import {
	type ComponentProps,
	createContext,
	useContext,
	useEffect,
	useId,
	useRef,
	useState,
} from "react";

/** Someone who can be mentioned: inserted as `name`, listed as `label`. */
export type Mentionable = { name: string; label: string };

/** The people a MentionTextarea offers, provided once per page. */
export const MentionNames = createContext<Mentionable[]>([]);

/**
 * The "@query" right before the caret, if the caret is in one: an @ at the
 * start or after whitespace (so e-mail addresses don't trigger it), then
 * anything but a line break.
 */
export function findMention(value: string, caret: number) {
	const before = value.slice(0, caret);
	const at = before.lastIndexOf("@");
	if (at === -1 || (at > 0 && !/\s/.test(before[at - 1]))) return null;
	const query = before.slice(at + 1);
	if (query.includes("\n") || query.length > 60) return null;
	return { start: at, query };
}

/** People whose name starts with the query, ignoring case. */
export function matchPeople(people: Mentionable[], query: string) {
	const q = query.toLocaleLowerCase("sv");
	return people.filter((p) => p.name.toLocaleLowerCase("sv").startsWith(q));
}

/**
 * A textarea where typing @ lists the board's people in a popover, narrowed
 * as more letters are typed. Arrow keys move, Enter or Tab picks, Escape
 * closes; picking replaces "@query" with the name. The popover is opened
 * with the textarea as its anchor, so it can be placed next to it with CSS
 * anchor positioning.
 */
export function MentionTextarea(props: ComponentProps<"textarea">) {
	const people = useContext(MentionNames);
	const textarea = useRef<HTMLTextAreaElement>(null);
	const list = useRef<HTMLDivElement>(null);
	const listId = useId();
	const [mention, setMention] = useState<{
		start: number;
		matches: Mentionable[];
	} | null>(null);
	const [active, setActive] = useState(0);
	// Escape closes the list until a new @ is typed.
	const dismissedAt = useRef<number | null>(null);

	const open = mention !== null && mention.matches.length > 0;
	const optionId = (i: number) => `${listId}-${i}`;

	function update() {
		const el = textarea.current;
		if (!el) return;
		const found = findMention(el.value, el.selectionStart);
		if (!found || found.start === dismissedAt.current) {
			setMention(null);
			return;
		}
		dismissedAt.current = null;
		const matches = matchPeople(people, found.query);
		setMention({ start: found.start, matches });
		setActive((i) => (i < matches.length ? i : 0));
	}

	function pick(person: Mentionable) {
		const el = textarea.current;
		if (!el || !mention) return;
		const caret = el.selectionStart;
		const insert = `${person.name} `;
		el.value =
			el.value.slice(0, mention.start) + insert + el.value.slice(caret);
		const at = mention.start + insert.length;
		el.setSelectionRange(at, at);
		el.focus();
		setMention(null);
	}

	// Show or hide the popover to match.
	useEffect(() => {
		const popover = list.current;
		if (!popover) return;
		const shown = popover.matches(":popover-open");
		if (open && !shown)
			popover.showPopover({ source: textarea.current ?? undefined });
		if (!open && shown) popover.hidePopover();
	}, [open]);

	return (
		<>
			<textarea
				{...props}
				ref={textarea}
				aria-autocomplete="list"
				aria-controls={listId}
				aria-activedescendant={open ? optionId(active) : undefined}
				onInput={(e) => {
					update();
					props.onInput?.(e);
				}}
				onClick={update}
				onBlur={(e) => {
					setMention(null);
					props.onBlur?.(e);
				}}
				onKeyDown={(e) => {
					if (open) {
						const n = mention.matches.length;
						if (e.key === "ArrowDown" || e.key === "ArrowUp") {
							e.preventDefault();
							setActive((i) => (i + (e.key === "ArrowDown" ? 1 : n - 1)) % n);
							return;
						}
						if (e.key === "Enter" || e.key === "Tab") {
							e.preventDefault();
							pick(mention.matches[active]);
							return;
						}
						if (e.key === "Escape") {
							e.preventDefault();
							dismissedAt.current = mention.start;
							setMention(null);
							return;
						}
					}
					props.onKeyDown?.(e);
				}}
				onKeyUp={(e) => {
					// Moving the caret sideways can enter or leave a mention.
					if (["ArrowLeft", "ArrowRight", "Home", "End"].includes(e.key))
						update();
					props.onKeyUp?.(e);
				}}
			/>
			{/* Focus stays in the textarea; aria-activedescendant points here. */}
			<div
				ref={list}
				id={listId}
				popover="manual"
				role="listbox"
				aria-label="Personer"
			>
				{open &&
					mention.matches.map((person, i) => (
						<div
							key={person.label}
							id={optionId(i)}
							role="option"
							tabIndex={-1}
							aria-selected={i === active}
							// Keep focus in the textarea while clicking.
							onMouseDown={(e) => {
								e.preventDefault();
								pick(person);
							}}
						>
							{person.label}
						</div>
					))}
			</div>
		</>
	);
}
