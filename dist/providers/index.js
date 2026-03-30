"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.openaiProvider = exports.anthropicProvider = void 0;
exports.getProvider = getProvider;
var anthropic_1 = require("./anthropic");
Object.defineProperty(exports, "anthropicProvider", { enumerable: true, get: function () { return anthropic_1.anthropicProvider; } });
var openai_1 = require("./openai");
Object.defineProperty(exports, "openaiProvider", { enumerable: true, get: function () { return openai_1.openaiProvider; } });
const anthropic_2 = require("./anthropic");
const openai_2 = require("./openai");
const providers = {
    anthropic: anthropic_2.anthropicProvider,
    openai: openai_2.openaiProvider,
    llamacpp: openai_2.openaiProvider,
    ollama: openai_2.openaiProvider,
};
function getProvider(providerName) {
    const key = providerName.toLowerCase();
    const provider = providers[key];
    if (!provider) {
        throw new Error(`Unknown provider "${providerName}". Supported: ${Object.keys(providers).join(", ")}`);
    }
    return provider;
}
//# sourceMappingURL=index.js.map