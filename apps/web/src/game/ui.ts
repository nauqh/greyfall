// The kit ships nine-slices with empty bands between the pieces, which
// neither Phaser NineSlice nor CSS border-image can read. Everything here
// composes them edge to edge first; after that a panel is an ordinary
// nine-slice that stretches without smearing its corners.

import * as Phaser from "phaser";

import { BAR, PANELS, RIBBON, packUrl, type PanelName, type SliceSheet } from "./art";

/** Key a sheet loads under, before composing. */
export function sheetKey(name: PanelName): string {
  return `sheet_${name}`;
}

/** Key the composed nine-slice ends up under. */
export function panelKey(name: PanelName): string {
  return `panel_${name}`;
}

export function loadPanels(scene: Phaser.Scene, names: readonly PanelName[]): void {
  for (const name of names) scene.load.image(sheetKey(name), packUrl(PANELS[name].file));
  scene.load.image("bar_base_src", packUrl(BAR.base));
  scene.load.image("bar_fill_src", packUrl(BAR.fill));
  scene.load.image("ribbon_src", packUrl(RIBBON.file));
}

interface Slice {
  key: string;
  left: number;
  right: number;
  top: number;
  bottom: number;
}

/** Pack a gapped nine-slice sheet into one contiguous texture. */
function compose(scene: Phaser.Scene, name: PanelName): Slice {
  const spec: SliceSheet = PANELS[name];
  const key = panelKey(name);
  const w = spec.colW[0] + spec.colW[1] + spec.colW[2];
  const h = spec.rowH[0] + spec.rowH[1] + spec.rowH[2];

  if (!scene.textures.exists(key)) {
    // Without this the missing sheet resolves to Phaser's __MISSING texture
    // and gets nine-sliced into a small green-and-black square, which is a
    // long way from looking like a forgotten preload.
    if (!scene.textures.exists(sheetKey(name))) {
      throw new Error(`panel "${name}" was never loaded: add it to loadPanels in preload`);
    }
    const src = scene.textures.get(sheetKey(name)).getSourceImage() as HTMLImageElement;
    const tex = scene.textures.createCanvas(key, w, h)!;
    tex.context.imageSmoothingEnabled = false;
    let dy = 0;
    for (let r = 0; r < 3; r++) {
      let dx = 0;
      for (let c = 0; c < 3; c++) {
        tex.context.drawImage(
          src,
          spec.colX[c]!,
          spec.rowY[r]!,
          spec.colW[c]!,
          spec.rowH[r]!,
          dx,
          dy,
          spec.colW[c]!,
          spec.rowH[r]!,
        );
        dx += spec.colW[c]!;
      }
      dy += spec.rowH[r]!;
    }
    tex.refresh();
  }
  return { key, left: spec.colW[0], right: spec.colW[2], top: spec.rowH[0], bottom: spec.rowH[2] };
}

/** A panel at any size, centred on x, y. Corners keep their pixel size. */
export function panel(
  scene: Phaser.Scene,
  name: PanelName,
  x: number,
  y: number,
  w: number,
  h: number,
): Phaser.GameObjects.NineSlice {
  const s = compose(scene, name);
  return scene.add
    .nineslice(x, y, s.key, undefined, Math.round(w), Math.round(h), s.left, s.right, s.top, s.bottom)
    .setOrigin(0.5);
}

/** Rows of the composed 320px wood table, measured off the art: its head
 *  down to the first plank seam, a clean run of plank between the seams, and
 *  its foot from under the second seam. */
const WOOD_ROWS = { headEnd: 123, bandStart: 134, bandEnd: 188, footStart: 198 } as const;

/** The wood table at its native width and any height, as one seamless
 *  board: the clean plank run repeats instead of stretching, so neither the
 *  grain nor the plank seams show a join. */
export function woodBoard(scene: Phaser.Scene, x: number, y: number, h: number): Phaser.GameObjects.Image {
  const s = compose(scene, "woodTable");
  const H = Math.round(h);
  const key = `${s.key}_board_${H}`;
  if (!scene.textures.exists(key)) {
    const src = scene.textures.get(s.key).getSourceImage() as HTMLCanvasElement;
    const W = src.width;
    const { headEnd, bandStart, bandEnd, footStart } = WOOD_ROWS;
    const foot = src.height - footStart;
    const tex = scene.textures.createCanvas(key, W, H)!;
    const ctx = tex.context;
    ctx.imageSmoothingEnabled = false;
    ctx.drawImage(src, 0, 0, W, headEnd, 0, 0, W, headEnd);
    for (let dy = headEnd; dy < H - foot; dy += bandEnd - bandStart) {
      const rows = Math.min(bandEnd - bandStart, H - foot - dy);
      ctx.drawImage(src, 0, bandStart, W, rows, 0, dy, W, rows);
    }
    ctx.drawImage(src, 0, footStart, W, foot, 0, H - foot, W, foot);
    tex.refresh();
  }
  return scene.add.image(x, y, key);
}

/** Slate title ribbon. The middle stretches; the forked ends never do. */
export function ribbon(
  scene: Phaser.Scene,
  x: number,
  y: number,
  w: number,
  scale = 1,
): Phaser.GameObjects.NineSlice {
  if (!scene.textures.exists("ribbon")) {
    const src = scene.textures.get("ribbon_src").getSourceImage() as HTMLImageElement;
    const tex = scene.textures.createCanvas("ribbon", RIBBON.w * 3, RIBBON.h)!;
    const ctx = tex.context;
    ctx.imageSmoothingEnabled = false;
    ctx.drawImage(src, 0, RIBBON.rowY, RIBBON.w, RIBBON.h, 0, 0, RIBBON.w, RIBBON.h);
    ctx.drawImage(src, RIBBON.midX, RIBBON.rowY, RIBBON.w, RIBBON.h, RIBBON.w, 0, RIBBON.w, RIBBON.h);
    ctx.drawImage(
      src,
      RIBBON.rightX,
      RIBBON.rowY,
      RIBBON.w,
      RIBBON.h,
      RIBBON.w * 2,
      0,
      RIBBON.w,
      RIBBON.h,
    );
    tex.refresh();
  }
  return scene.add
    .nineslice(
      x,
      y,
      "ribbon",
      undefined,
      Math.max(RIBBON.w * 2, Math.round(w / scale)),
      RIBBON.h,
      RIBBON.w,
      RIBBON.w,
      0,
      0,
    )
    .setOrigin(0.5)
    .setScale(scale);
}

/** The pack's arrow cursor, the canvas default. */
export const ARROW = 'url("/cursor.png") 0 0, default';
/** The pack's hand cursor, cropped to the art, fingertip hotspot at (4, 0). */
export const HAND = 'url("/cursor-pointer.png") 4 0, pointer';

/** Shared by every label, so the UI reads as one thing. */
export const FONT: Phaser.Types.GameObjects.Text.TextStyle = {
  fontFamily: '"Nunito", sans-serif',
  fontSize: "15px",
  color: "#fdfaf0",
  stroke: "#2e3a4e",
  strokeThickness: 3,
  fontStyle: "600",
};

/**
 * Glyphs are baked at this many texels per world unit. The camera zooms the
 * 1200-wide world to fit the screen, so a fixed 2 was upscaled (and blurred)
 * on any display past 2400 device pixels across; this covers the largest
 * zoom the screen can reach.
 */
export const TEXT_RES = Math.min(
  4,
  Math.max(2, Math.ceil((window.screen.width * Math.min(2, window.devicePixelRatio || 1)) / 1200)),
);

export function label(
  scene: Phaser.Scene,
  x: number,
  y: number,
  text: string,
  over: Phaser.Types.GameObjects.Text.TextStyle = {},
): Phaser.GameObjects.Text {
  const t = scene.add
    .text(x, y, text, { ...FONT, ...over })
    .setOrigin(0.5)
    .setResolution(TEXT_RES);
  // pixelArt forces NEAREST on every texture, which shimmers text at the
  // canvas's fractional FIT scale; glyphs want linear.
  t.texture.setFilter(Phaser.Textures.FilterMode.LINEAR);
  return t;
}

/** Hover sinks 2px with no tint; press sinks a bit more. */
export function button(
  scene: Phaser.Scene,
  x: number,
  y: number,
  w: number,
  h: number,
  text: string,
  tone: "blue" | "red",
  onClick: () => void,
): Phaser.GameObjects.Container {
  const up = tone === "blue" ? "blueButton" : "redButton";
  const face = panel(scene, up, 0, 0, w, h);
  const text_ = label(scene, 0, -1, text, { fontSize: "16px" });

  const box = scene.add.container(x, y, [face, text_]);
  box.setSize(w, h);
  // Hover sinks around the base position, which the scene may move later
  // (a viewport-anchored HUD re-lays out on resize); the sink follows it.
  box.setData("baseY", y);
  const sink = (on: number): void => {
    scene.tweens.killTweensOf(box);
    scene.tweens.add({
      targets: box,
      y: (box.getData("baseY") as number) + on,
      duration: 140,
      ease: "Sine.easeInOut",
    });
  };

  box.setInteractive({ cursor: HAND })
    .on("pointerover", () => sink(2))
    .on("pointerout", () => sink(0))
    .on("pointerdown", () => sink(3))
    .on("pointerup", () => {
      sink(2);
      onClick();
    });
  return box;
}

/**
 * The army totals bar. Its caps are 64px pieces but only capInk is art, so
 * the pieces are cropped to their ink first or every bar carries transparent
 * lead-in.
 */
export class PackBar {
  private fill: Phaser.GameObjects.Image;
  private innerW: number;
  /** Where the fill is headed, and where it currently sits. */
  private target = 1;
  private shown = 1;

  constructor(
    scene: Phaser.Scene,
    x: number,
    y: number,
    private width: number,
    private scale: number,
    tint: number,
    depth: number,
  ) {
    const capInk = BAR.capInk;

    if (!scene.textures.exists("bar_base")) {
      const src = scene.textures.get("bar_base_src").getSourceImage() as HTMLImageElement;
      const w = capInk + BAR.capW + capInk;
      const tex = scene.textures.createCanvas("bar_base", w, BAR.artH)!;
      const ctx = tex.context;
      ctx.imageSmoothingEnabled = false;
      // left cap ink, stretchable middle, right cap ink
      ctx.drawImage(src, BAR.capW - capInk, BAR.artY, capInk, BAR.artH, 0, 0, capInk, BAR.artH);
      ctx.drawImage(src, BAR.midX, BAR.artY, BAR.capW, BAR.artH, capInk, 0, BAR.capW, BAR.artH);
      ctx.drawImage(
        src,
        BAR.rightX,
        BAR.artY,
        capInk,
        BAR.artH,
        capInk + BAR.capW,
        0,
        capInk,
        BAR.artH,
      );
      tex.refresh();

      const fillSrc = scene.textures.get("bar_fill_src").getSourceImage() as HTMLImageElement;
      const ftex = scene.textures.createCanvas("bar_fill", BAR.capW, BAR.fillH)!;
      ftex.context.imageSmoothingEnabled = false;
      ftex.context.drawImage(
        fillSrc,
        0,
        BAR.fillY,
        BAR.capW,
        BAR.fillH,
        0,
        0,
        BAR.capW,
        BAR.fillH,
      );
      ftex.refresh();
    }

    const frameW = Math.round(width / scale);
    scene.add
      .nineslice(x, y, "bar_base", undefined, frameW, BAR.artH, capInk, capInk, 0, 0)
      .setOrigin(0.5)
      .setScale(scale)
      .setDepth(depth);

    // The fill spans channel edge to channel edge, which reaches well into
    // the caps; insetting by cap width leaves dead wood at both ends.
    this.innerW = width - BAR.chanX * 2 * scale;
    const top = y - (BAR.artH / 2) * scale;
    this.fill = scene.add
      .image(x - this.innerW / 2, top + (BAR.fillY - BAR.artY) * scale, "bar_fill")
      .setOrigin(0, 0)
      // setTintFill, not setTint: the strip is dark maroon and a tint
      // multiplies into it, turning green to mud.
      .setTintFill(tint)
      .setDepth(depth + 1);
    this.reset(1);
  }

  /** Aim the bar; it slides there rather than jumping. */
  set(frac: number): void {
    this.target = Math.max(0, Math.min(1, frac));
  }

  /** Snap, for the initial draw. */
  reset(frac: number): void {
    this.target = this.shown = Math.max(0, Math.min(1, frac));
    this.draw();
  }

  /** Called from the scene update. */
  tick(delta: number): void {
    if (Math.abs(this.target - this.shown) < 0.0005) {
      if (this.shown === this.target) return;
      this.shown = this.target;
    } else {
      // Fast at first, settling over ~250ms.
      this.shown += (this.target - this.shown) * Math.min(1, delta / 120);
    }
    this.draw();
  }

  private draw(): void {
    this.fill.setVisible(this.shown > 0.0005);
    this.fill.setDisplaySize(Math.max(1, this.innerW * this.shown), BAR.fillH * this.scale);
  }
}
