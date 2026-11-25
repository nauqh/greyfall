// The opening cutscene's script: screens of narration before a new game's Tidewake, each a few paragraphs that come
// up one after another. Lanternport's voice: it may say only what docs/world/reach.md "Who knows what" gives
// Lanternport, and keeps to that file's "How we tell it". Played by apps/web/src/app/atlas/ProloguePlayer.tsx.

export const PROLOGUE = {
  screens: [
    [
      "In the age of the old kings, Aurum was warm. Its winters came soft, its springs ran warm out of the rock, and gold, wherever it was dug, lay warm in the hand. The old folk had a word for the warmth beneath it all. They called it the Hearth.",
      "The kings kept one law above the rest, and it is said at every fire in the land still: dig no deeper than a grave. And so they were buried as deep as the law allowed, to lie warm until the world's end.",
    ],
    [
      "But the last of the kings died without an heir, and his lords broke the crown between them, a piece to every hold. Lanternport and Highward over it, Stiltwater on its salt, Kingsrest among the barrows, and the Citadel on its crag in the east, richest of them all.",
      "And with the lords came disparity. High and low, rich and poor, and of course, those who went up and those left below. For the gnome-kings raised a city on the sky, and called it Sunhold, and it looked down on all of them.",
    ],
    [
      "Then, in the Cold Year, the Grey rose in the east. It came with no army and no banner, only a cold that worked from the edges inward, like frost upon a pane. It took colour first, and then names, and those it took walked on after, keeping their posts and their prayers with nothing left behind the eyes.",
      "The first it took was the lord of the Citadel, yet not the whole of him. It took his name and left him his crown, and so the folk call him the Grey Warlord.",
    ],
    [
      "The lords of the west rode east against him with every spear they had, and not one of them came home. Their banners were seen once more, flying grey on the Citadel's walls. Kingsrest barred the road behind them at the Grey Gate, and Sunhold shut its own gates upon the sky and sent no aid, and has sent none since.",
    ],
    [
      "Even now, there are only embers. No ship has put in for three winters, and the taken walk every road toward whatever is still warm. Only Lanternport holds, on its salt beside the sea, its one fire never once let go out.",
      "Yes, indeed. And the tide, as it will, has carried a stranger into the caves beneath it: nameless, half-drowned, and warm, though the sea it came from was cold. No one at the fire has yet asked why.",
    ],
  ],
  /** Each land's name in its colour: the art's blue for Lanternport and Highward, then gold, salt-sea, barrow
   *  violet and Grey, each dark enough for 5:1 on the paper. */
  lands: {
    Aurum: "#94561a",
    Lanternport: "#2f5f9a",
    Highward: "#3c5a85",
    Stiltwater: "#1f6b69",
    Kingsrest: "#5c5a8a",
    Citadel: "#55585f",
    Sunhold: "#7a5e0a",
  } as Record<string, string>,
  title: "GREYFALL",
  subtitle: "Ashen Crown",
};
