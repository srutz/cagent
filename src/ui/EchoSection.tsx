/** biome-ignore-all lint/suspicious/noArrayIndexKey: its fine */
import { Box, Text } from "ink";
import type { SectionWithId } from "../inkoutput.js";

export function EchoSection({ section }: { section: SectionWithId }) {
	return (
		<Box>
			{section.content.map((line, index) => (
				<Text key={section.id + "_" + index}>{line}</Text>
			))}
		</Box>
	);
}
