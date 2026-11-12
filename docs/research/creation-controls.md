# Teaching the play keys in character creation

Research for making `apps/web/src/app/atlas/Creation.tsx` keyboard-only and using it to teach
Greyfall's play keys (WASD/arrows walk, Space tap roll / hold sprint, E interact, R flask,
Tab sack, Esc back) before the player lands. Sources at the foot, read 2026-11-13.

## What the reference games do

- **Dark Souls III (PC keyboard):** menus confirm with **E** and cancel with **Q**, the cursor
  moves on the arrows, tabs switch on Shift + Left/Right. E is also the in-game interact key, so
  every menu confirm rehearses interact. Creation sliders are keyboard only (Shift + arrow by 10).
  [3][4]
- **Elden Ring (PC keyboard):** menus run on arrows, Enter confirms, Esc backs out, and the
  on-screen prompts follow the device setting (System > Sound and Display > Device for On-Screen
  Prompts). Prompts sit in a bar at the bottom right of every menu. [1][2]
- **Celeste:** one set of keys for menu and play: arrows move, C confirms (the jump key), X backs
  (the dash key). The player has pressed jump dozens of times before the first level. [5]
- **Hollow Knight:** no menu teaching; King's Pass shows each verb when needed, a tablet glows
  to explain Focus as the player nears it. [6][7]
- **Hades:** WASD walk, Space dash, Esc menu; prompts are drawn as keycaps that change with the
  bound key and the device. [8]
- **Xbox Accessibility Guideline 112:** UI must be fully navigable by keyboard alone; prompts for
  select/back sit in the same place, same order, on every screen; linear lists wrap last to first;
  back is always available and always labelled. [9]
- **Game Accessibility Guidelines:** let players recall the controls later, not only once. [10]
- **Context-sensitive prompts:** one key may mean different things by context if the meanings
  stay close (E = choose here, E = interact later). [11]

Takeaway: the strongest teaching is Celeste and Dark Souls III's trick: make the menu keys *be*
the play keys, so creation is practice, not a lesson.

## 1. Recommended key map for creation

| Action | Keys | Why |
| --- | --- | --- |
| Move in the list | **W / S**, ↑ / ↓ | W/S are the walk keys; the hands start on WASD. Wrap at the ends (XAG 112). |
| Switch step (Class, Gift, Name) | **A / D**, ← / → | Lists are vertical, so horizontal is free. D forward only when the step is `ready`, A back only to a reached step, same rules as `go()` and `next()`. |
| Choose and go on | **E**, Enter | E is interact, as Dark Souls III confirms with E. Enter stays for players who reach for it. |
| Back | **Esc** | Same as play. Already wired. |
| Space | nothing in lists | Space rolls in play; do not make it a confirm, or the habit "Space = yes" is wrong on land. |

Implementation notes for the lead:

- **Act on keydown with `!e.repeat`.** A native `<button>` fires `click` on Enter keydown *and on
  auto-repeat*, so holding Enter can rush Class, Gift and Name and begin the run. Handle E/Enter in
  `keys()` with `preventDefault()` and ignore repeats; keep the `e.detail === 0` path or replace it.
- **The last confirm must not leak into play.** If "Come ashore" fires on E keydown, the matching
  keyup or a held E reaches the scene. Swallow keys until the fade's `onAnimationEnd`, which
  `stopPropagation` on the dialog already mostly does.
- **Name step quirks.** In the field, letters are letters: W, A, S, D, E and Q type themselves,
  Space types a space (already protected by `stopPropagation`). Left/Right move the caret, so do
  not use A/D/←/→ for steps while the input has focus. Only **Enter** (confirm), **Esc** (back) and
  **↑ / ↓** (optional, back to the step strip) act. Skip Enter while `e.nativeEvent.isComposing`
  so an IME commit does not begin the run. Esc here keeps the typed name in state.
- Tab: leave browser Tab order alone in creation (it reaches Back/Next for anyone using it), but
  do not advertise it; Tab means "sack" in play.

## 2. Where and how the key prompts show

- **Foot bar, always, same place, same order** (XAG 112, Elden Ring): the whole map for this
  step, left to right: move, step, choose, back. Class/Gift: `W S Move  A D Step  E Choose  Esc
  Back`. Name: `Type a name  Enter Come ashore  Esc Back`; drop the WASD caps here, since those
  letters now type.
- **One inline cap on the focused row only**: a small `E` keycap at the row's right edge, fading
  in with the focus. It answers "what does the key do *here*" without a second line of help. Never
  on every row: a column of identical caps is noise.
- **Teach the keys creation cannot practise on the sheet** (`crStats` / `crSlot`), next to the
  stat that key spends, mute until the step that shows it:
  - `Stamina` → `Space` (tap roll, hold sprint)
  - `Flasks` → `R` (drink)
  - gift slot → `Tab` ("in your sack")
- **Keycap look:** keep the existing `.crKeys kbd` (gold-dim hairline box, 800 11px sans, ink on
  paper). Square caps for letters, wider for `Esc`, `Enter`, `Space`, `Tab`. Show pairs as two
  caps (`W` `S`), not "W/S". Arrows only as a secondary pair, smaller and muted, so WASD reads as
  the primary hand position.

## 3. Focus and selection with no mouse hover

- **Two states, one look each.** *Cursor* (keyboard focus, the row being previewed) and *chosen*
  (the committed pick) must never look the same, and only one cursor may exist.
  - Cursor: the `--lit` wash plus the full ember underline and the inline `E` cap.
  - Chosen: a gold mark that persists when the cursor leaves (a thin gold left edge or a filled
    gold dot before the name), no wash.
- **Drop the 1px gold `:focus-visible` outline** on `.panelOption`; the wash plus underline is the
  focus indicator, and it must show for keyboard focus, not only `:hover` (XAG: focus always
  visible). Style `:focus` the way `:hover` is styled today.
- **Mouse moves the same cursor.** On `mouseenter`, focus the row instead of setting a separate
  hover state, so hover and keyboard never light two rows. `hoverCls`/`hoverGift` then collapse
  into "what has focus".
- Step strip: the current step underlined in ember, reached steps in ink, unreached muted, with
  small `A` / `D` caps at its two ends so the strip itself shows how to move along it.
- Motion: 120 to 160 ms opacity on the underline and cap; none under `prefers-reduced-motion`.

## 4. Handoff: what play should show

Creation, done this way, has practised **W, S, A, D, E and Esc** and shown **Space, R and Tab**
as captions. Play then shows only what was not practised, at the moment it is first useful
(Hollow Knight's rule), in the same keycap style:

- **Space** on landing: `Space Roll  hold Sprint`, gone after the first roll and the first sprint.
- **R** the first time health drops with a flask in hand.
- **Tab** the first time something goes into the sack.
- **Walk** only as a fallback: `W A S D Walk` if the player has not moved within a few seconds.
- **E** over interactables stays as a context prompt, never a tutorial line. **Esc** needs none.
- Keep one place to recall every key later (pause or sack), per the accessibility guideline.

## Sources

1. [Elden Ring PC Controls and Keybinds, keyboardcontrols.com](https://keyboardcontrols.com/shortcuts/games/elden-ring/)
2. [Elden Ring Keyboard And Mouse, That Video Game Blog](https://thatvideogameblog.com/elden-ring-keyboard-mouse/)
3. [Dark Souls III Controls, Wikidot](https://darksouls3.wikidot.com/controls)
4. [How to change by 10 in Dark Souls III character slider on keyboard, GameGrin](https://www.gamegrin.com/articles/how-to-change-by-10-in-dark-souls-iii-character-slider-on-keyboard/)
5. [Celeste default controls, Steam Community](https://steamcommunity.com/app/504230/discussions/0/4410794772266481855/)
6. [Hollow Knight's tutorial is a design masterclass, Indie Game Culture](https://indiegameculture.com/hollow-knight/hollow-knights-tutorial-is-a-design-masterclass/)
7. [King's Pass, Hollow Knight wiki](https://hollowknight.wiki.fextralife.com/King's_Pass)
8. [Hades controls, Shortcut Posters](https://shortcutposters.com/games/hades/)
9. [Xbox Accessibility Guideline 112, Microsoft Learn](https://learn.microsoft.com/en-us/xbox/accessibility/xbox-accessibility-guidelines/112)
10. [Indicate / allow reminder of controls during gameplay, Game Accessibility Guidelines](https://gameaccessibilityguidelines.com/indicate-allow-reminder-of-controls-during-gameplay/)
11. [Implementing context sensitive commands in UI design, Game Developer](https://www.gamedeveloper.com/design/implementing-context-sensitive-commands-in-ui-design)
