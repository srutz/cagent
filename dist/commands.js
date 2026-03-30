"use strict";
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
exports.command = command;
const node_child_process_1 = require("node:child_process");
const node_console_1 = require("node:console");
const node_crypto_1 = require("node:crypto");
const fs = __importStar(require("node:fs"));
const os = __importStar(require("node:os"));
const path = __importStar(require("node:path"));
const readline = __importStar(require("node:readline"));
const api_1 = require("./api");
const config_1 = require("./config");
const constants_1 = require("./constants");
const providers_1 = require("./providers");
const systemconf_1 = require("./systemconf");
const utils_1 = require("./utils");
function listMdFiles(dir) {
    try {
        return fs
            .readdirSync(dir)
            .filter((f) => f.toLowerCase().endsWith(".md"))
            .map((f) => ({ name: f, size: fs.statSync(path.join(dir, f)).size }));
    }
    catch {
        return [];
    }
}
function formatSize(bytes) {
    if (bytes < 1024)
        return `${bytes} B`;
    return `${(bytes / 1024).toFixed(1)} KB`;
}
async function command(context, task) {
    if (task === "/exit") {
        context.repl.rl.close();
        console.log(`\n${utils_1.c.dim}bye.${utils_1.c.reset}\n`);
        process.exit(0);
    }
    if (task === "/help" || task === "/?") {
        console.log(`\n${utils_1.c.bold}Available commands:${utils_1.c.reset}`);
        console.log(`  ${utils_1.c.cyan}/help${utils_1.c.reset}, ${utils_1.c.cyan}/?${utils_1.c.reset}      Show this help message`);
        console.log(`  ${utils_1.c.cyan}/exit${utils_1.c.reset}          Exit the agent`);
        console.log(`  ${utils_1.c.cyan}/model${utils_1.c.reset}         List models or switch: /model <key>`);
        console.log(`  ${utils_1.c.cyan}/stream${utils_1.c.reset}        Toggle streaming on/off`);
        console.log(`  ${utils_1.c.cyan}/status${utils_1.c.reset}        Show session info, tokens, skills, memory`);
        console.log(`  ${utils_1.c.cyan}/clear${utils_1.c.reset}         Clear conversation history`);
        console.log(`  ${utils_1.c.cyan}/history${utils_1.c.reset}       Show conversation history`);
        console.log(`  ${utils_1.c.cyan}/e${utils_1.c.reset}             Open last response in $EDITOR`);
        console.log(`  ${utils_1.c.cyan}/p${utils_1.c.reset}             Open last response in $PAGER\n`);
        context.repl.rl.prompt();
        return true;
    }
    if (task === "/model" || task.startsWith("/model ")) {
        const models = config_1.config?.settings.models ?? [];
        const arg = task.slice("/model".length).trim();
        if (!arg) {
            // List all models, mark current
            console.log(`\n${utils_1.c.bold}Available models:${utils_1.c.reset}`);
            for (const m of models) {
                const active = m.key === context.llm.model.key ? ` ${utils_1.c.green}(active)${utils_1.c.reset}` : "";
                console.log(`  ${utils_1.c.cyan}${m.key}${utils_1.c.reset} — ${m.provider}: ${m.modelName}${active}`);
            }
            console.log();
        }
        else {
            const match = models.find((m) => m.key === arg);
            if (!match) {
                (0, node_console_1.log)("✗", utils_1.c.red, `unknown model key "${arg}". Use /model to list.`);
            }
            else {
                const envKey = `CUSTOMAGENT_APIKEY_${match.provider.toUpperCase()}`;
                const apiKey = process.env[envKey] ?? "";
                if (!apiKey && !match.noApiKey) {
                    (0, node_console_1.log)("✗", utils_1.c.red, `API key not set for ${match.provider}. Set ${envKey}`);
                }
                else {
                    context.llm.model = match;
                    context.llm.provider = (0, providers_1.getProvider)(match.provider);
                    context.llm.apiKey = apiKey;
                    (0, systemconf_1.setConf)("model", match.key);
                    (0, node_console_1.log)("✓", utils_1.c.green, `switched to ${match.provider}: ${match.modelName}`);
                }
            }
        }
        context.repl.rl.prompt();
        return true;
    }
    if (task === "/stream") {
        const enabled = (0, api_1.toggleStream)();
        (0, systemconf_1.setConf)("stream", enabled ? "on" : "off");
        (0, node_console_1.log)("✓", utils_1.c.green, `streaming ${enabled ? "on" : "off"}`);
        context.repl.rl.prompt();
        return true;
    }
    if (task === "/status") {
        const tokens = (0, api_1.getSessionTokens)();
        console.log(`\n${utils_1.c.bold}Session status:${utils_1.c.reset}`);
        console.log(`  ${utils_1.c.cyan}Model:${utils_1.c.reset}    ${context.llm.model.provider}: ${context.llm.model.modelName}`);
        console.log(`  ${utils_1.c.cyan}History:${utils_1.c.reset}  ${context.history.length} messages`);
        console.log(`  ${utils_1.c.cyan}Tokens:${utils_1.c.reset}   ${tokens.total.toLocaleString()} total (${tokens.input.toLocaleString()} in / ${tokens.output.toLocaleString()} out)`);
        // Skills
        const skills = listMdFiles((0, constants_1.getSkillsPath)());
        if (skills.length > 0) {
            console.log(`\n  ${utils_1.c.bold}Skills${utils_1.c.reset} (${(0, constants_1.getSkillsPath)()}):`);
            for (const f of skills)
                console.log(`    ${utils_1.c.dim}${f.name}${utils_1.c.reset} ${formatSize(f.size)}`);
        }
        else {
            console.log(`\n  ${utils_1.c.dim}No skills (${(0, constants_1.getSkillsPath)()})${utils_1.c.reset}`);
        }
        // Memory
        const memory = listMdFiles((0, constants_1.getMemoryPath)());
        if (memory.length > 0) {
            console.log(`  ${utils_1.c.bold}Memory${utils_1.c.reset} (${(0, constants_1.getMemoryPath)()}):`);
            for (const f of memory)
                console.log(`    ${utils_1.c.dim}${f.name}${utils_1.c.reset} ${formatSize(f.size)}`);
        }
        else {
            console.log(`  ${utils_1.c.dim}No memory (${(0, constants_1.getMemoryPath)()})${utils_1.c.reset}`);
        }
        // Session file
        if (context.sessionFile) {
            try {
                const size = fs.statSync(context.sessionFile).size;
                console.log(`\n  ${utils_1.c.cyan}History file:${utils_1.c.reset} ${context.sessionFile} (${formatSize(size)})`);
            }
            catch {
                console.log(`\n  ${utils_1.c.cyan}History file:${utils_1.c.reset} ${context.sessionFile} (not yet written)`);
            }
        }
        else if (context.history.length > 0) {
            // Offer to save
            const rl = readline.createInterface({ input: process.stdin, output: process.stdout });
            const answer = await new Promise((resolve) => {
                rl.question(`\n  ${utils_1.c.yellow}No history file.${utils_1.c.reset} Save current history? [Y/n] `, (a) => resolve(a.trim()));
            });
            rl.close();
            if (!answer || answer.toLowerCase() === "y") {
                const dir = path.join((0, constants_1.getConfigDir)(), "historyfiles");
                fs.mkdirSync(dir, { recursive: true });
                const file = path.join(dir, `${(0, node_crypto_1.randomUUID)()}.json`);
                fs.writeFileSync(file, JSON.stringify(context.history, null, 2));
                context.setSessionFile(file);
                console.log(`  ${utils_1.c.green}✓${utils_1.c.reset} Saved to ${utils_1.c.bold}${file}${utils_1.c.reset}`);
            }
        }
        else {
            console.log(`\n  ${utils_1.c.dim}No history file (no messages yet)${utils_1.c.reset}`);
        }
        console.log();
        context.repl.rl.prompt();
        return true;
    }
    if (task === "/clear") {
        context.history.length = 0;
        (0, node_console_1.log)("✓", utils_1.c.green, "conversation history cleared");
        context.repl.rl.prompt();
        return true;
    }
    if (task === "/history") {
        if (context.history.length === 0) {
            (0, node_console_1.log)("✗", utils_1.c.red, "no history yet");
            context.repl.rl.prompt();
            return true;
        }
        const lines = [];
        for (const msg of context.history) {
            const role = msg.role === "assistant" ? "assistant" : "user";
            for (const block of msg.content) {
                if (block.type === "text") {
                    lines.push(`[${role}] ${block.text}`);
                }
                else if (block.type === "tool_use") {
                    const tb = block;
                    lines.push(`[${role}] tool_use: ${tb.name}`);
                }
                else if ("tool_use_id" in block) {
                    lines.push(`[${role}] tool_result`);
                }
            }
            lines.push("");
        }
        const text = lines.join("\n");
        const termRows = process.stdout.rows || 24;
        if (text.split("\n").length > termRows) {
            const tmpFile = path.join(os.tmpdir(), `customagent-history-${Date.now()}.txt`);
            fs.writeFileSync(tmpFile, text);
            const pager = process.env.PAGER || "less";
            try {
                (0, node_child_process_1.execSync)(`${pager} ${tmpFile}`, { stdio: "inherit" });
            }
            catch {
                console.log(text);
            }
            finally {
                fs.rmSync(tmpFile, { force: true });
            }
        }
        else {
            console.log(text);
        }
        context.repl.rl.prompt();
        return true;
    }
    if (task === "/e" || task === "/p") {
        const lastAssistant = [...context.history].reverse().find((m) => m.role === "assistant");
        if (!lastAssistant) {
            (0, node_console_1.log)("✗", utils_1.c.red, "no assistant response yet");
            context.repl.rl.prompt();
            return true;
        }
        const text = lastAssistant.content
            .filter((b) => b.type === "text")
            .map((b) => b.text)
            .join("\n");
        if (!text.trim()) {
            (0, node_console_1.log)("✗", utils_1.c.red, "last response has no text content");
            context.repl.rl.prompt();
            return true;
        }
        const tmpFile = path.join(os.tmpdir(), `customagent-response-${Date.now()}.md`);
        fs.writeFileSync(tmpFile, text);
        const program = task === "/e" ? process.env.EDITOR || "vi" : process.env.PAGER || "less";
        try {
            (0, node_child_process_1.execSync)(`${program} ${tmpFile}`, { stdio: "inherit" });
        }
        catch {
            (0, node_console_1.log)("✗", utils_1.c.red, `failed to open ${program}`);
        }
        finally {
            fs.rmSync(tmpFile, { force: true });
        }
        context.repl.rl.prompt();
        return true;
    }
    return false;
}
//# sourceMappingURL=commands.js.map