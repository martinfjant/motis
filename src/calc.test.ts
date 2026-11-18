import { expect, test } from "vitest";
import { calculate, formatResult } from "./calc";

test("arithmetic is calculated with the usual precedence", () => {
	expect(calculate("20*90-2")).toBe(1798);
	expect(calculate("2+3*4")).toBe(14);
	expect(calculate("(2+3)*4")).toBe(20);
	expect(calculate("10/4")).toBe(2.5);
	expect(calculate("-5+2")).toBe(-3);
	expect(calculate("2*-3")).toBe(-6);
	expect(calculate(" 20 * 90 - 2 ")).toBe(1798);
});

test("Swedish decimals and other operator signs work", () => {
	expect(calculate("1,5*2")).toBe(3);
	expect(calculate("1.5*2")).toBe(3);
	expect(calculate("3×4")).toBe(12);
	expect(calculate("12÷4")).toBe(3);
	expect(calculate("10−4")).toBe(6);
});

test("anything that isn't a calculation gives nothing", () => {
	expect(calculate("")).toBeNull();
	expect(calculate("42")).toBeNull(); // nothing to calculate
	expect(calculate("(42)")).toBeNull();
	expect(calculate("20*90-2 kr")).toBeNull();
	expect(calculate("2+")).toBeNull();
	expect(calculate("(2+3")).toBeNull();
	expect(calculate("2+3)")).toBeNull();
	expect(calculate("5/0")).toBeNull();
	expect(calculate("b")).toBeNull();
	expect(calculate("alert(1)")).toBeNull();
	expect(calculate("1,2,3+1")).toBeNull();
});

test("results are written the Swedish way", () => {
	expect(formatResult(1798)).toBe("1798");
	expect(formatResult(2.5)).toBe("2,5");
	expect(formatResult(10 / 3)).toBe("3,33");
	expect(formatResult(-3)).toBe("-3");
	expect(formatResult(0.1 + 0.2)).toBe("0,3");
	expect(formatResult(-0.001)).toBe("0");
});
