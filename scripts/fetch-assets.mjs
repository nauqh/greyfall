#!/usr/bin/env node
// Puts the Tiny Swords pack where the web app expects it, without ever
// committing it. The pack's license forbids redistribution, so the files live
// in a private S3 object and every machine fetches them for itself.
//
// The object is read with the AWS SDK rather than over a plain URL, because
// neither URL shape S3 offers works here: a public object is a redistributable
// copy of a pack whose license forbids exactly that, and a presigned URL
// expires (7 days at most) so it cannot sit in a host's environment
// variables. Signing each request keeps the object private and never stales.
//
// Credentials and region come from the standard AWS chain, so this picks up
// ~/.aws locally and AWS_* variables on a build host with no special casing.
//
// Point TINY_SWORDS_S3 at the object, in .env locally or in the host's
// environment for a deploy:
//
//   TINY_SWORDS_S3=s3://greyfall-assets/tiny-swords/tiny-swords-v1.zip
//
// It does nothing when the pack is already unpacked, so it is safe to run
// before every dev start, which is how it is wired. With nothing configured it
// prints what to do and exits 0 so `pnpm dev` still starts, and you get an
// unpainted game. Pass --require to fail instead, which is what a deploy wants
// rather than shipping a blank board.

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
  writeFileSync,
} from "node:fs";
import { tmpdir } from "node:os";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const DEST = join(ROOT, "apps", "web", "public", "tiny-swords");

// Read .env at the repo root if there is one, so the setting can be written
// down once instead of exported every time. Next loads .env for the app
// itself; this is a plain node process and gets none of that for free.
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

/**
 * The pack may sit at the root of the zip or one level down, depending on
 * whether the folder or its contents were zipped. Both are worth accepting;
 * the alternative is a confusing failure the first time it gets re-zipped.
 */
function findPack(dir) {
  if (isPack(dir)) return dir;
  for (const entry of readdirSync(dir, { withFileTypes: true })) {
    if (!entry.isDirectory()) continue;
    const inner = join(dir, entry.name);
    if (isPack(inner)) return inner;
  }
  return null;
}

function extract(zip, into) {
  // unzip is on most CI images and in git bash. The system tar on Windows is
  // bsdtar, which reads zip; GNU tar does not, so the order matters here.
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

async function fromS3(uri) {
  const parts = /^s3:\/\/([^/]+)\/(.+)$/.exec(uri);
  if (!parts) throw new Error(`TINY_SWORDS_S3 should look like s3://bucket/key, got: ${uri}`);
  const [, bucket, key] = parts;

  let S3Client, GetObjectCommand;
  try {
    ({ S3Client, GetObjectCommand } = await import("@aws-sdk/client-s3"));
  } catch {
    throw new Error("@aws-sdk/client-s3 is not installed; run pnpm install");
  }

  say(`fetching s3://${bucket}/${key}`);
  const client = new S3Client({});
  const res = await client.send(new GetObjectCommand({ Bucket: bucket, Key: key }));

  const work = mkdtempSync(join(tmpdir(), "greyfall-assets-"));
  const zip = join(work, "pack.zip");
  writeFileSync(zip, Buffer.from(await res.Body.transformToByteArray()));

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
    // drive letter locally, a different mount on a build host), and rename
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
    "Point TINY_SWORDS_S3 at the object holding it, in .env or the environment:",
    "  TINY_SWORDS_S3=s3://greyfall-assets/tiny-swords/tiny-swords-v1.zip",
    "",
    "AWS credentials come from the usual places (~/.aws, or AWS_* variables).",
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
  const uri = process.env.TINY_SWORDS_S3;
  if (!uri) {
    missing();
    return;
  }
  await fromS3(uri);
}

main().catch((err) => {
  console.error(`[assets] ${err.message}`);
  process.exit(1);
});
