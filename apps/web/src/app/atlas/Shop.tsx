import { useEffect, useRef, useState, type RefObject } from "react";

import type { AtlasApi, MenuView } from "../../game/AtlasScene";
import { packUrl } from "../../game/art";
import { useTick } from "../sound";
import { ItemIcon } from "./ItemIcon";
import { KeyHints } from "./SidePanel";
import "./panel.css";
import "./shop.css";

const ICON = {
  talk: "UI Elements/UI Elements/Icons/Icon_11.png",
  shop: "UI Elements/UI Elements/Icons/Icon_03.png",
  hire: "UI Elements/UI Elements/Icons/Icon_05.png",
  leave: "UI Elements/UI Elements/Icons/Icon_09.png",
  gold: "ui/icon_gold.png",
};

const SLOTS = 10;

/**
 * A merchant or a recruiter at the right, after Elden Ring's merchant: the greeting over Talk, Shop or Hire, Leave; Shop
 * opens the goods as a grid of slots, the picked good told out beside it, and the gold held and after at the foot.
 */
export function Shop({ menu, api }: { menu: MenuView; api: RefObject<AtlasApi | null> }) {
  const bought = useBought(menu);
  useTick(menu.pick);
  const rows = menu.options.map((o, i) => ({ ...o, i }));
  const goods = rows.filter((o) => o.icon);
  const choices = rows.filter((o) => !o.icon);
  const pick = menu.options[menu.pick];
  const cost = Number(pick?.note);
  const after = menu.sell ? menu.gold + cost : Math.abs(menu.gold - cost);
  const hover = (i: number) => api.current?.hover(i);
  const choose = (i: number) => api.current?.choose(i);
  return (
    <div className="sideDock">
      <div className={`shop${menu.shop ? " goods" : ""}`} role="menu" aria-label={menu.name}>
        <div className="shopTop">
          <div className="shopWho">
            <span className="shopKicker">{menu.sell ? "Sell" : menu.shop ? "Purchase" : menu.role}</span>
            <span className="shopName">{menu.name}</span>
          </div>
          <span className="shopPurse" aria-label={`${menu.gold} gold held`}>
            <img src={packUrl(ICON.gold)} alt="" width={18} height={18} />
            {menu.gold}
          </span>
        </div>

        {!menu.shop && (
          <>
            <blockquote className="shopGreet">&ldquo;{menu.greet}&rdquo;</blockquote>
            <section className="shopChoices">
              {choices.map((o) => (
                <button
                  key={o.label}
                  type="button"
                  role="menuitem"
                  className={`shopChoice${o.i === menu.pick ? " picked" : ""}`}
                  onMouseEnter={() => hover(o.i)}
                  onClick={() => choose(o.i)}
                >
                  <img src={packUrl(choiceIcon(o.label))} alt="" width={26} height={26} />
                  <span className="shopChoiceText">
                    <b>{o.label}</b>
                    {o.note && <small>{o.note}</small>}
                  </span>
                </button>
              ))}
            </section>
          </>
        )}

        {menu.shop && (
          <>
            <div className="shopBody">
              <section className="shopWares">
                <h3 className="panelHeading">{menu.sell ? "Your goods" : "Wares"}</h3>
                <ul className="shopGrid">
                  {goods.map((o) => (
                    <li key={o.label}>
                      <button
                        type="button"
                        role="menuitem"
                        aria-label={`${o.label}, ${o.sold ? "sold" : `${o.note} gold`}`}
                        className={`shopSlot${o.i === menu.pick ? " picked" : ""}${o.sold ? " sold" : ""}${o.afford === false && !o.sold ? " short" : ""}${o.label === bought ? " bought" : ""}`}
                        onMouseEnter={() => hover(o.i)}
                        onClick={() => choose(o.i)}
                      >
                        <span className="shopSlotArt">
                          <ItemIcon icon={o.icon!} size={34} />
                        </span>
                        <span className="shopPrice">{o.sold ? "Sold" : o.note}</span>
                      </button>
                    </li>
                  ))}
                  {Array.from({ length: Math.max(0, SLOTS - goods.length) }, (_, n) => (
                    <li key={n} aria-hidden="true">
                      <span className="shopSlot empty">
                        <span className="shopSlotArt" />
                      </span>
                    </li>
                  ))}
                </ul>
              </section>

              {/* Every good's telling in one cell, the picked one shown, so the cell is as tall as the tallest and the shop
                  keeps still as the pick moves. */}
              <section className="shopTell" aria-live="polite">
                {goods.map((o) => (
                  <div key={o.label} className={o.i === menu.pick ? "shown" : undefined} aria-hidden={o.i !== menu.pick}>
                    <Tell o={o} />
                  </div>
                ))}
                <div className={pick?.icon ? undefined : "shown"} aria-hidden={!!pick?.icon}>
                  <p className="shopAbout">Back to the talk.</p>
                </div>
              </section>
            </div>

            <section className="shopFoot">
              <dl className="shopLedger">
                <div>
                  <dt>Gold held</dt>
                  <dd>{menu.gold}</dd>
                </div>
                <div>
                  <dt>{menu.sell ? "Offer" : "Price"}</dt>
                  <dd>{pick?.sold || Number.isNaN(cost) ? "-" : cost}</dd>
                </div>
                <div className={pick?.afford === false && !pick.sold ? "short" : undefined}>
                  <dt>{pick?.afford === false && !pick.sold ? "Gold short" : "Gold after"}</dt>
                  <dd>{pick?.sold || Number.isNaN(cost) ? menu.gold : after}</dd>
                </div>
              </dl>
              {choices.map((o) => (
                <button
                  key={o.label}
                  type="button"
                  role="menuitem"
                  className={`shopChoice back${o.i === menu.pick ? " picked" : ""}`}
                  onMouseEnter={() => hover(o.i)}
                  onClick={() => choose(o.i)}
                >
                  <img src={packUrl(ICON.leave)} alt="" width={20} height={20} />
                  <b>{o.label}</b>
                </button>
              ))}
            </section>
          </>
        )}

        <KeyHints className="shopKeys" keys={menu.shop ? `W/S pick   E ${menu.sell ? "sell" : "buy"}   Esc back` : "W/S pick   E choose   Esc leave"} />
      </div>
    </div>
  );
}

function choiceIcon(label: string): string {
  if (label === "Talk") return ICON.talk;
  if (label === "Shop") return ICON.shop;
  if (label === "Sell") return ICON.gold;
  if (label.startsWith("Hire")) return ICON.hire;
  return ICON.leave;
}

/** The good last turned Sold while the goods were open, to flash its slot once. */
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

/** A good told out: its picture and name, its telling, what it changes, and whether it is held. */
function Tell({ o }: { o: MenuView["options"][number] }) {
  return (
    <>
      <div className="shopTellHead">
        <span className="shopTellArt">
          <ItemIcon icon={o.icon!} size={56} />
        </span>
        <span className="shopTellName">{o.label}</span>
      </div>
      {o.about && <p className="shopAbout">{o.about}</p>}
      <h3 className="panelHeading">Effect</h3>
      <dl className="shopStats">
        {o.change?.length
          ? o.change.map((c) => (
              <div key={c.label}>
                <dt>{c.label}</dt>
                <dd>
                  {c.now}
                  {c.after !== undefined && c.after !== c.now && (
                    <>
                      <span className="shopArrow"> -&gt; </span>
                      <b>{c.after}</b>
                    </>
                  )}
                </dd>
              </div>
            ))
          : o.gives && (
              <div>
                <dt>Gives</dt>
                <dd>{o.gives}</dd>
              </div>
            )}
        <div>
          <dt>Held</dt>
          <dd>{o.held ?? (o.sold ? "1 / 1" : "0 / 1")}</dd>
        </div>
      </dl>
    </>
  );
}
