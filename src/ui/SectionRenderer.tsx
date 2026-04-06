/** biome-ignore-all lint/suspicious/noArrayIndexKey: its fine */
import { Box, Text } from "ink";
import type { OutputStore, SectionWithId } from "../inkoutput.js";

export function SectionRenderer({
	section,
	store,
}: {
	section: SectionWithId;
	store: OutputStore;
}) {
	//console.log(">> rendering SectionRenderer", section.content.join("\n"));

	let prefix: string = section.type;
	switch (section.type) {
		case "assistant":
			prefix = "Agent replied";
			break;
		case "tool_result":
			prefix = "tool_result";
			if (section.options?.toolName) {
				prefix = "Tool-Result " + section.options.toolName;
			}
			break;
		case "tool_use":
			prefix = "tool_use";
			if (section.options?.toolName) {
				prefix = "Tool " + section.options.toolName;
			}
			break;
		case "user":
			prefix = "You said";
			break;
		case "echo":
			prefix = "";
			break;
	}

	let fullContent = [...section.content];
	if (section.partial) {
		fullContent.push(section.partial);
	}
	fullContent = fullContent.filter((line) => line.trim() !== ""); // Filter out empty lines

	if (!fullContent.length) {
		return null;
	}

	// Handle collapse
	const collapsed = store.collapsedSections.has(section.id);
	let collapseThreshold = -1;
	switch (section.type) {
		case "user":
			collapseThreshold = 999;
			break;
		case "assistant":
			collapseThreshold = 20;
			break;
		case "tool_use":
			collapseThreshold = 3;
			break;
		case "tool_result":
			collapseThreshold = 2;
			break;
		case "echo":
			collapseThreshold = 999;
			break;
	}
	const shouldCollapse = collapseThreshold > 0 && fullContent.length > collapseThreshold;
	const displayContent =
		shouldCollapse && collapsed ? fullContent.slice(0, collapseThreshold) : fullContent;

	return (
		<Box flexDirection="column" marginTop={2}>
			<Text color={"dim"}>{prefix}</Text>
			{displayContent.map((line, index) => (
				<Text key={section.id + "_" + index}>{line}</Text>
			))}
			{shouldCollapse && collapsed && (
				<Text color="dim">
					... {fullContent.length - collapseThreshold} more lines (press Ctrl+O to expand)
				</Text>
			)}
			{shouldCollapse && !collapsed && <Text color="dim">(press Ctrl+O to collapse)</Text>}
		</Box>
	);
}
