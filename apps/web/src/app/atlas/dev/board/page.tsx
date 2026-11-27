"use client";

// The notice board on its own, behind the dev password: every state at once, without playing to it.

import { useEffect, useState } from "react";
import { NOTICES } from "@greyfall/engine";

import type { BoardView } from "../../../../game/AtlasScene";
import { Board } from "../../Board";

// The game's notices, one in each state.
const NOTES: BoardView["notes"] = NOTICES.map((n, i) => ({ title: n.title, from: n.from, text: n.text, reward: n.reward, state: (["up", "fallen", "up", "paid"] as const)[i % 4]! }));

export default function BoardPreview() {
  const [notes, setNotes] = useState(NOTES);
  const [pick, setPick] = useState(0);
  const [gold, setGold] = useState(212);
  const leave = notes.length;

  const choose = (i: number) => {
    const n = notes[i];
    if (n?.state !== "fallen") return;
    setGold((g) => g + n.reward);
    setNotes((all) => all.map((m, j) => (j === i ? { ...m, state: "paid" } : m)));
  };

  useEffect(() => {
    const key = (e: KeyboardEvent) => {
      const k = e.key.toLowerCase();
      if (k === "s" || k === "arrowdown") setPick((p) => Math.min(p + 1, leave));
      else if (k === "w" || k === "arrowup") setPick((p) => Math.max(p - 1, 0));
      else if (k === "e") choose(pick);
    };
    window.addEventListener("keydown", key);
    return () => window.removeEventListener("keydown", key);
  });

  return (
    <main style={{ position: "fixed", inset: 0, background: "var(--outline)" }}>
      <Board board={{ name: "Lane House", notes, pick, gold }} onHover={setPick} onChoose={choose} />
    </main>
  );
}
