"use client";

// One duel room. The code is the address: a refresh mid-room lands back here,
// and since the seat is keyed to the stored token the poll picks the room
// straight back up. Joining first is the only way in - room.get is seated
// only, so a stranger's visit is bounced to the lobby by the room's own
// error handling.

import { useRouter } from "next/navigation";
import { use } from "react";

import { Room } from "../../../pvp/Room";
import { TrpcProvider } from "../../../pvp/Provider";

export default function DuelRoomPage({ params }: { params: Promise<{ code: string }> }) {
  const { code } = use(params);
  const router = useRouter();
  return (
    <main className="stage">
      <TrpcProvider>
        <Room code={code} onLeave={() => router.push("/duel")} />
      </TrpcProvider>
    </main>
  );
}