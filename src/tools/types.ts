export interface ToolDefinition {
	name: string;
	description: string;
	input_schema: Record<string, unknown>;
	/** Whether to prompt the user for confirmation before executing. Defaults to true. */
	confirmExec?: boolean;
	/** Whether this tool is enabled. Defaults to true. Disabled tools are not sent to the LLM. */
	enabled?: boolean;
	execute: (workspace: string, input: Record<string, unknown>) => string | Promise<string>;
}
