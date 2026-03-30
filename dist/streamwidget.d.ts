/**
 * A collapsible streaming text widget for the terminal.
 *
 * During streaming, shows at most 3 lines. Ctrl+O toggles between
 * collapsed and expanded view. After finish(), prints the final state
 * and cleans up raw mode.
 */
export declare class StreamWidget {
    private buffer;
    private expanded;
    private started;
    private finished;
    private renderedLineCount;
    private cols;
    private onKeypress;
    private wasRawMode;
    constructor();
    /** Feed handler — pass this to callLlm's onText. */
    onText: (text: string) => void;
    /** Call when streaming is done. Prints final output and restores terminal. */
    finish(): void;
    /** Whether the widget received any text. */
    get hasContent(): boolean;
    private render;
    private clearRendered;
    /** Wrap text into terminal-width lines for accurate line counting. */
    private wrapLines;
    private startRawMode;
    private stopRawMode;
}
//# sourceMappingURL=streamwidget.d.ts.map