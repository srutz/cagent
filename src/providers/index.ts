export { anthropicProvider } from "./anthropic";
export { openaiProvider } from "./openai";
export type {
	ApiResponse,
	ContentBlock,
	LLMProvider,
	LLMProviderOptions,
	Message,
	Role,
	TextBlock,
	TokenUsage,
	Tool,
	ToolResultBlock,
	ToolUseBlock,
} from "./types";

import { anthropicProvider } from "./anthropic";
import { openaiProvider } from "./openai";
import type { LLMProvider } from "./types";

const providers: Record<string, LLMProvider> = {
	anthropic: anthropicProvider,
	openai: openaiProvider,
	llamacpp: openaiProvider,
	ollama: openaiProvider,
};

export function getProvider(providerName: string): LLMProvider {
	const key = providerName.toLowerCase();
	const provider = providers[key];
	if (!provider) {
		throw new Error(
			`Unknown provider "${providerName}". Supported: ${Object.keys(providers).join(", ")}`,
		);
	}
	return provider;
}
