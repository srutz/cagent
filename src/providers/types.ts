/**
 * Provider-agnostic types and interface for LLM providers.
 *
 * The internal message format follows Anthropic's structure (content blocks).
 * Each provider adapter translates to/from this format at the boundary.
 */

// ─── Unified internal types ──────────────────────────────────────────────────

export type Role = "user" | "assistant";

export interface TextBlock {
	type: "text";
	text: string;
}

export interface ToolUseBlock {
	type: "tool_use";
	id: string;
	name: string;
	input: Record<string, unknown>;
}

export interface ToolResultBlock {
	type: "tool_result";
	tool_use_id: string;
	content: string;
}

export type ContentBlock = TextBlock | ToolUseBlock;

export interface Message {
	role: Role;
	content: ContentBlock[] | ToolResultBlock[];
}

export interface TokenUsage {
	inputTokens: number;
	outputTokens: number;
}

export interface ApiResponse {
	content: ContentBlock[];
	stop_reason: "end_turn" | "tool_use" | "max_tokens" | string;
	usage?: TokenUsage;
}

export interface Tool {
	name: string;
	description: string;
	input_schema: Record<string, unknown>;
}

// ─── Provider interface ──────────────────────────────────────────────────────

export interface LLMProviderOptions {
	apiKey: string;
	model: string;
	url: string;
	maxTokens?: number | undefined;
	system?: string | undefined;
	tools?: Tool[] | undefined;
	stream?: boolean | undefined;
}

export interface LLMProvider {
	/** Build the fetch RequestInit for this provider. */
	buildRequest(messages: Message[], options: LLMProviderOptions): RequestInit;

	/** Parse the raw JSON response into unified ApiResponse. */
	parseResponse(raw: unknown): ApiResponse;

	/** Parse an SSE stream, calling onText for each text chunk. Returns the full response. */
	parseStream(
		body: ReadableStream<Uint8Array>,
		onText: (text: string) => void,
	): Promise<ApiResponse>;
}
