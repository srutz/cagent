const { execSync } = require("child_process");
const path = require("path");

let tscJs;
try {
	tscJs = require.resolve("typescript/lib/tsc.js");
} catch {
	console.log("Installing typescript...");
	execSync("npm install --ignore-scripts typescript@6", {
		stdio: "inherit",
		cwd: __dirname,
	});
	tscJs = require.resolve("typescript/lib/tsc.js");
}
execSync(`node "${tscJs}"`, { stdio: "inherit", cwd: __dirname });
