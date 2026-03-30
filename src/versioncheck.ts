import { getConf, setConf } from "./systemconf";
import { c } from "./utils";

const REPO_URL =
	"https://raw.githubusercontent.com/srutz/cagent/main/package.json";
const CHECK_INTERVAL_MS = 24 * 60 * 60 * 1000; // 1 day

export async function checkForUpdate(currentVersion: string) {
	const lastCheck = Number(getConf("lastVersionCheck") || "0");
	if (Date.now() - lastCheck < CHECK_INTERVAL_MS) return;

	setConf("lastVersionCheck", String(Date.now()));

	try {
		const res = await fetch(REPO_URL, { signal: AbortSignal.timeout(3000) });
		if (!res.ok) return;
		const pkg = (await res.json()) as { version: string };
		if (pkg.version && pkg.version !== currentVersion) {
			console.log(
				`${c.yellow}  Update available: v${currentVersion} → v${pkg.version}${c.reset}`,
			);
			console.log(
				`${c.dim}  Run: npx https://github.com/srutz/cagent${c.reset}`,
			);
		}
	} catch {
		// silently ignore network errors
	}
}
