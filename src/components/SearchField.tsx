import { useNavigate } from "@tanstack/react-router";
import { useId } from "react";
import { Icon } from "./Icon";

/**
 * Search through the protocols of one's boards: a field and a button,
 * leading to the results page. A plain GET form, so it works before the
 * page's scripts have loaded too.
 */
export function SearchField({
	defaultValue = "",
	className = "",
}: {
	defaultValue?: string;
	className?: string;
}) {
	const navigate = useNavigate();
	const id = useId();
	return (
		<search className={className}>
			<form
				action="/sok"
				method="get"
				className="flex items-stretch rounded-xl border border-glass-line bg-glass-strong shadow-2xs backdrop-blur-md focus-within:ring-3 focus-within:ring-accent/30"
				onSubmit={(e) => {
					e.preventDefault();
					const q = String(new FormData(e.currentTarget).get("q") ?? "").trim();
					navigate({ to: "/sok", search: { q } });
				}}
			>
				<label htmlFor={id} className="sr-only">
					Sök i protokollen
				</label>
				<input
					id={id}
					name="q"
					type="search"
					defaultValue={defaultValue}
					placeholder="Sök i protokollen"
					className="w-full min-w-0 rounded-l-xl bg-transparent px-4 py-2 text-lg text-ink outline-none placeholder:text-muted"
				/>
				<button
					type="submit"
					className="rounded-r-xl px-3 text-ink hover:bg-surface-muted active:bg-surface-muted"
				>
					<Icon name="search" className="size-5" />
					<span className="sr-only">Sök</span>
				</button>
			</form>
		</search>
	);
}
