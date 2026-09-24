// One Phaser game per screen. The intro and the battle share a logical size,
// a camera setup and a background, so the page only ever deals with one
// aspect ratio and a screen swap cannot shift the sea.
//
// The canvas is the page, pixel for device pixel: nothing stretches the
// frame after Phaser draws it. Each camera zooms by baseZoom() instead, which
// fits the 1200x720 world on one axis and lets the other see more, so the
// world gains water around its edges instead of a letterbox seam.

import * as Phaser from "phaser";

export const GAME_W = 1200;
export const GAME_H = 720;

/** = Terrain/Tileset/Water Background color.png, and the page's own body. */
export const WATER = "#47aba9";

// Phaser 3.90 has no HiDPI support, so the backing store is sized in device
// pixels by hand and shown at 1 / DPR, its CSS size.
export const DPR = Math.max(1, Math.min(2, window.devicePixelRatio || 1));

/** Canvas px per world unit: the whole 1200x720 world, fitted on one axis.
 *  Not a whole number on most screens, so pixel art lands on uneven screen
 *  pixels; flooring it (min 1) would make them even at the cost of showing
 *  more world on bigger screens. */
export function baseZoom(scene: Phaser.Scene): number {
  return Math.min(scene.scale.width / GAME_W, scene.scale.height / GAME_H);
}

/** Zoom to fit, times `scale` (a scene's own zoom level), centred on cx, cy,
 *  and again on every resize. */
export function fitCamera(
  scene: Phaser.Scene,
  cx = GAME_W / 2,
  cy = GAME_H / 2,
  scale: () => number = () => 1,
): void {
  const cam = scene.cameras.main;
  const fit = (): void => {
    cam.setZoom(baseZoom(scene) * scale());
    cam.centerOn(cx, cy);
  };
  fit();
  scene.scale.on(Phaser.Scale.Events.RESIZE, fit);
  // Shutdown, not only destroy: a scene that restarts itself (the battle,
  // every round) would otherwise add a listener per restart.
  const off = (): void => {
    scene.scale.off(Phaser.Scale.Events.RESIZE, fit);
  };
  scene.events.once(Phaser.Scenes.Events.SHUTDOWN, off);
  scene.events.once(Phaser.Scenes.Events.DESTROY, off);
}

export const WATER_SPAN = { w: 3600, h: 2000 } as const;
/** The parent's size in device pixels. */
function deviceSize(parent: HTMLElement): { w: number; h: number } {
  return {
    w: Math.max(1, Math.round(parent.clientWidth * DPR)),
    h: Math.max(1, Math.round(parent.clientHeight * DPR)),
  };
}

export function startGame(
  parent: HTMLElement,
  key: string,
  Scene: new () => Phaser.Scene,
  data?: object,
): { destroy: () => void; ready: Promise<void> } {
  let game: Phaser.Game | null = null;
  let cancelled = false;
  let done = (): void => {};
  // Resolves when the scene's own create() runs: chunks, webfont, Phaser boot
  // and its asset loader are all behind it, so it is the real ready signal.
  const ready = new Promise<void>((ok) => (done = ok));
  // Scale.NONE does not follow the page, so the canvas is resized here.
  const follow = new ResizeObserver(() => {
    const { w, h } = deviceSize(parent);
    game?.scale.resize(w, h);
  });
  follow.observe(parent);
  // Phaser bakes each Text into a canvas when it is created; before the
  // webfont arrives that bake is the fallback font forever.
  void document.fonts
    .load('600 16px "Nunito"')
    .catch(() => {})
    .then(() => {
      if (cancelled) return;
      const { w, h } = deviceSize(parent);
      game = new Phaser.Game({
        type: Phaser.AUTO,
        parent,
        backgroundColor: WATER,
        pixelArt: true,
        roundPixels: true,
        // No sound ships, and the WebAudio manager races game destroy: its
        // onGameVisible suspend() can land after destroy closed the context,
        // throwing "Cannot suspend a closed AudioContext".
        audio: { noAudio: true },
        scale: {
          mode: Phaser.Scale.NONE,
          autoCenter: Phaser.Scale.NO_CENTER,
          width: w,
          height: h,
          zoom: 1 / DPR,
        },
      });
      game.events.once(Phaser.Core.Events.READY, () => {
        game!.canvas.style.cursor = 'url("/cursor.png") 0 0, default';
        const scene = game!.scene.add(key, Scene, true, data)!;
        scene.events.once(Phaser.Scenes.Events.CREATE, done);
      });
    });
  return {
    destroy: () => {
      cancelled = true;
      follow.disconnect();
      done();
      game?.destroy(true);
    },
    ready,
  };
}
