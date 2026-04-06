import { Box, Text, useInput } from "ink";
import { useEffect, useState } from "react";
import type { OutputStore } from "../inkoutput.js";
import { appendHistory } from "../readlineutils.js";

export function InputLine({ store }: { store: OutputStore }) {
	const [, forceRender] = useState(0);

	useEffect(() => {
		return store.subscribe(() => forceRender((n) => n + 1));
	}, [store]);

	useInput((input, key) => {
		if (!store.inputActive) return;

		if (key.return) {
			const value = store.inputValue.trim();
			if (value) {
				appendHistory(value, store.historyLines);
			}
			store.pushLine(`${store.inputPrompt}${store.inputValue}`);
			const resolve = store.inputResolve;
			store.finishInput();
			resolve?.(value);
			return;
		}

		if (key.backspace || key.delete) {
			if (store.inputCursor > 0) {
				store.inputValue =
					store.inputValue.slice(0, store.inputCursor - 1) +
					store.inputValue.slice(store.inputCursor);
				store.inputCursor--;
				store.updateInput();
			}
			return;
		}

		if (key.leftArrow) {
			if (store.inputCursor > 0) {
				store.inputCursor--;
				store.updateInput();
			}
			return;
		}

		if (key.rightArrow) {
			if (store.inputCursor < store.inputValue.length) {
				store.inputCursor++;
				store.updateInput();
			}
			return;
		}

		if (key.upArrow) {
			if (store.historyLines.length === 0) return;
			if (store.historyIndex === -1) {
				store.historySaved = store.inputValue;
			}
			if (store.historyIndex < store.historyLines.length - 1) {
				store.historyIndex++;
				store.inputValue =
					store.historyLines[store.historyLines.length - 1 - store.historyIndex] ?? "";
				store.inputCursor = store.inputValue.length;
				store.updateInput();
			}
			return;
		}

		if (key.downArrow) {
			if (store.historyIndex > 0) {
				store.historyIndex--;
				store.inputValue =
					store.historyLines[store.historyLines.length - 1 - store.historyIndex] ?? "";
				store.inputCursor = store.inputValue.length;
				store.updateInput();
			} else if (store.historyIndex === 0) {
				store.historyIndex = -1;
				store.inputValue = store.historySaved;
				store.inputCursor = store.inputValue.length;
				store.updateInput();
			}
			return;
		}

		// ctrl+a / ctrl+e
		if (key.ctrl && input === "a") {
			store.inputCursor = 0;
			store.updateInput();
			return;
		}
		if (key.ctrl && input === "e") {
			store.inputCursor = store.inputValue.length;
			store.updateInput();
			return;
		}
		// ctrl+u — clear line
		if (key.ctrl && input === "u") {
			store.inputValue = "";
			store.inputCursor = 0;
			store.updateInput();
			return;
		}

		// Regular character
		if (input && !key.ctrl && !key.meta) {
			store.inputValue =
				store.inputValue.slice(0, store.inputCursor) +
				input +
				store.inputValue.slice(store.inputCursor);
			store.inputCursor += input.length;
			store.updateInput();
		}
	});

	//if (!store.inputActive) return null;

	const before = store.inputValue.slice(0, store.inputCursor);
	const cursor = store.inputValue[store.inputCursor] ?? " ";
	const after = store.inputValue.slice(store.inputCursor + 1);

	return (
		<Box
			borderStyle="round"
			borderLeft={!true}
			borderRight={!true}
			borderColor="cyan"
			marginTop={1}
		>
			<Text>{store.inputPrompt}</Text>
			<Text>{before}</Text>
			<Text inverse>{cursor}</Text>
			<Text>{after}</Text>
		</Box>
	);
}
