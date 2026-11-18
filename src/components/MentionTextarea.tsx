import {
	type ComponentProps,
	createContext,
	useContext,
	useEffect,
	useId,
	useRef,
	useState,
} from "react";
import { calculate, formatResult } from "#/calc";
import { matchRefs, refText } from "#/protocol-refs";
import { textareaStyle, useFieldProps } from "./Field";
import { ProtocolRefs } from "./ProtocolRefs";

/** Someone who can be mentioned: inserted as `name`, listed as `label`. */
export type Mentionable = { name: string; label: string };

/** The people a MentionTextarea offers, provided once per page. */
export const MentionNames = createContext<Mentionable[]>([]);

/**
 * What a sign starts: @ a person, # another protocol, = a calculation
 * ("=20*90-2" becomes "1798").
 */
const SIGNS = ["@", "#", "="] as const;
type Sign = (typeof SIGNS)[number];
const LIST_LABEL: Record<Sign, string> = {
	"@": "Personer",
	"#": "Protokoll",
	"=": "Uträkning",
};

/** A choice in the list: what it shows, and the text it puts in. */
type Suggestion = { key: string; label: string; date?: string; insert: string };

/**
 * The "@query" (or "#query") right before the caret, if the caret is in
 * one: the sign at the start or after whitespace (so e-mail addresses don't
 * trigger it), then anything but a line break.
 */
export function findMention(value: string, caret: number, sign = "@") {
	const before = value.slice(0, caret);
	const at = before.lastIndexOf(sign);
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
 * A textarea where typing @ lists the board's people, and # its other
 * protocols, in a popover narrowed as more is typed; after = it offers the
 * result of the arithmetic typed so far. Arrow keys move, Enter
 * or Tab picks, Escape closes; picking replaces "@query" with the name, or
 * "#query" with the reference ("#Styrelsemöte 12-11-2026"). The popover is
 * placed just below the sign with inline styles.
 */
export function MentionTextarea(props: ComponentProps<"textarea">) {
	const people = useContext(MentionNames);
	const { refs } = useContext(ProtocolRefs);
	const textarea = useRef<HTMLTextAreaElement>(null);
	const list = useRef<HTMLDivElement>(null);
	const listId = useId();
	const [mention, setMention] = useState<{
		start: number;
		sign: Sign;
		matches: Suggestion[];
	} | null>(null);
	const [active, setActive] = useState(0);
	// Escape closes the list until a new @ is typed.
	const dismissedAt = useRef<number | null>(null);
	// What was typed last, so a new or changed query starts at the top.
	const lastQuery = useRef("");

	const open = mention !== null && mention.matches.length > 0;
	const optionId = (i: number) => `${listId}-${i}`;

	function update() {
		const el = textarea.current;
		if (!el) return;
		const caret = el.selectionStart;
		// The sign nearest the caret is the one being typed.
		let sign: Sign | null = null;
		let found: ReturnType<typeof findMention> = null;
		for (const s of SIGNS) {
			if (s === "#" && refs.length === 0) continue;
			const f = findMention(el.value, caret, s);
			if (f && (!found || f.start > found.start)) [sign, found] = [s, f];
		}
		if (!sign || !found || found.start === dismissedAt.current) {
			setMention(null);
			return;
		}
		dismissedAt.current = null;
		const matches = suggestions(sign, found.query);
		setMention({ start: found.start, sign, matches });
		const typed = `${sign}${found.start}:${found.query}`;
		if (typed !== lastQuery.current) setActive(0);
		else setActive((i) => (i < matches.length ? i : 0));
		lastQuery.current = typed;
	}

	function suggestions(sign: Sign, query: string): Suggestion[] {
		if (sign === "=") {
			const value = calculate(query);
			if (value === null) return [];
			const result = formatResult(value);
			return [
				{ key: "=", label: `${query.trim()} = ${result}`, insert: result },
			];
		}
		if (sign === "#")
			return matchRefs(refs, query).map((r) => ({
				key: r.id,
				label: r.title,
				date: r.date,
				insert: refText(r),
			}));
		return matchPeople(people, query).map((p) => ({
			key: p.label,
			label: p.label,
			insert: p.name,
		}));
	}

	function pick(choice: Suggestion) {
		const el = textarea.current;
		if (!el || !mention) return;
		const caret = el.selectionStart;
		const insert = `${choice.insert} `;
		el.value =
			el.value.slice(0, mention.start) + insert + el.value.slice(caret);
		const at = mention.start + insert.length;
		el.setSelectionRange(at, at);
		el.focus();
		setMention(null);
	}

	// Show or hide the popover to match, placed just below the @.
	const start = mention?.start;
	useEffect(() => {
		const popover = list.current;
		const el = textarea.current;
		if (!popover || !el) return;
		const shown = popover.matches(":popover-open");
		if (!open || start === undefined) {
			if (shown) popover.hidePopover();
			return;
		}
		if (!shown) popover.showPopover({ source: el });
		const place = () => placeAtCaret(popover, el, start);
		place();
		// Popovers are fixed to the viewport, so follow the page when it moves.
		window.addEventListener("scroll", place, true);
		window.addEventListener("resize", place);
		return () => {
			window.removeEventListener("scroll", place, true);
			window.removeEventListener("resize", place);
		};
	}, [open, start]);

	// Keep the chosen suggestion in sight when the list scrolls.
	useEffect(() => {
		if (!open) return;
		document
			.getElementById(optionId(active))
			?.scrollIntoView({ block: "nearest" });
	});

	return (
		<>
			<textarea
				className={textareaStyle} // the same as the regular text areas
				{...props}
				{...useFieldProps(props)}
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
				aria-label={LIST_LABEL[mention?.sign ?? "@"]}
				className="max-h-64 max-w-[min(24rem,calc(100vw-2rem))] overflow-y-auto rounded-xl border border-glass-line bg-glass-strong p-1.5 text-ink shadow-lg backdrop-blur-md"
			>
				{open &&
					mention.matches.map((choice, i) => (
						<div
							key={choice.key}
							id={optionId(i)}
							role="option"
							tabIndex={-1}
							aria-selected={i === active}
							className="cursor-pointer rounded-lg px-3 py-1.5 hover:bg-surface-muted aria-selected:bg-accent-strong aria-selected:text-on-accent"
							// Keep focus in the textarea while clicking.
							onMouseDown={(e) => {
								e.preventDefault();
								pick(choice);
							}}
						>
							{choice.label}
							{choice.date && (
								<>
									, <span className="whitespace-nowrap">{choice.date}</span>
								</>
							)}
						</div>
					))}
			</div>
			{/* Tells screen readers that the list opened, and how to use it. */}
			<output className="sr-only">
				{open
					? `${mention.matches.length} förslag. Välj med pil upp och ned, Enter för att infoga, Escape för att stänga.`
					: ""}
			</output>
		</>
	);
}

/** Puts the popover just below the given character of the textarea. */
function placeAtCaret(
	popover: HTMLElement,
	textarea: HTMLTextAreaElement,
	position: number,
) {
	const caret = caretCoordinates(textarea, position);
	const box = textarea.getBoundingClientRect();
	// Popovers are centred by default; place it by hand instead.
	popover.style.margin = "0";
	popover.style.inset = "auto";
	popover.style.top = `${box.top + caret.top - textarea.scrollTop + caret.height}px`;
	// At the sign, but moved left if it would stick out of the window. Its
	// full width is measured at the far left, where nothing squeezes it.
	popover.style.left = "0";
	const left = box.left + caret.left - textarea.scrollLeft;
	const room = document.documentElement.clientWidth - popover.offsetWidth - 8;
	popover.style.left = `${Math.max(8, Math.min(left, room))}px`;
}

// Styles that decide where text wraps and how big it is.
const MIRRORED = [
	"boxSizing",
	"width",
	"height",
	"overflowX",
	"overflowY",
	"borderTopWidth",
	"borderRightWidth",
	"borderBottomWidth",
	"borderLeftWidth",
	"paddingTop",
	"paddingRight",
	"paddingBottom",
	"paddingLeft",
	"fontStyle",
	"fontVariant",
	"fontWeight",
	"fontStretch",
	"fontSize",
	"lineHeight",
	"fontFamily",
	"textAlign",
	"textTransform",
	"textIndent",
	"letterSpacing",
	"wordSpacing",
	"tabSize",
	"direction",
] as const;

/**
 * Where a character is inside a textarea, relative to its border box.
 * Textareas don't tell, so the text up to it is laid out in a hidden copy
 * with the same styles, and a marker after it is measured.
 */
export function caretCoordinates(
	textarea: HTMLTextAreaElement,
	position: number,
) {
	const style = getComputedStyle(textarea);
	const mirror = document.createElement("div");
	for (const prop of MIRRORED) mirror.style[prop] = style[prop];
	mirror.style.position = "absolute";
	mirror.style.visibility = "hidden";
	mirror.style.top = "0";
	mirror.style.left = "-9999px";
	mirror.style.whiteSpace = "pre-wrap";
	mirror.style.overflowWrap = "break-word";
	mirror.textContent = textarea.value.slice(0, position);
	const marker = document.createElement("span");
	marker.textContent = textarea.value.slice(position) || ".";
	mirror.append(marker);
	document.body.append(mirror);
	const coordinates = {
		top: marker.offsetTop + Number.parseFloat(style.borderTopWidth),
		left: marker.offsetLeft + Number.parseFloat(style.borderLeftWidth),
		height:
			Number.parseFloat(style.lineHeight) ||
			Number.parseFloat(style.fontSize) * 1.2,
	};
	mirror.remove();
	return coordinates;
}
