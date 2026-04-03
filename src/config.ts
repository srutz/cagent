import { promises as fs } from "node:fs";
import { z } from "zod";
import { getMemoryPath, getSettingsFilePath, getSkillsPath } from "./constants.js";
import { output } from "./output.js";
import { runSettingsWizard } from "./settingswizard.js";

// Zod schemas
export const ModelSchema = z.object({
	provider: z.string(),
	key: z.string(),
	url: z.string(),
	modelName: z.string(),
	preventStreaming: z.boolean().optional(),
	noApiKey: z.boolean().optional(),
	maxTurns: z.number().int().positive().optional(),
});

export const FileHandleSchema = z.object({
	name: z.string(),
	content: z.string(),
});

export const SettingsSchema = z.object({
	models: z.array(ModelSchema),
});

export const ConfigSchema = z.object({
	settings: SettingsSchema,
	skills: z.array(FileHandleSchema),
	memory: z.array(FileHandleSchema),
});

// Exported types inferred from schemas
export type Model = z.infer<typeof ModelSchema>;
export type FileHandle = z.infer<typeof FileHandleSchema>;
export type Settings = z.infer<typeof SettingsSchema>;
export type Config = z.infer<typeof ConfigSchema>;

async function loadMarkdownDir(dir: string): Promise<FileHandle[]> {
	try {
		const files = await fs.readdir(dir);
		const results: FileHandle[] = [];
		for (const file of files) {
			if (file.toLowerCase().endsWith(".md")) {
				const content = await fs.readFile(`${dir}/${file}`, "utf-8");
				results.push({ name: file, content });
			}
		}
		return results;
	} catch (error) {
		if (error && typeof error === "object" && "code" in error && error.code !== "ENOENT") {
			output.warn(`⚠️  Warning: Error reading ${dir}:`);
			output.warn(`   ${error instanceof Error ? error.message : String(error)}`);
		}
		return [];
	}
}

export async function loadConfig(): Promise<Config> {
	config = {
		settings: { models: [] },
		skills: [],
		memory: [],
	};
	try {
		const settingsPath = getSettingsFilePath();
		const settingsContent = await fs.readFile(settingsPath, "utf-8");

		let settingsJson: unknown;
		try {
			settingsJson = JSON.parse(settingsContent);
		} catch (parseError) {
			output.error(`❌ Error parsing settings.json at ${getSettingsFilePath()}:`);
			output.error(
				`   Invalid JSON syntax: ${parseError instanceof Error ? parseError.message : String(parseError)}`,
			);
			process.exit(1);
		}

		const parseResult = SettingsSchema.safeParse(settingsJson);
		if (!parseResult.success) {
			output.error("❌ Error validating settings.json:");
			output.error("   The settings file does not match the expected schema:");
			for (const issue of parseResult.error.issues) {
				output.error(`   - ${issue.path.join(".")}: ${issue.message}`);
			}
			process.exit(1);
		}

		config.settings = parseResult.data;
	} catch (error) {
		if (error && typeof error === "object" && "code" in error && error.code === "ENOENT") {
			await runSettingsWizard();
			process.exit(0);
		}
		throw error;
	}

	// Load skills and memory markdown files (both optional)
	config.skills = await loadMarkdownDir(getSkillsPath());
	config.memory = await loadMarkdownDir(getMemoryPath());

	return config;
}

export let config: Config | null = null;
