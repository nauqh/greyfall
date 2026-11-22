# Laying out the character creation screen

Research for the layout of `apps/web/src/app/atlas/Creation.tsx` and `CreationScene.tsx`: where the
option list, the class on show, the numbers and the telling go on a 16:9 screen, drawn in Tiny
Swords pieces at whole-number scale. Sources at the foot, read 2026-11-22. Shares and margins were
measured off the screenshots named in each bullet (about 1% either way). First-party pages with
screenshots of these screens were not reachable (the wikis and guide sites below returned 403 or
402 to the fetcher); where a fan wiki or a player screenshot stands in, it says so.

## What the reference games do

- **Elden Ring, Select Character Base** (user-supplied screenshot [5]): three tall cards side by
  side, each 28% of the width and 73% of the height, 1% gaps, 7% side margin, a `<` `>` arrow at
  4% and 96% to page through the ten origins. The art fills each card; the stats (Level plus eight
  attributes) and the starting kit icons sit *on* the art in its lower half; the name is a plate at
  the foot. The selected card gets a gold frame and a faint glow, nothing else changes. Title strip
  top left with an icon; help text and key prompts bottom left at 93 to 97% down.
- **Elden Ring, Create Character** (user-supplied screenshot [6], field order from [7]): a left
  field column (Name, Body Type, Age, Origin, Keepsake, Choose Base Template, Detailed Appearance)
  at 8 to 22% across, plain text rows with no boxes. Choosing Origin opens a centre panel at 23 to
  49% across, 15 to 80% down: the origin's two-line description at its **top**, then ten centred
  plain rows (each about 4.5% of the height). The selected row in both columns is marked only by a
  soft lighter **band** across the column's full width. The "Character Status" column (Level, eight
  attributes, kit icons) sits at 52 to 65%, directly beside the model; the model stands at 55 to
  77%, about 63% of the screen height, and is the brightest thing on screen. The right 20% is
  empty dark backdrop. "Finish" is the only boxed button. Foot: help line plus prompts, bottom left.
- **Dark Souls III, character creation** (Polish-language screenshot from a third-party guide
  [8]): one left panel, 3.5 to 53% across and 14 to 85% down, holding everything: field labels
  right-aligned in a column (Name, Gender, Age, Class, Burial Gift, Face Templates, Physique,
  Appearance) with values on underlined rules beside them, then the stats list and an equipment
  icon grid below, then a boxed "Finish". The model has its own framed box at 55 to 97% across. The
  active field is marked by an orange ember glow behind its label. Help line and prompts at the foot.
- **Skyrim, race menu** (UESP fan wiki screenshot [9]): no panel at all. The world (Helgen) fills
  the screen and the character's head and torso take the centre-right half. A tab strip (Race,
  Body, Head) sits top centre in a thin frame. The race list is right-aligned plain text at 17 to
  34% across with a hairline on either side; the selected race sits at mid-height, larger, white,
  with an ornament cursor beside it, and the others fade by distance from it like a wheel, so ten
  races never need a scrollbar. The race description floats centred under the list over the
  character, white text with a shadow, no backing. Foot: one hairline, `R Done` left, NAME and RACE
  right.
- **Stardew Valley, new game** (official wiki screenshot [10]): one paper-like panel holds it
  all. The farmer stands in a small framed window top left with its own backdrop (sky over a strip
  of grass), arrows under it; fields with text boxes to the right; every other choice is a label
  between two arrow buttons, so there are no lists to scroll. One boxed OK at the bottom right.
- **Children of Morta, family screen** (player screenshot on Steam [11]): one centred framed
  panel (about 60% wide, 70% tall) over the dimmed, darkened house the family lives in, tabs on its
  top edge, and a right column inside it with the portrait, the name between two ornaments and
  the description in small type below. The world stays visible round all four sides.
- **Tiny Swords, the author's own showcase** ([1] to [4]):
  - UI sheet [2]: every piece sits on **one** large paper board; groups inside it are recessed
    darker cells (the `Banner_Slots` tone), not separate frames. A blue ribbon heading overlaps
    the board's top-left corner and hangs past it; a ribbon tail hangs off the bottom left like a
    bookmark; a scroll curl breaks the bottom right edge. The ground behind is flat sea teal
    (`#47aba9`, also the page's own background [1]).
  - Terrain sheet [3] and banner [4]: islands are never rectangles. Coasts step in and out tile
    by tile; there are two or three levels of grass with cliff faces under each shelf; foam rings
    every coast; rocks sit in the water off shore; trees come in clumps at the backs and edges;
    bushes at cliff feet; sheep and units are small (a warrior is about 1.5 tiles tall on a map 25
    tiles wide). UI pieces (the "Terrain" paper, the title sign) overlap the scenery's edge rather
    than sitting in a clear box beside it.
  - The pack ships the paper banner, a slots inset, wood table, sword, big and small ribbons, two
    small papers, two bars, square and round buttons, four cursors (one of them four corner
    brackets) and twelve icons, all stretchable, on a 64 px grid, animated at 10 fps [1].
- **Integer scaling** (Guntastic developer blog [12]): render a fixed base (640x360) and scale by
  whole numbers (2x at 720p, 3x at 1080p). When the screen is near the next whole step, round up
  and lose a little world at the sides; otherwise round down and fill the rest with border. Their
  levels carry one hideable tile of margin round every edge so rounding up never cuts play.

## Patterns that recur

1. **The character is the biggest and brightest thing**, 50 to 65% of the screen height in the
   3D games; the menu text is small (about 2.5% of the height) and low-contrast.
2. **Options are plain rows.** Boxes are kept for the one commit action (Finish, OK). The selected
   row is a full-width band (Elden Ring), a glow (DS3) or size plus brightness plus a cursor
   (Skyrim). Only the cursor's row is marked; the committed choice shows as the value in the
   field column, not as a second highlight.
3. **One surface, or none.** DS3, Stardew and Children of Morta put list, stats and telling on one
   panel; Elden Ring uses one translucent backing per column but aligns them on one baseline grid;
   Skyrim uses no panel. Nobody floats three unrelated boxes.
4. **The stats stand beside the character** (Elden Ring) or sit on its card (Select Character
   Base), so the eye goes row, then body, then numbers.
5. **The telling sits next to the list, in a fixed slot**: top of the option column (Elden Ring),
   under the list (Skyrim), under the portrait (Children of Morta). A fixed slot means the rows
   never jump when a longer text comes in.
6. **Side margins of 4 to 8% of the width** and a foot band of prompts in the bottom 5 to 7%.
7. **No scrolling by design**: Elden Ring caps a list at ten rows, Skyrim wheels the list in place,
   Stardew swaps lists for arrows, Select Character Base pages with arrows.
8. **Pixel art**: whole-number scale for the world, overscan instead of letterbox when close, the
   UI drawn at its own 1x and stretched by nine-slice, and the panel allowed to overlap the
   scenery.

## Where Greyfall stands now

From the current files: the menu is a `Banner.png` scroll at `left: 24px; top: 24px`, 400 px wide;
the numbers are a separate `.crStats` aside; the isle is a rectangle-ish 13 x 9 tile map at 2x or
3x centred at `50% + 50px`, with the whole sea behind it. That gives three disconnected pieces, a
24 px gutter (under 2%), and an empty right third at 1920 wide.

## Options

All three keep: keys and steps as now, the step name on `ribbonBlue.png`, the foot keys, the
scene at `zoom()` 1x/2x/3x, UI pieces at 1x with nine-slice stretch, text in the current fonts.

### A. One sheet, Elden Ring's Create Character

```
1366 x 768                                                   (scene 2x; 1920 x 1080 at 3x)
+--------------------------------------------------------------------------------------+
|   [== CLASS ==]ribbon over the corner                          .  ~cloud~      o rock |
|  +-paper (Banner 9-slice)--------------------------------+     ______trees___         |
|  | Class    Warrior  | The levy's oldest trade: a blade, |    / shelf, cliff  \__     |
|  | Gift     -        | a board of oak, and the nerve...  | H  |  face below      |    |
|  | Name     Nameless |                                   | P  |      [HERO]      |    |
|  |                   |>Warrior ######################### | 30 |   sheep   bush   |    |
|  |                   | Eggwarden                         | .. |__ foam ________/  o  |
|  |                   | Champion                          | Wk |                      |
|  |                   | Grovekeeper                       | [gift slot]               |
|  +-------------------+-----------------------------------+--+                       |
|   W S Move   E Choose   Esc Back                                                     |
+--------------------------------------------------------------------------------------+
 48  ........ 150 ....|........ 320 ......................|.170.| ..... ~520 scene ......
```

- **Sheet**: one `Banner.png` paper from x 48 to about 800 (55%), y 56 to 700, the ribbon
  hanging over its top-left corner as in the showcase [2]. Margins 48 px left, 40 top and bottom
  at 1366 (3.5%/5%); 64 and 56 at 1920, where the sheet ends near 1000 (52%).
- **Three columns inside it**, like Elden Ring: step fields (150 px: Class, Gift, Name, each with
  its current value in mute type, the active one banded), options (320 px: the telling in a fixed
  3-line slot at the top, then plain 40 px rows), numbers (170 px, in a `Banner_Slots` recessed
  cell on the sheet's right edge, so they stand beside the hero; six rows of 30 px, gift slot
  under them).
- **Cursor**: a full-width band in the recessed-cell tone behind the row, the row's text in ink
  and bold, the rest in mute; `Cursor_01` arrow at its left end. Chosen row: a small blue ribbon
  notch at the right end, never a second band. The sword stays for the step field only, or goes.
- **Scene**: the hero at 2x (3x at 1920), feet at 65% down, centred in the space right of the
  sheet; the isle built as in [3]: stepped coast, a raised shelf with a cliff face behind the hero,
  trees clumped at its back, rocks in the water, and land running off the right and bottom edges
  so no outline of a rectangle shows. The sheet's right edge overlaps the isle's west shore.
- **Short viewport (about 650 px)**: margins drop to 24/16, rows to 36, the telling slot stays 3
  lines, the number rows go to 26 (6 x 26 = 156); the sheet fits in 610. The scene stays at 2x
  down to 560 (the current rule) and is simply cropped at the foot; the isle bleeds anyway.
- Trade-offs: one surface answers "disconnected panels" and "cramped"; the hero half answers
  "empty right". The sheet is wide, so less world shows than in C. Gift and Name reuse the same
  columns, so all three steps look the same.

### B. Cards, Elden Ring's Select Character Base

```
1366 x 768
+--------------------------------------------------------------------------------------+
|                               [== CLASS ==]                                          |
|   +--------+   +--------+   +--------+   +--------+                                  |
|   |[slot]  |  r|[slot]  |r  |[slot]  |   |[slot]  |   r = Cursor_04 corner brackets  |
|   | hero 1x|   | hero 1x|   | hero 1x|   | hero 1x|                                  |
|   |HP 30 St|   |HP 22 St|   |HP 40 St|   |HP 50 St|                                  |
|   |At 3  Fl|   |At 2  Fl|   |At 5  Fl|   |At 3  Fl|                                  |
|   |Rc 1  Wk|   |Rc 1  Wk|   |Rc 1  Wk|   |Rc 1  Wk|                                  |
|   |=Warrior|   =Eggward=   |=Champion   |=Grovekp=                                  |
|   +--------+  r+--------+r  +--------+   +--------+                                  |
|   ~~~~~ long low isle strip, the cards planted on it like signboards ~~~~~~          |
|   The levy's oldest trade: a blade, a board of oak...   (one telling line)          |
|   W S Move   E Choose   Esc Back                                                     |
+--------------------------------------------------------------------------------------+
```

- Four `RegularPaper` cards (numbers in the sketch are placeholders), 250 x 420 at 1366 (340 x 560 at 1920), 24 px gaps, about 170 px
  side margins. Each card: the class idling in a `Banner_Slots` window at 1x (2x at 1920), the six
  numbers in two columns on the card's lower half, a small ribbon nameplate at its foot.
- Cursor: the four corner brackets of `Cursor_04` round the card, the card lifted 8 px, the other
  three dimmed. W S (or A D) moves across. The telling is one line under the row of cards.
- Gift: three or four cards with the item icon; Name: one central card with the hero and the wood
  table nameplate.
- Short viewport: ribbon 64 + cards 380 + telling 50 + foot 40 = 534, fits; heroes stay 1x.
- Trade-offs: the best side-by-side comparison of the classes. But it is four boxes (the boxed
  look the user turned down), the world shrinks to a strip, and each step has its own layout.

### C. World first, Skyrim's race menu

```
1366 x 768                                                   (scene 3x where it fits)
+--------------------------------------------------------------------------------------+
|                  [ Class |  Gift  |  Name ]  ribbon strip, top centre                 |
|   +-paper strip-+                    ______ trees ________                            |
|   |  Eggwarden  |                   /  shelf, cliff face   \___    +-wood table-+     |
|   |>WARRIOR<    |   (wheel: the     |                         |   | HP     30  |     |
|   |  Champion   |    cursor row     |         [HERO 3x]       |   | Stamina 100|     |
|   |  Grovekeeper|    stays mid)     |     sheep        bush   |   | ...        |     |
|   +-------------+                    \__ foam ____  o rock ___/   +------------+     |
|                       +-small paper: the telling, under the hero's feet-+            |
|  ---------------------------------------------------------------------------------   |
|   W S Move  E Choose  Esc Back                                 NAME Nameless  CLASS  |
+--------------------------------------------------------------------------------------+
```

- Scene full-bleed, hero at 3x (2x below 880 px tall) at about 55% across, the isle filling most
  of the screen. The list on a narrow 300 px paper strip at x 64, vertically centred, as a Skyrim
  wheel: cursor row in the middle, larger and in ink, the others fading by distance. The telling on
  a small paper under the hero's feet; the numbers on a `WoodTable` plaque planted on the isle
  beside the hero. Foot: one rule, keys left, name and class right.
- Short viewport: everything is centred on the hero, so it shrinks round the middle; the hero
  drops to 2x and the wood table moves up beside it.
- Trade-offs: the most world, closest to "a world behind the menu". But it is three separate
  pieces again (list, telling, table), which is the first complaint; and Skyrim's floating text
  reads because its world is dark and grey, while Tiny Swords grass is bright, so every piece of
  text needs its own paper.

## Recommendation

**Option A**, with C's care for the scenery.

- It is the screen the user already pointed at (Elden Ring's Create Character): field column,
  centre option list with the telling on top, status column beside the character.
- One paper sheet with recessed cells is how Pixel Frog groups pieces [2], and it answers the
  disconnected panels; a 48 to 64 px margin answers the cramped edge.
- Plain rows with a full-width band are the Elden Ring origin list; the arrow cursor and ribbon
  notch keep cursor and chosen apart, as `creation-controls.md` asks.
- The numbers in a recessed cell on the sheet's right edge stand beside the hero, as Elden Ring's
  status column does, with 30 px rows instead of the current tight list.
- The right 45% becomes the stage: the hero at 2x/3x on an isle built like the showcase [3],
  stepped coast, shelf and cliff, clumped trees, off-shore rocks, land running off the screen
  edges, the sheet overlapping its shore. That is what fixes "flat rectangle of grass", and it
  can be done in A without B's boxes or C's scattered pieces.

B's corner-bracket cursor is worth keeping in mind if a class comparison view is ever wanted.

## Sources

1. [Tiny Swords, Pixel Frog, itch.io](https://pixelfrog-assets.itch.io/tiny-swords) (contents, 64 px grid, 10 fps, page background `rgba(71, 171, 169)`)
2. [Tiny Swords UI showcase, UI_4.gif, embedded on [1]](https://raw.githubusercontent.com/Adriano-97/pixelImages/refs/heads/main/UI_4.gif)
3. [Tiny Swords terrain showcase, Terrain and Decorations_06.gif, embedded on [1]](https://raw.githubusercontent.com/Adriano-97/pixelImages/refs/heads/main/Terrain%20and%20Decorations_06.gif)
4. [Tiny Swords banner, BigBanner_03.gif, embedded on [1]](https://raw.githubusercontent.com/Adriano-97/pixelImages/refs/heads/main/BigBanner_03.gif)
5. Elden Ring "Select Character Base" screenshot, `elden-ring-character-creator-a.webp` in the repo root, supplied by the user (origin not recorded)
6. Elden Ring "Create Character" screenshot, `images.jpg` in the repo root, supplied by the user (origin not recorded)
7. [Character Creation, Eldenpedia (wiki.gg, fan wiki)](https://eldenring.wiki.gg/wiki/Character_Creation)
8. [Dark Souls 3: Character creation, gamepressure.com guide (screenshot, Polish UI)](https://www.gamepressure.com/darksouls3/1-character-creation/z68860)
9. [Skyrim:Character Creation, UESP (fan wiki), screenshot SR-menu-Character_Creation.jpg](https://en.uesp.net/wiki/Skyrim:Character_Creation)
10. [Getting Started, Stardew Valley Wiki (official), Character_creation_menu.png](https://stardewvalleywiki.com/Getting_Started)
11. [Children of Morta character selection screen, Steam Community player screenshot](https://steamcommunity.com/sharedfiles/filedetails/?id=1854581304)
12. [Guntastic: Pixel Sharp Graphics at Multiple Screen Resolutions, Minifloppy](https://minifloppy.it/posts/2018/guntastic-pixel-sharp-graphics-at-multiple-screen-resolutions/)

All read 2026-11-22.
