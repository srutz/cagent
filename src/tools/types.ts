export interface ToolDefinition {
	name: string;
	description: string;
	input_schema: Record<string, unknown>;
	execute: (workspace: string, input: Record<string, unknown>) => string;
}
