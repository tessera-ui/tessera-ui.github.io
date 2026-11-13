// Builds the homepage's live demo (demo/) to WebAssembly and copies it into
// docs/public/demo/, together with docs/.vitepress/theme/home/demo-build.json.
//
// The demo pins Tessera to one commit in demo/Cargo.toml; the matching
// cargo-tessera is installed into demo/.tools on first use. Release web builds
// also need Binaryen's `wasm-opt` (110 or newer) on PATH.
import {
  cpSync,
  existsSync,
  readFileSync,
  rmSync,
  statSync,
  writeFileSync,
} from "node:fs";
import { join } from "node:path";

const root = join(import.meta.dir, "..");
const demo = join(root, "demo");
const tools = join(demo, ".tools");
const output = join(root, "docs/public/demo");
const info = join(root, "docs/.vitepress/theme/home/demo-build.json");
const REPO = "https://github.com/tessera-ui/tessera";

function run(cmd: string[], cwd = root) {
  console.log(`$ ${cmd.join(" ")}`);
  const result = Bun.spawnSync(cmd, {
    cwd,
    stdout: "inherit",
    stderr: "inherit",
  });
  if (result.exitCode !== 0) process.exit(result.exitCode ?? 1);
}

const manifest = readFileSync(join(demo, "Cargo.toml"), "utf8");
const revs = new Set(
  [...manifest.matchAll(/rev = "([0-9a-f]{40})"/g)].map((m) => m[1]),
);
if (revs.size !== 1)
  throw new Error("demo/Cargo.toml must pin every Tessera crate to one rev");
const [rev] = revs;

if (!Bun.which("wasm-opt")) {
  throw new Error("Install Binaryen 110 or newer and put wasm-opt on PATH");
}

const exe = join(
  tools,
  "bin",
  process.platform === "win32" ? "cargo-tessera.exe" : "cargo-tessera",
);
const stamp = join(tools, "rev");
if (
  !existsSync(exe) ||
  !existsSync(stamp) ||
  readFileSync(stamp, "utf8").trim() !== rev
) {
  run([
    "cargo",
    "install",
    "--git",
    REPO,
    "--rev",
    rev,
    "cargo-tessera",
    "--root",
    tools,
    "--locked",
    "--force",
  ]);
  writeFileSync(stamp, `${rev}\n`);
}

// The binary is a Cargo subcommand, so its first argument is its own name.
run([exe, "tessera", "web", "build", "--release"], demo);

rmSync(output, { recursive: true, force: true });
cpSync(join(demo, "gen/web"), output, { recursive: true });

const wasm = join(output, "pkg-web/tessera_site_demo_lib_bg.wasm");
const bytes = statSync(wasm).size;
const gzip = Bun.gzipSync(readFileSync(wasm)).length;
// Busts browser caches when the build changes; the page passes it to index.html.
const hash = new Bun.CryptoHasher("sha256")
  .update(readFileSync(wasm))
  .digest("hex")
  .slice(0, 12);
writeFileSync(
  info,
  `${JSON.stringify({ rev, hash, wasmBytes: bytes, gzipBytes: gzip }, null, 2)}\n`,
);
console.log(
  `Demo built at ${rev.slice(0, 7)}: ${(bytes / 1e6).toFixed(1)} MB wasm, ${(gzip / 1e6).toFixed(1)} MB gzipped`,
);
