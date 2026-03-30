import type { Model } from "./config";
import type { ApiResponse, Message, Tool } from "./providers";
export type { ApiResponse, ContentBlock, Message, Role, Tool, ToolResultBlock } from "./providers";
export interface CallOptions {
    system?: string;
    tools?: Tool[];
    maxTokens?: number;
}
export declare function call(model: Model, messages: Message[], options?: CallOptions): Promise<ApiResponse>;
//# sourceMappingURL=llm.d.ts.map