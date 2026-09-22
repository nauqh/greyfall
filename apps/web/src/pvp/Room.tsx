"use client";

// The room, once you have a seat in it. One poll drives every screen: what
// the server says the state is, is what you are looking at.

import { useEffect } from "react";

import { api } from "./client.ts";
import type { RoomView } from "../server/room/view.ts";

/** 1s while anything is moving. The result screen slows down; see below. */
const POLL_MS = 1000;
const IDLE_POLL_MS = 5000;

export function Room({ initial, onLeave }: { initial: RoomView; onLeave: () => void }) {
  const room = api.room.get.useQuery(
    { code: initial.code },
    {
      initialData: initial,
      // Stop polling fast once the battle is in hand: a stored BattleResult is
      // ~16KB, and two clients pulling that every second on a finished room
      // would be the heaviest thing the server does, for nothing.
      refetchInterval: (q) => (q.state.data?.state === "result" ? IDLE_POLL_MS : POLL_MS),
    },
  );

  const view = room.data ?? initial;

  // An evicted or closed room is not an error to sit in.
  useEffect(() => {
    if (room.error) onLeave();
  }, [room.error, onLeave]);

  return (
    <div className="lobby">
      <h1 className="banner">{view.code}</h1>
      <p className="tagline">
        {view.state === "waiting"
          ? "Share the code. Waiting for an opponent."
          : "Both seats taken."}
      </p>

      <div className="seats">
        <Seat label="You" name={view.you.name} locked={view.you.locked} mine />
        <Seat
          label="Opponent"
          name={view.opponent?.name ?? null}
          locked={view.opponent?.locked ?? false}
        />
      </div>

      {view.msRemaining !== null ? (
        <p className="tagline">{Math.ceil(view.msRemaining / 1000)}s to plan</p>
      ) : null}

      <button className="linkBtn" type="button" onClick={onLeave}>
        Leave
      </button>
    </div>
  );
}

function Seat({
  label,
  name,
  locked,
  mine = false,
}: {
  label: string;
  name: string | null;
  locked: boolean;
  mine?: boolean;
}) {
  return (
    <div className={mine ? "seat mine" : "seat"}>
      <span className="seatLabel">{label}</span>
      <span className="seatName">{name ?? "empty"}</span>
      {locked ? <span className="seatLocked">locked in</span> : null}
    </div>
  );
}
