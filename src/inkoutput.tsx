/**
 * Ink-based output backend for cagent.
 *
 * Renders all agent output inside an Ink (React) component tree.
 * Input is handled via Ink's useInput hook — no readline needed.
 */

import { Box, render, Text } from "ink";
import React, { useEffect, useState } from "react";
import type { IOutput, Section } from "./output.js";
import { c } from "./output.js";
import { loadHistory } from "./readlineutils.js";
import { ConfirmLine } from "./ui/ConfirmLine.js";
import { InputLine } from "./ui/InputLine.js";
import { SectionRenderer } from "./ui/SectionRenderer.js";

type Listener = () => void;

export type SectionWithId = Section & { id: number };

export class OutputStore {
	sections: SectionWithId[] = [];
	thinking = false;
	//lines: Line[] = [];
	nextId = 1;
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

	emit(): void {
		for (const f of this.listeners) {
			f();
		}
	}

	pushLine(text: string): void {
		this.sections.push({ id: this.nextId++, type: "echo", content: [text] });
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
		this.inputValue = "";
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

// Main app

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

	const sections = store.sections;
	return (
		<Box flexDirection="column">
			{sections.map((section) => {
				return <SectionRenderer key={section.id} section={section} />;
			})}
			{store.thinking && <Text color="dim">[thinking...]</Text>}
			{store.confirmActive ? <ConfirmLine store={store} /> : <InputLine store={store} />}
		</Box>
	);
}

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

	write(text: string): void {
		const section = this.store.sections[this.store.sections.length - 1];
		if (!section) {
			throw new Error("no section");
		}
		section.partial = (section.partial || "") + text;
		this.store.emit();
		//console.log(">> write", text);
	}

	writeln(text = ""): void {
		const section = this.store.sections[this.store.sections.length - 1];
		if (!section) {
			throw new Error("no section");
		}
		//console.log(">> writeln", text);
		section.content = [...section.content, (section.partial || "") + text];
		section.partial = "";
		this.store.emit();
		//this.store.pushLine(full);
	}

	error(text: string): void {
		this.store.pushLine(text);
	}

	warn(text: string): void {
		this.store.pushLine(text);
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

	open(sectionType: SectionWithId["type"]): SectionWithId {
		const id = this.store.nextId++;
		const section = { id, type: sectionType, content: [] } satisfies SectionWithId;
		this.store.sections.push(section);
		this.store.emit();
		return section;
	}

	close() {
		const section = this.store.sections[this.store.sections.length - 1];
		if (!section) {
			console.error("No section to close");
			return;
		}
		this.store.emit();
	}

	setThinking(thinking: boolean) {
		if (this.store.thinking === thinking) {
			return;
		}
		this.store.thinking = thinking;
		this.store.emit();
	}
}

export function createInkOutput(): InkOutput {
	const store = new OutputStore();
	const inkInstance = render(React.createElement(InkApp, { store }));
	return new InkOutput(store, inkInstance);
}
