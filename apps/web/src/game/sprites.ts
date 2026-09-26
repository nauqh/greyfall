// Unit sheets: horizontal strips of equal frames, 10fps to match the pack.
// Anchors are the ground contact point in native pixels, read off the art.
// Every class has exactly one attack pose and is flipped to face its target.

import type { UnitClass } from "@greyfall/engine";

import { packUrl } from "./art";

export const FRAME_RATE = 10;

/** Attacks run at the cadence the art was authored for: a 1s action window
 * with 7-11 frame sheets means 12fps shows every frame; 18fps ate a third of
 * them. */
export const ATTACK_FRAME_RATE = 12;

export type Side = "a" | "b";
export type AnimName = "idle" | "run" | "attack" | "attack2" | "guard";

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

/** Head height above the feet, for pips and floating numbers. */
export const BODY_HEIGHT: Record<UnitClass, number> = {
  warrior: 89,
  archer: 88,
  monk: 69,
  lancer: 74,
  pawn: 71,
};

/**
 * A body is taller than an 84px cell (up to 89px), so feet-at-centre leaves
 * it looming entirely above the tile with nothing below. Shared by the
 * battle canvas and the draft screen's own CSS rendering, so both nudge the
 * same amount rather than drifting apart.
 */
export const SPRITE_NUDGE = 18;

const POSES: Record<UnitClass, Partial<Record<AnimName, string>>> = {
  warrior: {
    idle: "Warrior/Warrior_Idle.png",
    run: "Warrior/Warrior_Run.png",
    attack: "Warrior/Warrior_Attack1.png",
    // The kit's second slash; the warrior alternates so a beat of battle
    // reads as the two blows the art draws.
    attack2: "Warrior/Warrior_Attack2.png",
    guard: "Warrior/Warrior_Guard.png",
  },
  archer: {
    idle: "Archer/Archer_Idle.png",
    run: "Archer/Archer_Run.png",
    attack: "Archer/Archer_Shoot.png",
  },
  monk: {
    idle: "Monk/Idle.png",
    run: "Monk/Run.png",
    attack: "Monk/Heal.png",
  },
  lancer: {
    idle: "Lancer/Lancer_Idle.png",
    run: "Lancer/Lancer_Run.png",
    attack: "Lancer/Lancer_Right_Attack.png",
    // Played on taunt.
    guard: "Lancer/Lancer_Right_Defence.png",
  },
  pawn: {
    idle: "Pawn/Pawn_Idle.png",
    run: "Pawn/Pawn_Run.png",
    attack: "Pawn/Pawn_Idle.png",
  },
};

/** Two knight clans, blue and red: one roster in each clan's colour. */
const SIDE_DIR: Record<Side, string> = { a: "Blue Units", b: "Red Units" };

/** The Monk's heal burst, played on the unit being healed. */
export const HEAL_EFFECT = { frame: 192, frames: 11 } as const;

export function unitKey(side: Side, cls: UnitClass, anim: AnimName): string {
  return `${cls}_${side}_${anim}`;
}

export function animKey(side: Side, cls: UnitClass, anim: AnimName): string {
  return `${unitKey(side, cls, anim)}_anim`;
}

export function healKey(side: Side): string {
  return `heal_${side}`;
}

/** The Monk's revive burst is its heal burst. */
export function reviveKey(side: Side): string {
  return healKey(side);
}

export function loadUnits(scene: Phaser.Scene): void {
  for (const side of ["a", "b"] as const) {
    for (const cls of Object.keys(POSES) as UnitClass[]) {
      const size = BODY[cls].frame;
      for (const anim of Object.keys(POSES[cls]) as AnimName[]) {
        scene.load.spritesheet(unitKey(side, cls, anim), packUrl(`Units/${SIDE_DIR[side]}/` + POSES[cls][anim]), {
          frameWidth: size,
          frameHeight: size,
        });
      }
    }
    scene.load.spritesheet(healKey(side), packUrl(`Units/${SIDE_DIR[side]}/Monk/Heal_Effect.png`), {
      frameWidth: HEAL_EFFECT.frame,
      frameHeight: HEAL_EFFECT.frame,
    });
  }
}

/** Attacks play once; idle and run loop. Animations outlive a scene
 * restart, so every one of these is a no-op the second time round. */
export function makeAnims(scene: Phaser.Scene): void {
  const frameCount = (key: string): number =>
    scene.textures
      .get(key)
      .getFrameNames()
      .filter((f) => f !== "__BASE").length;

  for (const side of ["a", "b"] as const) {
    for (const cls of Object.keys(POSES) as UnitClass[]) {
      for (const anim of Object.keys(POSES[cls]) as AnimName[]) {
        const key = unitKey(side, cls, anim);
        if (scene.anims.exists(animKey(side, cls, anim))) continue;
        const frames = frameCount(key);
        if (frames === 0) continue;
        scene.anims.create({
          key: animKey(side, cls, anim),
          frames: scene.anims.generateFrameNumbers(key, { start: 0, end: frames - 1 }),
          // Attacks run faster than the loop poses: at 10fps a 7-frame
          // thrust spends its visible frames while the eye is elsewhere.
          frameRate: anim.startsWith("attack") ? ATTACK_FRAME_RATE : FRAME_RATE,
          repeat: anim === "idle" || anim === "run" ? -1 : 0,
        });
      }
    }
    if (scene.anims.exists(`${healKey(side)}_anim`)) continue;
    const burst = HEAL_EFFECT;
    scene.anims.create({
      key: `${healKey(side)}_anim`,
      frames: scene.anims.generateFrameNumbers(healKey(side), {
        start: 0,
        end: burst.frames - 1,
      }),
      frameRate: 14,
      repeat: 0,
      hideOnComplete: true,
    });
  }
}

/** Play `anim`, moving the origin to the class's own ground anchor. */
export function playPose(
  sprite: Phaser.GameObjects.Sprite,
  side: Side,
  cls: UnitClass,
  anim: AnimName,
  mirrored = false,
): void {
  const body = BODY[cls];
  sprite.setOrigin(body.anchorX / body.frame, body.anchorY / body.frame);
  // The art faces right in both colors; side b holds the right half. On a
  // mirrored board - seat B's own view of the duel - it holds the left half
  // instead, so the flip goes the other way. Run and attack keep the
  // directional flip their callers set from screen-space movement, which is
  // already mirrored by the time they see it.
  if (anim === "idle") sprite.setFlipX((side === "b") !== mirrored);
  sprite.play(animKey(side, cls, anim), true);
}
