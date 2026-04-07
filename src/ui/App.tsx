import { Box, useInput } from "ink";
import { useEffect, useState } from "react";
import type { OutputStore } from "../inkoutput.js";
import { ConfirmLine } from "./ConfirmLine.js";
import { InputLine } from "./InputLine.js";
import { SectionRenderer } from "./SectionRenderer.js";
import { ThinkingIndicator } from "./ThinkingIndicator.js";

export function App({ store }: { store: OutputStore }) {
	const [, forceRender] = useState(0);

	useEffect(() => {
		const unsub = store.subscribe(() => {
			forceRender((n) => n + 1);
		});
		// Pick up lines pushed before subscription was active
		forceRender((n) => n + 1);
		return unsub;
	}, [store]);

	// Handle Ctrl+O to toggle collapse of last tool_result
	useInput((input, key) => {
		if (key.ctrl && input === "o") {
			const lastToolResultId = store.getLastToolResultId();
			if (lastToolResultId !== null) {
				store.toggleCollapse(lastToolResultId);
			}
		}
	});

	const sections = store.sections;
	return (
		<Box flexDirection="column">
			{sections.map((section) => {
				return <SectionRenderer key={section.id} section={section} store={store} />;
			})}
			{store.thinking && <ThinkingIndicator />}
			{store.confirmActive && <ConfirmLine store={store} />}
			{!store.confirmActive && !store.exitRequested && <InputLine store={store} />}
		</Box>
	);
}
