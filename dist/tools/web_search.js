"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const ENGINES = [
    {
        name: "DuckDuckGo",
        url: (q) => `https://html.duckduckgo.com/html/?q=${encodeURIComponent(q)}`,
    },
    {
        name: "Google",
        url: (q) => `https://www.google.com/search?q=${encodeURIComponent(q)}&hl=en`,
    },
    {
        name: "Yandex",
        url: (q) => `https://yandex.com/search/?text=${encodeURIComponent(q)}`,
    },
];
const tool = {
    name: "web_search",
    description: "Search the web for information. Tries multiple search engines (Google, Yandex, DuckDuckGo) and returns results from the first one that succeeds.",
    input_schema: {
        type: "object",
        properties: {
            query: {
                type: "string",
                description: "The search query",
            },
        },
        required: ["query"],
    },
    execute(_workspace, input) {
        const query = input.query;
        // execute is sync but we need async fetch — use a blocking approach
        // by spawning a subprocess that runs the async search
        const { spawnSync } = require("node:child_process");
        const script = `
			const ENGINES = ${JSON.stringify(ENGINES.map((e) => ({ name: e.name, url: e.url(query) })))};

			function extractText(html) {
				return html
					.replace(/<script[^>]*>[\\s\\S]*?<\\/script>/gi, "")
					.replace(/<style[^>]*>[\\s\\S]*?<\\/style>/gi, "")
					.replace(/<[^>]+>/g, " ")
					.replace(/&nbsp;/g, " ")
					.replace(/&amp;/g, "&")
					.replace(/&lt;/g, "<")
					.replace(/&gt;/g, ">")
					.replace(/&quot;/g, '"')
					.replace(/&#\\d+;/g, "")
					.replace(/[ \\t]+/g, " ")
					.replace(/\\n\\s*\\n/g, "\\n")
					.trim();
			}

			async function main() {
				for (const engine of ENGINES) {
					try {
						const res = await fetch(engine.url, {
							headers: {
								"User-Agent": "Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
								"Accept": "text/html",
								"Accept-Language": "en-US,en;q=0.9",
							},
							redirect: "follow",
							signal: AbortSignal.timeout(10000),
						});
						if (!res.ok) continue;
						const html = await res.text();
						const text = extractText(html);
						if (text.length < 100) continue;
						console.log("[" + engine.name + "]\\n" + text.slice(0, 8000));
						return;
					} catch {}
				}
				console.log("Error: all search engines failed");
			}
			main();
		`;
        const result = spawnSync("node", ["-e", script], {
            timeout: 30_000,
            encoding: "utf8",
        });
        const out = result.stdout?.trim() ?? "";
        const err = result.stderr?.trim() ?? "";
        if (out)
            return out;
        if (err)
            return `Error: ${err}`;
        return "Error: all search engines failed";
    },
};
exports.default = tool;
//# sourceMappingURL=web_search.js.map