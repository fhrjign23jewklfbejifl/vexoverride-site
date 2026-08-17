import { spawnSync } from "node:child_process";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const collectorPath = path.join(root, "scripts", "vex-browser-collector.js");
const script = fs.readFileSync(collectorPath, "utf8");

const clip = spawnSync("clip.exe", { input: script });

if (clip.status === 0) {
  console.log("Copied scripts/vex-browser-collector.js to the Windows clipboard.");
} else {
  const copyPath = path.join(root, ".local", "vex-browser-collector-copy.txt");
  fs.mkdirSync(path.dirname(copyPath), { recursive: true });
  fs.writeFileSync(copyPath, script);
  console.log("Could not access the Windows clipboard from this shell.");
  console.log(`Open and copy this file instead: ${copyPath}`);
}

console.log("Open https://events.vex.com/ in Chrome, press F12, open Console, paste, and press Enter.");
