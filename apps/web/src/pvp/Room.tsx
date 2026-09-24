"use client";

// The room, once you have a seat in it. One poll drives every screen: what
// the server says the state is, is what you are looking at.

import type { Placement } from "@greyfall/engine";
import { useCallback, useEffect, useRef, useState } from "react";

import { Clouds, useCloudExit } from "../game/Clouds";
import { GameCanvas } from "../game/GameCanvas";
import { StatTip, useStatTip } from "../game/StatTip";
import { api } from "./client.ts";
import type { RoomView } from "../server/room/view.ts";

/** 1s while anything is moving. The result screen slows down; see below. */
const POLL_MS = 1000;
const IDLE_POLL_MS = 5000;
/** A placement is a click, and a click is not worth a round trip each. */
const AUTOSAVE_MS = 250;

export function Room({
  code,
  initial,
  onLeave,
}: {
  code: string;
  /** A view held before the first poll lands; absent on a direct visit. */
  initial?: RoomView;
  onLeave: () => void;
}) {
  const room = api.room.get.useQuery(
    { code },
    {
      initialData: initial,
      // Stop polling fast once the battle is in hand: a stored BattleResult is
      // ~16KB, and two clients pulling that every second on a finished room
      // would be the heaviest thing the server does, for nothing.
      refetchInterval: (q) => (q.state.data?.state === "result" ? IDLE_POLL_MS : POLL_MS),
      // Keep polling an unfocused tab. Waiting for an opponent is exactly
      // when someone alt-tabs away, and react-query parks the interval on a
      // blurred window by default - so the player who opened the room would
      // sit on "waiting" while the other one was already drafting.
      refetchIntervalInBackground: true,
    },
  );
  const view = room.data ?? initial;

  // The scene reads this every frame. Holding it in a ref rather than passing
  // it down means a poll never remounts the game underneath a battle. Null
  // only before the first poll lands, and nothing below reads it then: the
  // loading guard sits first, so every read happens under a real view.
  const live = useRef<RoomView | undefined>(view);
  live.current = view;

  const setArmy = api.room.setArmy.useMutation();
  const lock = api.room.lock.useMutation();
  const rematch = api.room.rematch.useMutation();
  const leave = api.room.leave.useMutation();
  const [error, setError] = useState<string | null>(null);
  // The server resolves as soon as both seats lock, so the poll carries the
  // winner while the fight is still playing. Nothing is said until the scene
  // has finished showing it.
  const [played, setPlayed] = useState(false);
  useEffect(() => setPlayed(false), [view?.round]);

  // An evicted or closed room is not something to sit in.
  useEffect(() => {
    if (room.error) onLeave();
  }, [room.error, onLeave]);

  const queued = useRef<Placement[] | null>(null);
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const pushArmy = useCallback(
    (army: Placement[]) => {
      queued.current = army;
      if (timer.current) return;
      timer.current = setTimeout(() => {
        timer.current = null;
        const next = queued.current;
        queued.current = null;
        if (next) setArmy.mutate({ code, army: next });
      }, AUTOSAVE_MS);
    },
    [setArmy],
  );
  useEffect(() => () => void (timer.current && clearTimeout(timer.current)), []);

  const exit = useCloudExit();
  const quit = useCallback(() => {
    leave.mutate({ code });
    exit.leave(onLeave);
  }, [leave, code, onLeave, exit]);

  // Hooks stay above the early returns below: this one used to sit after
  // them, so leaving the waiting screen ran one more hook than the render
  // before and React threw.
  const { tip, onTip } = useStatTip();

  // Waiting to drafting is a screen change without a route change: the
  // waiting screen closes into cloud first, and the board parts out of it.
  // Only when this client saw the waiting screen; a refresh mid-draft goes
  // straight to the board.
  const [sawWaiting, setSawWaiting] = useState(false);
  useEffect(() => {
    if (view?.state === "waiting") setSawWaiting(true);
  }, [view?.state]);

  // A short wait while the first poll lands; a wrong or expired code is
  // handled by the room.error effect, which walks out to the lobby.
  if (!view) {
    return (
      <div className="lobby">
        <p className="tagline">Entering the room...</p>
      </div>
    );
  }

  if (view.state === "waiting" || sawWaiting) {
    return (
      <>
        <Waiting view={view} onLeave={quit} />
        {view.state === "waiting" ? exit.cover : <Clouds mode="close" onDone={() => setSawWaiting(false)} />}
      </>
    );
  }

  // A walkover has no event log to play, so there is nothing for the canvas
  // to show and the page says what happened instead.
  const walkover = view.state === "result" && view.battle === null;

  return (
    <div className="roomStage">
      {walkover ? null : (
        <GameCanvas
          // Keyed on the round, so a rematch builds a fresh game and a poll
          // during a battle never disturbs the one that is playing.
          key={`duel-${view.round}`}
          start={(el) =>
            import("../game/BattleScene").then(({ startBattle }) =>
              startBattle(el, {
                result: null,
                seed: code,
                mySide: view.seat === 0 ? "a" : "b",
                // Never called in a duel: the server owns the resolution, and
                // Lock in stands where Start does in a solo battle.
                onDraft: () => {
                  throw new Error("a duel is resolved by the server");
                },
                onRematch: () => {
                  throw new Error("a duel rematch belongs to the room");
                },
                onNewArmy: () => {
                  throw new Error("a duel rematch belongs to the room");
                },
                onMenu: onLeave,
                onTip,
                duel: {
                  onArmyChange: pushArmy,
                  onLock: () => lock.mutate({ code }),
                  onPlayed: () => setPlayed(true),
                  status: () => {
                    const v = live.current!;
                    return {
                      msRemaining: v.msRemaining,
                      youLocked: v.you.locked,
                      theyLocked: v.opponent?.locked ?? false,
                      opponent: v.opponent?.name ?? null,
                      battle: v.battle,
                    };
                  },
                },
              }),
            )
          }
        >
          <StatTip tip={tip} />
        </GameCanvas>
      )}

      {view.state === "result" && (played || walkover) ? (
        <div className="resultBar">
          <Outcome view={view} />
          <button
            className="btn small"
            type="button"
            disabled={rematch.isPending}
            onClick={() => {
              setError(null);
              rematch.mutate({ code: view.code }, { onError: (e) => setError(e.message) });
            }}
          >
            Rematch
          </button>
          <button className="btn red small" type="button" onClick={quit}>
            Leave
          </button>
          {error ? <span className="error">{error}</span> : null}
        </div>
      ) : null}
      {exit.cover}
    </div>
  );
}

/** Who won, in the caller's own terms. */
function Outcome({ view }: { view: RoomView }) {
  const mine = view.seat === 0 ? "a" : "b";
  const winner = view.battle?.winner ?? view.walkover;
  const word =
    winner === "draw" || winner == null
      ? "A draw"
      : winner === mine
        ? "You hold"
        : "The grey takes you";
  const how = view.battle === null ? " - nobody fielded an army against you" : "";
  return (
    <span className="outcome">
      {word}
      {how}
    </span>
  );
}

function Waiting({ view, onLeave }: { view: RoomView; onLeave: () => void }) {
  return (
    <div className="lobby">
      <h1 className="banner">{view.code}</h1>
      <p className="tagline">Share the code. Waiting for an opponent.</p>
      <div className="seats">
        <Seat label="You" name={view.you.name} locked={view.you.locked} mine />
        <Seat label="Opponent" name={null} locked={false} />
      </div>
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
