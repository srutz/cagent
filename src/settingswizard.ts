import * as fs from "node:fs";
import * as path from "node:path";
import * as readline from "node:readline";
import { getSettingsFilePath } from "./constants";
import { c } from "./utils";

type ProviderChoice = "anthropic" | "openai" | "ollama";

const DEFAULTS: Record<
	ProviderChoice,
	{ url: string; modelName: string; noApiKey: boolean; envVar: string }
> = {
	anthropic: {
		url: "https://api.anthropic.com/v1/messages",
		modelName: "claude-sonnet-4-20250514",
		noApiKey: false,
		envVar: "CUSTOMAGENT_APIKEY_ANTHROPIC",
	},
	openai: {
		url: "https://api.openai.com/v1/chat/completions",
		modelName: "gpt-4o",
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

function ask(rl: readline.Interface, question: string): Promise<string> {
	return new Promise((resolve) => {
		rl.question(question, (answer) => resolve(answer.trim()));
	});
}

export async function runSettingsWizard(): Promise<void> {
	const rl = readline.createInterface({
		input: process.stdin,
		output: process.stdout,
	});

	console.log(`\n${c.bold}Welcome to customagent!${c.reset}`);
	console.log(`${c.dim}No settings.json found — let's create one.${c.reset}\n`);

	// 1. Pick provider
	console.log(`${c.bold}Select a provider:${c.reset}`);
	console.log(`  ${c.cyan}1${c.reset}) Anthropic (Claude)`);
	console.log(`  ${c.cyan}2${c.reset}) OpenAI`);
	console.log(`  ${c.cyan}3${c.reset}) Ollama (local)\n`);

	let provider: ProviderChoice | undefined;
	while (!provider) {
		const choice = await ask(rl, `${c.bold}Enter 1-3:${c.reset} `);
		if (choice === "1") provider = "anthropic";
		else if (choice === "2") provider = "openai";
		else if (choice === "3") provider = "ollama";
		else console.log(`${c.red}Invalid choice. Enter 1, 2, or 3.${c.reset}`);
	}

	const defaults = DEFAULTS[provider];

	// 2. Model name
	const modelName =
		(await ask(
			rl,
			`\n${c.bold}Model name${c.reset} ${c.dim}[${defaults.modelName}]:${c.reset} `,
		)) || defaults.modelName;

	// 3. API URL
	const url =
		(await ask(rl, `${c.bold}API URL${c.reset} ${c.dim}[${defaults.url}]:${c.reset} `)) ||
		defaults.url;

	// 4. API key reminder (not for ollama)
	if (!defaults.noApiKey) {
		console.log(
			`\n${c.dim}Set your API key before running:${c.reset}  export ${defaults.envVar}=<your-key>`,
		);
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
	const settingsPath = getSettingsFilePath();
	fs.mkdirSync(path.dirname(settingsPath), { recursive: true });
	fs.writeFileSync(settingsPath, JSON.stringify(settings, null, 2) + "\n");

	console.log(`\n${c.green}✓${c.reset} Wrote ${c.bold}${settingsPath}${c.reset}`);
	console.log(`${c.dim}Run customagent again to start.${c.reset}\n`);

	rl.close();
}
