import type { ComponentProps, ReactNode } from "react";

/**
 * A table with a caption and a header row. The rows go in as children:
 * <tr> with the first cell as <th scope="row"> (what the row is about) and
 * the rest as <td>. Scrolls sideways on its own when it is wider than the
 * screen, instead of the whole page.
 */
export function Table({
	caption,
	columns,
	children,
}: {
	caption: ReactNode;
	/** Column headings, each unique. */
	columns: string[];
	children: ReactNode;
}) {
	return (
		<div className="overflow-x-auto">
			<table className="w-full border-collapse">
				<caption className="caption-top py-2 text-left text-lg font-semibold">
					{caption}
				</caption>
				<thead>
					<tr className="border-b border-stone-300">
						{columns.map((column) => (
							<th
								key={column}
								scope="col"
								className="px-2 py-1 text-left text-sm font-medium text-stone-500"
							>
								{column}
							</th>
						))}
					</tr>
				</thead>
				<tbody className="[&>tr]:border-b [&>tr]:border-stone-200 [&>tr:last-child]:border-0">
					{children}
				</tbody>
			</table>
		</div>
	);
}

/** The cell that names a row, e.g. the person's name. */
export function RowHeader({ className = "", ...props }: ComponentProps<"th">) {
	return (
		<th
			scope="row"
			className={`px-2 py-2 text-left align-middle font-semibold whitespace-nowrap ${className}`}
			{...props}
		/>
	);
}

/** An ordinary cell. */
export function Cell({ className = "", ...props }: ComponentProps<"td">) {
	return (
		<td
			className={`px-2 py-2 text-left align-middle ${className}`}
			{...props}
		/>
	);
}
