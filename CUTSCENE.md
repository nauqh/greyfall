# The opening cutscene

What plays before a new game drops the captain into the Landing. The script is
`PROLOGUE` in `apps/web/src/app/atlas/prologue.ts`, played by
`ProloguePlayer.tsx`; this file is the why.

## Tone

- **Dark Souls, the opening.** A grave narrator over slow, near-still shots.
  It runs in three movements: an age, its fall, the last ember. Lore is told as
  fact and never explained, names are dropped and not glossed, and the hero is
  not in it until the end, when the game cuts to an undead in a cell.
  [Fandom: Opening (Dark Souls)](https://darksouls.fandom.com/wiki/Opening_(Dark_Souls)),
  [transcript](https://game-scripts-wiki.blogspot.com/2021/10/dark-souls-transcript.html).
- **Skyrim, the cold open.** The player wakes bound in a cart, carried to an
  execution for reasons they do not know. The hero is nameless, a captive,
  moved by others.
  [Game Rant: the opening scene](https://gamerant.com/skyrim-15th-anniversary-opening-scene/),
  [Symbolically Speaking: In the Beginning](https://symbolicallyspeaking.substack.com/p/symbolism-in-skyrim-in-the-beginning).

Taken from both: plain declaratives, no simile, no explanation, and a turn to
the player as a captive given to the tide. The cart becomes the sea. Every
paragraph earns its place by carrying one fact: what the Reach was, what broke
it, what is left, who the player is.

The cutscene is words on black, no shots. An earlier draft cut between the
narration and a live war played by `StrategicScene`; the war read as a trailer
competing with the words, so the film mode was dropped and the screen stays
black. The wording and the pace of its reveal are the whole cutscene.

## Storytelling and pacing

- **Reach the game quickly.** A common exercise puts an opening cutscene under
  300 words from fade in to gameplay; this one is 85. Fewer words also mean
  fewer facts to hold before the first choice.
  [Opening Cutscene, Kelsey Reyes](https://www.kelseyfoxreyes.com/post/opening-cutscene)
- **Leave something unknown.** Mystery holds attention better than a complete
  explanation; each paragraph should open a question it does not answer.
  [Writing a More Compelling Game Narrative](https://www.gamedeveloper.com/game-platforms/writing-a-more-compelling-game-narrative)
- **One idea per paragraph.** Readers skip the rest once they lose the thread,
  so each paragraph carries one turn: the whole Reach, the grey, the silence,
  the last fire, the player.
  [How Users Read on the Web, NN/g](https://www.nngroup.com/articles/how-users-read-on-the-web/)
- **Read off the screen, not the page.** BBC guidance is 160-180 words a minute
  (about 0.3 s a word) with at least a 1.5 s gap between captions; Netflix caps
  adult subtitles at 20 characters a second. This runs at 360 ms a word, about
  165 wpm, with a 1.5 s black gap, so the text sits below the ceiling rather
  than at it.
  [BBC Subtitle Guidelines](https://www.bbc.co.uk/accessibility/forproducts/guides/subtitles/),
  [Netflix English Timed Text Style Guide](https://partnerhelp.netflixstudios.com/hc/en-us/articles/217350977-English-USA-Timed-Text-Style-Guide)
- **Mixed case, left edge, room to breathe.** For blocks longer than a few
  words, mixed case, unjustified left alignment, 1.5 line spacing and about 70
  characters a line are the readable defaults; all caps is not meant for full
  paragraphs. The narration is therefore Georgia, mixed case, left aligned in
  a centred block, at 1.55 line height, while Cinzel stays for the title.
  [Game Accessibility Guidelines](https://gameaccessibilityguidelines.com/use-simple-clear-text-formatting/),
  [Typography for Glanceable Reading, NN/g](https://www.nngroup.com/articles/glanceable-fonts/)

## Lore it rests on

All from GAME.md, ATLAS.md and the NPC lines in `packages/engine/src/npcs.ts`;
nothing here contradicts them, and the narration reuses their own words where
it can.

- Bonfires know the captains (Ansel: "The fire knew my name"), and every road
  comes back to the Harbour's fire.
- The grey is an army out of the east: black soldiers and gnolls under the
  Grey Warlord, from the Greyfall.
- The gold city above "never sent us a single spear" (Ansel). The grey smells
  of "wet ash and old iron" (Ansel).
- Old Ferrow at the fire: "Another captain", "The fire doesn't ask who you
  were." Ysolde: habit "outlasts hope".
- The Grey Warlord is never named; he stays a lord with no name.

## The beats

Five short paragraphs, shown one at a time, then the title. The spine is a
chain anyone can follow: fires were kept for sailors, the grey burned them,
no help came, one fire is left, the tide brings the player to it.

The forty spears and the Citadel were cut from an earlier draft. Corwin's forty
died in the barrows, not at the Citadel, and "the Citadel" names two different
places in the world, so the line was both confusing and wrong.

| # | Paragraph | Why |
| --- | --- | --- |
| 1 | Before the grey, the Reach was whole. Every harbour kept a fire for the sailors who returned. | The world before, and the promise the rest of the story breaks |
| 2 | Then the grey came out of the east. A nameless warlord led it. His soldiers burned the harbours. | The cause, and where the grey came from. The Warlord stays a face no one can name |
| 3 | The city above sent no help. The sailors went out to meet the grey, one by one, and none returned. | The sky's indifference, and why Ferrow greets you with "another one" |
| 4 | One fire is left, at Last Harbour. An old man keeps it lit, though no sailors come. | The last ember, and the reason it is still burning |
| 5 | You were taken in the grey, bound, and thrown to the tide. It carried you to the last fire. Another sailor. | The turn to the player: the fire kept for sailors finally gets one |

Then the title card, **GREYFALL**, *The Shattered Reach*, and the black fades
out on the Landing: the sea cave behind the overlay is the arrival.

## Playing it

- Each paragraph opens on 1.5 s of black, fades in whole over 1.8 s, holds
  fully visible for 360 ms a word, then fades out over 1.2 s. The next
  paragraph starts on black again, so nothing is read while it moves. The
  whole run is about 62 s including the title.
- The title holds 5.2 s, then the overlay fades over 1.6 s into the Landing.
- A click or any key moves to the next card; holding Esc, Space or Enter for a
  second skips to the end.
