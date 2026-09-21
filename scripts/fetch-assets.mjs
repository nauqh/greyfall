#!/usr/bin/env node
// Puts the Tiny Swords pack where the web app expects it, without ever
// committing it. The pack's license forbids redistribution, so the files live
// outside the repo and every machine has to acquire them for itself.
//
// Order of preference:
//   1. Already there  - a link or folder at apps/web/public/tiny-swords that
//      contains Units/. Nothing to do, so this is safe on every dev start.
//   2. TINY_SWORDS_PATH - an unzipped pack somewhere on this machine. Linked,
//      or copied if the platform refuses a link.
//   3. TINY_SWORDS_URL  - a zip to fetch, for a build or deploy host. This is
//      where a private bucket URL goes.
//
// With none of those set it prints what to do and exits 0, so `pnpm dev` still
// starts (you just get an unpainted game). Pass --require to fail instead,
// which is what a deploy wants rather than shipping a blank board.

import { spawnSync } from "node:child_process";
import {
  cpSync,
  existsSync,
  mkdirSync,
  mkdtempSync,
  readdirSync,
  renameSync,
  rmSync,
  statSync,
  symlinkSync,
  writeFileSync,
} from "node:fs";
import { tmpdir } from "node:os";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const DEST = join(ROOT, "apps", "web", "public", "tiny-swords");

// Read .env at the repo root if there is one, so the settings below can be
// written down once instead of exported every time. Next loads .env for the
// app itself; this is a plain node process and gets none of that for free.
// loadEnvFile does not overwrite variables already in the environment, so an
// export still wins, which is what a deploy relies on.
try {
  process.loadEnvFile(join(ROOT, ".env"));
} catch {
  // No .env, or it is unreadable. Shell variables still apply.
}
/** A folder counts as the pack if it has this inside it. */
const MARKER = "Units";
const REQUIRED = process.argv.includes("--require");

const say = (msg) => console.log(`[assets] ${msg}`);

function isPack(dir) {
  try {
    return statSync(dir).isDirectory() && existsSync(join(dir, MARKER));
  } catch {
    return false;
  }
}

/** The pack folder may sit one level down inside an extracted zip. */
function findPack(dir) {
  if (isPack(dir)) return dir;
  for (const entry of readdirSync(dir, { withFileTypes: true })) {
    if (!entry.isDirectory()) continue;
    const inner = join(dir, entry.name);
    if (isPack(inner)) return inner;
  }
  return null;
}

function link(from) {
  mkdirSync(dirname(DEST), { recursive: true });
  try {
    // A junction needs no elevation on Windows; "dir" is the same idea elsewhere.
    symlinkSync(from, DEST, process.platform === "win32" ? "junction" : "dir");
    say(`linked ${DEST} -> ${from}`);
  } catch (err) {
    say(`could not link (${err.code}), copying instead`);
    cpSync(from, DEST, { recursive: true });
    say(`copied the pack to ${DEST}`);
  }
}

function extract(zip, into) {
  // unzip is on most CI images and in git bash. The system tar on Windows is
  // bsdtar, which reads zip; GNU tar does not, so order matters here.
  const winTar = "C:\\Windows\\System32\\tar.exe";
  const tries = [
    ["unzip", ["-q", zip, "-d", into]],
    [process.platform === "win32" ? winTar : "tar", ["-xf", zip, "-C", into]],
  ];
  for (const [cmd, args] of tries) {
    const run = spawnSync(cmd, args, { stdio: "ignore" });
    if (!run.error && run.status === 0) return true;
  }
  return false;
}

async function fromUrl(url) {
  say("downloading the pack");
  const res = await fetch(url);
  if (!res.ok) throw new Error(`download failed: ${res.status} ${res.statusText}`);

  const work = mkdtempSync(join(tmpdir(), "greyfall-assets-"));
  const zip = join(work, "pack.zip");
  writeFileSync(zip, Buffer.from(await res.arrayBuffer()));

  const out = join(work, "out");
  mkdirSync(out, { recursive: true });
  if (!extract(zip, out)) {
    throw new Error("no usable unzip tool found (tried unzip, then bsdtar)");
  }

  const pack = findPack(out);
  if (!pack) throw new Error(`the archive has no ${MARKER}/ folder in it`);

  mkdirSync(dirname(DEST), { recursive: true });
  rmSync(DEST, { recursive: true, force: true });
  try {
    renameSync(pack, DEST);
  } catch (err) {
    // The temp dir and the repo are often on different volumes (a different
    // drive letter here, a different mount on a build host), and rename
    // cannot cross one. Copying always works.
    if (err.code !== "EXDEV") throw err;
    cpSync(pack, DEST, { recursive: true });
  }
  rmSync(work, { recursive: true, force: true });
  say(`unpacked the pack to ${DEST}`);
}

function missing() {
  const how = [
    "The Tiny Swords pack is not in place, so the game will render unpainted.",
    "",
    "Download it from https://pixelfrog-assets.itch.io/tiny-swords and either:",
    "  TINY_SWORDS_PATH=/path/to/unzipped/pack pnpm assets",
    "  TINY_SWORDS_URL=https://your-bucket/tiny-swords.zip pnpm assets",
    "",
    "See the README. The pack forbids redistribution, which is why it is not",
    "in this repository and why this step exists at all.",
  ].join("\n");
  if (REQUIRED) {
    console.error(how);
    process.exit(1);
  }
  say(how);
}

async function main() {
  if (isPack(DEST)) {
    say("pack already in place");
    return;
  }

  const local = process.env.TINY_SWORDS_PATH;
  if (local) {
    const from = resolve(local);
    if (!isPack(from)) throw new Error(`TINY_SWORDS_PATH has no ${MARKER}/ folder: ${from}`);
    rmSync(DEST, { recursive: true, force: true });
    link(from);
    return;
  }

  const url = process.env.TINY_SWORDS_URL;
  if (url) {
    await fromUrl(url);
    return;
  }

  missing();
}

main().catch((err) => {
  console.error(`[assets] ${err.message}`);
  process.exit(1);
});
