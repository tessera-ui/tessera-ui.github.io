import fs from "node:fs/promises";
import path from "node:path";

const root = path.resolve("docs");
const languages = ["en", "zhHans"];
const files = [];
async function collect(directory) {
  for (const entry of await fs.readdir(directory, { withFileTypes: true })) {
    const filename = path.join(directory, entry.name);
    if (entry.isDirectory()) await collect(filename);
    else if (entry.name.endsWith(".md")) files.push(filename);
  }
}
for (const language of languages) await collect(path.join(root, language));

function route(filename) {
  return (
    "/" +
    path
      .relative(root, filename)
      .replaceAll("\\", "/")
      .replace(/^en\//, "")
      .replace(/\.md$/, "")
      .replace(/(^|\/)index$/, "$1")
  );
}
function normalize(value) {
  return value.replace(/\.html$/, "").replace(/\/$/, "") || "/";
}
const routes = new Set(files.map((filename) => normalize(route(filename))));
const failures = [];
for (const filename of files) {
  const source = await fs.readFile(filename, "utf8");
  const relative = path.relative(root, filename);
  const prose = source.replace(/^(`{3,}|~{3,})[^\n]*\n[\s\S]*?^\1\s*$/gm, "");
  for (const match of prose.matchAll(/\]\(([^\s)]+)(?:\s+"[^"]*")?\)/g)) {
    const target = match[1].split("#")[0];
    if (!target || /^(?:https?:|mailto:|data:)/.test(target)) continue;
    const resolved = new URL(target, `https://docs.test${route(filename)}`)
      .pathname;
    if (routes.has(normalize(resolved))) continue;
    try {
      await fs.access(path.join(root, "public", decodeURIComponent(resolved)));
    } catch {
      failures.push(`${relative}: missing link ${target}`);
    }
  }
  if (relative.replaceAll("\\", "/").includes("/guide/")) {
    if (!/^---\r?\n[\s\S]*?^title: .+$/m.test(source))
      failures.push(`${relative}: missing title`);
    const [language, ...parts] = relative.split(path.sep);
    const peer = path.join(root, language === "en" ? "zhHans" : "en", ...parts);
    try {
      await fs.access(peer);
    } catch {
      failures.push(`${relative}: missing translation`);
    }
  }
}
if (failures.length) {
  console.error(failures.join("\n"));
  process.exitCode = 1;
} else {
  console.log(
    `Checked ${files.length} Markdown pages: local links and guide translations are present.`,
  );
}
