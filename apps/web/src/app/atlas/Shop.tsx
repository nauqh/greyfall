import type { RefObject } from "react";

import type { AtlasApi, MenuView } from "../../game/AtlasScene";
import { ItemIcon } from "./ItemIcon";
import "./shop.css";

/** A talk menu, and a merchant's goods once Shop is picked. */
export function Shop({ menu, api }: { menu: MenuView; api: RefObject<AtlasApi | null> }) {
  return (
    // A merchant's menu, after the Souls games: the name, the options, the one picked marked. Its Shop opens the
    // goods on the blue keys of Play's command card, the picked one told out under them.
    <div className="shop" role="menu" aria-label={menu.name}>
      <span className="talkName">{menu.name}</span>
      {menu.shop && (
        <div className="shopGoods">
          <div className="shopCards">
            {menu.options.map(
              (o, i) =>
                o.icon && (
                  <button
                    key={o.label}
                    type="button"
                    role="menuitem"
                    aria-label={`${o.label}, ${o.sold ? "sold" : `${o.note} gold`}`}
                    className={`shopCard${i === menu.pick ? " picked" : ""}${o.sold ? " sold" : ""}`}
                    onClick={(e) => {
                      api.current?.choose(i);
                      e.currentTarget.blur();
                    }}
                  >
                    <ItemIcon icon={o.icon} size={40} />
                    <span className="shopPrice">{o.sold ? "Sold" : o.note}</span>
                  </button>
                ),
            )}
          </div>
          {/* Blank on Talk or Leave rather than gone, so the panel does not jump. */}
          <div className="shopTell">
            <span className="shopTellName">{menu.options[menu.pick]?.gives ? menu.options[menu.pick]!.label : " "}</span>
            <span>{menu.options[menu.pick]?.gives ?? " "}</span>
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
              onClick={(e) => {
                api.current?.choose(i);
                e.currentTarget.blur();
              }}
            >
              {o.label}
              {o.note && <span className="shopNote">{o.note}</span>}
            </button>
          ),
      )}
      <span className="talkNext" aria-hidden="true">
        WASD, E
      </span>
    </div>
  );
}
