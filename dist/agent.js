#!/usr/bin/env node
"use strict";
/**
 * Coding Agent — TypeScript CLI
 * Uses Claude + tool calling to write, run, and fix code autonomously.
 *
 * Setup:
 *   npm install tsx typescript @types/node
 *   export ANTHROPIC_API_KEY=sk-ant-...
 *   chmod +x agent.ts
 *   ./agent.ts             (interactive REPL)
 *   ./agent.ts "sort a list of numbers in perl"  (one-shot)
 */
var __createBinding = (this && this.__createBinding) || (Object.create ? (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    var desc = Object.getOwnPropertyDescriptor(m, k);
    if (!desc || ("get" in desc ? !m.__esModule : desc.writable || desc.configurable)) {
      desc = { enumerable: true, get: function() { return m[k]; } };
    }
    Object.defineProperty(o, k2, desc);
}) : (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    o[k2] = m[k];
}));
var __setModuleDefault = (this && this.__setModuleDefault) || (Object.create ? (function(o, v) {
    Object.defineProperty(o, "default", { enumerable: true, value: v });
}) : function(o, v) {
    o["default"] = v;
});
var __importStar = (this && this.__importStar) || (function () {
    var ownKeys = function(o) {
        ownKeys = Object.getOwnPropertyNames || function (o) {
            var ar = [];
            for (var k in o) if (Object.prototype.hasOwnProperty.call(o, k)) ar[ar.length] = k;
            return ar;
        };
        return ownKeys(o);
    };
    return function (mod) {
        if (mod && mod.__esModule) return mod;
        var result = {};
        if (mod != null) for (var k = ownKeys(mod), i = 0; i < k.length; i++) if (k[i] !== "default") __createBinding(result, mod, k[i]);
        __setModuleDefault(result, mod);
        return result;
    };
})();
Object.defineProperty(exports, "__esModule", { value: true });
const node_console_1 = require("node:console");
const fs = __importStar(require("node:fs"));
const path = __importStar(require("node:path"));
const node_util_1 = require("node:util");
const api_1 = require("./api");
const commands_1 = require("./commands");
const config_1 = require("./config");
const constants_1 = require("./constants");
const providers_1 = require("./providers");
const readlineutils_1 = require("./readlineutils");
const systemconf_1 = require("./systemconf");
const tools_1 = require("./tools");
const utils_1 = require("./utils");
const versioncheck_1 = require("./versioncheck");
// ─── CLI args ────────────────────────────────────────────────────────────────
const { values: args, positionals } = (0, node_util_1.parseArgs)({
    options: {
        verbose: { type: "boolean", short: "v", default: false },
        help: { type: "boolean", short: "h", default: false },
        session: { type: "string", short: "s" },
        workspace: { type: "string", short: "w" },
        dsn: { type: "string", short: "d" },
    },
    allowPositionals: true,
});
if (args.help) {
    console.log(`${utils_1.c.bold}cagent${utils_1.c.reset} — a coding agent by ${utils_1.c.magenta}stepan.rutz${utils_1.c.reset}`);
    console.log();
    console.log(`Usage: cagent [options] [task]`);
    console.log();
    console.log(`Options:`);
    console.log(`  -v, --verbose          Log API requests and responses`);
    console.log(`  -s, --session <file>   Persist/restore conversation history`);
    console.log(`  -w, --workspace <dir>  Set working directory (default: cwd)`);
    console.log(`  -d, --dsn <url>        PostgreSQL connection string (default: inherit PG* env vars)`);
    console.log(`  -h, --help             Show this message`);
    console.log();
    console.log(`Use /help inside the REPL for interactive commands.`);
    process.exit(0);
}
if (args.workspace) {
    const resolved = path.resolve(args.workspace);
    if (!fs.existsSync(resolved)) {
        console.error(`${utils_1.c.red}workspace not found: ${resolved}${utils_1.c.reset}`);
        process.exit(1);
    }
    (0, constants_1.setWorkspacePath)(resolved);
}
if (args.dsn) {
    (0, constants_1.setDsn)(args.dsn);
}
if (args.verbose) {
    (0, api_1.setVerbose)(true);
}
// ─── Session persistence ─────────────────────────────────────────────────────
let sessionFile = args.session;
function loadSession() {
    if (!sessionFile)
        return [];
    try {
        const data = fs.readFileSync(sessionFile, "utf-8");
        return JSON.parse(data);
    }
    catch {
        return [];
    }
}
function saveSession(history) {
    if (!sessionFile)
        return;
    fs.writeFileSync(sessionFile, JSON.stringify(history, null, 2));
}
// ─── Config ──────────────────────────────────────────────────────────────────
function formatTokens() {
    const t = (0, api_1.getSessionTokens)();
    if (t.total === 0)
        return "";
    return `${utils_1.c.dim}(${t.total.toLocaleString()} tokens)${utils_1.c.reset} `;
}
const MAX_TURNS = 20;
const WORKSPACE = (0, constants_1.getWorkspacePath)();
// ─── Agent loop ───────────────────────────────────────────────────────────────
async function runAgent(userMessage, history, llm) {
    history.push({ role: "user", content: [{ type: "text", text: userMessage }] });
    let turns = 0;
    while (turns < MAX_TURNS) {
        turns++;
        process.stdout.write(`${utils_1.c.dim}[thinking...]${utils_1.c.reset}\r`);
        let streamStarted = false;
        const response = await (0, api_1.callLlm)(history, llm, {
            onText(text) {
                if (!streamStarted) {
                    // Clear thinking indicator and print header
                    process.stdout.write(`\x1b[2K\r`);
                    (0, node_console_1.log)("◆ agent", utils_1.c.cyan, "");
                    streamStarted = true;
                }
                process.stdout.write(text);
            },
        });
        // Clear the thinking indicator (in case no streaming happened)
        if (!streamStarted) {
            process.stdout.write(`\x1b[2K\r`);
        }
        else {
            // End the streamed line
            console.log();
        }
        const tokenStr = formatTokens();
        // Add assistant message to history
        history.push({ role: "assistant", content: response.content });
        // Print text blocks only if we didn't stream them
        if (!streamStarted) {
            for (const block of response.content) {
                if (block.type === "text" && block.text.trim()) {
                    (0, node_console_1.log)(`◆ agent ${tokenStr}`, utils_1.c.cyan, "");
                    console.log(block.text.trim());
                }
            }
        }
        else if (tokenStr) {
            console.log(`${utils_1.c.cyan}◆${utils_1.c.reset} ${tokenStr}`);
        }
        // Done?
        if (response.stop_reason === "end_turn")
            break;
        // Process tool calls
        if (response.stop_reason === "tool_use") {
            const toolResults = [];
            for (const block of response.content) {
                if (block.type !== "tool_use")
                    continue;
                const { id, name, input } = block;
                // Pretty-print the tool call
                (0, utils_1.divider)(`tool: ${name}`);
                const inputLines = JSON.stringify(input, null, 2)
                    .split("\n")
                    .map((l) => `  ${l}`)
                    .join("\n");
                console.log(`${utils_1.c.yellow}${inputLines}${utils_1.c.reset}`);
                // Run it
                const result = (0, tools_1.executeTool)(WORKSPACE, name, input);
                // Print result
                console.log(`${utils_1.c.gray}─ result ─${utils_1.c.reset}`);
                result.split("\n").forEach((line) => {
                    console.log(`${utils_1.c.green}  ${line}${utils_1.c.reset}`);
                });
                toolResults.push({ type: "tool_result", tool_use_id: id, content: result });
            }
            // Feed results back
            history.push({ role: "user", content: toolResults });
            continue;
        }
        // max_tokens or unexpected stop
        break;
    }
    if (turns >= MAX_TURNS) {
        (0, node_console_1.log)("⚠ agent", utils_1.c.yellow, `Hit max turns (${MAX_TURNS}). Stopping.`);
    }
}
// ─── REPL / one-shot entry ────────────────────────────────────────────────────
async function main() {
    const config = await (0, config_1.loadConfig)();
    (0, api_1.buildSystemPrompt)(config);
    (0, systemconf_1.loadSystemConf)();
    // Resolve model: saved preference → first in settings
    const savedModelKey = (0, systemconf_1.getConf)("model");
    const model = (savedModelKey && config.settings.models.find((m) => m.key === savedModelKey)) ||
        config.settings.models[0];
    if (!model) {
        console.error(`${utils_1.c.red}Error: No models configured in settings.json.${utils_1.c.reset}`);
        process.exit(1);
    }
    // Restore stream preference
    const savedStream = (0, systemconf_1.getConf)("stream");
    if (savedStream === "on")
        (0, api_1.setStream)(true);
    const provider = (0, providers_1.getProvider)(model.provider);
    const envKey = `CUSTOMAGENT_APIKEY_${model.provider.toUpperCase()}`;
    const apiKey = process.env[envKey] ?? "";
    if (!apiKey && !model.noApiKey) {
        console.error(`${utils_1.c.red}Error: API key not set.${utils_1.c.reset}\n` + `  Set ${envKey} in your environment`);
        process.exit(1);
    }
    const llm = { model, provider, apiKey };
    console.log(`${utils_1.c.bold}${utils_1.c.magenta}◆ cagent v${require("../package.json").version}${utils_1.c.reset} by stepan.rutz / ${utils_1.c.dim}Model: ${model.provider}: ${model.modelName}${utils_1.c.reset}`);
    await (0, versioncheck_1.checkForUpdate)(require("../package.json").version);
    console.log(`${utils_1.c.dim}  workspace: ${WORKSPACE}${utils_1.c.reset}`);
    console.log(`${utils_1.c.dim}  Disclaimer: cagent may do harm if you are not careful. use at your own risk.${utils_1.c.reset}`);
    const dsn = (0, constants_1.getDsn)();
    if (dsn) {
        console.log(`${utils_1.c.dim}  database:  ${dsn}${utils_1.c.reset}`);
    }
    else if (process.env.PGDATABASE) {
        console.log(`${utils_1.c.dim}  database:  ${process.env.PGDATABASE} (from PG* env vars)${utils_1.c.reset}`);
    }
    const history = loadSession();
    if (sessionFile && history.length > 0) {
        console.log(`${utils_1.c.dim}  restored ${history.length} messages from ${sessionFile}${utils_1.c.reset}`);
    }
    // One-shot mode: argument passed directly
    const oneShot = positionals.join(" ").trim();
    if (oneShot) {
        console.log(`\n${utils_1.c.dim}task: ${oneShot}${utils_1.c.reset}\n`);
        await runAgent(oneShot, history, llm);
        saveSession(history);
        console.log(`\n${utils_1.c.dim}done.${utils_1.c.reset}\n`);
        return;
    }
    // Interactive REPL
    console.log(`${utils_1.c.dim}  Agentloop running. Ctrl+C to exit. /help for commands.\n${utils_1.c.reset}`);
    const repl = (0, readlineutils_1.createRepl)(`${utils_1.c.magenta}you > ${utils_1.c.reset}`);
    repl.rl.prompt();
    for await (const line of repl.rl) {
        const task = line.trim();
        if (!task) {
            repl.rl.prompt();
            continue;
        }
        repl.appendHistory(task);
        const ctx = {
            repl,
            history,
            llm,
            sessionFile,
            setSessionFile: (f) => {
                sessionFile = f;
            },
        };
        if (await (0, commands_1.command)(ctx, task)) {
            continue;
        }
        //console.log();
        try {
            await runAgent(task, history, llm);
            saveSession(history);
        }
        catch (err) {
            (0, node_console_1.log)("✗ error", utils_1.c.red, String(err));
        }
        console.log();
        repl.rl.prompt();
    }
    console.log(`\n${utils_1.c.dim}bye.${utils_1.c.reset}\n`);
}
main().catch((err) => {
    console.error(`${utils_1.c.red}Fatal: ${err.message}${utils_1.c.reset}`);
    process.exit(1);
});
//# sourceMappingURL=agent.js.map