import { useRouterState } from "@tanstack/react-router";
import { useEffect, useRef } from "react";
import { Button } from "./Button";
import { Icon } from "./Icon";
import { LinkButton } from "./LinkButton";

/** Full width (without the usual gap after a button), text on the left. */
const MENU_BUTTON = "w-full mr-0! text-left";
const MENU_ID = "user-menu";

/**
 * The logged-in user's name with an icon; clicking it opens a menu with
 * Mina föreningar, Mitt konto and Logga ut. The menu is a popover: the browser
 * opens and closes it, also on Escape or a click outside. It is placed under
 * the name with CSS anchor positioning.
 */
export function UserMenu({
	name,
	onLogOut,
}: {
	name: string;
	onLogOut: (e: React.FormEvent) => void;
}) {
	// Following a link doesn't reload the page, so close the menu when the
	// page changes (logging out goes to the start page too).
	const menu = useRef<HTMLDivElement>(null);
	const path = useRouterState({ select: (s) => s.location.pathname });
	useEffect(() => {
		if (path && menu.current?.matches(":popover-open"))
			menu.current.hidePopover();
	}, [path]);

	return (
		<>
			<button
				type="button"
				popoverTarget={MENU_ID}
				className="flex w-full items-center gap-2 rounded-xl px-3 whitespace-nowrap sm:px-5 [anchor-name:--user-menu] hover:bg-surface-muted"
			>
				<Icon name="user" className="size-5" />
				{name}
			</button>
			<div
				id={MENU_ID}
				ref={menu}
				popover="auto"
				className="m-0 mt-2 rounded-xl border border-glass-line bg-glass-strong p-3 text-ink shadow-lg backdrop-blur-md [position-anchor:--user-menu] [position-area:bottom_span-left] [inset:auto]"
			>
				{/* The buttons all as wide as the widest, text lined up on the left. */}
				<ul className="flex flex-col gap-2">
					<li>
						<LinkButton icon="home" to="/" className={MENU_BUTTON}>
							Mina föreningar
						</LinkButton>
					</li>
					{/* The header's search field is hidden on small screens. */}
					<li className="md:hidden">
						<LinkButton
							icon="search"
							to="/sok"
							search={{ q: "" }}
							className={MENU_BUTTON}
						>
							Sök
						</LinkButton>
					</li>
					<li>
						<LinkButton icon="user" to="/konto" className={MENU_BUTTON}>
							Mitt konto
						</LinkButton>
					</li>
					<li>
						<form onSubmit={onLogOut}>
							<Button icon="log-out" type="submit" className={MENU_BUTTON}>
								Logga ut
							</Button>
						</form>
					</li>
				</ul>
			</div>
		</>
	);
}
