import { useEffect, useRef, useState, type MouseEvent, type RefObject } from "react";

import type { AtlasApi, MenuView } from "../../game/AtlasScene";
import { ItemIcon } from "./ItemIcon";
import "./shop.css";

/** A talk menu, and a merchant's goods once Shop is picked. */
export function Shop({ menu, api }: { menu: MenuView; api: RefObject<AtlasApi | null> }) {
  const bought = useBought(menu);
  const pick = menu.options[menu.pick];
  const cost = Number(pick?.note);
  const choose = (i: number) => (e: MouseEvent<HTMLButtonElement>) => {
    api.current?.choose(i);
    e.currentTarget.blur();
  };
  return (
    // A merchant's menu, after the Souls games: the name, the options, the one picked marked. Its Shop opens the
    // goods after Skyrim's barter: the list on one side, the picked good told out on the other.
    <div className={`shop${menu.shop ? " open" : ""}`} role="menu" aria-label={menu.name}>
      {!menu.shop && <span className="talkName">{menu.name}</span>}
      {menu.shop && (
        <div className="shopGoods">
          <span className="shopHead">{menu.name}</span>
          <ul className="shopList">
            {menu.options.map(
              (o, i) =>
                o.icon && (
                  <li key={o.label}>
                    <button
                      type="button"
                      role="menuitem"
                      aria-label={`${o.label}, ${o.sold ? "sold" : `${o.note} gold`}`}
                      className={`shopRow${i === menu.pick ? " picked" : ""}${o.sold ? " sold" : ""}${o.afford === false && !o.sold ? " short" : ""}${o.label === bought ? " bought" : ""}`}
                      onMouseEnter={() => api.current?.hover(i)}
                      onClick={choose(i)}
                    >
                      <span className="shopKey">
                        <ItemIcon icon={o.icon} size={28} />
                      </span>
                      <span className="shopRowName">{o.label}</span>
                      <span className="shopPrice">{o.sold ? "Sold" : o.note}</span>
                    </button>
                  </li>
                ),
            )}
          </ul>
          {/* Blank on Back rather than gone, so the panel does not jump. */}
          <div className="shopTell" aria-live="polite">
            {pick?.icon && (
              <>
                <span className="shopKey big">
                  <ItemIcon icon={pick.icon} size={40} />
                </span>
                <span className="shopTellName">{pick.label}</span>
                {pick.about && <i className="shopAbout">{pick.about}</i>}
                {pick.change?.length ? (
                  <ul className="shopChange">
                    {pick.change.map((c) => (
                      <li key={c.label}>
                        <span>{c.label}</span>
                        <span>
                          {c.now}
                          {c.after !== undefined && c.after !== c.now && <b> -&gt; {c.after}</b>}
                        </span>
                      </li>
                    ))}
                  </ul>
                ) : (
                  pick.gives && <span>{pick.gives}</span>
                )}
                {pick.sold ? (
                  <span className="shopSold">Sold</span>
                ) : (
                  <span className={`shopCost${pick.afford === false ? " short" : ""}`}>
                    <span className="shopPrice">{pick.note}</span>
                    {menu.gold !== undefined && !Number.isNaN(cost) && (
                      <span>{menu.gold >= cost ? `${menu.gold - cost} gold after` : `${cost - menu.gold} gold short`}</span>
                    )}
                  </span>
                )}
              </>
            )}
          </div>
        </div>
      )}
      {menu.options.map(
        (o, i) =>
          !o.icon && (
            <button
              key={o.label}
              type="button"
              role="menuitem"
              className={`shopOption${i === menu.pick ? " picked" : ""}`}
              onMouseEnter={menu.shop ? () => api.current?.hover(i) : undefined}
              onClick={choose(i)}
            >
              {o.label}
              {o.note && <span className="shopNote">{o.note}</span>}
            </button>
          ),
      )}
      <span className="talkNext" aria-hidden="true">
        {menu.shop ? "W/S, E, Esc" : "WASD, E"}
      </span>
    </div>
  );
}

/** The good last turned Sold while the goods were open, to flash its row once. */
function useBought(menu: MenuView): string | null {
  const seen = useRef<Set<string> | null>(null);
  const [bought, setBought] = useState<string | null>(null);
  useEffect(() => {
    if (!menu.shop) {
      seen.current = null;
      return;
    }
    const sold = new Set(menu.options.filter((o) => o.sold).map((o) => o.label));
    const fresh = seen.current && [...sold].find((l) => !seen.current!.has(l));
    seen.current = sold;
    if (fresh) setBought(fresh);
  }, [menu]);
  return bought;
}
