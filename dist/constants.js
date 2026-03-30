"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.getConfigDir = getConfigDir;
exports.getSettingsFilePath = getSettingsFilePath;
exports.getSkillsPath = getSkillsPath;
exports.getMemoryPath = getMemoryPath;
exports.getWorkspacePath = getWorkspacePath;
exports.setWorkspacePath = setWorkspacePath;
exports.getDsn = getDsn;
exports.setDsn = setDsn;
function getConfigDir() {
    const homeDir = process.env.HOME || process.env.USERPROFILE;
    if (!homeDir) {
        throw new Error("Could not determine home directory from environment variables.");
    }
    return `${homeDir}/.customagent`;
}
function getSettingsFilePath() {
    return `${getConfigDir()}/settings.json`;
}
function getSkillsPath() {
    return `${getConfigDir()}/skills`;
}
function getMemoryPath() {
    return `${getConfigDir()}/memory`;
}
let workspacePath = process.cwd();
function getWorkspacePath() {
    return workspacePath;
}
function setWorkspacePath(p) {
    workspacePath = p;
}
let dsn;
function getDsn() {
    return dsn;
}
function setDsn(d) {
    dsn = d;
}
//# sourceMappingURL=constants.js.map