"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.getSessionTokens = getSessionTokens;
exports.resetSessionTokens = resetSessionTokens;
exports.setVerbose = setVerbose;
exports.setStream = setStream;
exports.toggleStream = toggleStream;
exports.getStreamEnabled = getStreamEnabled;
exports.buildSystemPrompt = buildSystemPrompt;
exports.callLlm = callLlm;
const constants_1 = require("./constants");
const tools_1 = require("./tools");
const utils_1 = require("./utils");
const STREAMING_DEFAULT = true; // stream responses by default, but allow disabling for providers that support it
let sessionInputTokens = 0;
let sessionOutputTokens = 0;
function getSessionTokens() {
    return {
        input: sessionInputTokens,
        output: sessionOutputTokens,
        total: sessionInputTokens + sessionOutputTokens,
    };
}
function resetSessionTokens() {
    sessionInputTokens = 0;
    sessionOutputTokens = 0;
}
let verbose = false;
// To change the default streaming behavior,
let streamOverride;
function setVerbose(v) {
    verbose = v;
}
function setStream(enabled) {
    streamOverride = enabled;
}
function toggleStream() {
    const current = streamOverride ?? STREAMING_DEFAULT;
    streamOverride = !current;
    return streamOverride;
}
function getStreamEnabled() {
    return streamOverride ?? STREAMING_DEFAULT;
}
const BASE_SYSTEM_PROMPT = `You are an expert coding agent. When given a task:
1. Break it down and write clean, working code.
2. Always run the code to verify it works.
3. If there are errors, read them carefully and fix them.
4. Iterate until the output is correct.
5. Be concise in your explanations — let the code speak.

Workspace path: ${(0, constants_1.getWorkspacePath)()}
You can write files, read them back, and run shell commands.
Use run_command for inspecting git state (git log, git diff), running tests, or inspecting output. Timeout is 15 seconds. Do NOT use find/ls to list source files — use the list_files tool instead, which automatically excludes node_modules/dist/build directories.
When using grep/rg via run_command, always exclude: node_modules, .git, dist, build, out, .next, target (e.g. --exclude-dir or --glob '!node_modules').
Use web_search to look up documentation, APIs, error messages, or anything else on the web.
Use query to run SQL against the connected PostgreSQL database. Available when launched with --dsn or from within psql.`;
function formatMarkdownSection(label, files) {
    if (files.length === 0)
        return "";
    const parts = files.map((f) => `### ${f.name}\n${f.content}`);
    return `\n\n## ${label}\n${parts.join("\n\n")}`;
}
let systemPrompt = BASE_SYSTEM_PROMPT;
function buildSystemPrompt(config) {
    systemPrompt =
        BASE_SYSTEM_PROMPT +
            formatMarkdownSection("Skills", config.skills) +
            formatMarkdownSection("Memory", config.memory);
}
async function callLlm(messages, llm, opts) {
    const { model, provider, apiKey } = llm;
    const useStream = !model.preventStreaming && (streamOverride ?? STREAMING_DEFAULT);
    const request = provider.buildRequest(messages, {
        apiKey,
        model: model.modelName,
        url: model.url,
        system: systemPrompt,
        tools: tools_1.TOOLS,
        stream: useStream,
    });
    if (verbose) {
        console.log(`${utils_1.c.dim}[verbose] → ${model.url} (stream: ${useStream})${utils_1.c.reset}`);
        try {
            const pretty = JSON.stringify(JSON.parse(request.body), null, 2);
            console.log(`${utils_1.c.dim}[verbose] request:\n${pretty}${utils_1.c.reset}`);
        }
        catch {
            console.log(`${utils_1.c.dim}[verbose] request: ${request.body}${utils_1.c.reset}`);
        }
    }
    const res = await fetch(model.url, request);
    if (!res.ok) {
        const body = await res.text();
        throw new Error(`API error ${res.status}: ${body}`);
    }
    function trackTokens(response) {
        if (response.usage) {
            sessionInputTokens += response.usage.inputTokens;
            sessionOutputTokens += response.usage.outputTokens;
        }
    }
    if (useStream && res.body) {
        const onText = opts?.onText ?? (() => { });
        const response = await provider.parseStream(res.body, onText);
        trackTokens(response);
        if (verbose) {
            try {
                const pretty = JSON.stringify(response, null, 2);
                console.log(`${utils_1.c.dim}[verbose] response:\n${pretty}${utils_1.c.reset}`);
            }
            catch {
                console.log(`${utils_1.c.dim}[verbose] response: ${response}${utils_1.c.reset}`);
            }
        }
        return response;
    }
    const raw = await res.json();
    if (verbose) {
        try {
            const pretty = JSON.stringify(raw, null, 2);
            console.log(`${utils_1.c.dim}[verbose] response:\n${pretty}${utils_1.c.reset}`);
        }
        catch {
            console.log(`${utils_1.c.dim}[verbose] response: ${raw}${utils_1.c.reset}`);
        }
    }
    const response = provider.parseResponse(raw);
    trackTokens(response);
    return response;
}
//# sourceMappingURL=api.js.map