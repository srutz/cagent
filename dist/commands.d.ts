import { type LlmOptions } from "./api";
import { type Message } from "./providers";
import type { Repl } from "./readlineutils";
export type AgentContext = {
    repl: Repl;
    history: Message[];
    llm: LlmOptions;
    sessionFile: string | undefined;
    setSessionFile: (file: string) => void;
};
export declare function command(context: AgentContext, task: string): Promise<boolean>;
//# sourceMappingURL=commands.d.ts.map