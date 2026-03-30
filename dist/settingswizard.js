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
exports.runSettingsWizard = runSettingsWizard;
const fs = __importStar(require("node:fs"));
const path = __importStar(require("node:path"));
const readline = __importStar(require("node:readline"));
const constants_1 = require("./constants");
const utils_1 = require("./utils");
const DEFAULTS = {
    anthropic: {
        url: "https://api.anthropic.com/v1/messages",
        modelName: "claude-sonnet-4-20250514",
        noApiKey: false,
        envVar: "CUSTOMAGENT_APIKEY_ANTHROPIC",
    },
    openai: {
        url: "https://api.openai.com/v1/chat/completions",
        modelName: "gpt-4.1",
        noApiKey: false,
        envVar: "CUSTOMAGENT_APIKEY_OPENAI",
    },
    ollama: {
        url: "http://localhost:11434/v1/chat/completions",
        modelName: "llama3",
        noApiKey: true,
        envVar: "",
    },
};
function ask(rl, question) {
    return new Promise((resolve) => {
        rl.question(question, (answer) => resolve(answer.trim()));
    });
}
async function runSettingsWizard() {
    const rl = readline.createInterface({
        input: process.stdin,
        output: process.stdout,
    });
    console.log(`\n${utils_1.c.bold}Welcome to customagent!${utils_1.c.reset}`);
    console.log(`${utils_1.c.dim}No settings.json found — let's create one.${utils_1.c.reset}\n`);
    // 1. Pick provider
    console.log(`${utils_1.c.bold}Select a provider:${utils_1.c.reset}`);
    console.log(`  ${utils_1.c.cyan}1${utils_1.c.reset}) Anthropic (Claude)`);
    console.log(`  ${utils_1.c.cyan}2${utils_1.c.reset}) OpenAI (GPT-4, etc., compatible with Azure and most LLMs)`);
    console.log(`  ${utils_1.c.cyan}3${utils_1.c.reset}) Ollama (local)\n`);
    let provider;
    while (!provider) {
        const choice = await ask(rl, `${utils_1.c.bold}Enter 1-3:${utils_1.c.reset} `);
        if (choice === "1")
            provider = "anthropic";
        else if (choice === "2")
            provider = "openai";
        else if (choice === "3")
            provider = "ollama";
        else
            console.log(`${utils_1.c.red}Invalid choice. Enter 1, 2, or 3.${utils_1.c.reset}`);
    }
    const defaults = DEFAULTS[provider];
    // 2. Model name
    const modelName = (await ask(rl, `\n${utils_1.c.bold}Model name${utils_1.c.reset} ${utils_1.c.dim}[${defaults.modelName}]:${utils_1.c.reset} `)) || defaults.modelName;
    // 3. API URL
    const url = (await ask(rl, `${utils_1.c.bold}API URL${utils_1.c.reset} ${utils_1.c.dim}[${defaults.url}]:${utils_1.c.reset} `)) ||
        defaults.url;
    // 4. API key reminder (not for ollama)
    if (!defaults.noApiKey) {
        console.log(`\n${utils_1.c.dim}Set your API key before running:${utils_1.c.reset}  export ${defaults.envVar}=<your-key>`);
    }
    // 5. Build key name
    const key = `${provider}-${modelName.replace(/[^a-zA-Z0-9]/g, "-")}`;
    const settings = {
        models: [
            {
                provider,
                key,
                url,
                modelName,
                ...(defaults.noApiKey ? { noApiKey: true } : {}),
            },
        ],
    };
    // 6. Write
    const settingsPath = (0, constants_1.getSettingsFilePath)();
    fs.mkdirSync(path.dirname(settingsPath), { recursive: true });
    fs.writeFileSync(settingsPath, JSON.stringify(settings, null, 2) + "\n");
    console.log(`\n${utils_1.c.green}✓${utils_1.c.reset} Wrote ${utils_1.c.bold}${settingsPath}${utils_1.c.reset}`);
    console.log(`${utils_1.c.dim}Run customagent again to start.${utils_1.c.reset}\n`);
    rl.close();
}
//# sourceMappingURL=settingswizard.js.map