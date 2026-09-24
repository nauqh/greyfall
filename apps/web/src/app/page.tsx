"use client";

// The title screen: the intro scene with the Warcraft menu over it. Every
// screen is its own route now, so the menu just links to them and this page
// holds no state of its own.

import Link from "next/link";

import { GameCanvas } from "../game/GameCanvas";

export default function Page() {
  return (
    <main className="stage">
      <GameCanvas
        start={(el) => import("../game/IntroScene").then(({ startIntro }) => startIntro(el))}
      >
        {/* The Warcraft menu: logo and stacked buttons over the scene, no
            panel art. Percent position and cqw sizes track the canvas. */}
        <div className="menu">
          <h1 className="menuTitle">GREYFALL</h1>
          {/* WC3 menu convention: one button style for every destination,
              hierarchy from order and the gold-ringed default, not hue. */}
          <Link className="menuBtn primary" href="/battle">
            Solo
          </Link>
          <Link className="menuBtn" href="/duel">
            Duel
          </Link>
          {/* In development: dimmed so it reads as not ready. */}
          <Link className="menuBtn dev" href="/map">
            Map
          </Link>
        </div>
        <div className="credit">Developed by Nauqh</div>
      </GameCanvas>
    </main>
  );
}