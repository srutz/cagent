const { execSync } = require("child_process");
const fs = require("fs");
const path = require("path");

const tscBin = path.join(__dirname, "node_modules", "typescript", "bin", "tsc");
if (!fs.existsSync(tscBin)) {
	console.log("Installing typescript...");
	execSync("npm install --ignore-scripts --no-save typescript@6", {
		stdio: "inherit",
		cwd: __dirname,
	});
}
// Verify it exists after install
if (!fs.existsSync(tscBin)) {
	// Try resolving from node_modules
	const resolved = path.join(__dirname, "node_modules", ".bin", "tsc");
	console.log("tsc bin not at expected path, trying:", resolved);
	execSync(`"${resolved}"`, { stdio: "inherit", cwd: __dirname });
} else {
	execSync(`node "${tscBin}"`, { stdio: "inherit", cwd: __dirname });
}
