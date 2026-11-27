import type { BoardView } from "../../game/AtlasScene";
import { packUrl } from "../../game/art";
import { useTick } from "../sound";
import { ItemIcon } from "./ItemIcon";
import { KeyHints } from "./SidePanel";
import "./panel.css";
import "./board.css";

const NOTICE = { x: 11 * 32, y: 13 * 32 };
const STAMP = { up: "Wanted", fallen: "Fallen", paid: "Paid" };

/** The Lane House board, after Elden Ring's bounty notes: the notes pinned on the wood, the picked one pinned up large
 *  beside them, the hall's name on a ribbon over the top and the keys along the foot of the wood. */
export function Board({ board, onHover, onChoose }: { board: BoardView; onHover: (i: number) => void; onChoose: (i: number) => void }) {
  useTick(board.pick);
  const pick = board.notes[board.pick];
  return (
    <div className="sideDock">
      <div className="boardWrap">
        <div className="board" role="menu" aria-label={board.name}>
          <h2 className="boardHead">{board.name}</h2>
          <span className="boardPurse" aria-label={`${board.gold} gold held`}>
            <img src={packUrl("ui/icon_gold.png")} alt="" width={18} height={18} />
            {board.gold}
          </span>

          <ul className="boardNotes">
            {board.notes.map((n, i) => (
              <li key={n.title}>
                <button
                  type="button"
                  role="menuitem"
                  aria-label={`${n.title}, ${STAMP[n.state]}, ${n.reward} gold`}
                  className={`boardNote ${n.state}${i === board.pick ? " picked" : ""}`}
                  onMouseEnter={() => onHover(i)}
                  onClick={() => onChoose(i)}
                >
                  <span className="boardPin" aria-hidden="true" />
                  <b>{n.title}</b>
                  <span className="boardReward">
                    <img src={packUrl("ui/icon_gold.png")} alt="" width={14} height={14} />
                    {n.reward}
                  </span>
                  {n.state !== "up" && <span className="boardStamp">{STAMP[n.state]}</span>}
                </button>
              </li>
            ))}
          </ul>

          {pick && (
            <section key={board.pick} className={`boardRead ${pick.state}`} aria-live="polite">
              <span className="boardPin" aria-hidden="true" />
              <div className="boardReadHead">
                <ItemIcon icon={NOTICE} size={40} />
                <span>{pick.title}</span>
              </div>
              <p>{pick.text}</p>
              <dl className="boardFacts">
                <div>
                  <dt>Posted by</dt>
                  <dd>{pick.from}</dd>
                </div>
                <div>
                  <dt>Reward</dt>
                  <dd>{pick.reward} gold</dd>
                </div>
                <div className={pick.state === "fallen" ? "due" : undefined}>
                  <dt>Stands</dt>
                  <dd>{pick.state === "up" ? "Still out there" : pick.state === "fallen" ? "Fallen, reward waiting" : "Paid out"}</dd>
                </div>
              </dl>
              {pick.state !== "up" && <span className="boardStamp big">{STAMP[pick.state]}</span>}
            </section>
          )}
          <KeyHints className="boardKeys" keys={pick?.state === "fallen" ? "W/A/S/D pick   E collect   Esc leave" : "W/A/S/D pick   Esc leave"} />
        </div>
      </div>
    </div>
  );
}
