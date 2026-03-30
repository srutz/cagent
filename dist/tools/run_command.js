"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const node_child_process_1 = require("node:child_process");
const tool = {
    name: "run_command",
    description: "Run a shell command in the workspace directory. Use this to execute code, install packages, run tests, or inspect output. Timeout is 15 seconds. Do NOT use find/ls to list source files — use the list_files tool instead, which automatically excludes node_modules/dist/build directories.",
    input_schema: {
        type: "object",
        properties: {
            command: {
                type: "string",
                description: "Shell command to run",
            },
        },
        required: ["command"],
    },
    execute(workspace, input) {
        const cmd = input.command;
        const result = (0, node_child_process_1.spawnSync)("bash", ["-c", cmd], {
            cwd: workspace,
            timeout: 15_000,
            encoding: "utf8",
        });
        const stdout = result.stdout?.trim() ?? "";
        const stderr = result.stderr?.trim() ?? "";
        const code = result.status ?? -1;
        let out = "";
        if (stdout)
            out += stdout;
        if (stderr)
            out += (out ? "\n--- stderr ---\n" : "") + stderr;
        if (!out)
            out = "(no output)";
        out += `\n[exit code: ${code}]`;
        return out;
    },
};
exports.default = tool;
//# sourceMappingURL=run_command.js.map