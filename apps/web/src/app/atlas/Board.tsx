import type { BoardView } from "../../game/AtlasScene";
import { packUrl } from "../../game/art";
import { useTick } from "../sound";
import { ItemIcon } from "./ItemIcon";
import { KeyHints } from "./SidePanel";
import "./panel.css";
import "./shop.css";
import "./board.css";

const NOTICE = { x: 11 * 32, y: 13 * 32 };
const STAMP = { up: "Wanted", fallen: "Fallen", paid: "Paid" };

/** A notice board after Elden Ring's bounty notes: notes pinned on the wood, the picked one read out on the paper beside. */
export function Board({ board, onHover, onChoose }: { board: BoardView; onHover: (i: number) => void; onChoose: (i: number) => void }) {
  useTick(board.pick);
  const pick = board.notes[board.pick];
  return (
    <div className="sideDock">
      <div className="board" role="menu" aria-label={board.name}>
        <div className="boardTop">
          <div className="boardWho">
            <span className="boardKicker">Notices</span>
            <span className="boardName">{board.name}</span>
          </div>
          <span className="shopPurse" aria-label={`${board.gold} gold held`}>
            <img src={packUrl("ui/icon_gold.png")} alt="" width={18} height={18} />
            {board.gold}
          </span>
        </div>

        <div className="boardBody">
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

          <section className="boardRead" aria-live="polite">
            {pick && (
              <>
                <div className="boardReadHead">
                  <ItemIcon icon={NOTICE} size={40} />
                  <span>{pick.title}</span>
                </div>
                <p>{pick.text}</p>
                <dl className="shopStats">
                  <div>
                    <dt>Posted by</dt>
                    <dd>{pick.from}</dd>
                  </div>
                  <div>
                    <dt>Reward</dt>
                    <dd>{pick.reward} gold</dd>
                  </div>
                  <div className={pick.state === "fallen" ? "boardDue" : undefined}>
                    <dt>Stands</dt>
                    <dd>{pick.state === "up" ? "Still out there" : pick.state === "fallen" ? "Fallen, reward waiting" : "Paid out"}</dd>
                  </div>
                </dl>
              </>
            )}
          </section>
        </div>

        <div className="boardFoot">
          <KeyHints className="shopKeys" keys={pick?.state === "fallen" ? "W/A/S/D pick   E collect   Esc leave" : "W/A/S/D pick   Esc leave"} />
        </div>
      </div>
    </div>
  );
}
