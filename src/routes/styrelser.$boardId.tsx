import { createFileRoute, Outlet, redirect } from "@tanstack/react-router";

// Everything about a board needs a logged-in user.
export const Route = createFileRoute("/styrelser/$boardId")({
	beforeLoad: ({ context }) => {
		if (!context.user) throw redirect({ to: "/logga-in" });
	},
	component: () => <Outlet />,
});
