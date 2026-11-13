"use client";

// The table before the run: who has sat down, and the host's Start.

const SEATS = 2;

/** The slice of RoomView this screen reads. */
interface WaitingView {
  code: string;
  seat: number;
  host: boolean;
  players: { name: string }[];
}

export function Waiting({
  view,
  onStart,
  onLeave,
  starting,
}: {
  view: WaitingView;
  onStart: () => void;
  onLeave: () => void;
  starting: boolean;
}) {
  const humans = view.players.length;
  return (
    <div className="lobby">
      <h1 className="banner">{view.code}</h1>
      <p className="tagline">Share the code. One rival sits opposite you.</p>
      <div className="seats">
        {Array.from({ length: SEATS }, (_, i) => {
          const player = view.players[i];
          if (!player) {
            return (
              <div key={i} className="seat empty">
                <span className="seatLabel">Seat {i + 1}</span>
                <span className="seatName">Waiting</span>
                <span className="seatNote">For a challenger</span>
              </div>
            );
          }
          return (
            <div key={i} className={i === view.seat ? "seat mine" : "seat"}>
              <span className="seatLabel">{i === view.seat ? "You" : `Seat ${i + 1}`}</span>
              <span className="seatName">{player.name}</span>
              {i === 0 ? <span className="seatNote">Host</span> : null}
            </div>
          );
        })}
      </div>
      {view.host ? (
        <button
          className="btn"
          type="button"
          disabled={humans < 2 || starting}
          onClick={onStart}
        >
          Start
        </button>
      ) : null}
      <p className="tagline">
        {view.host
          ? humans < 2
            ? "Start opens once a second player sits down."
            : "The table is full."
          : "The host starts the game."}
      </p>
      <button className="linkBtn" type="button" onClick={onLeave}>
        Leave
      </button>
    </div>
  );
}
