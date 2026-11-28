# Greyfall

- Player text (dialogue, the prologue, blurbs, notes, item text): read `docs/world/reach.md` "How we tell it", its Voices, and "Who knows what" first. Words: `GLOSSARY.md`.
- Visual change (a screen, a sprite, a map): with `pnpm dev` up, `pnpm shot atlas/dev/<area> out.png` (or any page path), then look at it. Usage in `scripts/shot.mjs`.
- Menus, panels, key hints: `docs/ui/menus.md`.
- Committing: other sessions share the index and working tree, so commit with `scripts/commit-mine.sh` (usage in its header).
- Linear: GRE. Label each issue with one area: `atlas` (lands, maps, areas), `engine` (`packages/engine`), `web` (`apps/web` pages, menus, UI) or `world` (lore, dialogue, `docs/world`). And one type: `add` (something new), `fix` (works wrong), `polish` (finer finish on what works) or `rework` (rebuild what exists). Never create a new label.
