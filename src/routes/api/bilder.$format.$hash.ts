import { createFileRoute } from "@tanstack/react-router";

// Boards' logos and banner pictures: /api/bilder/webp/<sha256> (or png for
// the PDF's logo), stored as "bilder/<sha256>.<format>". No extension in the
// address: the dev server would take it for a static file. Public, as they
// show on shared agendas and protocols too; the name is the file's
// fingerprint, so a file never changes and browsers and the CDN may keep it
// for good.
const TYPES = { webp: "image/webp", png: "image/png" } as const;

export const Route = createFileRoute("/api/bilder/$format/$hash")({
	server: {
		handlers: {
			GET: async ({ params }) => {
				const notFound = () => new Response("Hittades inte.", { status: 404 });
				const { format, hash } = params;
				if (
					!(format === "webp" || format === "png") ||
					!/^[0-9a-f]{64}$/.test(hash)
				)
					return notFound();
				const { getFileStorage } = await import(
					"#/server/files/storage.server"
				);
				const data = await (await getFileStorage()).get(
					`bilder/${hash}.${format}`,
				);
				if (!data) return notFound();
				return new Response(new Uint8Array(data), {
					headers: {
						"Content-Type": TYPES[format],
						"Cache-Control": "public, max-age=31536000, immutable",
					},
				});
			},
		},
	},
});
