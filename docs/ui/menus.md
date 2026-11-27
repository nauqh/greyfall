# Menus and panels

How Greyfall's menus look and take keys, after Dark Souls III's system menu but
on the game's paper. The pause menu (`apps/web/src/app/atlas/views.tsx`, styles
in `atlas/panel.css` under `.pausePanel`) is the model; build a new menu like it.

## Layout

- **One panel, centred**, a little above the middle (`translate: 0 -32px`),
  fixed height so it does not jump between pages. Built on `SidePanel` with a
  `className`, the paper frame and nothing else round it: no outline, no rule
  under the head, no kicker over the name.
- **Folder tabs**, left-aligned flush with the sheet, rounded at the top, on
  the sheet's top edge. The open tab is the paper's own colour (`#eee1c6`) and
  runs on into the sheet with no line between.
- **One framed sheet** holds the page: the only border in the panel. Line
  colour is opaque (`--frame: #ae8e6c`), never a translucent mix: overlapping
  translucent lines darken at the seam.
- **Rows** as Dark Souls sets a setting: name right-aligned on the left, value
  on the right, no rule between rows. The picked row's name gets an ember glow
  rising to its end (`.setRow.picked dt`), never a box.
- **Buttons** (a page's actions, `Defaults`): narrow (220px), tall (56px),
  text centred, vertically centred in the sheet when they are the whole page.
- **Sliders** in the panel's inks (`.setRange` in `settings/settings.css`):
  rust fill to the level, faint rust past it, a paper knob. The bar spans only
  the knob centre's travel, so at 0 and 100 the knob covers the end.

## Colours

Every menu colour is a token in `:root` (`globals.css`); write the token, never
the hex. Paper `--paper` (sheet, open tab) and `--paperRaised` (options,
cells). Inks `--brown`, `--bark`, `--mute` (the faintest that still reads on
the paper). Lines `--frame`, gilt `--goldLine`, gold sums and heads `--gold`.
`--good` and `--bad` for a rise and a fall. A picked row is `--onPicked` over
the brown bar, its second line `--onPickedNote`. `pnpm --filter @greyfall/web
test` (`scripts/check-colours.mjs`) enforces this and the text contrast; a
colour that is truly the screen's own carries an `/* own colour: why */` note.

## Keys

- **Every key on screen is a `.keyCap`** (`globals.css`): the blue
  `TinySquareBlueButton` of the field's E prompt. `.keyCap.wide` for a named
  key (Esc, Tab), framed inside its 34px height so it stands as tall as E.
- **A hint strip is `KeyHints`** (`atlas/SidePanel.tsx`), written as
  `"W/S pick   E choose   Esc back"`: three spaces between hints, `/` between
  keys. It shows them as Dark Souls 1 does, `W/S: Pick`: a colon after the
  keys and the word capitalised.
- **The pause menu's keys sit apart from it**: bare outlined text at the foot
  of the screen like a talk (`.pauseKeys`), the same strip on every page. No
  key caps on the tab bar.
- **A bonfire screen's keys are its footer** (`.bonfireKeys`): inside the
  paper, left-aligned, in the panel's ink under one rule.
- **The keys**: A/D change (the page, or the picked level), W/S move, E choose,
  Esc back or resume. Tabs start with the pick on the tab bar; S steps down
  into the page. Arrow keys mirror WASD except on a focused slider.

## Sound

Levels live in `apps/web/src/app/sound.ts`: each channel (music, effects) runs
through its own Web Audio gain, so a slider can go past the file's full volume.
Defaults (music 30%, effects 50%) play the mix as made; the field music sits
about 8 dB (LUFS) under the blows, so it shows lower.

## Sources

The Dark Souls III and Elden Ring menus (smoked panel, hairline frame, ember
glow on the picked row, a prompt bar apart at the foot) and Skyrim's controls
list, read 2026-11-15:

1. [Elden Ring Keyboard And Mouse, That Video Game Blog](https://thatvideogameblog.com/elden-ring-keyboard-mouse/)
2. [Elden Ring's mouse and keyboard controls, PC Gamer](https://www.pcgamer.com/elden-ring-pc-keyboard-mouse-controls/)
3. [Skyrim:Controls, UESP Wiki](https://en.uesp.net/wiki/Skyrim:Controls)
4. [Controls, Skyrim Wiki (Fextralife)](https://skyrim.wiki.fextralife.com/Controls)
