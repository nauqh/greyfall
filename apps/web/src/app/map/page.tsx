"use client";

// The strategic map, still in development. Back to the title on the scene's
// own menu button.

import { useRouter } from "next/navigation";

import { GameCanvas } from "../../game/GameCanvas";

export default function MapPage() {
  const router = useRouter();
  return (
    <main className="stage">
      <GameCanvas
        start={(el) =>
          import("../../game/StrategicScene").then(({ startStrategic }) =>
            startStrategic(el, {
              onMenu: () => router.push("/"),
            }),
          )
        }
      />
    </main>
  );
}