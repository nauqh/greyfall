import { useLayoutEffect, useRef, useState, type ReactNode } from "react";

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

export interface Cursor {
  /** The ref for row `i`: the picked one is measured and scrolled to. */
  mark: (i: number) => ((el: HTMLElement | null) => void) | undefined;
  bar: ReactNode;
}

/** Dark Souls' highlight: one solid bar that slides to the picked row, up or down, rather than each row lighting in turn.
 *  `bar` goes first in the rows' nearest positioned box, which their offsets are measured against. */
export function useCursor(pick: number): Cursor {
  const picked = useRef<HTMLElement | null>(null);
  const [at, setAt] = useState<{ x: number; y: number; w: number; h: number } | null>(null);
  useLayoutEffect(() => {
    const el = picked.current;
    // Inside the row's border, so a framed row keeps its frame over the bar.
    setAt(el && { x: el.offsetLeft + el.clientLeft, y: el.offsetTop + el.clientTop, w: el.clientWidth, h: el.clientHeight });
  }, [pick]);
  return {
    mark: (i) =>
      i === pick
        ? (el) => {
            picked.current = el;
            el?.scrollIntoView({ block: "nearest" });
          }
        : undefined,
    bar: at && <span className="panelCursor" aria-hidden="true" style={{ translate: `${at.x}px ${at.y}px`, width: at.w, height: at.h }} />,
  };
}

/**
 * The side panel the rest, the level up and the merchants share, after Elden Ring's grace: who or where at the head, a
 * badge beside it, the panel's own middle, then the choices as roomy rows.
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
  wide = false,
  compact = false,
  role = "menu",
  className = "",
  cursor,
  foot,
}: {
  kicker?: string;
  name: string;
  sub?: ReactNode;
  badge?: ReactNode;
  children?: ReactNode;
  /** The panel's last line, under the choices: its key hints. */
  foot?: ReactNode;
  options: PanelOption[];
  pick: number;
  onPick: (i: number) => void;
  onChoose: (i: number) => void;
  wide?: boolean;
  /** As tall as its content, for a panel opened in the field rather than at a rest. */
  compact?: boolean;
  role?: "menu" | "dialog";
  className?: string;
  /** A sliding highlight from useCursor, shared with rows the panel's children draw. */
  cursor?: Cursor;
}) {
  useTick(pick);
  return (
    <div className={`sidePanel${wide ? " wide" : ""}${compact ? " compact" : ""}${cursor ? " hasCursor" : ""} ${className}`} role={role} aria-label={name}>
      {cursor?.bar}
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
                key={i}
                ref={cursor ? cursor.mark(i) : i === pick ? (el) => el?.scrollIntoView({ block: "nearest" }) : undefined}
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
      {foot}
    </div>
  );
}

/** A strip of key hints, written "W/S pick   E choose" and shown as Dark Souls 1 prompts them, "W/S: Pick", each key on
 *  the blue button of the field's E prompt. A key in `onKey` is a button too, for the mouse. */
export function KeyHints({ keys, className, onKey }: { keys: string; className: string; onKey?: Record<string, () => void> }) {
  return (
    <span className={className} aria-hidden={onKey ? undefined : true}>
      {keys.split(/\s{2,}/).map((part) => {
        const [k = "", ...rest] = part.split(" ");
        const said = rest.join(" ");
        const words = `: ${said.charAt(0).toUpperCase()}${said.slice(1)}`;
        const caps = k.split("/").map((c) => (
          <kbd key={c} className={c.length > 1 ? "keyCap wide" : "keyCap"}>
            {c}
          </kbd>
        ));
        const press = onKey?.[k];
        return press ? (
          <button key={part} type="button" className="keyHint" onClick={press}>
            {caps}
            {words}
          </button>
        ) : (
          <span key={part} className="keyHint">
            {caps}
            {words}
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
