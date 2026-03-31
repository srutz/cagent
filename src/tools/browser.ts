import { execShell, formatResult } from "./agentexec";
import type { ToolDefinition } from "./types";

const tool: ToolDefinition = {
	name: "browser",
	description: `Control a browser using agent-browser. Runs "agent-browser <command>" and returns the output.

Workflow: open a URL, take a snapshot to get element refs (@e1, @e2, ...), then interact using those refs. Always re-snapshot after navigation or DOM changes since refs are invalidated.

Key commands:
  open <url>                  — navigate to a URL
  snapshot -i                 — get accessibility tree with interactive element refs
  snapshot -i -s <selector>   — snapshot scoped to a CSS selector
  click <ref>                 — click an element (e.g. "click @e3")
  fill <ref> <text>           — clear and fill an input field
  type <ref> <text>           — type text without clearing first
  press <key>                 — press a key (e.g. "press Enter")
  select <ref> <value>        — select an option from a dropdown
  check <ref> / uncheck <ref> — toggle a checkbox
  hover <ref>                 — hover over an element
  screenshot [path]           — take a screenshot (default: /tmp/screenshot.png)
  screenshot --full [path]    — full-page screenshot
  get text <ref>              — get text content of an element
  get html <ref>              — get innerHTML of an element
  get value <ref>             — get current value of an input
  get url                     — get current page URL
  get title                   — get page title
  eval <script>               — evaluate JavaScript in the page
  wait <ms|selector>          — wait for time or element
  wait --url <pattern>        — wait for navigation to URL
  wait --text <text>          — wait for text to appear
  scroll [up|down] [amount]   — scroll the page
  back / forward / reload     — navigation history
  tab list                    — list open tabs
  tab new <url>               — open new tab
  tab <index>                 — switch to tab
  close                       — close current tab
  find text <text>            — locate element by visible text
  find role <role>            — locate element by ARIA role
  set viewport <w> <h>        — set viewport size

Use --session <name> at the end of any command for isolated sessions.`,
	input_schema: {
		type: "object",
		properties: {
			command: {
				type: "string",
				description:
					"The agent-browser command to run (without the 'agent-browser' prefix)",
			},
		},
		required: ["command"],
	},
	execute(_workspace, input) {
		const command = input.command as string;
		return formatResult(execShell(`agent-browser ${command}`, { timeout: 30_000 }));
	},
};

export default tool;
