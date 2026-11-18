import type { ComponentProps, ReactNode } from "react";

/**
 * A table with a caption and a header row. The rows go in as children:
 * <tr> with the first cell as <th scope="row"> (what the row is about) and
 * the rest as <td>. On phones each row becomes a small card: the row's
 * heading, then each cell under its label (give cells a label, the column's
 * name). From sm up it is an ordinary table, scrolling sideways on its own
 * if it is wider than the screen.
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
			<table className="w-full border-collapse max-sm:block">
				<caption className="caption-top py-2 text-left text-lg font-semibold max-sm:block">
					{caption}
				</caption>
				{/* On phones the cells carry their own labels instead. */}
				<thead className="max-sm:sr-only">
					<tr className="border-b border-line">
						{columns.map((column) => (
							<th
								key={column}
								scope="col"
								className="px-2 py-1 text-left text-sm font-medium whitespace-nowrap text-muted"
							>
								{column}
							</th>
						))}
					</tr>
				</thead>
				<tbody className="max-sm:block [&>tr]:border-b [&>tr]:border-line-faint [&>tr:last-child]:border-0 max-sm:[&>tr]:block max-sm:[&>tr]:py-2">
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
			className={`px-2 py-2 text-left align-middle font-semibold whitespace-nowrap max-sm:block max-sm:px-0 max-sm:pb-0 max-sm:text-lg ${className}`}
			{...props}
		/>
	);
}

/**
 * An ordinary cell. label (the column's name) is shown above the value on
 * phones, where the table is shown as cards.
 */
export function Cell({
	className = "",
	label,
	...props
}: ComponentProps<"td"> & { label?: string }) {
	return (
		<td
			data-label={label}
			className={`px-2 py-2 text-left align-middle max-sm:block max-sm:px-0 max-sm:py-1 max-sm:before:block max-sm:before:text-sm max-sm:before:text-muted max-sm:before:content-[attr(data-label)] ${className}`}
			{...props}
		/>
	);
}
