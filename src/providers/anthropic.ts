import { sseLines } from "./sse.js";
import type { ApiResponse, ContentBlock, LLMProvider, LLMProviderOptions, Message } from "./types.js";

export const anthropicProvider: LLMProvider = {
	buildRequest(messages: Message[], options: LLMProviderOptions): RequestInit {
		return {
			method: "POST",
			headers: {
				"Content-Type": "application/json",
				"x-api-key": options.apiKey,
				"anthropic-version": "2023-06-01",
			},
			body: JSON.stringify({
				model: options.model,
				max_tokens: options.maxTokens ?? 16384,
				...(options.stream ? { stream: true } : {}),
				...(options.system ? { system: options.system } : {}),
				...(options.tools?.length ? { tools: options.tools } : {}),
				messages,
			}),
		};
	},

	parseResponse(raw: unknown): ApiResponse {
		const res = raw as Record<string, unknown>;
		const usage = res.usage as { input_tokens?: number; output_tokens?: number } | undefined;
		return {
			content: res.content as ContentBlock[],
			stop_reason: res.stop_reason as string,
			...(usage && {
				usage: {
					inputTokens: usage.input_tokens ?? 0,
					outputTokens: usage.output_tokens ?? 0,
				},
			}),
		};
	},

	async parseStream(body, onText) {
		const content: ContentBlock[] = [];
		const blocks: Map<number, ContentBlock> = new Map();
		const jsonBufs: Map<number, string> = new Map();
		let stopReason = "end_turn";
		let inputTokens = 0;
		let outputTokens = 0;

		for await (const data of sseLines(body)) {
			let event: Record<string, unknown>;
			try {
				event = JSON.parse(data);
			} catch {
				continue;
			}

			const type = event.type as string;

			if (type === "message_start") {
				const msg = event.message as Record<string, unknown> | undefined;
				const usage = msg?.usage as { input_tokens?: number; output_tokens?: number } | undefined;
				if (usage) {
					inputTokens += usage.input_tokens ?? 0;
					outputTokens += usage.output_tokens ?? 0;
				}
			} else if (type === "content_block_start") {
				const index = event.index as number;
				const block = event.content_block as ContentBlock;
				blocks.set(index, { ...block } as ContentBlock);
			} else if (type === "content_block_delta") {
				const index = event.index as number;
				const delta = event.delta as Record<string, unknown>;
				const block = blocks.get(index);
				if (delta.type === "text_delta" && block && block.type === "text") {
					const text = delta.text as string;
					block.text += text;
					onText(text);
				} else if (delta.type === "input_json_delta" && block && block.type === "tool_use") {
					jsonBufs.set(index, (jsonBufs.get(index) ?? "") + (delta.partial_json as string));
				}
			} else if (type === "content_block_stop") {
				const index = event.index as number;
				const block = blocks.get(index);
				if (block) {
					if (block.type === "tool_use" && jsonBufs.has(index)) {
						try {
							// biome-ignore lint/style/noNonNullAssertion: i said so
							block.input = JSON.parse(jsonBufs.get(index)!);
						} catch {
							block.input = {};
						}
					}
					content.push(block);
				}
			} else if (type === "message_delta") {
				const delta = event.delta as Record<string, unknown>;
				if (delta.stop_reason) {
					stopReason = delta.stop_reason as string;
				}
				const usage = event.usage as { output_tokens?: number } | undefined;
				if (usage) {
					outputTokens = usage.output_tokens ?? outputTokens;
				}
			}
		}

		return {
			content,
			stop_reason: stopReason,
			...((inputTokens || outputTokens) && {
				usage: { inputTokens, outputTokens },
			}),
		};
	},
};
