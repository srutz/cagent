/** biome-ignore-all lint/suspicious/noArrayIndexKey: its fine */

import { Box, Text } from "ink";
import type { OutputStore, SectionWithId } from "../inkoutput.js";
import type { AnsiColorNames } from "../utils.js";

export function SectionRenderer({
	section,
	store,
}: {
	section: SectionWithId;
	store: OutputStore;
}) {
	//console.log(">> rendering SectionRenderer", section.content.join("\n"));

	let prefix: string = section.type;
	//let prefixColor: Omit<ComponentProps<typeof Text>["color"], "string"> = "dim";
	let prefixColor: AnsiColorNames = "dim";
	switch (section.type) {
		case "assistant":
			prefix = "●";
			prefixColor = "green";
			break;
		case "tool_result":
			prefix = "tool_result";
			if (section.options?.toolName) {
				prefix = "⮐ Tool-result " + section.options.toolName;
			}
			prefixColor = "cyan";
			break;
		case "tool_use":
			prefix = "tool_use";
			if (section.options?.toolName) {
				prefix = "⮕ " + section.options.toolName.trim();
			}
			prefixColor = "cyan";
			break;
		case "user":
			prefix = ">";
			break;
		case "confirm":
			prefix = "?";
			prefixColor = "yellow";
			break;
		case "echo":
			prefix = "";
			break;
	}

	let fullContent = [...section.content];
	if (section.partial) {
		fullContent.push(section.partial);
	}
	if (!section.options?.keepEmptyLines) {
		/* Filter out empty lines */
		fullContent = fullContent.filter((line) => line.trim() !== "");
	}

	if (!fullContent.length) {
		return null;
	}

	{
		/* Handle collapse */
	}
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
		case "confirm":
			collapseThreshold = 999;
			break;
	}
	const shouldCollapse = collapseThreshold > 0 && fullContent.length > collapseThreshold;
	const displayContent =
		shouldCollapse && collapsed ? fullContent.slice(0, collapseThreshold) : fullContent;

	let marginTop = 2;
	if (section.options?.box) {
		marginTop = 0;
	} else if (section.type === "tool_result") {
		marginTop = 0;
	} else if (section.type === "echo") {
		marginTop = 0;
	}

	return (
		<Box
			flexDirection="column"
			marginTop={marginTop}
			padding={section.options?.box ? 1 : 0}
			alignSelf={section.options?.box ? "flex-start" : undefined}
			borderStyle={section.options?.box ? "round" : undefined}
			borderColor={section.options?.box ? "yellow" : undefined}
		>
			{displayContent.map((line, index) => (
				<Box flexDirection="row" key={section.id + "_" + index} columnGap={0}>
					{index === 0 && (
						<Box flexShrink={0} marginRight={prefix.length === 0 ? 0 : 1}>
							<Text color={prefixColor}>{prefix}</Text>
						</Box>
					)}
					<Text>{line || " "}</Text>
				</Box>
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
