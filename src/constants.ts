export function getConfigDir() {
	const homeDir = process.env.HOME || process.env.USERPROFILE;
	if (!homeDir) {
		throw new Error("Could not determine home directory from environment variables.");
	}
	return `${homeDir}/.customagent`;
}

export function getSettingsFilePath() {
	return `${getConfigDir()}/settings.json`;
}

export function getSkillsPath() {
	return `${getConfigDir()}/skills`;
}

export function getMemoryPath() {
	return `${getConfigDir()}/memory`;
}

let workspacePath = process.cwd();

export function getWorkspacePath() {
	return workspacePath;
}

export function setWorkspacePath(p: string) {
	workspacePath = p;
}

let dsn: string | undefined;

export function getDsn() {
	return dsn;
}

export function setDsn(d: string) {
	dsn = d;
}
