"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.openaiProvider = void 0;
const sse_1 = require("./sse");
// ─── Converters ──────────────────────────────────────────────────────────────
function convertMessages(messages, system) {
    const out = [];
    if (system) {
        out.push({ role: "system", content: system });
    }
    for (const msg of messages) {
        const blocks = msg.content;
        // Tool results → role: "tool" messages
        if (blocks.length > 0 && blocks[0] !== undefined && "tool_use_id" in blocks[0]) {
            for (const block of blocks) {
                out.push({
                    role: "tool",
                    tool_call_id: block.tool_use_id,
                    content: block.content,
                });
            }
            continue;
        }
        const contentBlocks = blocks;
        if (msg.role === "assistant") {
            // Collect text and tool_calls from content blocks
            const textParts = [];
            const toolCalls = [];
            for (const block of contentBlocks) {
                if (block.type === "text") {
                    textParts.push(block.text);
                }
                else if (block.type === "tool_use") {
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
            const oaiMsg = {
                role: "assistant",
                content: textParts.length > 0 ? textParts.join("\n") : null,
            };
            if (toolCalls.length > 0) {
                oaiMsg.tool_calls = toolCalls;
            }
            out.push(oaiMsg);
        }
        else {
            // User messages — concatenate text blocks
            const text = contentBlocks
                .filter((b) => b.type === "text")
                .map((b) => b.text)
                .join("\n");
            out.push({ role: "user", content: text });
        }
    }
    return out;
}
function convertTools(tools) {
    return tools.map((t) => ({
        type: "function",
        function: {
            name: t.name,
            description: t.description,
            parameters: t.input_schema,
        },
    }));
}
// ─── Map finish_reason → unified stop_reason ─────────────────────────────────
function mapFinishReason(reason) {
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
// ─── Provider ────────────────────────────────────────────────────────────────
exports.openaiProvider = {
    buildRequest(messages, options) {
        const oaiMessages = convertMessages(messages, options.system);
        const body = {
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
    parseResponse(raw) {
        const res = raw;
        const choice = res.choices?.[0];
        if (!choice) {
            throw new Error("OpenAI response contained no choices");
        }
        const msg = choice.message;
        const content = [];
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
        const toolCalls = new Map();
        let finishReason = "stop";
        let inputTokens = 0;
        let outputTokens = 0;
        for await (const data of (0, sse_1.sseLines)(body)) {
            let chunk;
            try {
                chunk = JSON.parse(data);
            }
            catch {
                continue;
            }
            const choices = chunk.choices;
            const choice = choices?.[0];
            if (!choice)
                continue;
            if (choice.finish_reason) {
                finishReason = choice.finish_reason;
            }
            const usage = chunk.usage;
            if (usage) {
                inputTokens = usage.prompt_tokens ?? inputTokens;
                outputTokens = usage.completion_tokens ?? outputTokens;
            }
            const delta = choice.delta;
            if (!delta)
                continue;
            if (delta.content) {
                const t = delta.content;
                text += t;
                onText(t);
            }
            if (delta.tool_calls) {
                for (const tc of delta.tool_calls) {
                    const idx = tc.index;
                    const existing = toolCalls.get(idx);
                    if (!existing) {
                        toolCalls.set(idx, {
                            id: tc.id ?? "",
                            name: tc.function?.name ?? "",
                            args: tc.function?.arguments ?? "",
                        });
                    }
                    else {
                        if (tc.id)
                            existing.id = tc.id;
                        const fn = tc.function;
                        if (fn?.name)
                            existing.name += fn.name;
                        if (fn?.arguments)
                            existing.args += fn.arguments;
                    }
                }
            }
        }
        const content = [];
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
//# sourceMappingURL=openai.js.map