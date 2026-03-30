"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.checkForUpdate = checkForUpdate;
const systemconf_1 = require("./systemconf");
const utils_1 = require("./utils");
const REPO_URL = "https://raw.githubusercontent.com/srutz/cagent/main/package.json";
const CHECK_INTERVAL_MS = 24 * 60 * 60 * 1000; // 1 day
async function checkForUpdate(currentVersion) {
    const lastCheck = Number((0, systemconf_1.getConf)("lastVersionCheck") || "0");
    if (Date.now() - lastCheck < CHECK_INTERVAL_MS)
        return;
    (0, systemconf_1.setConf)("lastVersionCheck", String(Date.now()));
    try {
        const res = await fetch(REPO_URL, { signal: AbortSignal.timeout(3000) });
        if (!res.ok)
            return;
        const pkg = (await res.json());
        if (pkg.version && pkg.version !== currentVersion) {
            console.log(`${utils_1.c.yellow}  Update available: v${currentVersion} → v${pkg.version}${utils_1.c.reset}`);
            console.log(`${utils_1.c.dim}  Run: npx https://github.com/srutz/cagent${utils_1.c.reset}`);
        }
    }
    catch {
        // silently ignore network errors
    }
}
//# sourceMappingURL=versioncheck.js.map