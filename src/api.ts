import type { Config, FileHandle, Model } from "./config";
import { getWorkspacePath } from "./constants";
import type { ApiResponse, LLMProvider, Message } from "./providers";
import { TOOLS } from "./tools";
import { c } from "./utils";

const STREAMING_DEFAULT = true; // stream responses by default, but allow disabling for providers that support it

let sessionInputTokens = 0;
let sessionOutputTokens = 0;

export function getSessionTokens() {
	return {
		input: sessionInputTokens,
		output: sessionOutputTokens,
		total: sessionInputTokens + sessionOutputTokens,
	};
}

export function resetSessionTokens() {
	sessionInputTokens = 0;
	sessionOutputTokens = 0;
}

let verbose = false;
// To change the default streaming behavior,
let streamOverride: boolean | undefined;
let showThinking = true;

export function setVerbose(v: boolean) {
	verbose = v;
}

export function setStream(enabled: boolean) {
	streamOverride = enabled;
}

export function toggleStream(): boolean {
	const current = streamOverride ?? STREAMING_DEFAULT;
	streamOverride = !current;
	return streamOverride;
}

export function getStreamEnabled(): boolean {
	return streamOverride ?? STREAMING_DEFAULT;
}

export function toggleThinking(): boolean {
	showThinking = !showThinking;
	return showThinking;
}

export function getThinkingEnabled(): boolean {
	return showThinking;
}

const BASE_SYSTEM_PROMPT = `You are an expert coding agent. When given a task:
1. Break it down and write clean, working code.
2. Always run the code to verify it works.
3. If there are errors, read them carefully and fix them.
4. Iterate until the output is correct.
5. Be concise in your explanations — let the code speak.

Workspace path: ${getWorkspacePath()}
You can write files, read them back, and run shell commands.
Use run_command for inspecting git state (git log, git diff), running tests, or inspecting output. Timeout is 15 seconds. Do NOT use find/ls to list source files — use the list_files tool instead, which automatically excludes node_modules/dist/build directories.
When using grep/rg via run_command, always exclude: node_modules, .git, dist, build, out, .next, target (e.g. --exclude-dir or --glob '!node_modules').
Use web_search to look up documentation, APIs, error messages, or anything else on the web.
Use query to run SQL against the connected PostgreSQL database. Available when launched with --dsn or from within psql.`;

function formatMarkdownSection(label: string, files: FileHandle[]): string {
	if (files.length === 0) return "";
	const parts = files.map((f) => `### ${f.name}\n${f.content}`);
	return `\n\n## ${label}\n${parts.join("\n\n")}`;
}

let systemPrompt = BASE_SYSTEM_PROMPT;

export function buildSystemPrompt(config: Config) {
	systemPrompt =
		BASE_SYSTEM_PROMPT +
		formatMarkdownSection("Skills", config.skills) +
		formatMarkdownSection("Memory", config.memory);
}

export type LlmOptions = {
	model: Model;
	provider: LLMProvider;
	apiKey: string;
};

export interface CallLlmOptions {
	/** Called for each streamed text chunk. Only used when streaming is active. */
	onText?: (text: string) => void;
}

export async function callLlm(
	messages: Message[],
	llm: LlmOptions,
	opts?: CallLlmOptions,
): Promise<ApiResponse> {
	const { model, provider, apiKey } = llm;
	const useStream = !model.preventStreaming && (streamOverride ?? STREAMING_DEFAULT);

	const request = provider.buildRequest(messages, {
		apiKey,
		model: model.modelName,
		url: model.url,
		system: systemPrompt,
		tools: TOOLS,
		stream: useStream,
	});

	if (verbose) {
		console.log(`${c.dim}[verbose] → ${model.url} (stream: ${useStream})${c.reset}`);
		try {
			const pretty = JSON.stringify(JSON.parse(request.body as string), null, 2);
			console.log(`${c.dim}[verbose] request:\n${pretty}${c.reset}`);
		} catch {
			console.log(`${c.dim}[verbose] request: ${request.body}${c.reset}`);
		}
	}

	const res = await fetch(model.url, request);

	if (!res.ok) {
		const body = await res.text();
		throw new Error(`API error ${res.status}: ${body}`);
	}

	function trackTokens(response: ApiResponse) {
		if (response.usage) {
			sessionInputTokens += response.usage.inputTokens;
			sessionOutputTokens += response.usage.outputTokens;
		}
	}

	if (useStream && res.body) {
		const onText = opts?.onText ?? (() => {});
		const response = await provider.parseStream(res.body, onText);
		trackTokens(response);

		if (verbose) {
			try {
				const pretty = JSON.stringify(response, null, 2);
				console.log(`${c.dim}[verbose] response:\n${pretty}${c.reset}`);
			} catch {
				console.log(`${c.dim}[verbose] response: ${response}${c.reset}`);
			}
		}

		return response;
	}

	const raw = await res.json();

	if (verbose) {
		try {
			const pretty = JSON.stringify(raw, null, 2);
			console.log(`${c.dim}[verbose] response:\n${pretty}${c.reset}`);
		} catch {
			console.log(`${c.dim}[verbose] response: ${raw}${c.reset}`);
		}
	}

	const response = provider.parseResponse(raw);
	trackTokens(response);
	return response;
}
