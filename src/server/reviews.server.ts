import { createHash, randomUUID } from "node:crypto";
import type { Client, Row } from "@libsql/client";
import { requireParent } from "./agendas.server";
import { BoardError } from "./boards.server";
import type {
	Justering,
	MemberRef,
	ProtocolItem,
	Review,
	ReviewRound,
	ReviewStatus,
} from "./items";
import { appUrl, MailError, sendMail } from "./mail/send.server";
import {
	reviewDecidedMail,
	reviewDoneMail,
	reviewRequestMail,
} from "./mail/templates.server";
import {
	listEdits,
	listProtocolItems,
	publicValue,
	toProtocol,
} from "./protocols.server";
import { cleanSignature } from "./signature.server";
import { checkToken, createToken } from "./tokens.server";

// Justering: a closed protocol is sent to the justerare chosen in it. Each
// gets a personal link where they read the protocol and approve or decline
// it. Sending again starts a new round, and only the latest round counts.

/** How long a justering link works. */
export const REVIEW_LINK_DAYS = 30;

const toReview = (r: Row): Review => ({
	id: String(r.id),
	name: String(r.name),
	email: String(r.email),
	status: r.status as ReviewStatus,
	comment: String(r.comment),
	decidedAt: r.decided_at == null ? null : String(r.decided_at),
	signature: r.signature == null ? null : String(r.signature),
});

function roundState(reviews: Review[]): ReviewStatus {
	if (reviews.some((r) => r.status === "declined")) return "declined";
	if (reviews.every((r) => r.status === "approved")) return "approved";
	return "pending";
}

/**
 * A fingerprint of everything the justerare read: the meeting details and
 * every point with what was recorded. Any change gives a new fingerprint.
 */
export async function protocolFingerprint(
	db: Client,
	protocolId: string,
): Promise<string> {
	const [protocol, items] = await Promise.all([
		db.execute({
			sql: "SELECT title, meeting_at, location FROM protocols WHERE id = ?",
			args: [protocolId],
		}),
		listProtocolItems(db, protocolId),
	]);
	const p = protocol.rows[0];
	const content = JSON.stringify({
		title: p?.title,
		meetingAt: p?.meeting_at,
		location: p?.location,
		items: items.map(({ title, description, type, value }) => ({
			title,
			description,
			type,
			value,
		})),
	});
	return createHash("sha256").update(content).digest("base64url");
}

async function latestRound(db: Client, protocolId: string) {
	const res = await db.execute({
		sql: `SELECT * FROM protocol_reviews WHERE protocol_id = ?
          AND round = (SELECT MAX(round) FROM protocol_reviews WHERE protocol_id = ?)
          ORDER BY rowid`,
		args: [protocolId, protocolId],
	});
	return res.rows;
}

/** The latest round, or null if the protocol has never been sent. */
export async function getReviewRound(
	db: Client,
	protocolId: string,
): Promise<ReviewRound | null> {
	const rows = await latestRound(db, protocolId);
	const first = rows[0];
	if (!first) return null;
	const reviews = rows.map(toReview);
	return {
		round: Number(first.round),
		sentAt: String(first.sent_at),
		sentByName: String(first.sent_by_name),
		reviews,
		state: roundState(reviews),
		changed:
			(await protocolFingerprint(db, protocolId)) !==
			String(first.content_hash),
	};
}

/**
 * Justerat: everyone in the latest round approved, and the protocol is
 * still exactly what they approved.
 */
export async function isJusterat(
	db: Client,
	protocolId: string,
): Promise<boolean> {
	const rows = await latestRound(db, protocolId);
	if (rows.length === 0 || rows.some((r) => r.status !== "approved"))
		return false;
	return (
		(await protocolFingerprint(db, protocolId)) === String(rows[0].content_hash)
	);
}

/** Who justerade the protocol and their signatures, or null if not justerat. */
export async function getJustering(
	db: Client,
	protocolId: string,
): Promise<Justering | null> {
	if (!(await isJusterat(db, protocolId))) return null;
	const rows = await latestRound(db, protocolId);
	return {
		reviewers: rows.map((r) => ({
			name: String(r.name),
			approvedAt: String(r.decided_at),
			signature: r.signature == null ? null : String(r.signature),
		})),
	};
}

/** The chosen justerare in the protocol, each once. */
function chosenReviewers(items: ProtocolItem[]) {
	const byMember = new Map<MemberRef, string>();
	for (const item of items) {
		if (item.type !== "reviewers" || item.value.tabled) continue;
		for (const r of item.value.reviewers ?? [])
			if (r.member && !byMember.has(r.member)) byMember.set(r.member, r.name);
	}
	return [...byMember].map(([member, name]) => ({ member, name }));
}

/**
 * Where the justerare gets the protocol, and their plain name for the
 * greeting; null if they have no address or have left the board.
 */
async function memberContact(
	db: Client,
	boardId: string,
	member: MemberRef,
): Promise<{ email: string; name: string } | null> {
	const [kind, id] = member.split(/:(.*)/s);
	const res =
		kind === "user"
			? await db.execute({
					sql: `SELECT u.email, u.name FROM users u
                JOIN board_memberships m ON m.user_id = u.id AND m.board_id = ?
                WHERE u.id = ?`,
					args: [boardId, id],
				})
			: await db.execute({
					sql: "SELECT email, name FROM board_unregistered_members WHERE board_id = ? AND id = ?",
					args: [boardId, id],
				});
	const row = res.rows[0];
	return row?.email
		? { email: String(row.email), name: String(row.name) }
		: null;
}

/**
 * "Skicka för justering": emails each justerare a personal link to the
 * closed protocol. Sending again starts a new round, which replaces the
 * earlier links and answers; that is refused when it would change nothing
 * (already approved, or declined and not edited since).
 */
export async function sendForReview(
	db: Client,
	userId: string,
	protocolId: string,
	now = new Date(),
): Promise<void> {
	const { row, board } = await requireParent(
		db,
		userId,
		"protocol",
		protocolId,
	);
	const protocol = toProtocol(row);
	if (!protocol.closedAt)
		throw new BoardError("Stäng protokollet innan det skickas för justering.");

	const reviewers = chosenReviewers(await listProtocolItems(db, protocolId));
	if (reviewers.length === 0)
		throw new BoardError(
			"Välj justerare under punkten Val av justerare först.",
		);
	const withEmail = await Promise.all(
		reviewers.map(async (r) => ({
			...r,
			contact: await memberContact(db, board.id, r.member),
		})),
	);
	const missing = withEmail.filter((r) => !r.contact).map((r) => r.name);
	if (missing.length > 0)
		throw new BoardError(
			`${missing.join(" och ")} saknar e-postadress. Lägg till den under Inställningar, eller välj en annan justerare.`,
		);

	const current = await getReviewRound(db, protocolId);
	if (current && !current.changed && current.state === "approved")
		throw new BoardError("Protokollet är redan justerat.");
	if (current && !current.changed && current.state === "declined")
		throw new BoardError(
			"Protokollet har inte ändrats sedan det avvisades. Redigera det först.",
		);

	const sender = await db.execute({
		sql: "SELECT name, email FROM users WHERE id = ?",
		args: [userId],
	});
	const senderName = String(sender.rows[0]?.name ?? "");
	const senderEmail = String(sender.rows[0]?.email ?? "");
	const round = (current?.round ?? 0) + 1;
	const contentHash = await protocolFingerprint(db, protocolId);
	const sends = withEmail.flatMap(({ contact, ...r }) =>
		contact
			? [
					{
						...r,
						email: contact.email,
						plainName: contact.name,
						id: randomUUID(),
					},
				]
			: [],
	);
	await db.batch(
		sends.map((r) => ({
			sql: `INSERT INTO protocol_reviews
              (id, protocol_id, round, member, name, email, content_hash, sent_at, sent_by, sent_by_name)
            VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
			args: [
				r.id,
				protocolId,
				round,
				r.member,
				r.name,
				r.email,
				contentHash,
				now.toISOString(),
				userId,
				senderName,
			],
		})),
		"write",
	);
	const failed: string[] = [];
	let failure: MailError | undefined;
	for (const r of sends) {
		const token = await createToken(
			db,
			{
				purpose: "review",
				subjectId: r.id,
				email: r.email,
				minutes: REVIEW_LINK_DAYS * 24 * 60,
			},
			now,
		);
		try {
			await sendMail(
				db,
				reviewRequestMail({
					to: r.email,
					// Questions about the minutes go to whoever sent them.
					replyTo: senderEmail || undefined,
					name: r.plainName,
					senderName,
					boardName: board.name,
					protocol,
					url: appUrl(`/justera/${token}`),
					days: REVIEW_LINK_DAYS,
				}),
			);
		} catch (err) {
			if (!(err instanceof MailError)) throw err;
			failed.push(r.name);
			failure = err;
		}
	}
	// The round is sent; whoever didn't get the email gets it on sending again.
	if (failure)
		throw new BoardError(
			`Mejlet kom inte fram till ${failed.join(" och ")}. ${failure.message} Skicka för justering igen för att försöka på nytt.`,
		);
}

/** The review a link is for, with its protocol and round. */
async function reviewForToken(db: Client, token: string, now: Date) {
	const info = await checkToken(db, "review", token, now);
	if (!info) return null;
	const res = await db.execute({
		sql: `SELECT r.*, p.board_id, b.name AS board_name, b.background AS board_background
          FROM protocol_reviews r
          JOIN protocols p ON p.id = r.protocol_id
          JOIN boards b ON b.id = p.board_id
          WHERE r.id = ?`,
		args: [info.subjectId],
	});
	const row = res.rows[0];
	if (!row) return null;
	const protocolId = String(row.protocol_id);
	const round = await getReviewRound(db, protocolId);
	return {
		row,
		review: toReview(row),
		protocolId,
		board: {
			name: String(row.board_name),
			background: String(row.board_background),
		},
		round,
		/** A later sending has replaced this one. */
		replaced: Number(row.round) !== round?.round,
	};
}

/**
 * The justerare's page: the protocol read-only, their own answer and how
 * the others have answered. Null if the link is wrong or has expired.
 */
export async function getReviewPage(
	db: Client,
	token: string,
	now = new Date(),
) {
	const found = await reviewForToken(db, token, now);
	if (!found) return null;
	const { review, protocolId, board, round, replaced } = found;
	const [protocolRow, items, edits] = await Promise.all([
		db.execute({
			sql: "SELECT * FROM protocols WHERE id = ?",
			args: [protocolId],
		}),
		listProtocolItems(db, protocolId),
		listEdits(db, protocolId),
	]);
	const protocol = toProtocol(protocolRow.rows[0]);
	return {
		board,
		protocol: {
			title: protocol.title,
			meetingAt: protocol.meetingAt,
			location: protocol.location,
			closedAt: protocol.closedAt,
		},
		items: items.map(({ id, title, description, type, value }) => ({
			id,
			title,
			description,
			type,
			value: publicValue(value),
		})),
		edits,
		review: {
			name: review.name,
			status: review.status,
			comment: review.comment,
			decidedAt: review.decidedAt,
		},
		sentByName: String(found.row.sent_by_name),
		/** Once everyone has approved: who, with signatures. */
		justering: replaced ? null : await getJustering(db, protocolId),
		replaced,
		/** Changed since this link was sent: answering waits for a new sending. */
		changed: !replaced && !!round?.changed,
		others: replaced
			? []
			: (round?.reviews ?? [])
					.filter((r) => r.id !== review.id)
					.map((r) => ({ name: r.name, status: r.status })),
	};
}

/**
 * The justerare's answer. Approving needs their drawn signature; declining
 * needs a comment saying what is wrong.
 * Only the latest sending can be answered, once, and only while the
 * protocol is as it was sent. The sender hears about a decline, and about
 * the protocol being fully approved.
 */
export async function decideReview(
	db: Client,
	token: string,
	input: { approve: boolean; comment: string; signature?: string },
	now = new Date(),
): Promise<void> {
	const found = await reviewForToken(db, token, now);
	if (!found) throw new BoardError("Länken fungerar inte längre.");
	if (found.replaced)
		throw new BoardError(
			"Protokollet har skickats på nytt. Använd länken i det senaste mejlet.",
		);
	if (found.round?.changed)
		throw new BoardError(
			"Protokollet har ändrats sedan det skickades. Du får ett nytt mejl när det skickas igen.",
		);
	const comment = input.comment.trim();
	if (!input.approve && !comment)
		throw new BoardError("Skriv vad som behöver ändras.");
	// Approving is signing: the drawn signature is required.
	const signature = input.approve
		? cleanSignature(input.signature ?? "")
		: null;

	const res = await db.execute({
		sql: `UPDATE protocol_reviews SET status = ?, comment = ?, decided_at = ?, signature = ?
          WHERE id = ? AND status = 'pending'`,
		args: [
			input.approve ? "approved" : "declined",
			input.approve ? "" : comment,
			now.toISOString(),
			signature,
			found.review.id,
		],
	});
	if (res.rowsAffected === 0)
		throw new BoardError("Du har redan svarat på det här utskicket.");

	// Tell the sender, if they still have an account. The answer is saved
	// either way, so a failed email is only logged.
	try {
		await notifySender(db, found, input.approve, comment);
	} catch (err) {
		if (!(err instanceof MailError)) throw err;
		console.error("Justering notice not sent:", err.message);
	}
}

async function notifySender(
	db: Client,
	found: NonNullable<Awaited<ReturnType<typeof reviewForToken>>>,
	approve: boolean,
	comment: string,
) {
	const senderId = found.row.sent_by;
	if (senderId == null) return;
	const sender = await db.execute({
		sql: "SELECT email, name FROM users WHERE id = ?",
		args: [senderId],
	});
	const to = sender.rows[0];
	if (!to) return;
	const protocolRow = await db.execute({
		sql: "SELECT * FROM protocols WHERE id = ?",
		args: [found.protocolId],
	});
	const protocol = toProtocol(protocolRow.rows[0]);
	const url = appUrl(`/styrelser/${protocol.boardId}/protokoll/${protocol.id}`);
	const mail = {
		to: String(to.email),
		boardName: found.board.name,
		protocol,
		url,
	};
	if (!approve) {
		await sendMail(
			db,
			reviewDecidedMail({ ...mail, reviewerName: found.review.name, comment }),
		);
		return;
	}
	const round = await getReviewRound(db, found.protocolId);
	if (round?.state === "approved")
		await sendMail(
			db,
			reviewDoneMail({ ...mail, reviewers: round.reviews.map((r) => r.name) }),
		);
}
