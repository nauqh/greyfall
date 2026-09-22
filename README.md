# Greyfall

A Souls-themed auto-battler. You buy an army from a fixed roster, arrange it on
a board, and watch it fight. See [PRD.md](PRD.md) for the design and
[AGENTS.md](AGENTS.md) for how work is done in this repo.

Phase 1, the battle prototype, is what currently exists: pick units within a
gold budget, place them on your half of the board, and watch the engine play the
fight back in the browser. No server, database or sign-in yet.

## Requirements

- Node 24 (developed on 24.14). The engine CLI runs TypeScript directly with no
  build step, so older versions of Node may not run it.
- pnpm 10 (developed on 10.28).

## Setup

```bash
pnpm install
```

### The art pack

The game draws entirely on [Tiny Swords](https://pixelfrog-assets.itch.io/tiny-swords)
by Pixel Frog. The license allows commercial use and modification but **forbids
redistribution**, so the pack is not in this repository. It lives in a private
S3 object and each machine fetches its own copy.

Copy `.env.example` to `.env` and point it at the object:

```
TINY_SWORDS_S3=s3://greyfall-assets/tiny-swords/tiny-swords-v1.zip
```

That is the whole setup. `pnpm assets` fetches and unpacks it into
`apps/web/public/tiny-swords`; it runs automatically before `dev` and `build`,
and does nothing if the pack is already unpacked. AWS credentials and region
come from the standard chain, so `~/.aws` works locally and `AWS_*` variables
work on a build host, with no difference in configuration.

The SDK is used rather than a plain URL on purpose. Neither URL shape S3
offers is usable: a public object would be a redistributable copy of the pack,
and a presigned URL expires after at most 7 days so it cannot live in a host's
environment variables. Signing each request keeps the object private and never
goes stale.

If the pack is missing the script says so and carries on, so `pnpm dev` still
starts. You get the draft screen without art and a blank blue battle board,
with 404s for `/tiny-swords/...` in the console. That is the symptom to
recognise. `pnpm assets --require` fails instead of warning, which is what a
deploy wants.

### Uploading a new version of the pack

```bash
powershell -Command "Compress-Archive -Path tiny-swords\* -DestinationPath tiny-swords-v2.zip"
aws s3 cp tiny-swords-v2.zip s3://greyfall-assets/tiny-swords/tiny-swords-v2.zip
```

Use a new name rather than overwriting, then change `TINY_SWORDS_S3`. Builds
stay reproducible and a rollback is one variable. Leave the bucket private.

### When you deploy

Set `TINY_SWORDS_S3` plus AWS credentials in the host's environment variables,
since a build container has no `~/.aws`:

| variable | value |
| --- | --- |
| `TINY_SWORDS_S3` | `s3://greyfall-assets/tiny-swords/tiny-swords-v1.zip` |
| `AWS_ACCESS_KEY_ID` | the deploy user's key |
| `AWS_SECRET_ACCESS_KEY` | its secret |
| `AWS_REGION` | `ap-southeast-1` |

Set them in the platform, not in `.env`. Do not paste a placeholder into
`.env` as a reminder: the SDK would build a request header out of it and fail
with `Invalid character in header content`, which says nothing about the
cause. Leaving the variables unset falls back on `~/.aws`, which is what you
want locally.

All three are needed, region included: with no region resolvable the SDK
fails with `Region is missing` before it reaches S3.

On Vercel, being unconfigured is fatal rather than quiet - `pnpm assets`
treats a missing `TINY_SWORDS_S3` as an error when `VERCEL` is set, so a
forgotten variable stops the build instead of deploying a game with no art.

Give the deploy its own IAM user scoped to `s3:GetObject` on that one key.
Build environment variables are readable by anyone with project access.

The `prebuild` hook runs before `next build`, so the pack is in `public/` by
the time Next copies it into the output, and is then served as static files.
On Vercel, set the project's Root Directory to `apps/web`.

CI needs none of this: the build never reads the art, because every reference
to it is a runtime URL.

### Serving from somewhere other than the root

Everything that asks for a pack file goes through `packUrl`, whose prefix is
`NEXT_PUBLIC_ASSET_BASE` (default `/tiny-swords`). A host that serves the app
under a path sets that one variable. This is what a Discord Activity will need,
since Discord proxies Activity requests behind a `/.proxy/` prefix:

```bash
NEXT_PUBLIC_ASSET_BASE=/.proxy/tiny-swords
```

## Running

```bash
pnpm dev                          # the game; Next prints the port it took
pnpm test                         # engine unit and property tests
pnpm typecheck                    # both packages
pnpm battle                       # print one battle in the terminal
pnpm battle -- --seed 7 --moves   # a chosen seed, movement included
pnpm assets                       # fetch and unpack the art pack
```

The CLI needs no art, so it is the quickest way to check the engine works
before setting the pack up.

## Layout

```
packages/engine   the simulation: balance tables, seeded rng, simulate(),
                  generateArmy(), and a CLI. Pure TypeScript, no dependencies.
apps/web          Next.js app. React for the draft screen, Phaser for the
                  battle playback.
```

The engine is a pure function: armies and a seed in, a result and an event log
out. The client imports it directly for this phase, and because it touches no
I/O it moves to the server unchanged in Phase 2, which is what keeps a preview
and an official result in agreement.

The same armies and the same seed always produce the same battle, so a replay
only needs to store two army snapshots and a seed.
