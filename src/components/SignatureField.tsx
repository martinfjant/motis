import { useEffect, useId, useRef } from "react";
import type SignaturePadType from "signature_pad";
import { Button } from "./Button";

/**
 * A field to draw a signature in, with mouse, finger or pen, using the
 * signature_pad library. Reports the drawing as a PNG data URL, or null
 * while it is empty.
 */
export function SignatureField({
	label,
	onChange,
}: {
	label: string;
	onChange: (signature: string | null) => void;
}) {
	const canvas = useRef<HTMLCanvasElement>(null);
	const pad = useRef<SignaturePadType | null>(null);
	const labelId = useId();
	const report = useRef(onChange);
	report.current = onChange;

	useEffect(() => {
		const element = canvas.current;
		if (!element) return;
		let cancelled = false;
		let observer: ResizeObserver | undefined;

		// Loaded in the browser only: it draws on a canvas.
		import("signature_pad").then(({ default: SignaturePad }) => {
			if (cancelled) return;
			const signaturePad = new SignaturePad(element, {
				penColor: "#1c1917",
				minWidth: 0.8,
				maxWidth: 2.6,
			});
			pad.current = signaturePad;
			signaturePad.addEventListener("endStroke", () =>
				report.current(signaturePad.toDataURL("image/png")),
			);

			// Sharp on high-resolution screens. Resizing clears the canvas,
			// so the drawing is put back afterwards.
			const resize = () => {
				const ratio = Math.max(window.devicePixelRatio || 1, 1);
				const data = signaturePad.toData();
				element.width = element.offsetWidth * ratio;
				element.height = element.offsetHeight * ratio;
				element.getContext("2d")?.scale(ratio, ratio);
				signaturePad.clear();
				signaturePad.fromData(data);
			};
			resize();
			observer = new ResizeObserver(resize);
			observer.observe(element);
		});

		return () => {
			cancelled = true;
			observer?.disconnect();
			pad.current?.off();
			pad.current = null;
		};
	}, []);

	return (
		<div>
			<p id={labelId}>{label}</p>
			<canvas
				ref={canvas}
				aria-labelledby={labelId}
				className="block h-40 w-full max-w-md touch-none rounded-lg border border-stone-400 bg-white"
			/>
			<p>
				<Button
					onClick={() => {
						pad.current?.clear();
						report.current(null);
					}}
				>
					Rensa
				</Button>
			</p>
		</div>
	);
}
