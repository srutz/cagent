import { Box, Text, useInput } from "ink";
import { useEffect, useState } from "react";
import type { OutputStore } from "../inkoutput.js";
import { c } from "../utils.js";

export function ConfirmLine({ store }: { store: OutputStore }) {
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
			store.sections.push({
				id: store.nextId++,
				type: "confirm",
				content: [`${c.yellow}${store.confirmQuestion} [Y/n]${c.reset} ${yes ? "yes" : "no"}`],
			});
			const resolve = store.confirmResolve;
			store.finishConfirm();
			resolve?.(yes);
		}
	});

	if (!store.confirmActive) return null;

	return (
		<Box
			borderStyle="round"
			borderLeft={!true}
			borderRight={!true}
			borderColor="cyan"
			borderBottom={false}
			marginTop={1}
		>
			<Text color="yellow">{store.confirmQuestion} [Y/n] </Text>
		</Box>
	);
}
