// One Phaser game per screen. The intro and the battle share a logical size,
// a camera setup and a background, so the page only ever deals with one
// aspect ratio and a screen swap cannot shift the sea.
//
// Scale.EXPAND keeps one axis at the world's size and grows the other to
// cover the parent, so the canvas fills the page and the world gains water
// around its edges instead of a letterbox seam. The camera's zoom is fixed,
// so full-page veils size themselves from viewSize().

import * as Phaser from "phaser";

export const GAME_W = 1200;
export const GAME_H = 720;

/** = Terrain/Tileset/Water Background color.png, and the page's own body. */
export const WATER = "#47aba9";

// Phaser 3.90 has no HiDPI support: the canvas backing store is the game
// size, and the browser bilinear-upscales it to physical pixels, which is
// what smears thin glyphs. Render at devicePixelRatio instead and zoom the
// camera to match, so the canvas only ever gets downscaled.
export const DPR = Math.max(1, Math.min(2, window.devicePixelRatio || 1));

/** The canvas is DPR times the world; zoom recentres, so aim it back. */
export function fitCamera(scene: Phaser.Scene): void {
  const cam = scene.cameras.main;
  cam.setZoom(DPR);
  cam.centerOn(GAME_W / 2, GAME_H / 2);
  // EXPAND changes the canvas size on window resize, which shifts what the
  // camera sees; keep the world centred so the extra water stays even.
  const recenter = (): void => {
    cam.centerOn(GAME_W / 2, GAME_H / 2);
  };
  scene.scale.on(Phaser.Scale.Events.RESIZE, recenter);
  scene.events.once(Phaser.Scenes.Events.DESTROY, () => scene.scale.off(Phaser.Scale.Events.RESIZE, recenter));
}

export const WATER_SPAN = { w: 3600, h: 2000 } as const;
/** FIT scaling fits the logical world to whatever the page gives it. */
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
  // Phaser bakes each Text into a canvas when it is created; before the
  // webfont arrives that bake is the fallback font forever.
  void document.fonts
    .load('600 16px "Nunito"')
    .catch(() => {})
    .then(() => {
      if (cancelled) return;
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
          mode: Phaser.Scale.EXPAND,
          autoCenter: Phaser.Scale.NO_CENTER,
          width: Math.round(GAME_W * DPR),
          height: Math.round(GAME_H * DPR),
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
      done();
      game?.destroy(true);
    },
    ready,
  };
}
