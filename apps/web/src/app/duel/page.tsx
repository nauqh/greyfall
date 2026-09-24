"use client";

// The duel entry: name, create, join. Entering a room navigates to its own
// route, where the room's poll owns the truth.

import { useRouter } from "next/navigation";

import { TrpcProvider } from "../../pvp/Provider";
import { Lobby } from "../../pvp/Lobby";

export default function DuelPage() {
  const router = useRouter();
  return (
    <main className="stage">
      <TrpcProvider>
        <Lobby
          onEnter={(room) => router.push(`/duel/${room.code}`)}
          onBack={() => router.push("/")}
        />
      </TrpcProvider>
    </main>
  );
}