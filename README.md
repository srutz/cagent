# Custom Agent

by stepan rutz ([https://stepanrutz.com](https://stepanrutz.com))

License is MIT. See [LICENSE](LICENSE) for details.

This coding-agent is a TypeScript implementation of an autonomous agent framework that can interact with language models, execute tools, and perform tasks based on user input.

It designed to be simple and modular. Also it is meant to be a starting point for including it into your own projects. 

[Hello-World Demo](https://static.stepanrutz.com/cagent.gif)

Specialities include:

- Add new tools in a modular way (see `src/tools/`)
- Support for multiple LLM providers (llama.cpp, ollama, OpenAI, Anthropic, Azure, etc.)
- The agent wrote itself for the most part.

Special config files and directories

$HOME/.customagent/
- `config.json` — global configuration (model, provider, stream, etc.)
- `systemconf.jon` - file written by the agent to store user settings
- `skills/` — directory for agent skills (optional, all Markdown files are loaded as context)
- `memory/ ` — directory for agent memory files (optional, all Markdown files are loaded as context)


- `src/agent.ts` — main agent logic and REPL
- `src/api.ts` — LLM API interaction and configuration
- `src/tools/` — directory for tool definitions and implementations


## Author

- **Name:** Stepan Rutz
- **Webpage:** [https://stepanrutz.com](https://stepanrutz.com)

## Setup

```bash
npm install
npm run build
```

## Run

**Interactive REPL** — ask tasks one at a time:
```bash
npx cagent what tools you got
```

**One-shot** — pass the task as an argument:
```bash
npx cagent "write a python script that finds all prime numbers up to 100"
npx cagent "find and fix bugs in my code, 5 at a time"
```

## Architecture

```
main()
  ├── one-shot mode  (argv)
  └── REPL mode      (readline)
        └── runAgent(task)
              └── loop (max 20 turns)
                    ├── callLLM(messages)   → fetch /v1/messages
                    ├── print text blocks
                    ├── if stop_reason === "end_turn" → done
                    └── if stop_reason === "tool_use"
                          ├── executeTool(name, input)
                          └── append tool_result → continue
```

## Tool Discovery

The agent supports tool usage for code execution, file I/O, search, queries, and more. Tool discovery works as follows:

- Tools are defined as modules in `src/tools/` with a common interface (`ToolDefinition`).
- Each tool provides a name, description, input schema, and an `execute` function.
- The array of enabled tools is managed in [`src/tools/index.ts`](src/tools/index.ts).
- When a tool call is needed (as decided by the LLM), the agent will match the requested tool name against this set.
- Tool metadata (name/description/schema) is sent to the LLM to enable autonomous tool invocation.
- To add a tool, create a new module in `src/tools/`, implement the `ToolDefinition` interface, and add it to the `definitions` array in [`src/tools/index.ts`](src/tools/index.ts).

This design allows the agent to dynamically discover capabilities at launch, exposing all declared tools for use in code generation, REPLs, and more.

To add a tool to the agent, simply create a new file in `src/tools/` that exports a `ToolDefinition` object. Also make sure to add the tool to the `definitions` array in `src/tools/index.ts` so that it is included in the agent's capabilities.

