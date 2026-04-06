import { sseLines } from "./sse.js";
import type {
	ApiResponse,
	ContentBlock,
	LLMProvider,
	LLMProviderOptions,
	Message,
	TextBlock,
	ToolResultBlock,
} from "./types.js";

// OpenAI-specific types

interface OpenAIMessage {
	role: "system" | "user" | "assistant" | "tool";
	content?: string | null;
	tool_calls?: OpenAIToolCall[];
	tool_call_id?: string;
}

interface OpenAIToolCall {
	id: string;
	type: "function";
	function: { name: string; arguments: string };
}

interface OpenAITool {
	type: "function";
	function: { name: string; description: string; parameters: Record<string, unknown> };
}

interface OpenAIResponse {
	choices: Array<{
		message: {
			role: string;
			content: string | null;
			tool_calls?: OpenAIToolCall[];
		};
		finish_reason: string;
	}>;
	usage?: {
		prompt_tokens?: number;
		completion_tokens?: number;
	};
}

function convertMessages(messages: Message[], system?: string): OpenAIMessage[] {
	const out: OpenAIMessage[] = [];

	if (system) {
		out.push({ role: "system", content: system });
	}

	for (const msg of messages) {
		const blocks = msg.content;

		// Tool results → role: "tool" messages
		if (blocks.length > 0 && blocks[0] !== undefined && "tool_use_id" in blocks[0]) {
			for (const block of blocks as ToolResultBlock[]) {
				out.push({
					role: "tool",
					tool_call_id: block.tool_use_id,
					content: block.content,
				});
			}
			continue;
		}

		const contentBlocks = blocks as ContentBlock[];

		if (msg.role === "assistant") {
			// Collect text and tool_calls from content blocks
			const textParts: string[] = [];
			const toolCalls: OpenAIToolCall[] = [];

			for (const block of contentBlocks) {
				if (block.type === "text") {
					textParts.push(block.text);
				} else if (block.type === "tool_use") {
					toolCalls.push({
						id: block.id,
						type: "function",
						function: {
							name: block.name,
							arguments: JSON.stringify(block.input),
						},
					});
				}
			}

			const oaiMsg: OpenAIMessage = {
				role: "assistant",
				content: textParts.length > 0 ? textParts.join("\n") : null,
			};
			if (toolCalls.length > 0) {
				oaiMsg.tool_calls = toolCalls;
			}
			out.push(oaiMsg);
		} else {
			// User messages — concatenate text blocks
			const text = contentBlocks
				.filter((b): b is TextBlock => b.type === "text")
				.map((b) => b.text)
				.join("\n");
			out.push({ role: "user", content: text });
		}
	}

	return out;
}

function convertTools(
	tools: { name: string; description: string; input_schema: Record<string, unknown> }[],
): OpenAITool[] {
	return tools.map((t) => ({
		type: "function" as const,
		function: {
			name: t.name,
			description: t.description,
			parameters: t.input_schema,
		},
	}));
}

// Map finish_reason → unified stop_reason

function mapFinishReason(reason: string): string {
	switch (reason) {
		case "stop":
			return "end_turn";
		case "tool_calls":
			return "tool_use";
		case "length":
			return "max_tokens";
		default:
			return reason;
	}
}

// Provider

export const openaiProvider: LLMProvider = {
	buildRequest(messages: Message[], options: LLMProviderOptions): RequestInit {
		const oaiMessages = convertMessages(messages, options.system);

		const body: Record<string, unknown> = {
			model: options.model,
			messages: oaiMessages,
			...(options.stream ? { stream: true } : {}),
		};

		if (options.tools?.length) {
			body.tools = convertTools(options.tools);
		}

		return {
			method: "POST",
			headers: {
				"Content-Type": "application/json",
				Authorization: `Bearer ${options.apiKey}`,
			},
			body: JSON.stringify(body),
		};
	},

	parseResponse(raw: unknown): ApiResponse {
		const res = raw as OpenAIResponse;
		const choice = res.choices?.[0];
		if (!choice) {
			throw new Error("OpenAI response contained no choices");
		}
		const msg = choice.message;
		const content: ContentBlock[] = [];

		if (msg.content) {
			content.push({ type: "text", text: msg.content });
		}

		if (msg.tool_calls) {
			for (const tc of msg.tool_calls) {
				content.push({
					type: "tool_use",
					id: tc.id,
					name: tc.function.name,
					input: JSON.parse(tc.function.arguments),
				});
			}
		}

		return {
			content,
			stop_reason: mapFinishReason(choice.finish_reason),
			...(res.usage && {
				usage: {
					inputTokens: res.usage.prompt_tokens ?? 0,
					outputTokens: res.usage.completion_tokens ?? 0,
				},
			}),
		};
	},

	async parseStream(body, onText) {
		let text = "";
		const toolCalls: Map<number, { id: string; name: string; args: string }> = new Map();
		let finishReason = "stop";
		let inputTokens = 0;
		let outputTokens = 0;

		for await (const data of sseLines(body)) {
			let chunk: Record<string, unknown>;
			try {
				chunk = JSON.parse(data);
			} catch {
				continue;
			}

			const choices = chunk.choices as Array<Record<string, unknown>> | undefined;
			const choice = choices?.[0];
			if (!choice) continue;

			if (choice.finish_reason) {
				finishReason = choice.finish_reason as string;
			}

			const usage = chunk.usage as
				| { prompt_tokens?: number; completion_tokens?: number }
				| undefined;
			if (usage) {
				inputTokens = usage.prompt_tokens ?? inputTokens;
				outputTokens = usage.completion_tokens ?? outputTokens;
			}

			const delta = choice.delta as Record<string, unknown> | undefined;
			if (!delta) continue;

			if (delta.content) {
				const t = delta.content as string;
				text += t;
				onText(t);
			}

			if (delta.tool_calls) {
				for (const tc of delta.tool_calls as Array<Record<string, unknown>>) {
					const idx = tc.index as number;
					const existing = toolCalls.get(idx);
					if (!existing) {
						toolCalls.set(idx, {
							id: (tc.id as string) ?? "",
							name: ((tc.function as Record<string, unknown>)?.name as string) ?? "",
							args: ((tc.function as Record<string, unknown>)?.arguments as string) ?? "",
						});
					} else {
						if (tc.id) existing.id = tc.id as string;
						const fn = tc.function as Record<string, unknown> | undefined;
						if (fn?.name) existing.name += fn.name as string;
						if (fn?.arguments) existing.args += fn.arguments as string;
					}
				}
			}
		}

		const content: ContentBlock[] = [];
		if (text) {
			content.push({ type: "text", text });
		}
		for (const [, tc] of toolCalls) {
			content.push({
				type: "tool_use",
				id: tc.id,
				name: tc.name,
				input: tc.args ? JSON.parse(tc.args) : {},
			});
		}

		return {
			content,
			stop_reason: mapFinishReason(finishReason),
			...((inputTokens || outputTokens) && {
				usage: { inputTokens, outputTokens },
			}),
		};
	},
};
