import * as fs from "node:fs";
import * as path from "node:path";
import { getConfigDir } from "./constants.js";

const filePath = path.join(getConfigDir(), "systemconf.json");

let data: Record<string, string> = {};

export function loadSystemConf() {
	try {
		data = JSON.parse(fs.readFileSync(filePath, "utf-8"));
	} catch {
		data = {};
	}
}

function save() {
	fs.mkdirSync(path.dirname(filePath), { recursive: true });
	fs.writeFileSync(filePath, JSON.stringify(data, null, 2));
}

export function getConf(key: string): string | undefined {
	return data[key];
}

export function setConf(key: string, value: string) {
	data[key] = value;
	save();
}
