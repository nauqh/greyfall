"use client";

// The room, once you have a seat in it. One poll drives every screen: what
// the server says the state is, is what you are looking at. In a run, the
// Skirmish scene plays the room's run: every action is a round trip, and a
// round ends when everyone is ready or the server's clock runs out.

import { useCallback, useEffect, useRef, useState } from "react";

import type { BattleResult, LobbyRound } from "@greyfall/engine";

import type { AutoHooks } from "../game/autoPlan";
import { Clouds, useCloudExit } from "../game/Clouds";
import { GameCanvas } from "../game/GameCanvas";
import { StatTip, useStatTip } from "../game/StatTip";
import { api } from "./client.ts";
import { Waiting } from "./Waiting";
import type { RoomView } from "../server/room/view.ts";

/** 1s while anything is moving; a finished room slows down. */
const POLL_MS = 1000;
const IDLE_POLL_MS = 5000;

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
      refetchInterval: (q) => (q.state.data?.state === "result" ? IDLE_POLL_MS : POLL_MS),
      // Keep polling an unfocused tab. Waiting for the others is exactly
      // when someone alt-tabs away, and react-query parks the interval on a
      // blurred window by default.
      refetchIntervalInBackground: true,
    },
  );
  const view = room.data ?? initial;
  const utils = api.useUtils();

  // The scene reads these from its own handlers. Holding them in refs rather
  // than passing them down means a poll never remounts the game underneath a
  // battle.
  const live = useRef<RoomView | undefined>(view);
  live.current = view;
  const liveAt = useRef(0);
  liveAt.current = room.dataUpdatedAt;

  const start = api.room.start.useMutation();
  const rematch = api.room.rematch.useMutation();
  const leave = api.room.leave.useMutation();
  const [error, setError] = useState<string | null>(null);
  // The poll knows the run is over before the last fight has been watched;
  // nothing is said until the scene has shown it.
  const [played, setPlayed] = useState(false);

  // A rematch is a new run on the same seats, so a new game for the canvas.
  const game = useRef({ n: 0, round: 0 });
  const round = view?.run?.round ?? 0;
  if (round < game.current.round) game.current.n += 1;
  game.current.round = round;
  useEffect(() => setPlayed(false), [game.current.n]);

  // An evicted or closed room is not something to sit in.
  useEffect(() => {
    if (room.error) onLeave();
  }, [room.error, onLeave]);

  const take = useCallback(
    (v: RoomView) => {
      live.current = v;
      utils.room.get.setData({ code }, v);
    },
    [utils, code],
  );

  // The scene waits on the round it is planning; the poll that shows the run
  // past it fetches this seat's fight and hands it over.
  const waiter = useRef<{ round: number; resolve: (f: { round: LobbyRound; result: BattleResult | null }) => void } | null>(null);
  const settle = useCallback(() => {
    const w = waiter.current;
    const v = live.current;
    if (!w || !v?.run || !v.last || v.run.round <= w.round) return;
    waiter.current = null;
    const { last } = v;
    void utils.client.room.fight
      .query({ code, round: last.round })
      .catch(() => null)
      .then((f) => w.resolve({ round: last, result: f?.result ?? null }));
  }, [utils, code]);
  useEffect(settle, [view, settle]);

  const hooks = useRef<AutoHooks | null>(null);
  hooks.current ??= {
    seat: view?.seat ?? 0,
    run: () => live.current!.run!,
    act: (action) =>
      utils.client.room.act.mutate({ code, action }).then(
        (v) => {
          take(v);
          return null;
        },
        (e: Error) => e.message,
      ),
    ready: () => void utils.client.room.ready.mutate({ code }).then(take, () => {}),
    fought: (r) =>
      new Promise((resolve) => {
        waiter.current = { round: r, resolve };
        settle();
      }),
    clock: () => {
      const v = live.current!;
      return {
        msRemaining: v.msRemaining === null ? null : Math.max(0, v.msRemaining - (Date.now() - liveAt.current)),
        ready: v.players.map((p) => p.ready),
      };
    },
    onCard: (r) => {
      const v = live.current;
      if (v?.run?.over && v.last?.round === r.round) setPlayed(true);
    },
  };
  hooks.current.seat = view?.seat ?? 0;

  const exit = useCloudExit();
  const quit = useCallback(() => {
    leave.mutate({ code });
    exit.leave(onLeave);
  }, [leave, code, onLeave, exit]);

  // Hooks stay above the early returns below: leaving the waiting screen
  // must not change how many hooks run.
  const { tip, onTip } = useStatTip();

  // Waiting to planning is a screen change without a route change: the
  // waiting screen closes into cloud first, and the board parts out of it.
  // Only when this client saw the waiting screen; a refresh mid-run goes
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

  if (view.state === "waiting" || !view.run || sawWaiting) {
    return (
      <>
        <Waiting
          view={view}
          onStart={() => start.mutate({ code }, { onSuccess: take })}
          onLeave={quit}
          starting={start.isPending}
        />
        {view.state === "waiting" || !view.run ? exit.cover : <Clouds mode="close" onDone={() => setSawWaiting(false)} />}
      </>
    );
  }

  return (
    <div className="roomStage">
      <GameCanvas
        key={`versus-${game.current.n}`}
        start={(el) =>
          import("../game/BattleScene").then(({ startBattle }) =>
            startBattle(el, {
              result: null,
              seed: code,
              auto: hooks.current!,
              onMenu: quit,
              onTip,
            }),
          )
        }
      >
        <StatTip tip={tip} />
      </GameCanvas>

      {view.state === "result" && played ? (
        <div className="resultBar">
          {view.host ? (
            <button
              className="btn small"
              type="button"
              disabled={rematch.isPending}
              onClick={() => {
                setError(null);
                rematch.mutate({ code: view.code }, { onSuccess: take, onError: (e) => setError(e.message) });
              }}
            >
              Rematch
            </button>
          ) : null}
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
