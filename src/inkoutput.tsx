/**
 * Ink-based output backend for cagent.
 *
 * Renders all agent output inside an Ink (React) component tree.
 * Input is handled via Ink's useInput hook — no readline needed.
 */

import { render } from "ink";
import React from "react";
import type { IOutput, Section, SectionOptions } from "./output.js";
import { c } from "./output.js";
import { loadHistory } from "./readlineutils.js";
import { App } from "./ui/App.js";

export type SectionWithId = Section & { id: number };

export type Listener = () => void;

export class OutputStore {
	sections: SectionWithId[] = [];
	thinking = false;
	exitRequested = false;
	nextId = 1;

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

	/** Collapsed sections tracking */
	collapsedSections = new Set<number>();

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

	toggleCollapse(sectionId: number): void {
		if (this.collapsedSections.has(sectionId)) {
			this.collapsedSections.delete(sectionId);
		} else {
			this.collapsedSections.add(sectionId);
		}
		this.emit();
	}

	getLastToolResultId(): number | null {
		for (let i = this.sections.length - 1; i >= 0; i--) {
			if (this.sections[i]?.type === "tool_result") {
				return this.sections[i]?.id ?? null;
			}
		}
		return null;
	}
}

export class InkOutput implements IOutput {
	private store: OutputStore;
	private inkInstance: { unmount: () => void };

	constructor(store: OutputStore, inkInstance: { unmount: () => void }) {
		this.store = store;
		this.inkInstance = inkInstance;
	}

	exit() {
		this.store.exitRequested = true;
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

	open(sectionType: SectionWithId["type"], options?: SectionOptions): SectionWithId {
		const id = this.store.nextId++;
		const section = {
			id,
			type: sectionType,
			content: [],
			options: options,
		} satisfies SectionWithId;
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
		// Auto-collapse tool_result sections with more than 10 lines
		if (section.type === "tool_result" && section.content.length > 10) {
			this.store.collapsedSections.add(section.id);
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
	const inkInstance = render(React.createElement(App, { store }));
	return new InkOutput(store, inkInstance);
}
