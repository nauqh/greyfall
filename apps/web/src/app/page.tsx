"use client";

// The title screen is one scene: the menu is a signboard inside it
// (IntroScene), so this page only hands the scene a way to navigate.

import Link from "next/link";
import { useRouter } from "next/navigation";

import { GameCanvas } from "../game/GameCanvas";

export default function Page() {
  const router = useRouter();
  return (
    <main className="stage">
      <GameCanvas
        start={(el) =>
          import("../game/IntroScene").then(({ startIntro }) => startIntro(el, { go: (href) => router.push(href) }))
        }
      >
        {/* The canvas menu has no keyboard or screen-reader path; this does,
            and stays hidden until tabbed into. */}
        <nav className="kbdNav" aria-label="Main menu">
          <Link href="/battle">Solo</Link>
          <Link href="/duel">Duel</Link>
          <Link href="/map">Map</Link>
        </nav>
        {/* Screen chrome, not world: pinned to the viewport corner. */}
        <div className="credit">Developed by Nauqh</div>
      </GameCanvas>
    </main>
  );
}
