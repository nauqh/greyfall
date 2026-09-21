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
You have to supply them yourself:

1. Download the pack from itch.io and unzip it somewhere. The result should be a
   folder containing `Units/`, `Terrain/`, `UI Elements/`, `Buildings/` and
   `Particle FX/`.
2. Make it reachable at `apps/web/public/tiny-swords`, either as a link or a
   plain copy:

   ```bash
   # git bash / macOS / Linux
   ln -s /absolute/path/to/tiny-swords apps/web/public/tiny-swords
   ```

   ```powershell
   # PowerShell, from the repo root
   New-Item -ItemType SymbolicLink -Path apps\web\public\tiny-swords `
            -Target C:\absolute\path\to\tiny-swords
   ```

   Copying the folder to that path works just as well if symlinks are awkward on
   your machine. `.gitignore` excludes anything named `tiny-swords/` at any
   depth, so neither a link nor a copy can be committed by accident.

If the pack is missing, the draft screen still works but loses all its art, and
the battle screen is a blank blue rectangle with a browser console full of 404s
for `/tiny-swords/...`. That is the symptom to recognise.

## Running

```bash
pnpm --filter @greyfall/web dev   # the game; Next prints the port it took
pnpm test                         # engine unit and property tests
pnpm typecheck                    # both packages
pnpm battle                       # print one battle in the terminal
pnpm battle -- --seed 7 --moves   # a chosen seed, movement included
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
