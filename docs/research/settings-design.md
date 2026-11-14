# Settings page: controls sheet design

Research for the read-only controls page at `/settings`
(`apps/web/src/app/settings/`). Sources at the foot, read 2026-11-15.

## What the reference games do

- **Dark Souls III** (`ds3_20.05.webp`): one dark, smoked panel with a thin
  filigree frame. Lists are serif text over hairline rules; the picked row is
  marked by an orange ember glow under it, not a box. Prompts sit in a bar at
  the bottom left as `glyph :Action`, in the same order on every screen.
- **Elden Ring** (`Elden-Ring-Arrow-Purchase-Screen.webp`, controls menu): the
  same smoked glass and gold hairlines; a tab strip with the shoulder glyphs
  (LB/RB, Q/E on keyboard) at its two ends to say how to switch; section
  headings in a small gold serif with label/value rows under them; the same
  bottom prompt bar. Esc and the map key are fixed and cannot be rebound. [1][2]
- **Skyrim**: System > Controls is a single list of action on the left and
  bound key on the right, one row per action, highlighted on hover; Enter
  starts a rebind. [3][4]

## Design picked

- Full-bleed dark vignette with one smoked panel, gold hairline frame and an
  outer offset outline (DS3/Elden Ring), sized to 760px and the phone width.
- Header: "Controls" in the title's display face (Cinzel), then a tab strip,
  one tab per mode, with dim `Q` and `E` caps at its ends (Elden Ring). The
  picked tab gets the DS3 ember glow and a gold underline.
- Body: groups as Elden Ring sections, a gold small-caps heading (IM Fell SC)
  over Skyrim-style rows: action in IM Fell on the left, keycaps on the right,
  hairline between rows, ember wash on hover. Two columns when wide, one on a
  phone.
- Keycaps: square for a letter, wider for a word, gold hairline on soot, the
  key string shown as given. Each key is its own cap (`W` `A` `S` `D`).
- Footer prompt bar, DS3 style `glyph :Action`: `Q E :Switch tab`,
  `Esc :Back`. The Back prompt is a real link to `/`.
- Keys: Q/E and Left/Right switch tabs and wrap; Esc closes the clouds and
  returns to the title (`useCloudExit`). Tabs are buttons in a `tablist`, so
  mouse and Tab focus work too.
- Colours come from the title ribbon (`#f2ead4` bone, `#f3d58a` gold); fonts
  are the layout's `--display`, `--book` and `--bookSc`. The title's paper is
  not used: a Souls options screen is dark glass, and paper would read as a
  second title menu.

## Sources

1. [Elden Ring Keyboard And Mouse, That Video Game Blog](https://thatvideogameblog.com/elden-ring-keyboard-mouse/)
2. [Elden Ring's mouse and keyboard controls, PC Gamer](https://www.pcgamer.com/elden-ring-pc-keyboard-mouse-controls/)
3. [Skyrim:Controls, UESP Wiki](https://en.uesp.net/wiki/Skyrim:Controls)
4. [Controls, Skyrim Wiki (Fextralife)](https://skyrim.wiki.fextralife.com/Controls)
