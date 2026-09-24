"use client";

// The duel entry: name, create, join. Entering a room navigates to its own
// route, where the room's poll owns the truth.

import { useRouter } from "next/navigation";

import { Clouds, useCloudExit } from "../../game/Clouds";
import { TrpcProvider } from "../../pvp/Provider";
import { Lobby } from "../../pvp/Lobby";

export default function DuelPage() {
  const router = useRouter();
  const { cover, leave } = useCloudExit();
  return (
    <main className="stage">
      <TrpcProvider>
        <Lobby
          onEnter={(room) => leave(() => router.push(`/duel/${room.code}`))}
          onBack={() => leave(() => router.push("/"))}
        />
      </TrpcProvider>
      <Clouds mode="open" />
      {cover}
    </main>
  );
}