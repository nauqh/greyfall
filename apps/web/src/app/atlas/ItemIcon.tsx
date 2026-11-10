import type { ShopIcon } from "../../game/AtlasScene";

/** A good's picture in a merchant's menu: the cell of its sheet, and a tint multiplied over its shape, as Phaser tints. */
export function ItemIcon({ icon, size }: { icon: ShopIcon; size: number }) {
  const c = icon.crop;
  const k = c ? size / c.w : 1;
  const art = {
    image: `url("${icon.url}")`,
    position: c ? `${-c.x * k}px ${-c.y * k}px` : "0 0",
    size: c ? `${c.sheetW * k}px ${c.sheetH * k}px` : "100% 100%",
  };
  return (
    <span
      aria-hidden="true"
      style={{ position: "relative", display: "inline-block", width: size, height: size, verticalAlign: "middle", backgroundImage: art.image, backgroundPosition: art.position, backgroundSize: art.size, backgroundRepeat: "no-repeat", imageRendering: "pixelated" }}
    >
      {icon.tint && (
        <span
          style={{ position: "absolute", inset: 0, backgroundColor: icon.tint, mixBlendMode: "multiply", maskImage: art.image, maskPosition: art.position, maskSize: art.size, maskRepeat: "no-repeat", WebkitMaskImage: art.image, WebkitMaskPosition: art.position, WebkitMaskSize: art.size, WebkitMaskRepeat: "no-repeat" }}
        />
      )}
    </span>
  );
}
