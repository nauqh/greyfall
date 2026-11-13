"use client";

// Versus's entry: the auto chess run split down the middle. The left half is
// the solo run against the three AI clans; the right is the duel over a room
// code. Each half is its own live scene, so the mode is chosen by the place,
// and the room form only appears once its half is picked.
//
// Each scene is rendered once at the width its pane takes when picked, and
// the pane clips it. Hovering opens that window over a still picture, so the
// art is never resized or re-zoomed.

import { useRouter } from "next/navigation";
import { useState } from "react";

import { Clouds, useCloudExit } from "../../game/Clouds";
import { GameCanvas } from "../../game/GameCanvas";
import { TrpcProvider } from "../../pvp/Provider";
import { Lobby } from "../../pvp/Lobby";

// The scenes load Phaser and the art pack, so they are imported where the
// browser, not the server, can reach them.
const startSolo = async (el: HTMLElement) => {
  const [{ startGame }, { IntroSkirmishScene }] = await Promise.all([
    import("../../game/boot"),
    import("../../game/introSkirmish"),
  ]);
  return startGame(el, "intro-skirmish", IntroSkirmishScene);
};

const startOnline = async (el: HTMLElement) => {
  const [{ startGame }, { IntroVersusScene }] = await Promise.all([
    import("../../game/boot"),
    import("../../game/introVersus"),
  ]);
  return startGame(el, "intro-versus", IntroVersusScene);
};

export default function VersusPage() {
  const router = useRouter();
  const { cover, leave } = useCloudExit();
  const [ready, setReady] = useState(0);
  const [online, setOnline] = useState(false);

  return (
    <main className="stage">
      <div className="pick">
        <section className="pickPane">
          <div className="pickScene">
            <GameCanvas bare start={startSolo} onReady={() => setReady((n) => n + 1)} />
          </div>
          <button className="pickHit" type="button" onClick={() => leave(() => router.push("/battle"))}>
            <span className="pickTag">PvE</span>
            <span className="pickTitle">The clans</span>
            <span className="pickHint">Buy, merge, and outlast three AI clans</span>
          </button>
        </section>
        <section className="pickPane">
          <div className="pickScene">
            <GameCanvas bare start={startOnline} onReady={() => setReady((n) => n + 1)} />
          </div>
          <button className="pickHit" type="button" onClick={() => setOnline(true)}>
            <span className="pickTag">PvP</span>
            <span className="pickTitle">A rival</span>
            <span className="pickHint">One room code, one friend, one winner</span>
          </button>
        </section>
      </div>

      <button className="pickBack" type="button" onClick={() => leave(() => router.push("/"))}>
        Back to the title
      </button>

      {online && (
        <div className="pickLobby">
          <TrpcProvider>
            <Lobby
              onEnter={(room) => leave(() => router.push(`/versus/${room.code}`))}
              onBack={() => setOnline(false)}
            />
          </TrpcProvider>
        </div>
      )}

      {/* One cover for both scenes: it parts once the pair is up. */}
      {ready < 2 ? <Clouds key="cover" mode="cover" /> : <Clouds key="open" mode="open" />}
      {cover}
    </main>
  );
}
