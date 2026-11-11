import { createFileRoute, Link, useRouter } from "@tanstack/react-router";
import { useState } from "react";
import { daysUntilText, formatMeetingAt } from "#/meeting-time";
import { getUpcomingMeetings } from "#/server/agendas.functions";
import { createBoard, getMyBoards } from "#/server/boards.functions";
import type { UpcomingMeeting } from "#/server/meetings.server";

export const Route = createFileRoute("/styrelser/")({
	loader: async () => {
		const [boards, upcoming] = await Promise.all([
			getMyBoards(),
			getUpcomingMeetings(),
		]);
		return { boards, upcoming };
	},
	component: Boards,
});

function Boards() {
	const { boards, upcoming } = Route.useLoaderData();
	const router = useRouter();
	const [error, setError] = useState<string | null>(null);
	const [pending, setPending] = useState(false);

	async function onSubmit(e: React.FormEvent<HTMLFormElement>) {
		e.preventDefault();
		const form = e.currentTarget;
		const name = String(new FormData(form).get("name"));
		setPending(true);
		setError(null);
		try {
			const board = await createBoard({ data: { name } });
			await router.navigate({
				to: "/styrelser/$boardId",
				params: { boardId: board.id },
			});
		} catch (err) {
			setError(err instanceof Error ? err.message : "Något gick fel.");
			setPending(false);
		}
	}

	return (
		<main>
			<h1>Styrelser</h1>
			{boards.length > 0 && <Upcoming meetings={upcoming} />}
			<section aria-labelledby="my-boards">
				<h2 id="my-boards">Dina styrelser</h2>
				{boards.length === 0 ? (
					<p>Du är inte med i någon styrelse ännu.</p>
				) : (
					<ul>
						{boards.map((b) => (
							<li key={b.id}>
								<Link to="/styrelser/$boardId" params={{ boardId: b.id }}>
									{b.name}
								</Link>{" "}
								({b.role === "admin" ? "administratör" : "ledamot"})
							</li>
						))}
					</ul>
				)}
			</section>
			<section aria-labelledby="new-board">
				<h2 id="new-board">Skapa ny styrelse</h2>
				<form onSubmit={onSubmit}>
					<p>
						<label htmlFor="name">Föreningens namn</label>
						<input id="name" name="name" required />
					</p>
					{error && <p role="alert">{error}</p>}
					<button type="submit" disabled={pending}>
						Skapa styrelse
					</button>
				</form>
			</section>
		</main>
	);
}

/** The user's next meetings across all boards, soonest first. */
function Upcoming({ meetings }: { meetings: UpcomingMeeting[] }) {
	const [next] = meetings;
	return (
		<section aria-labelledby="upcoming">
			<h2 id="upcoming">Dina kommande möten</h2>
			{!next ? (
				<p>Inga möten är inplanerade just nu.</p>
			) : (
				<>
					<p>
						Nästa möte är <strong>{daysUntilText(next.daysUntil)}</strong>,{" "}
						<time dateTime={next.meetingAt}>
							{formatMeetingAt(next.meetingAt)}
						</time>
						, i {next.boardName}.
					</p>
					<ul>
						{meetings.map((m) => (
							<li key={`${m.boardId}-${m.agenda?.id ?? "planned"}`}>
								<time dateTime={m.meetingAt}>
									{formatMeetingAt(m.meetingAt)}
								</time>{" "}
								({daysUntilText(m.daysUntil)}), {m.boardName}:{" "}
								{m.agenda ? (
									<Link
										to="/styrelser/$boardId/dagordningar/$agendaId"
										params={{ boardId: m.boardId, agendaId: m.agenda.id }}
									>
										{m.agenda.title}
									</Link>
								) : (
									<>
										bestämt på förra mötet, ingen kallelse ännu.{" "}
										<Link
											to="/styrelser/$boardId"
											params={{ boardId: m.boardId }}
										>
											Kalla till möte
										</Link>
									</>
								)}
							</li>
						))}
					</ul>
				</>
			)}
		</section>
	);
}
