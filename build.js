const { execSync } = require("child_process");
const fs = require("fs");
const path = require("path");

const tscPath = path.join(__dirname, "node_modules", "typescript", "bin", "tsc");
if (!fs.existsSync(tscPath)) {
	execSync("npm install --ignore-scripts --no-save typescript", {
		stdio: "inherit",
		cwd: __dirname,
	});
}
execSync(`node "${tscPath}"`, { stdio: "inherit", cwd: __dirname });
