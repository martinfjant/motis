import { useRouter } from "@tanstack/react-router";
import {
	createContext,
	type ReactNode,
	useContext,
	useId,
	useRef,
	useState,
} from "react";
import {
	addAttachment,
	deleteAttachment,
	replaceAttachment,
} from "#/server/attachments.functions";
import type { Attachment } from "#/server/files/attachments.server";
import { Button } from "./Button";
import { useConfirm } from "./ConfirmDialog";
import { dialogStyle } from "./Dialog";
import { ErrorMessage } from "./ErrorMessage";
import { Icon } from "./Icon";
import { IconButton } from "./IconButton";
import { AnchorButton } from "./LinkButton";

// Files attached to points: "Bilaga 1", "Bilaga 2"… A page provides its
// meeting's attachments once (AttachmentsProvider); each point lists its
// own, and "Bilaga N" in texts opens the file in a dialog, so nobody has to
// leave the page to read it.

export type { Attachment };

type Context = {
	attachments: Attachment[];
	/** Where the files are read: "/api/bilagor", or through a share link. */
	base: string;
	/** Set where attachments may be changed. */
	edit?: { kind: "agenda" | "protocol"; editSession?: string };
	open: (attachment: Attachment) => void;
};

const Attachments = createContext<Context>({
	attachments: [],
	base: "/api/bilagor",
	open: () => {},
});

export const useAttachments = () => useContext(Attachments);

/** "Bilaga 3: Budget.pdf". */
export const attachmentTitle = (a: Attachment) =>
	`Bilaga ${a.number}: ${a.name}`;

/**
 * Provides a page's attachments, and the dialog they open in. `base` is
 * where the files are read; `edit` turns on adding, replacing and removing.
 */
export function AttachmentsProvider({
	attachments,
	base,
	edit,
	children,
}: {
	attachments: Attachment[];
	base: string;
	edit?: Context["edit"];
	children: ReactNode;
}) {
	const dialog = useRef<HTMLDialogElement>(null);
	const [shown, setShown] = useState<Attachment | null>(null);
	const headingId = useId();
	const open = (attachment: Attachment) => {
		setShown(attachment);
		dialog.current?.showModal();
	};
	const url = shown && `${base}/${shown.id}`;
	return (
		<Attachments.Provider value={{ attachments, base, edit, open }}>
			{children}
			<dialog
				ref={dialog}
				aria-labelledby={headingId}
				className={`${dialogStyle} max-w-5xl`}
				onClose={() => setShown(null)}
			>
				{shown && url && (
					<>
						<div className="flex items-start justify-between gap-4">
							<h2 id={headingId} className="text-2xl break-words">
								{attachmentTitle(shown)}
							</h2>
							<IconButton
								icon="x"
								label="Stäng"
								onClick={() => dialog.current?.close()}
							/>
						</div>
						{shown.contentType === "application/pdf" ? (
							<iframe
								src={url}
								title={attachmentTitle(shown)}
								className="h-[60dvh] w-full rounded-lg border border-line bg-white"
							/>
						) : (
							<img
								src={url}
								alt={attachmentTitle(shown)}
								className="mx-auto max-h-[60dvh] w-auto rounded-lg"
							/>
						)}
						<p>
							{/* Phones show only part of a PDF in a frame: the whole file. */}
							<AnchorButton
								href={url}
								target="_blank"
								rel="noopener"
								icon="external-link"
							>
								Öppna i ny flik
							</AnchorButton>
							<AnchorButton href={`${url}?ladda-ner`} download icon="download">
								Ladda ner
							</AnchorButton>
						</p>
					</>
				)}
			</dialog>
		</Attachments.Provider>
	);
}

/** "PDF, 1,2 MB". */
function describe(a: Attachment) {
	const kind = a.contentType === "application/pdf" ? "PDF" : "bild";
	const size =
		a.size >= 1_000_000
			? `${(a.size / 1_000_000).toLocaleString("sv-SE", { maximumFractionDigits: 1 })} MB`
			: `${Math.max(1, Math.round(a.size / 1000))} kB`;
	return `${kind}, ${size}`;
}

/** Opens an attachment in the dialog; looks like a link. */
export function AttachmentLink({
	attachment,
	children,
}: {
	attachment: Attachment;
	children: ReactNode;
}) {
	const { open } = useAttachments();
	return (
		<button
			type="button"
			className="cursor-pointer text-left text-link underline underline-offset-2 hover:text-link-hover"
			onClick={() => open(attachment)}
			aria-haspopup="dialog"
		>
			{children}
		</button>
	);
}

/**
 * A point's attachments: a list to open them from, and where the page
 * allows it, buttons to add, replace and remove them.
 */
export function PointAttachments({ itemId }: { itemId: string }) {
	const { attachments, edit } = useAttachments();
	const own = attachments.filter((a) => a.itemId === itemId);
	if (edit) return <AttachmentEditor itemId={itemId} own={own} edit={edit} />;
	if (own.length === 0) return null;
	return (
		<div className="pt-2">
			<h4 className="font-semibold">Bilagor</h4>
			<ul className="list-none space-y-1">
				{own.map((a) => (
					<li key={a.id} className="flex items-center gap-2">
						<Icon name="paperclip" className="size-4 shrink-0 text-muted" />
						<AttachmentLink attachment={a}>{attachmentTitle(a)}</AttachmentLink>
						<span className="text-sm text-muted">({describe(a)})</span>
					</li>
				))}
			</ul>
		</div>
	);
}

const ACCEPT = "application/pdf,image/jpeg,image/png,image/webp";

function AttachmentEditor({
	itemId,
	own,
	edit,
}: {
	itemId: string;
	own: Attachment[];
	edit: NonNullable<Context["edit"]>;
}) {
	const router = useRouter();
	const confirm = useConfirm();
	const [error, setError] = useState<string | null>(null);
	const [status, setStatus] = useState<string | null>(null);
	const [pending, setPending] = useState(false);
	const addInput = useRef<HTMLInputElement>(null);
	const replaceInput = useRef<HTMLInputElement>(null);
	const replacing = useRef<Attachment | null>(null);

	function form(file: File, extra: Record<string, string>) {
		const data = new FormData();
		data.set("kind", edit.kind);
		if (edit.editSession) data.set("editSession", edit.editSession);
		for (const [k, v] of Object.entries(extra)) data.set(k, v);
		data.set("file", file);
		return data;
	}

	async function run(action: () => Promise<string>) {
		setError(null);
		setStatus(null);
		setPending(true);
		try {
			setStatus(await action());
			await router.invalidate();
		} catch (err) {
			setError(err instanceof Error ? err.message : "Något gick fel.");
			await router.invalidate();
		} finally {
			setPending(false);
		}
	}

	async function onAdd(files: FileList | null) {
		if (!files || files.length === 0) return;
		const list = [...files];
		await run(async () => {
			// One at a time, in the order chosen, so they're numbered that way.
			for (const file of list)
				await addAttachment({ data: form(file, { itemId }) });
			return list.length === 1
				? `${list[0].name} är tillagd.`
				: `${list.length} bilagor är tillagda.`;
		});
	}

	async function onReplace(files: FileList | null) {
		const attachment = replacing.current;
		const file = files?.[0];
		if (!attachment || !file) return;
		await run(async () => {
			await replaceAttachment({
				data: form(file, { attachmentId: attachment.id }),
			});
			return `Bilaga ${attachment.number} är utbytt mot ${file.name}.`;
		});
	}

	async function onDelete(attachment: Attachment) {
		if (
			!(await confirm({
				title: `Ta bort ${attachmentTitle(attachment)}?`,
				message:
					"Bilagorna efter den numreras om, och hänvisningar i texterna följer med.",
				confirmLabel: "Ta bort",
				confirmIcon: "trash-2",
			}))
		)
			return;
		await run(async () => {
			await deleteAttachment({
				data: {
					kind: edit.kind,
					attachmentId: attachment.id,
					editSession: edit.editSession,
				},
			});
			return `${attachment.name} är borttagen.`;
		});
	}

	return (
		<div className="space-y-1.5 pt-2">
			<h4 className="font-semibold">Bilagor</h4>
			{own.length > 0 && (
				<ul className="list-none space-y-1">
					{own.map((a) => (
						<li key={a.id} className="flex flex-wrap items-center gap-x-2">
							<Icon name="paperclip" className="size-4 shrink-0 text-muted" />
							<AttachmentLink attachment={a}>
								{attachmentTitle(a)}
							</AttachmentLink>
							<span className="text-sm text-muted">({describe(a)})</span>
							<IconButton
								icon="upload"
								label={`Byt ut ${attachmentTitle(a)}`}
								onClick={() => {
									replacing.current = a;
									replaceInput.current?.click();
								}}
							/>
							<IconButton
								icon="trash-2"
								label={`Ta bort ${attachmentTitle(a)}`}
								onClick={() => onDelete(a)}
							/>
						</li>
					))}
				</ul>
			)}
			<p>
				<Button
					icon="paperclip"
					type="button"
					aria-busy={pending}
					onClick={() => !pending && addInput.current?.click()}
				>
					Lägg till bilaga
				</Button>
			</p>
			<p className="text-sm text-muted">
				PDF eller bild (JPEG, PNG, WebP), högst 20 MB.
			</p>
			{/* Chosen through the buttons above; not reachable on their own. */}
			<input
				ref={addInput}
				type="file"
				accept={ACCEPT}
				multiple
				hidden
				onChange={(e) => {
					onAdd(e.currentTarget.files);
					e.currentTarget.value = "";
				}}
			/>
			<input
				ref={replaceInput}
				type="file"
				accept={ACCEPT}
				hidden
				onChange={(e) => {
					onReplace(e.currentTarget.files);
					e.currentTarget.value = "";
				}}
			/>
			<ErrorMessage error={error} />
			{/* Read out when a change is done. */}
			<output className="block text-sm">{status}</output>
		</div>
	);
}
