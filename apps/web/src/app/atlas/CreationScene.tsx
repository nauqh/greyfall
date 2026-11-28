import { useEffect, useRef, type ReactNode } from "react";

import type { HeroClass } from "@greyfall/engine";

import type { SackItem } from "../../game/AtlasScene";
import { ItemIcon } from "./ItemIcon";
import "./creationScene.css";

/** The sheet's window onto the hamlet (`creationStage.ts`), the choices on a slip over its left side. Mounted once; the
 *  class looked at cuts it to that class's door, none to the whole hamlet. */
export function CreationScene({ cls, gift, children }: { cls: HeroClass | null; gift?: SackItem; children: ReactNode }) {
  const world = useRef<HTMLDivElement>(null);

  useEffect(() => {
    let cancelled = false;
    let game: { destroy: () => void } | null = null;
    // Phaser only in the browser, and only once.
    void Promise.all([import("../../game/boot"), import("../../game/creationStage")]).then(([{ startGame }, { CreationStage }]) => {
      if (!cancelled) game = startGame(world.current!, "creation-stage", CreationStage);
    });
    return () => {
      cancelled = true;
      game?.destroy();
    };
  }, []);

  useEffect(() => {
    void import("../../game/creationStage").then(({ showClass }) => showClass(cls));
  }, [cls]);

  return (
    <div className="crScene">
      <div ref={world} className="crWorld" aria-hidden="true">
        {gift && (
          <span key={gift.label} className="crGift">
            <ItemIcon icon={gift.icon} size={32} />
          </span>
        )}
      </div>
      {children}
    </div>
  );
}
