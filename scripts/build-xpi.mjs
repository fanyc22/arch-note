import { execFileSync } from "node:child_process";
import { mkdirSync, readFileSync, rmSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const root = dirname(dirname(fileURLToPath(import.meta.url)));
const pkg = JSON.parse(readFileSync(join(root, "package.json"), "utf8"));
const dist = join(root, "dist");
const out = join(dist, `arch-note-zotero-deepseek-${pkg.version}.xpi`);

rmSync(dist, { recursive: true, force: true });
mkdirSync(dist, { recursive: true });

const files = [
  "manifest.json",
  "bootstrap.js",
  "prefs.js",
  "preferences.xhtml",
  "preferences.js",
  "chrome"
];

execFileSync("zip", ["-X", "-r", out, ...files], {
  cwd: root,
  stdio: "inherit"
});

console.log(out);
