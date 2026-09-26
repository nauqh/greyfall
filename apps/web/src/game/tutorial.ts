// The first match's walkthrough, spoken by one of the player's own Pawns.
// Each step waits for the player to do the thing it asks, so it teaches by
// doing; a step with a button waits for the button instead.

import type { MatchState } from "@greyfall/engine";

export interface TutorialContext {
  state: MatchState;
  selected: readonly number[];
  phase: "plan" | "battle" | "report" | "over";
}

export type TutorialFocus = "barracks" | "army" | "fight" | null;

interface Step {
  text: string;
  /** Shown as a button; the step ends when it is pressed. */
  button?: string;
  /** The step ends by itself once this holds. */
  done?: (c: TutorialContext) => boolean;
  focus: TutorialFocus;
  /** Only shown while this holds; hidden, not skipped, otherwise. */
  when?: (c: TutorialContext) => boolean;
}

const ownFighters = (c: TutorialContext) => c.state.units.filter((u) => u.side === "a" && u.class !== "pawn");

export const STEPS: readonly Step[] = [
  {
    text: "Welcome, Keeper! We three Pawns dig this mine for you: 2 gold each, every round. The grey things across the water want your castle.",
    button: "Go on",
    focus: null,
  },
  {
    text: "Gold buys an army. Click the barracks, then press Warrior on the right. Train two or three.",
    done: (c) => ownFighters(c).length > 0,
    focus: "barracks",
  },
  {
    text: "Now pick them up: drag a box around your Warriors, or press Army (F2) to take every fighter at once.",
    done: (c) => c.selected.some((id) => ownFighters(c).some((u) => u.id === id)),
    focus: "army",
  },
  {
    text: "Right click the ground to send them. They fight anything they meet on the way. On a touch screen, just tap.",
    done: (c) => ownFighters(c).some((u) => u.order.type === "attackMove" || u.order.type === "move" || u.order.type === "attack"),
    focus: null,
  },
  {
    text: "Nothing moves while you plan. Press Fight! and both sides' plans play out at the same time.",
    done: (c) => c.phase !== "plan",
    focus: "fight",
  },
  {
    text: "That is a round: plan, fight, read the report. Break their castle before the Greying eats both!",
    button: "Go on",
    focus: null,
    when: (c) => c.phase === "plan" && c.state.round >= 2,
  },
  {
    text: "More troops come from more buildings. Click an empty plot on your plateau and build: archery range for Archers, tower for Lancers, monastery for Monks. Houses add supply.",
    button: "Got it",
    focus: null,
    when: (c) => c.phase === "plan",
  },
  {
    text: "Two roads lead to their castle: the High Pass over the ridge, and the Low Road across the ford. Send the army to one, then strike next round. The castle trains more of us for the yard mine, but a big army costs upkeep.",
    button: "Got it",
    focus: null,
    when: (c) => c.phase === "plan" && c.state.round >= 3,
  },
];

const KEY = "greyfall.tutorial.done";

/** Whether this browser has finished or skipped the walkthrough. Storage can
 *  be missing or refuse, which reads as not done. */
export function tutorialDone(): boolean {
  try {
    return window.localStorage.getItem(KEY) === "1";
  } catch {
    return false;
  }
}

export function markTutorialDone(): void {
  try {
    window.localStorage.setItem(KEY, "1");
  } catch {
    // A private window: it shows again next time, which is harmless.
  }
}
