import { useEffect, useRef, useState, type RefObject } from "react";

import type { AtlasApi, MenuView } from "../../game/AtlasScene";
import { ItemIcon } from "./ItemIcon";
import { SidePanel } from "./SidePanel";
import "./shop.css";

/**
 * A merchant or a recruiter in the side panel: their name and greeting, then Talk, Shop or Hire, Leave. Shop opens the
 * goods in the same panel after Skyrim's barter: the list, then the picked good told out below it, its price and the gold
 * left.
 */
export function Shop({ menu, api }: { menu: MenuView; api: RefObject<AtlasApi | null> }) {
  const bought = useBought(menu);
  const pick = menu.options[menu.pick];
  const cost = Number(pick?.note);
  const rows = menu.options.map((o, i) => ({ ...o, i }));
  return (
    <div className="sideDock">
      <SidePanel
        kicker={menu.shop ? "Goods" : menu.role}
        name={menu.name}
        badge={
          <span className="shopPurse" aria-label={`${menu.gold} gold`}>
            <span className="panelGold">{menu.gold}</span>
          </span>
        }
        wide={menu.shop}
        options={rows.filter((o) => !o.icon).map((o) => ({ label: o.label, note: o.note ?? (o.label === "Back" ? "To the talk" : undefined), i: o.i }))}
        pick={menu.pick}
        onPick={(i) => api.current?.hover(i)}
        onChoose={(i) => api.current?.choose(i)}
        keys={menu.shop ? "W/S pick   E buy   Esc back" : "W/S pick   E choose   Esc leave"}
      >
        {!menu.shop && <p className="panelNote">&ldquo;{menu.greet}&rdquo;</p>}
        {menu.shop && (
          <>
            <ul className="shopList">
              {rows
                .filter((o) => o.icon)
                .map((o) => (
                  <li key={o.label}>
                    <button
                      type="button"
                      role="menuitem"
                      aria-label={`${o.label}, ${o.sold ? "sold" : `${o.note} gold`}`}
                      className={`shopRow${o.i === menu.pick ? " picked" : ""}${o.sold ? " sold" : ""}${o.afford === false && !o.sold ? " short" : ""}${o.label === bought ? " bought" : ""}`}
                      onMouseEnter={() => api.current?.hover(o.i)}
                      onClick={() => api.current?.choose(o.i)}
                    >
                      <span className="shopKey">
                        <ItemIcon icon={o.icon!} size={28} />
                      </span>
                      <span className="shopRowName">{o.label}</span>
                      {o.sold ? <span className="shopSoldTag">Sold</span> : <span className="panelGold">{o.note}</span>}
                    </button>
                  </li>
                ))}
            </ul>
            {/* Blank on Back rather than gone, so the panel does not jump. */}
            <div className="shopTell panelRule" aria-live="polite">
              {pick?.icon && (
                <>
                  <div className="shopTellHead">
                    <span className="shopKey big">
                      <ItemIcon icon={pick.icon} size={40} />
                    </span>
                    <span className="shopTellName">{pick.label}</span>
                  </div>
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
                    <span className="shopSoldTag">Already yours</span>
                  ) : (
                    !Number.isNaN(cost) && (
                      <div className={`panelCost${pick.afford === false ? " short" : ""}`}>
                        <span>
                          Price <span className="panelGold">{cost}</span>
                        </span>
                        <span>{menu.gold >= cost ? `${menu.gold - cost} gold after` : `${cost - menu.gold} gold short`}</span>
                      </div>
                    )
                  )}
                </>
              )}
            </div>
          </>
        )}
      </SidePanel>
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
