import type { ShopIcon } from "../../game/AtlasScene";

/** A good's picture in a menu or the sack: its cell of the icon sheet, scaled up. */
export function ItemIcon({ icon, size }: { icon: ShopIcon; size: number }) {
  const k = size / 32;
  return (
    <span
      aria-hidden="true"
      style={{ display: "inline-block", width: size, height: size, verticalAlign: "middle", backgroundImage: 'url("/icons/shikashi.png")', backgroundPosition: `${-icon.x * k}px ${-icon.y * k}px`, backgroundSize: `${512 * k}px ${867 * k}px`, imageRendering: "pixelated" }}
    />
  );
}
