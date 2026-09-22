"use client";

// Name, create, join. The whole of the PvP entry point.
//
// Plain DOM rather than a Phaser scene: it is a form, and the scene's own UI
// kit has no text input. The board screens stay in Phaser.

import { useEffect, useState } from "react";

import { api, rememberToken, storedToken } from "./client.ts";
import type { RoomView } from "../server/room/view.ts";

const NAME_KEY = "greyfall.name";

export function Lobby({
  onEnter,
  onBack,
}: {
  onEnter: (room: RoomView) => void;
  onBack: () => void;
}) {
  const [name, setName] = useState("");
  const [code, setCode] = useState("");
  const [error, setError] = useState<string | null>(null);

  const issue = api.room.issueToken.useMutation();
  const create = api.room.create.useMutation();
  const join = api.room.join.useMutation();
  const busy = issue.isPending || create.isPending || join.isPending;

  useEffect(() => {
    try {
      setName(window.localStorage.getItem(NAME_KEY) ?? "");
    } catch {
      /* no stored name; the field just starts empty */
    }
  }, []);

  /** Every call needs a token, so make sure one exists before the first one. */
  const withToken = async (): Promise<void> => {
    if (storedToken()) return;
    const { token } = await issue.mutateAsync();
    rememberToken(token);
  };

  const run = async (go: () => Promise<RoomView>): Promise<void> => {
    setError(null);
    try {
      await withToken();
      try {
        window.localStorage.setItem(NAME_KEY, name.trim());
      } catch {
        /* the name just will not be remembered */
      }
      onEnter(await go());
    } catch (e) {
      setError(e instanceof Error ? e.message : "something went wrong");
    }
  };

  const named = name.trim().length > 0;

  return (
    <div className="lobby">
      <h1 className="banner">GREYFALL</h1>
      <p className="tagline">Two warbands, one room code.</p>

      <div className="paper">
        <label className="field">
          <span className="fieldLabel">Your name</span>
          <input
            value={name}
            maxLength={20}
            onChange={(e) => setName(e.target.value)}
            placeholder="Wanderer"
          />
        </label>

        <button
          className="btn"
          type="button"
          disabled={!named || busy}
          onClick={() => void run(() => create.mutateAsync({ name: name.trim() }))}
        >
          Create a room
        </button>

        <div className="field">
          <span className="fieldLabel">Have a code?</span>
          <div className="joinRow">
            <input
              className="codeInput"
              value={code}
              maxLength={6}
              onChange={(e) => setCode(e.target.value.toUpperCase())}
              placeholder="CODE"
            />
            <button
              className="btn red small"
              type="button"
              disabled={!named || code.trim().length !== 6 || busy}
              onClick={() =>
                void run(() => join.mutateAsync({ code: code.trim(), name: name.trim() }))
              }
            >
              Join
            </button>
          </div>
        </div>

        {error ? <p className="error">{error}</p> : null}
      </div>

      <button className="linkBtn" type="button" onClick={onBack}>
        Back to solo
      </button>
    </div>
  );
}
