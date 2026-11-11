import { randomUUID } from "node:crypto";
import type { InStatement } from "@libsql/client";
import type { ItemType } from "./items";

export const DEFAULT_TEMPLATE_NAME = "Styrelsemöte";

export const DEFAULT_TEMPLATE_ITEMS: { title: string; type: ItemType }[] = [
	{ title: "Mötets öppnande", type: "toggle" },
	{ title: "Val av ordförande", type: "person" },
	{ title: "Val av sekreterare", type: "person" },
	{ title: "Val av justerare", type: "person" },
	{ title: "Närvarande ledamöter", type: "attendance" },
	{ title: "Godkännande av dagordning", type: "toggle" },
	{ title: "Föregående protokoll", type: "toggle" },
	{ title: "Ekonomi", type: "text" },
	{ title: "Driftsfrågor", type: "text" },
	{ title: "Övriga frågor", type: "text" },
	{ title: "Nästa möte", type: "text" },
	{ title: "Mötets avslutande", type: "toggle" },
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
				sql: "INSERT INTO template_items (id, template_id, position, title, type) VALUES (?, ?, ?, ?, ?)",
				args: [randomUUID(), id, i + 1, item.title, item.type],
			})),
		],
	};
}
