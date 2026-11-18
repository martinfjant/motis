// Arithmetic typed after = in notes ("Vi har =20*90-2 kr kvar"), offered
// as a suggestion like @ and # (see MentionTextarea). Parsed by hand, never
// eval'd: numbers (with , or . as decimal sign), + - * / and parentheses.
// × · and ÷ also work, and − (the real minus sign) as well.

/**
 * The value of an arithmetic expression, or null if it isn't one, has no
 * operator (a plain number needs no calculating) or divides by zero.
 */
export function calculate(input: string): number | null {
	const read = tokenize(input);
	if (!read?.some((t) => typeof t === "string" && t !== "(" && t !== ")"))
		return null;
	const tokens = read;
	let i = 0;
	const peek = () => tokens[i];

	function expr(): number | null {
		let left = term();
		while (left !== null && (peek() === "+" || peek() === "-")) {
			const op = tokens[i++];
			const right = term();
			if (right === null) return null;
			left = op === "+" ? left + right : left - right;
		}
		return left;
	}
	function term(): number | null {
		let left = factor();
		while (left !== null && (peek() === "*" || peek() === "/")) {
			const op = tokens[i++];
			const right = factor();
			if (right === null || (op === "/" && right === 0)) return null;
			left = op === "*" ? left * right : left / right;
		}
		return left;
	}
	function factor(): number | null {
		const t = tokens[i++];
		if (typeof t === "number") return t;
		if (t === "-" || t === "+") {
			const v = factor();
			return v === null ? null : t === "-" ? -v : v;
		}
		if (t === "(") {
			const v = expr();
			return tokens[i++] === ")" ? v : null;
		}
		return null;
	}

	const value = expr();
	return i === tokens.length && value !== null && Number.isFinite(value)
		? value
		: null;
}

const OPERATORS: Record<string, string> = {
	"+": "+",
	"-": "-",
	"−": "-",
	"*": "*",
	"×": "*",
	"·": "*",
	"/": "/",
	"÷": "/",
	"(": "(",
	")": ")",
};

/** Numbers and operators, or null at the first other character. */
function tokenize(input: string): (number | string)[] | null {
	const tokens: (number | string)[] = [];
	const re = /\s*(?:(\d+(?:[.,]\d+)?)|(\S))/y;
	while (re.lastIndex < input.trimEnd().length) {
		const m = re.exec(input);
		if (!m) return null;
		if (m[1]) tokens.push(Number(m[1].replace(",", ".")));
		else if (OPERATORS[m[2]]) tokens.push(OPERATORS[m[2]]);
		else return null;
	}
	return tokens.length > 0 ? tokens : null;
}

/**
 * A result as written in Swedish text: decimal comma, at most two
 * decimals, an ordinary hyphen for minus (so it can be calculated again).
 */
export function formatResult(value: number): string {
	const rounded = Math.round(value * 100) / 100;
	return String(rounded === 0 ? 0 : rounded).replace(".", ",");
}
