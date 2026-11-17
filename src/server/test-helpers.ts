import type { Client } from "@libsql/client";

/**
 * Test setup: marks every point not yet dealt with (neither done nor tabled)
 * as done, so the meeting may be closed. Straight in the database, for tests
 * about what happens after closing, not about the points themselves.
 */
export async function settleRemainingPoints(db: Client, protocolId: string) {
	await db.execute({
		sql: `UPDATE protocol_items SET value = json_set(value, '$.done', json('true'))
          WHERE protocol_id = ? AND type != 'close'
            AND json_extract(value, '$.done') IS NOT 1
            AND json_extract(value, '$.tabled') IS NOT 1`,
		args: [protocolId],
	});
}
