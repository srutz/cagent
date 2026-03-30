import * as readline from "readline";
export interface Repl {
    rl: readline.Interface;
    historyLines: string[];
    appendHistory(line: string): void;
}
export declare function createRepl(prompt: string): Repl;
//# sourceMappingURL=readlineutils.d.ts.map