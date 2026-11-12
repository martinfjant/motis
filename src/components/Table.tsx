import type { ComponentProps, ReactNode } from "react";

/**
 * A table with a caption and a header row. The rows go in as children:
 * <tr> with the first cell as <th scope="row"> (what the row is about) and
 * the rest as <td>.
 */
export function Table({
	caption,
	columns,
	children,
}: {
	caption: ReactNode;
	columns: ReactNode[];
	children: ReactNode;
}) {
	return (
		<table>
			<caption>{caption}</caption>
			<thead>
				<tr>
					{columns.map((column, i) => (
						// Columns never move, so their place is their key.
						// biome-ignore lint/suspicious/noArrayIndexKey: fixed columns
						<th key={i} scope="col">
							{column}
						</th>
					))}
				</tr>
			</thead>
			<tbody>{children}</tbody>
		</table>
	);
}

/** The cell that names a row, e.g. the person's name. */
export function RowHeader(props: ComponentProps<"th">) {
	return <th scope="row" {...props} />;
}

/** An ordinary cell. */
export function Cell(props: ComponentProps<"td">) {
	return <td {...props} />;
}
