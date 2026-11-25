import type { ReactNode } from "react";

import { useTick } from "../sound";

import "./panel.css";

export interface PanelOption {
  label: string;
  note?: string;
  /** A number at the row's right, popped when `pop` changes. */
  aside?: ReactNode;
  pop?: number;
  dim?: boolean;
  /** Its index among the scene's options, when the panel's rows are not all of them. */
  i?: number;
}

/**
 * The side panel the rest, the level up and the merchants share, after Elden Ring's grace: who or where at the head, a
 * badge beside it, the panel's own middle, then the choices as roomy rows and the keys at the foot.
 */
export function SidePanel({
  kicker,
  name,
  sub,
  badge,
  children,
  options,
  pick,
  onPick,
  onChoose,
  keys,
  wide = false,
  compact = false,
  role = "menu",
  className = "",
}: {
  kicker?: string;
  name: string;
  sub?: ReactNode;
  badge?: ReactNode;
  children?: ReactNode;
  options: PanelOption[];
  pick: number;
  onPick: (i: number) => void;
  onChoose: (i: number) => void;
  keys?: string;
  wide?: boolean;
  /** As tall as its content, for a panel opened in the field rather than at a rest. */
  compact?: boolean;
  role?: "menu" | "dialog";
  className?: string;
}) {
  useTick(pick);
  return (
    <div className={`sidePanel${wide ? " wide" : ""}${compact ? " compact" : ""} ${className}`} role={role} aria-label={name}>
      <div className="panelHead">
        <div className="panelWhere">
          {kicker && <span className="panelKicker">{kicker}</span>}
          <span className="panelName">{name}</span>
          {sub && <span className="panelSub">{sub}</span>}
        </div>
        {badge}
      </div>
      {children}
      {options.length > 0 && (
        <div className="panelOptions">
          {options.map((o, n) => {
            const i = o.i ?? n;
            return (
              <button
                key={o.label}
                type="button"
                role="menuitem"
                className={`panelOption${i === pick ? " picked" : ""}${o.dim ? " dim" : ""}`}
                onMouseEnter={() => onPick(i)}
                onClick={() => onChoose(i)}
              >
                <span className="panelOptionText">
                  <span className="panelOptionName">{o.label}</span>
                  {o.note && <span className="panelOptionNote">{o.note}</span>}
                </span>
                {o.aside !== undefined && (
                  <b key={o.pop} className={`panelAside${o.pop ? " pop" : ""}`}>
                    {o.aside}
                  </b>
                )}
              </button>
            );
          })}
        </div>
      )}
      {keys && <KeyHints className="panelKeys" keys={keys} />}
    </div>
  );
}

/** A strip of key hints, written "W/S pick   E choose", each key on the blue button of the field's E prompt. */
export function KeyHints({ keys, className }: { keys: string; className: string }) {
  return (
    <span className={className} aria-hidden="true">
      {keys.split(/\s{2,}/).map((part) => {
        const [k = "", ...words] = part.split(" ");
        return (
          <span key={part} className="keyHint">
            {k.split("/").map((c) => (
              <kbd key={c} className={c.length > 1 ? "keyCap wide" : "keyCap"}>
                {c}
              </kbd>
            ))}
            {words.join(" ")}
          </span>
        );
      })}
    </span>
  );
}

/** A level on a blue key, the way the shop sets each good's picture. */
export function LevelBadge({ level, pop }: { level: number; pop?: number }) {
  return (
    <div className="panelBadge" aria-label={`Level ${level}`}>
      <span>Level</span>
      <b key={pop} className={pop ? "pop" : undefined}>
        {level}
      </b>
    </div>
  );
}
