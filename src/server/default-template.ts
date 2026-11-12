import { randomUUID } from "node:crypto";
import type { InStatement } from "@libsql/client";
import { DEFAULT_REVIEWER_COUNT, type ItemType } from "./items";

export const DEFAULT_TEMPLATE_NAME = "Styrelsemöte";

// Attendance comes before the choices, since justerare are chosen among
// those present.
export const DEFAULT_TEMPLATE_ITEMS: { title: string; type: ItemType }[] = [
	{ title: "Mötets öppnande", type: "open" },
	{ title: "Närvarande ledamöter", type: "attendance" },
	{ title: "Val av ordförande", type: "person" },
	{ title: "Val av sekreterare", type: "person" },
	{ title: "Val av justerare", type: "reviewers" },
	{ title: "Godkännande av dagordning", type: "toggle" },
	{ title: "Föregående protokoll", type: "toggle" },
	{ title: "Ekonomi", type: "text" },
	{ title: "Driftsfrågor", type: "text" },
	{ title: "Övriga frågor", type: "text" },
	{ title: "Nästa möte", type: "next_meeting" },
	{ title: "Mötets avslutande", type: "close" },
];

/** Statements that give a board its own editable copy of the default template. */
export function defaultTemplateStatements(boardId: string): {
	id: string;
	statements: InStatement[];
} {
	const id = randomUUID();
	return {
		id,
		statements: [
			{
				sql: "INSERT INTO templates (id, board_id, name) VALUES (?, ?, ?)",
				args: [id, boardId, DEFAULT_TEMPLATE_NAME],
			},
			...DEFAULT_TEMPLATE_ITEMS.map((item, i) => ({
				sql: "INSERT INTO template_items (id, template_id, position, title, type, config) VALUES (?, ?, ?, ?, ?, ?)",
				args: [
					randomUUID(),
					id,
					i + 1,
					item.title,
					item.type,
					item.type === "reviewers"
						? JSON.stringify({ reviewerCount: DEFAULT_REVIEWER_COUNT })
						: "{}",
				],
			})),
		],
	};
}
