/**
 * Ink-based output backend for cagent.
 *
 * Renders all agent output inside an Ink (React) component tree.
 * Input is handled via Ink's useInput hook — no readline needed.
 */

import { Box, render, Static, Text, useInput } from "ink";
import React, { useEffect, useState } from "react";
import type { IOutput } from "./output.js";
import { c } from "./output.js";
import { appendHistory, loadHistory } from "./readlineutils.js";

// ─── Shared state between the React tree and the imperative InkOutput ────────

interface Line {
	id: number;
	text: string;
	stream: "stdout" | "stderr";
}

type Listener = () => void;

class OutputStore {
	startupLines: string[] = [];
	lines: Line[] = [];
	nextId = 0;
	partial = "";

	/** Input state */
	inputActive = false;
	inputPrompt = "";
	inputValue = "";
	inputCursor = 0;
	inputResolve: ((value: string) => void) | null = null;
	historyLines: string[] = [];
	historyIndex = -1;
	historySaved = "";

	/** Confirm state */
	confirmActive = false;
	confirmQuestion = "";
	confirmResolve: ((value: boolean) => void) | null = null;

	private listeners: Listener[] = [];

	subscribe(fn: Listener): () => void {
		this.listeners.push(fn);
		return () => {
			this.listeners = this.listeners.filter((l) => l !== fn);
		};
	}

	private emit(): void {
		for (const fn of this.listeners) fn();
	}

	pushStartupLine(text: string): void {
		this.startupLines.push(text);
		this.emit();
	}

	pushLine(text: string, stream: "stdout" | "stderr" = "stdout"): void {
		this.lines.push({ id: this.nextId++, text, stream });
		this.emit();
	}

	setPartial(text: string): void {
		this.partial = text;
		this.emit();
	}

	/** Activate readline prompt */
	startInput(prompt: string, resolve: (value: string) => void): void {
		this.inputActive = true;
		this.inputPrompt = prompt;
		this.inputValue = "";
		this.inputCursor = 0;
		this.inputResolve = resolve;
		this.historyLines = loadHistory();
		this.historyIndex = -1;
		this.historySaved = "";
		this.emit();
	}

	finishInput(): void {
		this.inputActive = false;
		this.inputResolve = null;
		this.emit();
	}

	updateInput(): void {
		this.emit();
	}

	startConfirm(question: string, resolve: (value: boolean) => void): void {
		this.confirmActive = true;
		this.confirmQuestion = question;
		this.confirmResolve = resolve;
		this.emit();
	}

	finishConfirm(): void {
		this.confirmActive = false;
		this.confirmResolve = null;
		this.emit();
	}
}

// ─── Input component using useInput ──────────────────────────────────────────

function InputLine({ store }: { store: OutputStore }) {
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

	if (!store.inputActive) return null;

	const before = store.inputValue.slice(0, store.inputCursor);
	const cursor = store.inputValue[store.inputCursor] ?? " ";
	const after = store.inputValue.slice(store.inputCursor + 1);

	return (
		<Box>
			<Text>{store.inputPrompt}</Text>
			<Text>{before}</Text>
			<Text inverse>{cursor}</Text>
			<Text>{after}</Text>
		</Box>
	);
}

// ─── Confirm component ──────────────────────────────────────────────────────

function ConfirmLine({ store }: { store: OutputStore }) {
	const [, forceRender] = useState(0);

	useEffect(() => {
		return store.subscribe(() => forceRender((n) => n + 1));
	}, [store]);

	useInput((input, key) => {
		if (!store.confirmActive) return;
		const k = input.toLowerCase().trim();
		const yes = k === "" || k === "y" || key.return;
		const no = k === "n";
		if (yes || no) {
			store.pushLine(`${c.yellow}${store.confirmQuestion} [Y/n]${c.reset} ${yes ? "yes" : "no"}`);
			const resolve = store.confirmResolve;
			store.finishConfirm();
			resolve?.(yes);
		}
	});

	if (!store.confirmActive) return null;

	return <Text color="yellow">{store.confirmQuestion} [Y/n] </Text>;
}

// ─── Startup message component ──────────────────────────────────────────────

function StartupMessage({ store }: { store: OutputStore }) {
	const [, forceRender] = useState(0);

	useEffect(() => {
		return store.subscribe(() => forceRender((n) => n + 1));
	}, [store]);

	if (store.startupLines.length === 0) return null;

	return (
		<Box flexDirection="column">
			{store.startupLines.map((line, i) => (
				<Text key={i}>{line}</Text>
			))}
		</Box>
	);
}

// ─── Main app ────────────────────────────────────────────────────────────────

function InkApp({ store }: { store: OutputStore }) {
	const [, forceRender] = useState(0);

	useEffect(() => {
		const unsub = store.subscribe(() => {
			forceRender((n) => n + 1);
		});
		// Pick up lines pushed before subscription was active
		forceRender((n) => n + 1);
		return unsub;
	}, [store]);

	return (
		<Box flexDirection="column">
			<StartupMessage store={store} />
			<Static items={store.lines}>
				{(line) =>
					line.stream === "stderr" ? (
						<Text key={line.id} color="red">
							{line.text}
						</Text>
					) : (
						<Text key={line.id}>{line.text}</Text>
					)
				}
			</Static>
			{store.partial ? <Text>{store.partial}</Text> : null}
			<InputLine store={store} />
			<ConfirmLine store={store} />
		</Box>
	);
}

// ─── InkOutput class ─────────────────────────────────────────────────────────

export class InkOutput implements IOutput {
	private store: OutputStore;
	private inkInstance: { unmount: () => void };

	constructor(store: OutputStore, inkInstance: { unmount: () => void }) {
		this.store = store;
		this.inkInstance = inkInstance;
	}

	exit() {
		this.inkInstance.unmount();
	}

	startupWriteLn(text: string): void {
		this.store.pushStartupLine(text);
	}

	write(text: string): void {
		this.store.setPartial(this.store.partial + text);
	}

	writeln(text = ""): void {
		const full = this.store.partial + text;
		this.store.partial = "";
		this.store.pushLine(full);
	}

	error(text: string): void {
		this.store.pushLine(text, "stderr");
	}

	warn(text: string): void {
		this.store.pushLine(text, "stderr");
	}

	log(prefix: string, color: string, msg: string): void {
		this.store.pushLine(`${color}${prefix}${c.reset} ${msg}`);
	}

	divider(label: string): void {
		const line = "─".repeat(60);
		this.store.pushLine("");
		this.store.pushLine(`${c.dim}${line}${c.reset}`);
		if (label) this.store.pushLine(`${c.dim}  ${label}${c.reset}`);
	}

	clearLine(): void {
		this.store.setPartial("");
	}

	confirm(question: string): Promise<boolean> {
		return new Promise((resolve) => {
			this.store.startConfirm(question, resolve);
		});
	}

	readLine(prompt: string): Promise<string> {
		return new Promise((resolve) => {
			this.store.startInput(prompt, resolve);
		});
	}

	unmount(): void {
		this.inkInstance.unmount();
	}
}

// ─── Factory ─────────────────────────────────────────────────────────────────

export function createInkOutput(): InkOutput {
	const store = new OutputStore();
	const inkInstance = render(React.createElement(InkApp, { store }));
	return new InkOutput(store, inkInstance);
}
