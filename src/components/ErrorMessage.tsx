/** An error to show the user, read out as soon as it appears. Nothing if none. */
export function ErrorMessage({ error }: { error: string | null | undefined }) {
	if (!error) return null;
	return <p role="alert">{error}</p>;
}
