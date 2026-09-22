#!/usr/bin/env node
// Fetches the Tiny Swords pack from S3 into public/; the license forbids committing it.
// Lives inside apps/web: Vercel's Root Directory sandbox forbids `..` traversal.
// Pure-JS unzip, not a shelled-out tool: the Vercel build image has neither a working unzip nor a zip-capable tar.

import {
  cpSync,
  existsSync,
  mkdirSync,
  mkdtempSync,
  readdirSync,
  renameSync,
  rmSync,
  statSync,
} from "node:fs";
import { tmpdir } from "node:os";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const APP_ROOT = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const DEST = join(APP_ROOT, "public", "tiny-swords");

try {
  process.loadEnvFile(join(APP_ROOT, ".env"));
} catch {
  // No .env; shell variables still apply.
}

const MARKER = "Units";
const REQUIRED = process.argv.includes("--require") || !!process.env.VERCEL;

const say = (msg) => console.log(`[assets] ${msg}`);

function isPack(dir) {
  try {
    return statSync(dir).isDirectory() && existsSync(join(dir, MARKER));
  } catch {
    return false;
  }
}

// The pack may be at the zip root or one level down, depending on how it was zipped.
function findPack(dir) {
  if (isPack(dir)) return dir;
  for (const entry of readdirSync(dir, { withFileTypes: true })) {
    if (!entry.isDirectory()) continue;
    const inner = join(dir, entry.name);
    if (isPack(inner)) return inner;
  }
  return null;
}

async function fromS3(uri) {
  const parts = /^s3:\/\/([^/]+)\/(.+)$/.exec(uri);
  if (!parts) throw new Error(`TINY_SWORDS_S3 should look like s3://bucket/key, got: ${uri}`);
  const [, bucket, key] = parts;

  const { S3Client, GetObjectCommand } = await import("@aws-sdk/client-s3");
  const { default: AdmZip } = await import("adm-zip");

  // Empty falls back to ~/.aws; a filled-in placeholder fails as "Invalid character in header content".
  for (const name of ["AWS_ACCESS_KEY_ID", "AWS_SECRET_ACCESS_KEY"]) {
    const value = process.env[name];
    if (value && !/^[\x21-\x7e]+$/.test(value)) {
      throw new Error(
        `${name} has characters that cannot be sent in a request. Check .env ` +
          "for a placeholder that was never replaced; leave it empty or drop " +
          "the line to fall back on ~/.aws.",
      );
    }
  }

  say(`fetching s3://${bucket}/${key}`);
  const client = new S3Client({});
  const res = await client.send(new GetObjectCommand({ Bucket: bucket, Key: key }));
  const zip = Buffer.from(await res.Body.transformToByteArray());

  const work = mkdtempSync(join(tmpdir(), "greyfall-assets-"));
  const out = join(work, "out");
  mkdirSync(out, { recursive: true });
  new AdmZip(zip).extractAllTo(out, true);

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
