"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const node_child_process_1 = require("node:child_process");
const constants_1 = require("../constants");
const tool = {
    name: "query",
    description: "Run a SQL query against the connected PostgreSQL database using the install psql tool. Returns results in plain text. Use this for SELECT, INSERT, UPDATE, DELETE, or any SQL statement. When no --dsn is provided, it uses inherited PG* environment variables (PGHOST, PGUSER, PGDATABASE, etc.).",
    input_schema: {
        type: "object",
        properties: {
            sql: {
                type: "string",
                description: "SQL statement to execute",
            },
        },
        required: ["sql"],
    },
    execute(_workspace, input) {
        const sql = input.sql;
        const dsn = (0, constants_1.getDsn)();
        const psqlArgs = dsn ? [dsn, "-Atc", sql] : ["-Atc", sql];
        const result = (0, node_child_process_1.spawnSync)("psql", psqlArgs, {
            timeout: 15_000,
            encoding: "utf8",
        });
        const stdout = result.stdout?.trim() ?? "";
        const stderr = result.stderr?.trim() ?? "";
        const code = result.status ?? -1;
        if (code !== 0 && stderr) {
            return `Error: ${stderr}`;
        }
        return stdout || "(no rows)";
    },
};
exports.default = tool;
//# sourceMappingURL=query.js.map