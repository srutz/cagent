"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.TOOLS = void 0;
exports.executeTool = executeTool;
const list_files_1 = __importDefault(require("./list_files"));
const query_1 = __importDefault(require("./query"));
const read_file_1 = __importDefault(require("./read_file"));
const run_command_1 = __importDefault(require("./run_command"));
const web_search_1 = __importDefault(require("./web_search"));
const write_file_1 = __importDefault(require("./write_file"));
const definitions = [
    write_file_1.default,
    read_file_1.default,
    run_command_1.default,
    list_files_1.default,
    web_search_1.default,
    query_1.default,
];
exports.TOOLS = definitions.map(({ name, description, input_schema }) => ({
    name,
    description,
    input_schema,
}));
function executeTool(workspace, name, input) {
    const tool = definitions.find((t) => t.name === name);
    if (!tool)
        return `Error: unknown tool "${name}"`;
    try {
        return tool.execute(workspace, input);
    }
    catch (err) {
        console.error("Tool execution error:", err);
        return `Error: ${err instanceof Error ? err.message : String(err)}`;
    }
}
//# sourceMappingURL=index.js.map