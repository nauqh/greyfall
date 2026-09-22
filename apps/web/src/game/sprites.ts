// Unit sheets: horizontal strips of equal frames, 10fps to match the pack.
//
// Anchors are the ground contact point in native pixels, read off the art.
// Within a class the feet land on the same row in every sheet, so one anchor
// per class stops units hopping between animations. The Lancer vertical
// thrusts are the exception and carry their own.
//
// The Lancer is the only class shipping Up and Down attack poses, which is
// what the vertical board needs. Everyone else is flipped to face its target.

import type { UnitClass } from "@greyfall/engine";

import { packUrl } from "./art";

export const FRAME_RATE = 10;

export type Side = "a" | "b";
export type AnimName = "idle" | "run" | "attack" | "attackUp" | "attackDown";

interface Body {
  frame: number;
  anchorX: number;
  anchorY: number;
}

/** Frame size and ground anchor per class. */
export const BODY: Record<UnitClass, Body> = {
  warrior: { frame: 192, anchorX: 94, anchorY: 136 },
  archer: { frame: 192, anchorX: 95, anchorY: 135 },
  monk: { frame: 192, anchorX: 96, anchorY: 133 },
  lancer: { frame: 320, anchorX: 156, anchorY: 197 },
  // Off the Phase 1 roster, but the engine accepts a Pawn on the board.
  pawn: { frame: 192, anchorX: 96, anchorY: 134 },
};

/**
 * Head height above the feet, for pips and floating numbers. The Lancer
 * measures to its head, not its lance tip 148px up.
 */
export const BODY_HEIGHT: Record<UnitClass, number> = {
  warrior: 89,
  archer: 88,
  monk: 69,
  lancer: 74,
  pawn: 71,
};

interface Pose {
  file: string;
  /** Only set where the pose redraws the figure off the class anchor. */
  anchorX?: number;
  anchorY?: number;
}

const POSES: Record<UnitClass, Partial<Record<AnimName, Pose>>> = {
  warrior: {
    idle: { file: "Warrior/Warrior_Idle.png" },
    run: { file: "Warrior/Warrior_Run.png" },
    attack: { file: "Warrior/Warrior_Attack1.png" },
  },
  archer: {
    idle: { file: "Archer/Archer_Idle.png" },
    run: { file: "Archer/Archer_Run.png" },
    attack: { file: "Archer/Archer_Shoot.png" },
  },
  monk: {
    idle: { file: "Monk/Idle.png" },
    run: { file: "Monk/Run.png" },
    attack: { file: "Monk/Heal.png" },
  },
  lancer: {
    idle: { file: "Lancer/Lancer_Idle.png" },
    run: { file: "Lancer/Lancer_Run.png" },
    attack: { file: "Lancer/Lancer_Right_Attack.png" },
    // The up thrust lifts the figure 9px; the down thrust redraws it lower.
    attackUp: { file: "Lancer/Lancer_Up_Attack.png", anchorX: 150, anchorY: 190 },
    attackDown: { file: "Lancer/Lancer_Down_Attack.png", anchorX: 165, anchorY: 206 },
  },
  pawn: {
    idle: { file: "Pawn/Pawn_Idle.png" },
    run: { file: "Pawn/Pawn_Run.png" },
    attack: { file: "Pawn/Pawn_Idle.png" },
  },
};

const SIDE_DIR: Record<Side, string> = { a: "Blue Units", b: "Red Units" };

/** The Monk's heal burst, played on the unit being healed. */
export const HEAL_EFFECT = { frame: 192, frames: 11 } as const;

/** Exported so the draft screen shows the same art without pulling in Phaser. */
export function sheetUrl(side: Side, cls: UnitClass, anim: AnimName = "idle"): string {
  return packUrl(`Units/${SIDE_DIR[side]}/${POSES[cls][resolveAnim(cls, anim)]!.file}`);
}

export function unitKey(side: Side, cls: UnitClass, anim: AnimName): string {
  return `${cls}_${side}_${anim}`;
}

export function animKey(side: Side, cls: UnitClass, anim: AnimName): string {
  return `${unitKey(side, cls, anim)}_anim`;
}

export function healKey(side: Side): string {
  return `heal_${side}`;
}

/** Falls back to the one attack pose where there are no vertical ones. */
export function resolveAnim(cls: UnitClass, want: AnimName): AnimName {
  return POSES[cls][want] ? want : "attack";
}

export function anchorFor(cls: UnitClass, anim: AnimName): { x: number; y: number } {
  const body = BODY[cls];
  const pose = POSES[cls][anim];
  return {
    x: (pose?.anchorX ?? body.anchorX) / body.frame,
    y: (pose?.anchorY ?? body.anchorY) / body.frame,
  };
}

export function loadUnits(scene: Phaser.Scene): void {
  for (const side of ["a", "b"] as const) {
    const dir = `Units/${SIDE_DIR[side]}/`;
    for (const cls of Object.keys(POSES) as UnitClass[]) {
      const size = BODY[cls].frame;
      for (const anim of Object.keys(POSES[cls]) as AnimName[]) {
        scene.load.spritesheet(unitKey(side, cls, anim), packUrl(dir + POSES[cls][anim]!.file), {
          frameWidth: size,
          frameHeight: size,
        });
      }
    }
    scene.load.spritesheet(healKey(side), packUrl(`${dir}Monk/Heal_Effect.png`), {
      frameWidth: HEAL_EFFECT.frame,
      frameHeight: HEAL_EFFECT.frame,
    });
  }
}

/** Attacks play once; idle and run loop. */
export function makeAnims(scene: Phaser.Scene): void {
  const frameCount = (key: string): number =>
    scene.textures.get(key).getFrameNames().filter((f) => f !== "__BASE").length;

  for (const side of ["a", "b"] as const) {
    for (const cls of Object.keys(POSES) as UnitClass[]) {
      for (const anim of Object.keys(POSES[cls]) as AnimName[]) {
        const key = unitKey(side, cls, anim);
        const frames = frameCount(key);
        if (frames === 0) continue;
        scene.anims.create({
          key: animKey(side, cls, anim),
          frames: scene.anims.generateFrameNumbers(key, { start: 0, end: frames - 1 }),
          frameRate: FRAME_RATE,
          repeat: anim === "idle" || anim === "run" ? -1 : 0,
        });
      }
    }
    scene.anims.create({
      key: `${healKey(side)}_anim`,
      frames: scene.anims.generateFrameNumbers(healKey(side), {
        start: 0,
        end: HEAL_EFFECT.frames - 1,
      }),
      frameRate: 14,
      repeat: 0,
      hideOnComplete: true,
    });
  }
}

/** Play `anim`, moving the origin to that pose ground anchor. */
export function playPose(
  sprite: Phaser.GameObjects.Sprite,
  side: Side,
  cls: UnitClass,
  anim: AnimName,
): void {
  const resolved = resolveAnim(cls, anim);
  const anchor = anchorFor(cls, resolved);
  sprite.setOrigin(anchor.x, anchor.y);
  sprite.play(animKey(side, cls, resolved), true);
}
