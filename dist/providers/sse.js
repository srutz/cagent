"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.sseLines = sseLines;
/** Async iterator over SSE data lines from a ReadableStream. */
async function* sseLines(body) {
    const reader = body.getReader();
    const decoder = new TextDecoder();
    let buffer = "";
    while (true) {
        const { done, value } = await reader.read();
        if (done)
            break;
        buffer += decoder.decode(value, { stream: true });
        const lines = buffer.split("\n");
        buffer = lines.pop() ?? "";
        for (const line of lines) {
            const trimmed = line.trim();
            if (trimmed.startsWith("data: ")) {
                const data = trimmed.slice(6);
                if (data === "[DONE]")
                    return;
                yield data;
            }
        }
    }
}
//# sourceMappingURL=sse.js.map