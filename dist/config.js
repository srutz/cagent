"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.config = exports.ConfigSchema = exports.SettingsSchema = exports.FileHandleSchema = exports.ModelSchema = void 0;
exports.loadConfig = loadConfig;
const node_fs_1 = require("node:fs");
const zod_1 = require("zod");
const constants_1 = require("./constants");
const settingswizard_js_1 = require("./settingswizard.js");
// Zod schemas
exports.ModelSchema = zod_1.z.object({
    provider: zod_1.z.string(),
    key: zod_1.z.string(),
    url: zod_1.z.string(),
    modelName: zod_1.z.string(),
    preventStreaming: zod_1.z.boolean().optional(),
    noApiKey: zod_1.z.boolean().optional(),
});
exports.FileHandleSchema = zod_1.z.object({
    name: zod_1.z.string(),
    content: zod_1.z.string(),
});
exports.SettingsSchema = zod_1.z.object({
    models: zod_1.z.array(exports.ModelSchema),
});
exports.ConfigSchema = zod_1.z.object({
    settings: exports.SettingsSchema,
    skills: zod_1.z.array(exports.FileHandleSchema),
    memory: zod_1.z.array(exports.FileHandleSchema),
});
async function loadMarkdownDir(dir) {
    try {
        const files = await node_fs_1.promises.readdir(dir);
        const results = [];
        for (const file of files) {
            if (file.toLowerCase().endsWith(".md")) {
                const content = await node_fs_1.promises.readFile(`${dir}/${file}`, "utf-8");
                results.push({ name: file, content });
            }
        }
        return results;
    }
    catch (error) {
        if (error && typeof error === "object" && "code" in error && error.code !== "ENOENT") {
            console.warn(`⚠️  Warning: Error reading ${dir}:`);
            console.warn(`   ${error instanceof Error ? error.message : String(error)}`);
        }
        return [];
    }
}
async function loadConfig() {
    exports.config = {
        settings: { models: [] },
        skills: [],
        memory: [],
    };
    try {
        const settingsPath = (0, constants_1.getSettingsFilePath)();
        const settingsContent = await node_fs_1.promises.readFile(settingsPath, "utf-8");
        let settingsJson;
        try {
            settingsJson = JSON.parse(settingsContent);
        }
        catch (parseError) {
            console.error(`❌ Error parsing settings.json at ${(0, constants_1.getSettingsFilePath)()}:`);
            console.error(`   Invalid JSON syntax: ${parseError instanceof Error ? parseError.message : String(parseError)}`);
            process.exit(1);
        }
        const parseResult = exports.SettingsSchema.safeParse(settingsJson);
        if (!parseResult.success) {
            console.error("❌ Error validating settings.json:");
            console.error("   The settings file does not match the expected schema:");
            for (const issue of parseResult.error.issues) {
                console.error(`   - ${issue.path.join(".")}: ${issue.message}`);
            }
            process.exit(1);
        }
        exports.config.settings = parseResult.data;
    }
    catch (error) {
        if (error && typeof error === "object" && "code" in error && error.code === "ENOENT") {
            await (0, settingswizard_js_1.runSettingsWizard)();
            process.exit(0);
        }
        throw error;
    }
    // Load skills and memory markdown files (both optional)
    exports.config.skills = await loadMarkdownDir((0, constants_1.getSkillsPath)());
    exports.config.memory = await loadMarkdownDir((0, constants_1.getMemoryPath)());
    return exports.config;
}
exports.config = null;
//# sourceMappingURL=config.js.map