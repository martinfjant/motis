import { createFileRoute, Outlet, redirect } from "@tanstack/react-router";

export const Route = createFileRoute("/styrelser")({
	beforeLoad: ({ context }) => {
		if (!context.user) throw redirect({ to: "/logga-in" });
	},
	component: () => <Outlet />,
});
