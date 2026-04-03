export { anthropicProvider } from "./anthropic.js";
export { openaiProvider } from "./openai.js";
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
} from "./types.js";

import { anthropicProvider } from "./anthropic.js";
import { openaiProvider } from "./openai.js";
import type { LLMProvider } from "./types.js";

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
