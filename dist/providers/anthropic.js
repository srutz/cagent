"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.anthropicProvider = void 0;
const sse_1 = require("./sse");
exports.anthropicProvider = {
    buildRequest(messages, options) {
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
    parseResponse(raw) {
        const res = raw;
        const usage = res.usage;
        return {
            content: res.content,
            stop_reason: res.stop_reason,
            ...(usage && {
                usage: {
                    inputTokens: usage.input_tokens ?? 0,
                    outputTokens: usage.output_tokens ?? 0,
                },
            }),
        };
    },
    async parseStream(body, onText) {
        const content = [];
        const blocks = new Map();
        const jsonBufs = new Map();
        let stopReason = "end_turn";
        let inputTokens = 0;
        let outputTokens = 0;
        for await (const data of (0, sse_1.sseLines)(body)) {
            let event;
            try {
                event = JSON.parse(data);
            }
            catch {
                continue;
            }
            const type = event.type;
            if (type === "message_start") {
                const msg = event.message;
                const usage = msg?.usage;
                if (usage) {
                    inputTokens += usage.input_tokens ?? 0;
                    outputTokens += usage.output_tokens ?? 0;
                }
            }
            else if (type === "content_block_start") {
                const index = event.index;
                const block = event.content_block;
                blocks.set(index, { ...block });
            }
            else if (type === "content_block_delta") {
                const index = event.index;
                const delta = event.delta;
                const block = blocks.get(index);
                if (delta.type === "text_delta" && block && block.type === "text") {
                    const text = delta.text;
                    block.text += text;
                    onText(text);
                }
                else if (delta.type === "input_json_delta" && block && block.type === "tool_use") {
                    jsonBufs.set(index, (jsonBufs.get(index) ?? "") + delta.partial_json);
                }
            }
            else if (type === "content_block_stop") {
                const index = event.index;
                const block = blocks.get(index);
                if (block) {
                    if (block.type === "tool_use" && jsonBufs.has(index)) {
                        try {
                            // biome-ignore lint/style/noNonNullAssertion: i said so
                            block.input = JSON.parse(jsonBufs.get(index));
                        }
                        catch {
                            block.input = {};
                        }
                    }
                    content.push(block);
                }
            }
            else if (type === "message_delta") {
                const delta = event.delta;
                if (delta.stop_reason) {
                    stopReason = delta.stop_reason;
                }
                const usage = event.usage;
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
//# sourceMappingURL=anthropic.js.map