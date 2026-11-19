import { createServerFn } from "@tanstack/react-start";

// Attachments ("Bilaga 1"…) on the points of agendas and protocols. Files
// come as form data; see files/attachments.server.ts for the rules.

const str = (v: unknown) => (typeof v === "string" ? v : "");
const obj = (d: unknown) => (d ?? {}) as Record<string, unknown>;

type Kind = "agenda" | "protocol";
function kindOf(v: unknown): Kind {
	if (v !== "agenda" && v !== "protocol") throw new Error("Ogiltig sort.");
	return v;
}

/** An uploaded file from form data. */
function fileOf(form: FormData): File {
	const file = form.get("file");
	if (!(file instanceof File) || file.size === 0)
		throw new Error("Välj en fil.");
	return file;
}

async function ctx() {
	const { requireUser } = await import("./session.server");
	const attachments = await import("./files/attachments.server");
	return { ...(await requireUser()), attachments };
}

async function read(file: File) {
	const { BoardError } = await import("./boards.server");
	const { MAX_ATTACHMENT_BYTES } = await import("./files/attachments.server");
	if (file.size > MAX_ATTACHMENT_BYTES)
		throw new BoardError(`${file.name} är för stor (högst 20 MB).`);
	return { name: file.name, data: new Uint8Array(await file.arrayBuffer()) };
}

/** Form data: kind, itemId, file, and editSession for protocols. */
export const addAttachment = createServerFn({ method: "POST" })
	.validator((d: unknown) => {
		if (!(d instanceof FormData)) throw new Error("Ogiltig uppladdning.");
		return {
			kind: kindOf(d.get("kind")),
			itemId: str(d.get("itemId")),
			editSession: str(d.get("editSession")) || undefined,
			file: fileOf(d),
		};
	})
	.handler(async ({ data }) => {
		const { db, user, attachments } = await ctx();
		await attachments.addAttachment(
			db,
			user.id,
			data.kind,
			data.itemId,
			await read(data.file),
			data.editSession,
		);
	});

/** Form data: kind, attachmentId, file, and editSession for protocols. */
export const replaceAttachment = createServerFn({ method: "POST" })
	.validator((d: unknown) => {
		if (!(d instanceof FormData)) throw new Error("Ogiltig uppladdning.");
		return {
			kind: kindOf(d.get("kind")),
			attachmentId: str(d.get("attachmentId")),
			editSession: str(d.get("editSession")) || undefined,
			file: fileOf(d),
		};
	})
	.handler(async ({ data }) => {
		const { db, user, attachments } = await ctx();
		await attachments.replaceAttachment(
			db,
			user.id,
			data.kind,
			data.attachmentId,
			await read(data.file),
			data.editSession,
		);
	});

export const deleteAttachment = createServerFn({ method: "POST" })
	.validator((d: unknown) => ({
		kind: kindOf(obj(d).kind),
		attachmentId: str(obj(d).attachmentId),
		editSession: str(obj(d).editSession) || undefined,
	}))
	.handler(async ({ data }) => {
		const { db, user, attachments } = await ctx();
		await attachments.deleteAttachment(
			db,
			user.id,
			data.kind,
			data.attachmentId,
			data.editSession,
		);
	});
