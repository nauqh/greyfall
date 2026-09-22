// The kit ships nine-slices with empty bands between the pieces, which
// neither Phaser NineSlice nor CSS border-image can read. Everything here
// composes them edge to edge first; after that a panel is an ordinary
// nine-slice that stretches without smearing its corners.

import * as Phaser from "phaser";

import { BAR, PANELS, packUrl, type PanelName, type SliceSheet } from "./art";

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

/** Shared by every label, so the UI reads as one thing. */
export const FONT: Phaser.Types.GameObjects.Text.TextStyle = {
  fontFamily: '"Gochi Hand", cursive',
  fontSize: "15px",
  color: "#f5f2e4",
  stroke: "#2e3a4e",
  strokeThickness: 3,
};

export function label(
  scene: Phaser.Scene,
  x: number,
  y: number,
  text: string,
  over: Phaser.Types.GameObjects.Text.TextStyle = {},
): Phaser.GameObjects.Text {
  return scene.add
    .text(x, y, text, { ...FONT, ...over })
    .setOrigin(0.5)
    .setResolution(2);
}

/** The pressed sheet is a second nine-slice swapped in on pointer down. */
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
  const down = tone === "blue" ? "blueButtonDown" : "redButtonDown";
  const face = panel(scene, up, 0, 0, w, h);
  const pressed = panel(scene, down, 0, 0, w, h).setVisible(false);
  const text_ = label(scene, 0, -1, text, { fontSize: "16px" });

  const box = scene.add.container(x, y, [face, pressed, text_]);
  box.setSize(w, h);
  box.setInteractive({ useHandCursor: true })
    .on("pointerdown", () => {
      face.setVisible(false);
      pressed.setVisible(true);
      text_.setY(2);
    })
    .on("pointerup", () => {
      face.setVisible(true);
      pressed.setVisible(false);
      text_.setY(-1);
      onClick();
    })
    .on("pointerout", () => {
      face.setVisible(true);
      pressed.setVisible(false);
      text_.setY(-1);
    });
  return box;
}

/**
 * The army totals bar. Its caps are 64px wide but only 15px is art, so the
 * pieces are cropped to their ink first or every bar carries 49px of
 * transparent lead-in.
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
    const capInk = 15;

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

    // The fill sits where its own sheet puts it, (fillY - artY) rows down.
    this.innerW = width - capInk * 2 * scale;
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

/**
 * Same packing as `compose` but without Phaser, so the DOM draft screen can
 * use the art as a CSS border-image with no derived files on disk.
 */
export async function nineSliceDataUrl(
  name: PanelName,
): Promise<{ url: string; slice: string }> {
  const spec = PANELS[name];
  const img = new Image();
  img.src = packUrl(spec.file);
  await img.decode();

  const w = spec.colW[0] + spec.colW[1] + spec.colW[2];
  const h = spec.rowH[0] + spec.rowH[1] + spec.rowH[2];
  const canvas = document.createElement("canvas");
  canvas.width = w;
  canvas.height = h;
  const ctx = canvas.getContext("2d")!;
  ctx.imageSmoothingEnabled = false;
  let dy = 0;
  for (let r = 0; r < 3; r++) {
    let dx = 0;
    for (let c = 0; c < 3; c++) {
      ctx.drawImage(
        img,
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
  // border-image-slice wants top right bottom left.
  const slice = `${spec.rowH[0]} ${spec.colW[2]} ${spec.rowH[2]} ${spec.colW[0]}`;
  return { url: canvas.toDataURL("image/png"), slice };
}
