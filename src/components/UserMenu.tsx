import { useRouterState } from "@tanstack/react-router";
import { useEffect, useRef } from "react";
import { Button } from "./Button";
import { UserIcon } from "./IconButton";
import { LinkButton } from "./LinkButton";

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
				className="inline-flex items-center gap-2 rounded-lg px-2 py-1 [anchor-name:--user-menu] hover:bg-stone-100"
			>
				<UserIcon />
				{name}
			</button>
			<div
				id={MENU_ID}
				ref={menu}
				popover="auto"
				className="m-0 mt-2 rounded-xl bg-white p-3 shadow-lg [position-anchor:--user-menu] [position-area:bottom_span-left] [inset:auto]"
			>
				<ul className="flex flex-col gap-2">
					<li>
						<LinkButton to="/">Mina föreningar</LinkButton>
					</li>
					<li>
						<LinkButton to="/konto">Mitt konto</LinkButton>
					</li>
					<li>
						<form onSubmit={onLogOut}>
							<Button type="submit">Logga ut</Button>
						</form>
					</li>
				</ul>
			</div>
		</>
	);
}
