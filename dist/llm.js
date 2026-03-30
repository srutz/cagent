"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.call = call;
const fetchWithError_1 = require("./fetchWithError");
const providers_1 = require("./providers");
async function call(model, messages, options) {
    const envKey = "CUSTOMAGENT_APIKEY_" + model.provider.toUpperCase();
    const apiKey = process.env[envKey];
    if (!apiKey) {
        throw new Error(`API key for model "${model.modelName}" not found. Please set the environment variable ${envKey}`);
    }
    const provider = (0, providers_1.getProvider)(model.provider);
    const request = provider.buildRequest(messages, {
        apiKey,
        model: model.modelName,
        url: model.url,
        maxTokens: options?.maxTokens,
        system: options?.system,
        tools: options?.tools,
    });
    const response = await (0, fetchWithError_1.fetchWithError)(model.url, request);
    const raw = await response.json();
    return provider.parseResponse(raw);
}
//# sourceMappingURL=llm.js.map