import type { ReactNode } from "react";

/** A short confirmation, like "Sparat." or "Länken är kopierad." */
export function Notice({ children }: { children: ReactNode }) {
	return <output>{children}</output>;
}
