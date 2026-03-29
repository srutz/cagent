/** Async iterator over SSE data lines from a ReadableStream. */
export async function* sseLines(
	body: ReadableStream<Uint8Array>,
): AsyncGenerator<string> {
	const reader = body.getReader();
	const decoder = new TextDecoder();
	let buffer = "";

	while (true) {
		const { done, value } = await reader.read();
		if (done) break;
		buffer += decoder.decode(value, { stream: true });

		const lines = buffer.split("\n");
		buffer = lines.pop() ?? "";

		for (const line of lines) {
			const trimmed = line.trim();
			if (trimmed.startsWith("data: ")) {
				const data = trimmed.slice(6);
				if (data === "[DONE]") return;
				yield data;
			}
		}
	}
}
