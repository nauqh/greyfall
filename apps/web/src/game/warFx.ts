// Battle effects for the war on the map: the blow, the number, the arrow,
// the death. The same beats the battle board plays, adapted to units that
// stand in containers on the island; the board's own copies stay with it.

import * as Phaser from "phaser";

import { FX, packUrl } from "./art";
import { DEPTH } from "./terrain";
import { TEXT_RES } from "./ui";

/** When a blow lands after its swing starts, and how long an arrow flies. */
export const IMPACT_MS = 280;
export const ARROW_RELEASE_MS = 420;
export const FLIGHT_MS = 320;

/** Every effect still on screen, so a skipped playback can sweep them all:
 *  killing their tweens skips the onComplete that would destroy them. */
const live = new WeakMap<Phaser.Scene, Set<Phaser.GameObjects.GameObject>>();

export function trackFx<T extends Phaser.GameObjects.GameObject>(scene: Phaser.Scene, o: T): T {
  let set = live.get(scene);
  if (!set) live.set(scene, (set = new Set()));
  set.add(o);
  o.once(Phaser.GameObjects.Events.DESTROY, () => set.delete(o));
  return o;
}

/** Destroy every effect still showing. */
export function clearFx(scene: Phaser.Scene): void {
  for (const o of [...(live.get(scene) ?? [])]) o.destroy();
}

export function loadWarFx(scene: Phaser.Scene): void {
  scene.load.spritesheet("arrow", packUrl("Units/Blue Units/Archer/Arrow.png"), { frameWidth: 64, frameHeight: 64 });
  scene.load.spritesheet("bone", packUrl("Enemy%20Pack/Gnoll/Gnoll_Bone.png"), { frameWidth: 64, frameHeight: 64 });
  scene.load.spritesheet("dust", packUrl(FX.dust.file), { frameWidth: FX.dust.frame, frameHeight: FX.dust.frame });
}

export function makeWarFxAnims(scene: Phaser.Scene): void {
  if (!scene.anims.exists("dust_anim")) {
    scene.anims.create({
      key: "dust_anim",
      frames: scene.anims.generateFrameNumbers("dust", { start: 0, end: FX.dust.frames - 1 }),
      frameRate: 16,
      repeat: 0,
      hideOnComplete: true,
    });
  }
  if (!scene.anims.exists("bone_anim")) {
    scene.anims.create({
      key: "bone_anim",
      frames: scene.anims.generateFrameNumbers("bone", { start: 0, end: 3 }),
      frameRate: 12,
      repeat: -1,
    });
  }
}

/** A number that pops, rises and fades over a point in the world. */
export function floatText(scene: Phaser.Scene, x: number, y: number, text: string, color: string, speed: number): void {
  const tag = trackFx(scene, scene.add
    .text(x, y, text, {
      fontFamily: '"Nunito", sans-serif',
      fontSize: "17px",
      color,
      stroke: "#1c2634",
      strokeThickness: 4,
    })
    .setOrigin(0.5)
    .setDepth(DEPTH.fx + 1)
    .setResolution(TEXT_RES));
  tag.setScale(1.35);
  scene.tweens.add({ targets: tag, scale: 1, duration: 110 / speed, ease: "Back.easeOut" });
  scene.tweens.add({ targets: tag, y: y - 28, duration: 900 / speed, ease: "Sine.easeOut", onComplete: () => tag.destroy() });
  scene.tweens.add({ targets: tag, alpha: 0, delay: 520 / speed, duration: 380 / speed });
}

/** A blink of white, then a red blush: the hit. */
export function flash(scene: Phaser.Scene, target: Phaser.GameObjects.Sprite | Phaser.GameObjects.Image, speed: number): void {
  target.setTintFill(0xffffff);
  scene.time.delayedCall(40 / speed, () => {
    if (!target.active) return;
    target.setTint(0xff8a80);
    scene.time.delayedCall(110 / speed, () => {
      if (target.active) target.clearTint();
    });
  });
}

/** The archer's arcing arrow, or the Gnoll's tumbling bone. */
export function projectile(
  scene: Phaser.Scene,
  side: "a" | "b",
  from: { x: number; y: number },
  to: { x: number; y: number },
  speed: number,
): void {
  const shot = trackFx(
    scene,
    side === "a" ? scene.add.sprite(from.x, from.y, "arrow") : scene.add.sprite(from.x, from.y, "bone").play("bone_anim"),
  );
  shot.setDepth(DEPTH.fx);
  const apexY = Math.min(from.y, to.y) - Math.min(90, Math.abs(to.x - from.x) / 4 + 20);
  const midX = (from.x + to.x) / 2;
  scene.tweens.addCounter({
    from: 0,
    to: 1,
    duration: FLIGHT_MS / speed,
    onUpdate: (tw) => {
      const t = tw.progress;
      const x = (1 - t) * (1 - t) * from.x + 2 * (1 - t) * t * midX + t * t * to.x;
      const y = (1 - t) * (1 - t) * from.y + 2 * (1 - t) * t * apexY + t * t * to.y;
      if (side === "a") {
        const dx = 2 * (1 - t) * (midX - from.x) + 2 * t * (to.x - midX);
        const dy = 2 * (1 - t) * (apexY - from.y) + 2 * t * (to.y - apexY);
        shot.setRotation(Math.atan2(dy, dx));
      }
      shot.setPosition(x, y);
    },
    onComplete: () => shot.destroy(),
  });
}

/** The body greys and sinks where it stood while a pale soul lifts off it. */
export function deathFx(scene: Phaser.Scene, root: Phaser.GameObjects.Container, body: Phaser.GameObjects.Sprite, speed: number): void {
  trackFx(scene, root);
  body.clearTint().setTint(0x6f6f6f);
  body.anims.pause();
  const soul = trackFx(scene, scene.add
    .sprite(root.x, root.y, body.texture.key, body.frame.name)
    .setOrigin(body.originX, body.originY)
    .setFlipX(body.flipX)
    .setTint(0xcfe0ff)
    .setAlpha(0.35)
    .setDepth(DEPTH.fx));
  scene.tweens.add({
    targets: soul,
    y: soul.y - 40,
    alpha: 0,
    duration: 1100 / speed,
    ease: "Sine.easeOut",
    onComplete: () => soul.destroy(),
  });
  scene.tweens.add({
    targets: root,
    alpha: 0,
    delay: 120 / speed,
    duration: 700 / speed,
    ease: "Sine.easeIn",
    onComplete: () => root.destroy(),
  });
  trackFx(scene, scene.add.sprite(root.x, root.y, "dust").setOrigin(0.5, 0.8).setDepth(DEPTH.unit + root.y + 2).play("dust_anim"));
}
