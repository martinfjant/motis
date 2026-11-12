import { createClient } from "@libsql/client";
import { afterEach, beforeEach, expect, test, vi } from "vitest";
import { createAgenda, listTemplates } from "./agendas.server";
import { createUser } from "./auth.server";
import {
	addMember,
	addMemberByEmail,
	BoardError,
	createBoard,
} from "./boards.server";
import { getCallStatus, sendCall } from "./calls.server";
import { listOutbox } from "./mail/send.server";
import { migrate } from "./migrate";
import { createProtocol } from "./protocols.server";

let db: ReturnType<typeof createClient>;
let anna: string, bo: string, boardId: string, agendaId: string;
let shareId: string;

const mk = async (name: string) =>
	(
		await createUser(db, {
			name,
			email: `${name}@example.se`,
			password: "hemligt123",
		})
	).id;

beforeEach(() => {
	vi.useFakeTimers({ toFake: ["Date"] });
	vi.setSystemTime(new Date("2026-11-20T09:00:00Z"));
});
afterEach(() => {
	vi.useRealTimers();
	vi.unstubAllEnvs();
	vi.unstubAllGlobals();
	vi.restoreAllMocks();
});

beforeEach(async () => {
	db = createClient({ url: ":memory:" });
	await migrate(db);
	anna = await mk("anna");
	bo = await mk("bo");
	boardId = (await createBoard(db, anna, "BRF Björken")).id;
	await addMemberByEmail(db, anna, boardId, "bo@example.se");
	await addMember(db, anna, boardId, {
		name: "Dora",
		email: "dora@example.se",
		title: "Kassör",
	});
	await addMember(db, anna, boardId, { name: "Eva", email: "", title: "" });
	const [tpl] = await listTemplates(db, anna, boardId);
	const agenda = await createAgenda(db, anna, boardId, {
		title: "Styrelsemöte",
		meetingAt: "2026-11-20T18:00",
		location: "Lokalen",
		templateId: tpl.id,
	});
	agendaId = agenda.id;
	shareId = agenda.shareId;
});

test("the kallelse goes to everyone on the board with an address", async () => {
	expect(await getCallStatus(db, bo, agendaId)).toEqual({
		recipients: [
			{ name: "anna", email: "anna@example.se" },
			{ name: "bo", email: "bo@example.se" },
			{ name: "Dora (Kassör)", email: "dora@example.se" },
		],
		missing: ["Eva"],
		sent: [],
	});

	await sendCall(db, bo, agendaId);
	const mails = await listOutbox(db);
	expect(mails.map((m) => m.to).sort()).toEqual([
		"anna@example.se",
		"bo@example.se",
		"dora@example.se",
	]);
	const [mail] = mails;
	expect(mail.subject).toBe(
		"Kallelse: Styrelsemöte 20-11-2026 18:00 – BRF Björken",
	);
	expect(mail.text).toContain("bo kallar till möte i BRF Björken.");
	expect(mail.text).toContain("Tid: 20-11-2026 18:00");
	expect(mail.text).toContain("Plats: Lokalen");
	expect(mail.text).toContain("1. Mötets öppnande");
	expect(mail.text).toContain(`http://localhost:3000/dagordning/${shareId}`);
	expect(mail.html).toContain(
		`href="http://localhost:3000/dagordning/${shareId}"`,
	);

	const status = await getCallStatus(db, anna, agendaId);
	expect(status.sent).toEqual([
		{
			sentAt: "2026-11-20T09:00:00.000Z",
			sentByName: "bo",
			recipients: status.recipients,
		},
	]);
});

test("no kallelse once the meeting has started, or from outside the board", async () => {
	const cia = await mk("cia");
	await expect(sendCall(db, cia, agendaId)).rejects.toThrow(BoardError);
	await createProtocol(db, anna, agendaId);
	await expect(sendCall(db, anna, agendaId)).rejects.toThrow(/redan startat/);
	expect(await listOutbox(db)).toEqual([]);
});

test("if some emails fail, the others still go out and are recorded", async () => {
	vi.stubEnv("RESEND_API_KEY", "re_test");
	vi.stubEnv("MAIL_FROM", "noreply@mail.example.se");
	vi.stubEnv("DEV_MAIL_TO", "jag@example.se");
	vi.spyOn(console, "error").mockImplementation(() => {});
	const subjects: string[] = [];
	// Resend refuses the email meant for Dora.
	vi.stubGlobal(
		"fetch",
		vi.fn(async (_url: string, init: RequestInit) => {
			const body = JSON.parse(String(init.body));
			subjects.push(body.subject);
			expect(body.reply_to).toBe("bo@example.se");
			return body.subject.includes("dora@")
				? Response.json({ name: "validation_error" }, { status: 422 })
				: Response.json({ id: "x" });
		}),
	);
	await expect(sendCall(db, bo, agendaId)).rejects.toThrow(
		/kom inte fram till Dora \(Kassör\)/,
	);
	expect(subjects).toHaveLength(3);
	const { sent } = await getCallStatus(db, anna, agendaId);
	expect(sent[0].recipients.map((r) => r.email)).toEqual([
		"anna@example.se",
		"bo@example.se",
	]);
});
