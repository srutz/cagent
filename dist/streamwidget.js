"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.StreamWidget = void 0;
const utils_1 = require("./utils");
const COLLAPSED_LINES = 3;
const TOGGLE_KEY = "\x0f"; // Ctrl+O
/**
 * A collapsible streaming text widget for the terminal.
 *
 * During streaming, shows at most 3 lines. Ctrl+O toggles between
 * collapsed and expanded view. After finish(), prints the final state
 * and cleans up raw mode.
 */
class StreamWidget {
    buffer = "";
    expanded = false;
    started = false;
    finished = false;
    renderedLineCount = 0;
    cols;
    onKeypress = null;
    wasRawMode = false;
    constructor() {
        this.cols = process.stdout.columns || 80;
    }
    /** Feed handler — pass this to callLlm's onText. */
    onText = (text) => {
        if (this.finished)
            return;
        if (!this.started) {
            this.started = true;
            // Clear thinking indicator
            process.stdout.write(`\x1b[2K\r`);
            this.startRawMode();
        }
        this.buffer += text;
        this.render();
    };
    /** Call when streaming is done. Prints final output and restores terminal. */
    finish() {
        if (this.finished)
            return;
        this.finished = true;
        this.stopRawMode();
        if (!this.started)
            return;
        // Clear the widget area
        this.clearRendered();
        // Print final output — always expanded
        const lines = this.wrapLines(this.buffer);
        process.stdout.write(`${utils_1.c.cyan}◆ agent${utils_1.c.reset} `);
        if (lines.length <= COLLAPSED_LINES) {
            process.stdout.write(`\n${this.buffer.trim()}\n`);
        }
        else {
            process.stdout.write(`${utils_1.c.dim}(${lines.length} lines)${utils_1.c.reset}\n${this.buffer.trim()}\n`);
        }
    }
    /** Whether the widget received any text. */
    get hasContent() {
        return this.started;
    }
    // ─── Rendering ──────────────────────────────────────────────────────────
    render() {
        this.clearRendered();
        const lines = this.wrapLines(this.buffer);
        const total = lines.length;
        const collapsed = !this.expanded && total > COLLAPSED_LINES;
        const visible = collapsed ? lines.slice(0, COLLAPSED_LINES) : lines;
        const outputLines = [];
        // Header
        if (collapsed) {
            outputLines.push(`${utils_1.c.cyan}◆ agent${utils_1.c.reset} ${utils_1.c.dim}(${total} lines, showing ${COLLAPSED_LINES} — Ctrl+O to expand)${utils_1.c.reset}`);
        }
        else if (total > COLLAPSED_LINES) {
            outputLines.push(`${utils_1.c.cyan}◆ agent${utils_1.c.reset} ${utils_1.c.dim}(${total} lines — Ctrl+O to collapse)${utils_1.c.reset}`);
        }
        else {
            outputLines.push(`${utils_1.c.cyan}◆ agent${utils_1.c.reset}`);
        }
        for (const line of visible) {
            outputLines.push(line);
        }
        if (collapsed) {
            outputLines.push(`${utils_1.c.dim}...${utils_1.c.reset}`);
        }
        const output = outputLines.join("\n");
        process.stdout.write(output);
        this.renderedLineCount = outputLines.length;
    }
    clearRendered() {
        if (this.renderedLineCount > 0) {
            // Move up and clear each line
            process.stdout.write(`\x1b[${this.renderedLineCount - 1}A\r`);
            for (let i = 0; i < this.renderedLineCount; i++) {
                process.stdout.write(`\x1b[2K`);
                if (i < this.renderedLineCount - 1) {
                    process.stdout.write(`\x1b[1B`);
                }
            }
            // Move back to top
            if (this.renderedLineCount > 1) {
                process.stdout.write(`\x1b[${this.renderedLineCount - 1}A`);
            }
            process.stdout.write(`\r`);
            this.renderedLineCount = 0;
        }
    }
    /** Wrap text into terminal-width lines for accurate line counting. */
    wrapLines(text) {
        const raw = text.split("\n");
        const result = [];
        for (const line of raw) {
            if (line.length <= this.cols) {
                result.push(line);
            }
            else {
                for (let i = 0; i < line.length; i += this.cols) {
                    result.push(line.slice(i, i + this.cols));
                }
            }
        }
        return result;
    }
    // ─── Raw mode for key capture ───────────────────────────────────────────
    startRawMode() {
        if (!process.stdin.isTTY)
            return;
        this.wasRawMode = process.stdin.isRaw ?? false;
        process.stdin.setRawMode(true);
        process.stdin.resume();
        this.onKeypress = (data) => {
            const key = data.toString();
            if (key === TOGGLE_KEY) {
                this.expanded = !this.expanded;
                this.render();
            }
            // Ctrl+C during streaming — let it propagate
            if (key === "\x03") {
                this.stopRawMode();
                process.kill(process.pid, "SIGINT");
            }
        };
        process.stdin.on("data", this.onKeypress);
    }
    stopRawMode() {
        if (this.onKeypress) {
            process.stdin.off("data", this.onKeypress);
            this.onKeypress = null;
        }
        if (process.stdin.isTTY) {
            process.stdin.setRawMode(this.wasRawMode);
            // Don't pause stdin — readline still needs it
        }
    }
}
exports.StreamWidget = StreamWidget;
//# sourceMappingURL=streamwidget.js.map