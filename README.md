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
Each machine points at its own copy.

Download and unzip the pack, then copy `.env.example` to `.env` and set one
line:

```
TINY_SWORDS_PATH=/absolute/path/to/unzipped/tiny-swords
```

That is the whole setup. `pnpm assets` reads it and links the pack into
`apps/web/public/tiny-swords`; it runs automatically before `dev` and `build`,
does nothing if the pack is already there, and a variable exported in the shell
beats the one in the file. `.env` is gitignored, `.env.example` is the template.

If the pack is missing the script says so and carries on, so `pnpm dev` still
starts. You get the draft screen without art and a blank blue battle board,
with 404s for `/tiny-swords/...` in the console. That is the symptom to
recognise. `pnpm assets --require` fails instead of warning, which is what a
deploy wants.

### When you deploy

Set `TINY_SWORDS_URL` to a zip instead, in the host's own environment
variables. The script downloads and unpacks it into `apps/web/public/`, which
Next then serves as static files, so nothing else changes:

```
TINY_SWORDS_URL=https://your-bucket/tiny-swords.zip
```

Two things to know when you get there. Keep the object private and sign a
short-lived URL at deploy time (`aws s3 presign`, or the equivalent) rather
than leaving a public link, since a public pack zip is the redistribution the
license forbids. And because signed URLs expire, that one has to be generated
by the deploy, not written into a file.

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
