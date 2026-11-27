"use client";

// The notice board on its own, behind the dev password: every state at once, without playing to it.

import { useEffect, useState } from "react";
import { NOTICES, stepNotice } from "@greyfall/engine";

import type { BoardView } from "../../../../game/AtlasScene";
import { Board } from "../../Board";

// The game's notices, one in each state.
const NOTES: BoardView["notes"] = NOTICES.map((n, i) => ({ title: n.title, from: n.from, text: n.text, reward: n.reward, state: (["up", "fallen", "up", "paid"] as const)[i % 4]! }));

export default function BoardPreview() {
  const [notes, setNotes] = useState(NOTES);
  const [pick, setPick] = useState(0);
  const [gold, setGold] = useState(212);

  const choose = (i: number) => {
    const n = notes[i];
    if (n?.state !== "fallen") return;
    setGold((g) => g + n.reward);
    setNotes((all) => all.map((m, j) => (j === i ? { ...m, state: "paid" } : m)));
  };

  useEffect(() => {
    const key = (e: KeyboardEvent) => {
      const k = e.key.toLowerCase();
      const [dx, dy] = k === "a" || k === "arrowleft" ? [-1, 0] : k === "d" || k === "arrowright" ? [1, 0] : k === "w" || k === "arrowup" ? [0, -1] : k === "s" || k === "arrowdown" ? [0, 1] : [0, 0];
      if (dx || dy) setPick((p) => stepNotice(p, notes.length, dx, dy));
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
