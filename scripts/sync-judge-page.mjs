import { mkdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";
import process from "node:process";

const root = process.cwd();
const sourcePath = path.join(root, "index.html");
const judgeDirectory = path.join(root, "judge");
const judgePath = path.join(judgeDirectory, "index.html");
const checkOnly = process.argv.includes("--check");
const source = await readFile(sourcePath, "utf8");

if (checkOnly) {
  const judge = await readFile(judgePath, "utf8").catch(() => "");
  if (judge !== source) {
    console.error("judge/index.html is out of sync. Run npm.cmd run sync:judge.");
    process.exitCode = 1;
  } else {
    console.log("judge/index.html matches index.html.");
  }
} else {
  await mkdir(judgeDirectory, { recursive: true });
  await writeFile(judgePath, source, "utf8");
  console.log("Synced judge/index.html from index.html.");
}
