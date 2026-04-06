/**
 * @deprecated Import from "./output" instead.
 */

export type { IOutput } from "./output.js";
export { ConsoleOutput, c, output, output as default } from "./output.js";

export function lpad(_str: string, _length: number, _padCharar = " ") {
	return _str.padStart(_length, _padCharar);
}

export function rpad(_str: string, _length: number, _padCharar = " ") {
	return _str.padEnd(_length, _padCharar);
}
