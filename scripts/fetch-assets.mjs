#!/usr/bin/env node
// Unpacks the Tiny Swords pack into apps/web/public from the private S3 object
// named by TINY_SWORDS_S3. The pack's license forbids redistribution, so it is
// never committed.
//
// The SDK rather than a URL: a public object would be a redistributable copy,
// and a presigned URL expires within 7 days so it cannot live in a host's
// environment. Credentials and region come from the standard AWS chain.
//
// A no-op once unpacked, so it is safe before every dev start. Warns and exits
// 0 when unconfigured; --require exits 1 instead, for a deploy.

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

// Next loads .env for the app; a plain node process does not get that free.
// loadEnvFile leaves existing variables alone, so an export still wins.
try {
  process.loadEnvFile(join(ROOT, ".env"));
} catch {
  // No .env. Shell variables still apply.
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

/** The pack may be at the zip root or one level down, depending on how it was zipped. */
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
  // Windows' system tar is bsdtar, which reads zip; GNU tar does not.
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

  // Otherwise a placeholder pasted from the docs fails as "Invalid character
  // in header content", which names nothing useful.
  for (const name of ["AWS_ACCESS_KEY_ID", "AWS_SECRET_ACCESS_KEY"]) {
    const value = process.env[name];
    if (value !== undefined && !/^[\x21-\x7e]+$/.test(value)) {
      throw new Error(
        `${name} is empty or has characters that cannot be sent in a request. ` +
          "Check .env for a placeholder that was never filled in, or remove the " +
          "line entirely to fall back on ~/.aws.",
      );
    }
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
    // Temp and the repo are often on different volumes; rename cannot cross one.
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
