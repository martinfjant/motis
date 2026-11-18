import { type ComponentProps, useState } from "react";
import { Field, fieldStyle, useFieldProps } from "./Field";
import { Icon } from "./Icon";

/**
 * A password <input> with a button at its end that shows what is typed, for
 * those who need to see it. The button's label stays the same; it is
 * pressed while the password shows.
 */
export function PasswordInput(props: Omit<ComponentProps<"input">, "type">) {
	const [shown, setShown] = useState(false);
	return (
		// A span: Field puts its control inside a <p>.
		<span className="relative block">
			<input
				{...props}
				type={shown ? "text" : "password"}
				// Typed passwords aren't corrected or capitalised when shown.
				autoCapitalize="off"
				autoCorrect="off"
				spellCheck={false}
				className={`${fieldStyle} pr-12`}
				{...useFieldProps(props)}
			/>
			<button
				type="button"
				aria-label="Visa lösenord"
				title={shown ? "Dölj lösenord" : "Visa lösenord"}
				aria-pressed={shown}
				onClick={() => setShown((s) => !s)}
				className="absolute inset-y-0 right-1 my-auto flex size-10 items-center justify-center rounded-md text-muted hover:bg-surface-strong hover:text-ink"
			>
				<Icon name={shown ? "eye-off" : "eye"} className="size-5" />
			</button>
		</span>
	);
}

const MISMATCH = "Lösenorden är inte likadana.";

/**
 * A new password, typed twice so a typo doesn't lock anyone out. The form
 * gets it as "password"; the browser stops the form, with a message at the
 * second field, while the two differ.
 */
export function NewPasswordFields({ label }: { label: string }) {
	// Checked on every keystroke in either field.
	function check(e: React.FormEvent<HTMLInputElement>) {
		const form = e.currentTarget.form;
		const first = form?.elements.namedItem("password");
		const again = form?.elements.namedItem("passwordAgain");
		if (
			!(first instanceof HTMLInputElement) ||
			!(again instanceof HTMLInputElement)
		)
			return;
		again.setCustomValidity(
			again.value && again.value !== first.value ? MISMATCH : "",
		);
	}

	return (
		<>
			<Field id="password" label={label} hint="Minst 8 tecken.">
				<PasswordInput
					name="password"
					autoComplete="new-password"
					minLength={8}
					required
					onInput={check}
				/>
			</Field>
			<Field id="passwordAgain" label="Skriv lösenordet igen">
				<PasswordInput
					name="passwordAgain"
					autoComplete="new-password"
					required
					onInput={check}
				/>
			</Field>
		</>
	);
}
