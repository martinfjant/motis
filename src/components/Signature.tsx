import { isSvgSignature, readSignature } from "#/signature";

/**
 * A stored signature, drawn: SVG ones as shapes in the text colour, so the
 * ink follows dark mode; older PNG ones as an image on white, since their
 * dark ink would disappear on a dark background.
 */
export function Signature({ stored, name }: { stored: string; name: string }) {
	const label = `Signatur: ${name}`;
	if (!isSvgSignature(stored))
		return (
			<img src={stored} alt={label} className="h-16 w-auto rounded bg-white" />
		);
	const shape = readSignature(stored);
	if (!shape) return null;
	return (
		<svg
			role="img"
			aria-label={label}
			viewBox={`0 0 ${shape.width} ${shape.height}`}
			fill="none"
			stroke="currentColor"
			strokeLinecap="round"
			className="h-16 w-auto"
			style={{ aspectRatio: `${shape.width} / ${shape.height}` }}
		>
			{shape.parts.map((p, i) =>
				p.kind === "path" ? (
					// biome-ignore lint/suspicious/noArrayIndexKey: fixed shapes of a stored drawing
					<path key={i} d={p.d} strokeWidth={p.strokeWidth} />
				) : p.kind === "circle" ? (
					<circle
						// biome-ignore lint/suspicious/noArrayIndexKey: fixed shapes of a stored drawing
						key={i}
						cx={p.cx}
						cy={p.cy}
						r={p.r}
						fill="currentColor"
						stroke="none"
					/>
				) : (
					<line
						// biome-ignore lint/suspicious/noArrayIndexKey: fixed shapes of a stored drawing
						key={i}
						x1={p.x1}
						y1={p.y1}
						x2={p.x2}
						y2={p.y2}
						strokeWidth={p.strokeWidth}
					/>
				),
			)}
		</svg>
	);
}
