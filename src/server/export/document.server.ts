import type { Client } from "@libsql/client";
import { type Block, recordedBlocks } from "#/components/points/blocks";
import { formatInstant, formatMeetingAt } from "../../meeting-time";
import { requireParent } from "../agendas.server";
import { BoardError } from "../boards.server";
import { listAttachments } from "../files/attachments.server";
import { pdfLogo } from "../files/board-images.server";
import type { Justering, ProtocolEdit } from "../items";
import {
	listEdits,
	listProtocolItems,
	publicValue,
	toProtocol,
} from "../protocols.server";
import { getJustering } from "../reviews.server";

// A closed protocol as a document to download (Markdown or PDF): the same
// content as the read-only protocol page, described once here.

export type { Block };

/** An attachment as the downloads name it: "Bilaga 2: Budget.pdf". */
export type DocumentAttachment = {
	id: string;
	number: number;
	name: string;
	contentType: string;
};

export type ProtocolDocument = {
	boardName: string;
	/** The board's logo as PNG, for the PDF's first page. */
	logo: Uint8Array | null;
	title: string;
	meetingAt: string;
	location: string;
	closedAt: string;
	points: {
		title: string;
		description: string;
		blocks: Block[];
		attachments: DocumentAttachment[];
	}[];
	/** Every attachment, numbered, in point order. */
	attachments: DocumentAttachment[];
	edits: ProtocolEdit[];
	justering: Justering | null;
};

async function buildDocument(
	db: Client,
	protocolId: string,
	boardName: string,
): Promise<ProtocolDocument> {
	const res = await db.execute({
		sql: "SELECT * FROM protocols WHERE id = ?",
		args: [protocolId],
	});
	const protocol = toProtocol(res.rows[0]);
	if (!protocol.closedAt)
		throw new BoardError("Protokollet kan laddas ner när det är stängt.");
	const [items, edits, justering, attachments, logo] = await Promise.all([
		listProtocolItems(db, protocolId),
		listEdits(db, protocolId),
		getJustering(db, protocolId),
		listAttachments(db, "protocol", protocolId),
		pdfLogo(db, protocol.boardId),
	]);
	const documentAttachments = attachments.map((a) => ({
		id: a.id,
		itemId: a.itemId,
		number: a.number,
		name: a.name,
		contentType: a.contentType,
	}));
	return {
		boardName,
		logo,
		title: protocol.title,
		meetingAt: protocol.meetingAt,
		location: protocol.location,
		closedAt: protocol.closedAt,
		points: items.map((item) => ({
			title: item.title,
			description: item.description,
			blocks: recordedBlocks({ ...item, value: publicValue(item.value) }),
			attachments: documentAttachments.filter((a) => a.itemId === item.id),
		})),
		attachments: documentAttachments,
		edits,
		justering,
	};
}

/** For a board member: their board's closed protocol. */
export async function documentForMember(
	db: Client,
	userId: string,
	protocolId: string,
): Promise<ProtocolDocument> {
	const { board } = await requireParent(db, userId, "protocol", protocolId);
	return buildDocument(db, protocolId, board.name);
}

/** Through the share link: anyone with it, once the protocol is closed. */
export async function documentForShare(
	db: Client,
	shareId: string,
): Promise<ProtocolDocument | null> {
	if (!shareId) return null;
	const res = await db.execute({
		sql: `SELECT p.id, b.name AS board_name FROM protocols p
          JOIN boards b ON b.id = p.board_id WHERE p.share_id = ?`,
		args: [shareId],
	});
	const row = res.rows[0];
	if (!row) return null;
	return buildDocument(db, String(row.id), String(row.board_name));
}

/** "Protokoll Styrelsemöte 2026-11-12", safe as a file name. */
export function fileName(doc: ProtocolDocument, extension: string): string {
	const date = doc.meetingAt.slice(0, 10) || doc.closedAt.slice(0, 10);
	const name = `Protokoll ${doc.title} ${date}`
		// Characters not allowed in file names, and control characters.
		.replace(/[\\/:*?"<>|]+/g, "")
		.replace(/\p{Cc}+/gu, "")
		.replace(/\s+/g, " ")
		.trim();
	return `${name}.${extension}`;
}

/** "Bilaga 2: Budget.pdf". */
export const attachmentLabel = (a: DocumentAttachment) =>
	`Bilaga ${a.number}: ${a.name}`;

/** Details shared by both formats. */
export function meetingLines(doc: ProtocolDocument) {
	return [
		...(doc.meetingAt
			? [{ label: "Tid", value: formatMeetingAt(doc.meetingAt) }]
			: []),
		...(doc.location ? [{ label: "Plats", value: doc.location }] : []),
	];
}

export function historyLines(doc: ProtocolDocument): string[] {
	return [
		`Protokollet stängdes ${formatInstant(doc.closedAt)}.`,
		...doc.edits.map(
			(e) => `Redigerat ${formatInstant(e.editedAt)} av ${e.userName}.`,
		),
	];
}
