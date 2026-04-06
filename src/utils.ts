/**
 * @deprecated Import from "./output" instead.
 */

export { c, output, output as default } from "./output.js";

export type AnsiColorNames =
	| "reset"
	| "dim"
	| "bold"
	| "cyan"
	| "green"
	| "yellow"
	| "red"
	| "magenta"
	| "blue"
	| "gray";

export function lpad(_str: string, _length: number, _padCharar = " ") {
	return _str.padStart(_length, _padCharar);
}

export function rpad(_str: string, _length: number, _padCharar = " ") {
	return _str.padEnd(_length, _padCharar);
}
