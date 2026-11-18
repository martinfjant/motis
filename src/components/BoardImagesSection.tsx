import { useRouter } from "@tanstack/react-router";
import { useState } from "react";
import { removeBoardImage, uploadBoardImage } from "#/server/boards.functions";
import { Button } from "./Button";
import { useConfirm } from "./ConfirmDialog";
import { ErrorMessage } from "./ErrorMessage";
import { Field, Input } from "./Field";
import { Form } from "./Form";
import { Notice } from "./Notice";
import { Section } from "./Section";

const ACCEPT = "image/jpeg,image/png,image/webp";

/**
 * The board's logo (on its pages, protocols and PDFs) and banner picture
 * (behind the heading of its pages). Admins upload and remove them; the
 * server makes each picture anew, smaller and without metadata.
 */
export function BoardImagesSection({
	boardId,
	logo,
	banner,
	canEdit,
}: {
	boardId: string;
	logo: string | null;
	banner: string | null;
	canEdit: boolean;
}) {
	return (
		<Section id="images" title="Logotyp och bild">
			<ImageForm
				boardId={boardId}
				which="logo"
				label="Logotyp"
				definite="Logotypen"
				hint="Visas vid styrelsens namn, i protokollen och i PDF:erna. Helst kvadratisk, eller bredare än hög."
				current={logo}
				canEdit={canEdit}
			/>
			<ImageForm
				boardId={boardId}
				which="banner"
				label="Bild"
				definite="Bilden"
				hint="Visas bakom rubriken på styrelsens sidor, till exempel en bild på husen. Helst bred, minst 1600 bildpunkter."
				current={banner}
				canEdit={canEdit}
			/>
		</Section>
	);
}

function ImageForm({
	boardId,
	which,
	label,
	definite,
	hint,
	current,
	canEdit,
}: {
	boardId: string;
	which: "logo" | "banner";
	label: string;
	/** "Logotypen", "Bilden". */
	definite: string;
	hint: string;
	current: string | null;
	canEdit: boolean;
}) {
	const router = useRouter();
	const confirm = useConfirm();
	const [error, setError] = useState<string | null>(null);
	const [status, setStatus] = useState<string | null>(null);
	const [pending, setPending] = useState(false);
	const lower = label.toLowerCase();

	async function onSubmit(e: React.FormEvent<HTMLFormElement>) {
		e.preventDefault();
		if (pending) return;
		const form = e.currentTarget;
		const data = new FormData(form);
		data.set("boardId", boardId);
		data.set("which", which);
		setError(null);
		setStatus(null);
		setPending(true);
		try {
			await uploadBoardImage({ data });
			await router.invalidate();
			form.reset();
			setStatus(`${definite} är sparad.`);
		} catch (err) {
			setError(err instanceof Error ? err.message : "Något gick fel.");
		} finally {
			setPending(false);
		}
	}

	async function onRemove() {
		if (
			!(await confirm({
				title: `Ta bort ${lower}?`,
				confirmLabel: "Ta bort",
				confirmIcon: "trash-2",
			}))
		)
			return;
		setError(null);
		setStatus(null);
		try {
			await removeBoardImage({ data: { boardId, which } });
			await router.invalidate();
			setStatus(`${definite} är borttagen.`);
		} catch (err) {
			setError(err instanceof Error ? err.message : "Något gick fel.");
		}
	}

	return (
		<div className="space-y-2.5">
			<h3 className="text-xl font-bold">{label}</h3>
			{current ? (
				<img
					src={current}
					alt={`Nuvarande ${lower}`}
					className={
						which === "logo"
							? "max-h-24 w-auto rounded-lg bg-white/70 p-1"
							: "max-h-40 w-full rounded-lg object-cover"
					}
				/>
			) : (
				<p>Ingen {lower} vald.</p>
			)}
			{canEdit ? (
				<Form onSubmit={onSubmit}>
					<Field
						id={`${which}-file`}
						label={current ? `Byt ${lower}` : `Välj ${lower}`}
						hint={`${hint} JPEG, PNG eller WebP, högst 15 MB.`}
					>
						<Input name="file" type="file" accept={ACCEPT} required />
					</Field>
					<ErrorMessage error={error} />
					{status && <Notice>{status}</Notice>}
					<p>
						<Button icon="upload" type="submit" aria-busy={pending}>
							Ladda upp
						</Button>
						{current && (
							<Button icon="trash-2" type="button" onClick={onRemove}>
								Ta bort {lower}
							</Button>
						)}
					</p>
				</Form>
			) : (
				<p className="text-muted">Administratörer kan ändra {lower}.</p>
			)}
		</div>
	);
}
