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
redistribution**, so the files are not in this repository and never should be.
Every machine fetches them for itself, into `apps/web/public/tiny-swords`:

```bash
# you already have the pack unzipped somewhere
TINY_SWORDS_PATH=/path/to/unzipped/pack pnpm assets

# or pull a zip, which is what a build host does
TINY_SWORDS_URL=https://your-bucket/tiny-swords.zip pnpm assets
```

`pnpm assets` is idempotent and runs automatically before `dev` and `build`. If
the pack is already in place it does nothing. If no source is configured it
prints these instructions and carries on, so `pnpm dev` still starts; you just
get an unpainted game. Add `--require` to make it fail instead, which is what a
deploy should do rather than shipping a blank board:

```bash
pnpm assets --require
```

`.gitignore` excludes anything named `tiny-swords/` at any depth, so neither a
link nor a copy can be committed by accident.

If the pack is missing, the draft screen still works but loses all its art, and
the battle screen is a blank blue rectangle with a browser console full of 404s
for `/tiny-swords/...`. That is the symptom to recognise.

### Where the assets live in production

The pack is not baked into the image or the repo. A deploy fetches it at build
time from somewhere private that you control (an S3 or R2 bucket, a release
asset, anything that can hand back a zip over HTTPS), so the redistribution
terms are never breached by a public artifact:

```bash
TINY_SWORDS_URL=https://your-bucket/tiny-swords.zip pnpm assets --require
pnpm --filter @greyfall/web build
```

The files land in `apps/web/public/`, which Next serves as ordinary static
files, so nothing else changes. CI itself needs no pack: the build never reads
the art, because every reference to it is a runtime URL.

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
pnpm assets                       # put the art pack in place
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
