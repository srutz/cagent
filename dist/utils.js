"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.c = void 0;
exports.log = log;
exports.divider = divider;
exports.c = {
    reset: "\x1b[0m",
    dim: "\x1b[2m",
    bold: "\x1b[1m",
    cyan: "\x1b[36m",
    green: "\x1b[32m",
    yellow: "\x1b[33m",
    red: "\x1b[31m",
    magenta: "\x1b[35m",
    blue: "\x1b[34m",
    gray: "\x1b[90m",
};
function log(prefix, color, msg) {
    console.log(`${color}${prefix}${exports.c.reset} ${msg}`);
}
function divider(label) {
    const line = "─".repeat(60);
    console.log(`\n${exports.c.dim}${line}${exports.c.reset}`);
    if (label)
        console.log(`${exports.c.dim}  ${label}${exports.c.reset}`);
}
//# sourceMappingURL=utils.js.map