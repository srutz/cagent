import { z } from "zod";
export declare const ModelSchema: z.ZodObject<{
    provider: z.ZodString;
    key: z.ZodString;
    url: z.ZodString;
    modelName: z.ZodString;
    preventStreaming: z.ZodOptional<z.ZodBoolean>;
    noApiKey: z.ZodOptional<z.ZodBoolean>;
}, z.core.$strip>;
export declare const FileHandleSchema: z.ZodObject<{
    name: z.ZodString;
    content: z.ZodString;
}, z.core.$strip>;
export declare const SettingsSchema: z.ZodObject<{
    models: z.ZodArray<z.ZodObject<{
        provider: z.ZodString;
        key: z.ZodString;
        url: z.ZodString;
        modelName: z.ZodString;
        preventStreaming: z.ZodOptional<z.ZodBoolean>;
        noApiKey: z.ZodOptional<z.ZodBoolean>;
    }, z.core.$strip>>;
}, z.core.$strip>;
export declare const ConfigSchema: z.ZodObject<{
    settings: z.ZodObject<{
        models: z.ZodArray<z.ZodObject<{
            provider: z.ZodString;
            key: z.ZodString;
            url: z.ZodString;
            modelName: z.ZodString;
            preventStreaming: z.ZodOptional<z.ZodBoolean>;
            noApiKey: z.ZodOptional<z.ZodBoolean>;
        }, z.core.$strip>>;
    }, z.core.$strip>;
    skills: z.ZodArray<z.ZodObject<{
        name: z.ZodString;
        content: z.ZodString;
    }, z.core.$strip>>;
    memory: z.ZodArray<z.ZodObject<{
        name: z.ZodString;
        content: z.ZodString;
    }, z.core.$strip>>;
}, z.core.$strip>;
export type Model = z.infer<typeof ModelSchema>;
export type FileHandle = z.infer<typeof FileHandleSchema>;
export type Settings = z.infer<typeof SettingsSchema>;
export type Config = z.infer<typeof ConfigSchema>;
export declare function loadConfig(): Promise<Config>;
export declare let config: Config | null;
//# sourceMappingURL=config.d.ts.map