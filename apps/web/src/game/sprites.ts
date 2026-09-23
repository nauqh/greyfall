// Unit sheets: horizontal strips of equal frames, 10fps to match the pack.
// Anchors are the ground contact point in native pixels, read off the art.
// Every class has exactly one attack pose and is flipped to face its target.

import type { UnitClass } from "@greyfall/engine";

import { packUrl } from "./art";

export const FRAME_RATE = 10;

export type Side = "a" | "b";
export type AnimName = "idle" | "run" | "attack";

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

/** Frame size and ground anchor per class, for the Enemy Pack monsters. */
export const MONSTER_BODY: Record<UnitClass, Body> = {
  // Skull: ink rows 57..129 of 192; ground line at 129.
  warrior: { frame: 192, anchorX: 74, anchorY: 129 },
  // Slingshot Gnome: ink rows 72..136 of 192.
  archer: { frame: 192, anchorX: 86, anchorY: 136 },
  // Spear Goblin: 256px frames; ink rows 50..175 of 256.
  lancer: { frame: 256, anchorX: 101, anchorY: 175 },
  // Hex Shaman: ink rows 55..136 of 192.
  monk: { frame: 192, anchorX: 87, anchorY: 136 },
  // Gnome: ink rows 57..126 of 192.
  pawn: { frame: 192, anchorX: 71, anchorY: 126 },
};

/** Head height above the feet, for pips and floating numbers. */
export const BODY_HEIGHT: Record<UnitClass, number> = {
  warrior: 89,
  archer: 88,
  monk: 69,
  lancer: 74,
  pawn: 71,
};

/** Per-monster head heights, from the same ink measurements. */
export const MONSTER_BODY_HEIGHT: Record<UnitClass, number> = {
  warrior: 72,
  archer: 64,
  monk: 81,
  lancer: 125,
  pawn: 69,
};

/**
 * A body is taller than an 84px cell (up to 89px), so feet-at-centre leaves
 * it looming entirely above the tile with nothing below. Shared by the
 * battle canvas and the draft screen's own CSS rendering, so both nudge the
 * same amount rather than drifting apart.
 */
export const SPRITE_NUDGE = 18;

const POSES: Record<UnitClass, Record<AnimName, string>> = {
  warrior: {
    idle: "Warrior/Warrior_Idle.png",
    run: "Warrior/Warrior_Run.png",
    attack: "Warrior/Warrior_Attack1.png",
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
  },
  pawn: {
    idle: "Pawn/Pawn_Idle.png",
    run: "Pawn/Pawn_Run.png",
    attack: "Pawn/Pawn_Idle.png",
  },
};

/** Side b's monsters, one Enemy Pack unit per troop class. Frame counts are
 * whatever the strip divides into at the class's frame width; makeAnims
 * reads the real count off the loaded texture. */
const MONSTER_POSES: Record<UnitClass, Record<AnimName, string>> = {
  warrior: {
    idle: "Skull/Skull_Idle.png",
    run: "Skull/Skull_Run.png",
    attack: "Skull/Skull_Attack.png",
  },
  archer: {
    idle: "Slingshot Gnome/Slingshot Gnome_Idle.png",
    run: "Slingshot Gnome/Slingshot Gnome_Run.png",
    attack: "Slingshot Gnome/Slingshot Gnome_Shoot.png",
  },
  monk: {
    idle: "Hex Shaman/Hex Shaman_Idle.png",
    run: "Hex Shaman/Hex Shaman_Run.png",
    attack: "Hex Shaman/Hex Shaman_Attack.png",
  },
  lancer: {
    idle: "Spear Goblin/Spear Goblin_Idle.png",
    run: "Spear Goblin/Spear Goblin_Run.png",
    attack: "Spear Goblin/Spear Goblin_Attack Fast.png",
  },
  pawn: {
    idle: "Gnome/Gnome_Idle.png",
    run: "Gnome/Gnome_Run.png",
    attack: "Gnome/Gnome_Attack.png",
  },
};

const SIDE_DIR: Record<Side, string> = { a: "Blue Units", b: "Red Units" };

/** The Monk's heal burst, played on the unit being healed. */
export const HEAL_EFFECT = { frame: 192, frames: 11 } as const;

/** The shaman's blast, the monster stand-in: 1152x128 is 9 frames of 128. */
export const EXPLOSION = { frame: 128, frames: 9 } as const;

export function unitKey(side: Side, cls: UnitClass, anim: AnimName): string {
  return `${cls}_${side}_${anim}`;
}

export function animKey(side: Side, cls: UnitClass, anim: AnimName): string {
  return `${unitKey(side, cls, anim)}_anim`;
}

export function healKey(side: Side): string {
  return `heal_${side}`;
}

export function loadUnits(scene: Phaser.Scene): void {
  for (const cls of Object.keys(POSES) as UnitClass[]) {
    const size = BODY[cls].frame;
    for (const anim of Object.keys(POSES[cls]) as AnimName[]) {
      scene.load.spritesheet(unitKey("a", cls, anim), packUrl(`Units/${SIDE_DIR.a}/` + POSES[cls][anim]), {
        frameWidth: size,
        frameHeight: size,
      });
    }
  }
  scene.load.spritesheet(healKey("a"), packUrl(`Units/${SIDE_DIR.a}/Monk/Heal_Effect.png`), {
    frameWidth: HEAL_EFFECT.frame,
    frameHeight: HEAL_EFFECT.frame,
  });

  for (const cls of Object.keys(MONSTER_POSES) as UnitClass[]) {
    const size = MONSTER_BODY[cls].frame;
    for (const anim of Object.keys(MONSTER_POSES[cls]) as AnimName[]) {
      scene.load.spritesheet(
        unitKey("b", cls, anim),
        packUrl(`Enemy Pack/${MONSTER_POSES[cls][anim].replace(/ /g, "%20")}`),
        {
          frameWidth: size,
          frameHeight: size,
        },
      );
    }
  }
  // The shaman's blast stands in for the heal burst on the monster side.
  scene.load.spritesheet(
    healKey("b"),
    packUrl(`Enemy Pack/Hex Shaman/${"Hex Shaman_Explosion.png".replace(/ /g, "%20")}`),
    {
      frameWidth: EXPLOSION.frame,
      frameHeight: EXPLOSION.frame,
    },
  );
}

/** Attacks play once; idle and run loop. Animations outlive a scene
 * restart, so every one of these is a no-op the second time round. */
export function makeAnims(scene: Phaser.Scene): void {
  const frameCount = (key: string): number =>
    scene.textures
      .get(key)
      .getFrameNames()
      .filter((f) => f !== "__BASE").length;

  const bodyOf = (side: Side): Record<UnitClass, Body> => (side === "a" ? BODY : MONSTER_BODY);
  const posesOf = (side: Side): Record<UnitClass, Record<AnimName, string>> =>
    side === "a" ? POSES : MONSTER_POSES;

  for (const side of ["a", "b"] as const) {
    for (const cls of Object.keys(posesOf(side)) as UnitClass[]) {
      for (const anim of Object.keys(posesOf(side)[cls]) as AnimName[]) {
        const key = unitKey(side, cls, anim);
        if (scene.anims.exists(animKey(side, cls, anim))) continue;
        const frames = frameCount(key);
        if (frames === 0) continue;
        scene.anims.create({
          key: animKey(side, cls, anim),
          frames: scene.anims.generateFrameNumbers(key, { start: 0, end: frames - 1 }),
          frameRate: FRAME_RATE,
          repeat: anim === "attack" ? 0 : -1,
        });
      }
    }
    if (scene.anims.exists(`${healKey(side)}_anim`)) continue;
    const burst = side === "a" ? HEAL_EFFECT : EXPLOSION;
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
  const body = (side === "a" ? BODY : MONSTER_BODY)[cls];
  sprite.setOrigin(body.anchorX / body.frame, body.anchorY / body.frame);
  // The art faces right in both colors; side b holds the right half. On a
  // mirrored board - seat B's own view of the duel - it holds the left half
  // instead, so the flip goes the other way. Run and attack keep the
  // directional flip their callers set from screen-space movement, which is
  // already mirrored by the time they see it.
  if (anim === "idle") sprite.setFlipX((side === "b") !== mirrored);
  sprite.play(animKey(side, cls, anim), true);
}
