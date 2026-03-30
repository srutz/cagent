import type { Config, Model } from "./config";
import type { ApiResponse, LLMProvider, Message } from "./providers";
export declare function getSessionTokens(): {
    input: number;
    output: number;
    total: number;
};
export declare function resetSessionTokens(): void;
export declare function setVerbose(v: boolean): void;
export declare function setStream(enabled: boolean): void;
export declare function toggleStream(): boolean;
export declare function getStreamEnabled(): boolean;
export declare function buildSystemPrompt(config: Config): void;
export type LlmOptions = {
    model: Model;
    provider: LLMProvider;
    apiKey: string;
};
export interface CallLlmOptions {
    /** Called for each streamed text chunk. Only used when streaming is active. */
    onText?: (text: string) => void;
}
export declare function callLlm(messages: Message[], llm: LlmOptions, opts?: CallLlmOptions): Promise<ApiResponse>;
//# sourceMappingURL=api.d.ts.map