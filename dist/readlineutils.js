"use strict";
var __createBinding = (this && this.__createBinding) || (Object.create ? (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    var desc = Object.getOwnPropertyDescriptor(m, k);
    if (!desc || ("get" in desc ? !m.__esModule : desc.writable || desc.configurable)) {
      desc = { enumerable: true, get: function() { return m[k]; } };
    }
    Object.defineProperty(o, k2, desc);
}) : (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    o[k2] = m[k];
}));
var __setModuleDefault = (this && this.__setModuleDefault) || (Object.create ? (function(o, v) {
    Object.defineProperty(o, "default", { enumerable: true, value: v });
}) : function(o, v) {
    o["default"] = v;
});
var __importStar = (this && this.__importStar) || (function () {
    var ownKeys = function(o) {
        ownKeys = Object.getOwnPropertyNames || function (o) {
            var ar = [];
            for (var k in o) if (Object.prototype.hasOwnProperty.call(o, k)) ar[ar.length] = k;
            return ar;
        };
        return ownKeys(o);
    };
    return function (mod) {
        if (mod && mod.__esModule) return mod;
        var result = {};
        if (mod != null) for (var k = ownKeys(mod), i = 0; i < k.length; i++) if (k[i] !== "default") __createBinding(result, mod, k[i]);
        __setModuleDefault(result, mod);
        return result;
    };
})();
Object.defineProperty(exports, "__esModule", { value: true });
exports.createRepl = createRepl;
const fs = __importStar(require("node:fs"));
const os = __importStar(require("node:os"));
const path = __importStar(require("node:path"));
const readline = __importStar(require("readline"));
const HISTORY_DIR = path.join(os.homedir(), ".customagent");
const HISTORY_FILE = path.join(HISTORY_DIR, "readline.history");
const MAX_HISTORY = 500;
function loadHistory() {
    try {
        if (!fs.existsSync(HISTORY_FILE))
            return [];
        return fs
            .readFileSync(HISTORY_FILE, "utf8")
            .split("\n")
            .filter((l) => l.length > 0);
    }
    catch {
        return [];
    }
}
function saveHistory(lines) {
    fs.mkdirSync(HISTORY_DIR, { recursive: true });
    fs.writeFileSync(HISTORY_FILE, lines.slice(-MAX_HISTORY).join("\n") + "\n", "utf8");
}
function appendHistory(line, lines) {
    if (line && lines[lines.length - 1] !== line) {
        lines.push(line);
    }
    saveHistory(lines);
}
function createRepl(prompt) {
    const historyLines = loadHistory();
    const rl = readline.createInterface({
        input: process.stdin,
        output: process.stdout,
        prompt,
        history: historyLines.slice().reverse(),
        historySize: MAX_HISTORY,
    });
    return {
        rl,
        historyLines,
        appendHistory(line) {
            appendHistory(line, historyLines);
        },
    };
}
//# sourceMappingURL=readlineutils.js.map