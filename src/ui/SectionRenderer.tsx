/** biome-ignore-all lint/suspicious/noArrayIndexKey: its fine */
import { Box, Text } from "ink";
import type { SectionWithId } from "../inkoutput.js";
import { rpad } from "../utils.js";

export function SectionRenderer({ section }: { section: SectionWithId }) {
	//console.log(">> rendering SectionRenderer", section.content.join("\n"));
	let prefix: string = section.type;
	switch (section.type) {
		case "assistant":
			prefix = "Agent";
			break;
	}
	const fullContent = [...section.content];
	if (section.partial) {
		fullContent.push(section.partial);
	}
	return (
		<Box flexDirection="column" marginTop={1}>
			{fullContent.map((line, index) => (
				<Text key={section.id + "_" + index}>
					{rpad(prefix, 12)} | {line}
				</Text>
			))}
		</Box>
	);
}
