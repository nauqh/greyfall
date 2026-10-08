// Unit sheets: horizontal strips of equal frames, 10fps to match the pack.
// Anchors are the ground contact point in native pixels, read off the art.
// Every class has exactly one attack pose and is flipped to face its target.

import type { Champion, MonsterClass, UnitClass, UnitSide } from "@greyfall/engine";

import { packUrl } from "./art";

export const FRAME_RATE = 10;

/** Attacks run at the cadence the art was authored for: a 1s action window
 * with 7-11 frame sheets means 12fps shows every frame; 18fps ate a third of
 * them. */
export const ATTACK_FRAME_RATE = 12;

export type Side = UnitSide;
export type AnimName = "idle" | "run" | "attack" | "attack2" | "guard";

interface Body {
  frame: number;
  anchorX: number;
  anchorY: number;
}

/** Frame size and ground anchor per class. */
const KNIGHT_BODY: Record<UnitClass, Body> = {
  warrior: { frame: 192, anchorX: 94, anchorY: 136 },
  archer: { frame: 192, anchorX: 95, anchorY: 135 },
  monk: { frame: 192, anchorX: 96, anchorY: 133 },
  lancer: { frame: 320, anchorX: 156, anchorY: 197 },
  // Off the Phase 1 roster, but the engine accepts a Pawn on the board.
  pawn: { frame: 192, anchorX: 96, anchorY: 134 },
};

/** Skirmish's monsters, one look for both teams. Anchors are the feet, read off
 *  the idle sheet's bottom rows of ink; the two big ones are drawn smaller so a
 *  Troll stands in its cell rather than over three. */
const CHAMPION: Record<MonsterClass, { dir: string; body: Body; height: number; scale: number; poses: Partial<Record<AnimName, string>> }> = {
  skull: {
    dir: "Skull",
    body: { frame: 192, anchorX: 95, anchorY: 128 },
    height: 73,
    scale: 1,
    poses: { idle: "Skull_Idle.png", run: "Skull_Run.png", attack: "Skull_Attack.png" },
  },
  torch: {
    dir: "Torch Goblin",
    body: { frame: 192, anchorX: 93, anchorY: 132 },
    height: 68,
    scale: 1,
    poses: { idle: "Torch Goblin_Idle.png", run: "Torch Goblin_Run.png", attack: "Torch Goblin_Attack.png" },
  },
  gnoll: {
    dir: "Gnoll",
    body: { frame: 192, anchorX: 97, anchorY: 133 },
    height: 75,
    scale: 1,
    poses: { idle: "Gnoll_Idle.png", run: "Gnoll_Walk.png", attack: "Gnoll_Throw.png" },
  },
  thief: {
    dir: "Thief",
    body: { frame: 192, anchorX: 94, anchorY: 131 },
    height: 73,
    scale: 1,
    poses: { idle: "Thief_Idle.png", run: "Thief_Run.png", attack: "Thief_Attack.png" },
  },
  // Its tail trails right of its feet, so the anchor is the robe, not the ink.
  shaman: {
    dir: "Hex Shaman",
    body: { frame: 192, anchorX: 100, anchorY: 136 },
    height: 82,
    scale: 1,
    poses: { idle: "Hex Shaman_Idle.png", run: "Hex Shaman_Run.png", attack: "Hex Shaman_Attack.png" },
  },
  troll: {
    dir: "Troll",
    body: { frame: 384, anchorX: 193, anchorY: 296 },
    height: 211,
    scale: 0.7,
    poses: { idle: "Troll_Idle.png", run: "Troll_Walk.png", attack: "Troll_Attack.png" },
  },
  minotaur: {
    dir: "Minotaur",
    body: { frame: 320, anchorX: 160, anchorY: 213 },
    height: 129,
    scale: 0.85,
    poses: { idle: "Minotaur_Idle.png", run: "Minotaur_Walk.png", attack: "Minotaur_Attack.png" },
  },
};

const isChampion = (cls: Champion): cls is MonsterClass => cls in CHAMPION;

export const BODY: Record<Champion, Body> = {
  ...KNIGHT_BODY,
  ...(Object.fromEntries(Object.entries(CHAMPION).map(([c, m]) => [c, m.body])) as Record<MonsterClass, Body>),
};

/** Head height above the feet, for pips and floating numbers, at the drawn scale. */
export const BODY_HEIGHT: Record<Champion, number> = {
  warrior: 89,
  archer: 88,
  monk: 69,
  lancer: 74,
  pawn: 71,
  ...(Object.fromEntries(Object.entries(CHAMPION).map(([c, m]) => [c, Math.round(m.height * m.scale)])) as Record<
    MonsterClass,
    number
  >),
};

/** How much smaller a class is drawn than its art. */
export function bodyScale(cls: Champion): number {
  return isChampion(cls) ? CHAMPION[cls].scale : 1;
}

/** A Skirmish monster's portrait. Minotaur's file has a double underscore in the pack. */
export function championAvatar(cls: MonsterClass): string {
  const dir = CHAMPION[cls].dir;
  return packUrl(`Enemy Pack/${dir}/${dir}_${cls === "minotaur" ? "_" : ""}Avatar.png`);
}

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
const SIDE_DIR: Record<"a" | "b", string> = { a: "Blue Units", b: "Red Units" };

interface Monster {
  name: string;
  body: Body;
  height: number;
  poses: Partial<Record<AnimName, string>>;
}

/** The monsters: an Enemy Pack body for each class they field. */
const MONSTER: Partial<Record<UnitClass, Monster>> = {
  warrior: {
    name: "Skull",
    body: { frame: 192, anchorX: 95, anchorY: 128 },
    height: 73,
    poses: { idle: "Skull/Skull_Idle.png", run: "Skull/Skull_Run.png", attack: "Skull/Skull_Attack.png" },
  },
  lancer: {
    name: "Spear Goblin",
    body: { frame: 256, anchorX: 121, anchorY: 174 },
    height: 100,
    poses: {
      idle: "Spear Goblin/Spear Goblin_Idle.png",
      run: "Spear Goblin/Spear Goblin_Run.png",
      attack: "Spear Goblin/Spear Goblin_Attack Fast.png",
    },
  },
  archer: {
    name: "Gnoll",
    body: { frame: 192, anchorX: 97, anchorY: 133 },
    height: 75,
    poses: { idle: "Gnoll/Gnoll_Idle.png", run: "Gnoll/Gnoll_Walk.png", attack: "Gnoll/Gnoll_Throw.png" },
  },
};

export function monsterName(cls: UnitClass): string {
  return MONSTER[cls]?.name ?? "Monster";
}

export function monsterAvatar(cls: UnitClass): string | undefined {
  const name = MONSTER[cls]?.name;
  return name && packUrl(`Enemy Pack/${name}/${name}_Avatar.png`);
}

function bodyOf(side: Side, cls: Champion): Body {
  return (side === "m" && !isChampion(cls) && MONSTER[cls]?.body) || BODY[cls];
}

/** Head height above the feet, for either roster. */
export function headOf(side: Side, cls: UnitClass): number {
  return (side === "m" && MONSTER[cls]?.height) || BODY_HEIGHT[cls];
}

function posesOf(side: Side): [UnitClass, Partial<Record<AnimName, string>>][] {
  if (side === "m") return Object.entries(MONSTER).map(([cls, m]) => [cls as UnitClass, m.poses]);
  return Object.entries(POSES) as [UnitClass, Partial<Record<AnimName, string>>][];
}

function sheetUrl(side: Side, file: string): string {
  return packUrl(side === "m" ? `Enemy Pack/${file}` : `Units/${SIDE_DIR[side]}/${file}`);
}

/** The Monk's heal burst, played on the unit being healed. */
export const HEAL_EFFECT = { frame: 192, frames: 11 } as const;

/** A monster looks the same on either team, so its sheets load once, keyed without a side. */
export function unitKey(side: Side, cls: Champion, anim: AnimName): string {
  return isChampion(cls) ? `${cls}_${anim}` : `${cls}_${side}_${anim}`;
}

export function animKey(side: Side, cls: Champion, anim: AnimName): string {
  return `${unitKey(side, cls, anim)}_anim`;
}

export function healKey(side: Side): string {
  return `heal_${side}`;
}

/** The Monk's revive burst is its heal burst. */
export function reviveKey(side: Side): string {
  return healKey(side);
}

export function loadUnits(scene: Phaser.Scene, withMonsters = false): void {
  for (const side of withMonsters ? (["a", "b", "m"] as const) : (["a", "b"] as const)) {
    for (const [cls, poses] of posesOf(side)) {
      const size = bodyOf(side, cls).frame;
      for (const [anim, file] of Object.entries(poses) as [AnimName, string][]) {
        scene.load.spritesheet(unitKey(side, cls, anim), sheetUrl(side, file), { frameWidth: size, frameHeight: size });
      }
    }
    if (side === "m") continue;
    scene.load.spritesheet(healKey(side), packUrl(`Units/${SIDE_DIR[side]}/Monk/Heal_Effect.png`), {
      frameWidth: HEAL_EFFECT.frame,
      frameHeight: HEAL_EFFECT.frame,
    });
  }
}

/** Skirmish's monster sheets, loaded once for both teams. */
export function loadChampions(scene: Phaser.Scene): void {
  for (const [cls, m] of Object.entries(CHAMPION) as [MonsterClass, (typeof CHAMPION)[MonsterClass]][]) {
    for (const [anim, file] of Object.entries(m.poses) as [AnimName, string][]) {
      const key = unitKey("a", cls, anim);
      if (scene.textures.exists(key)) continue;
      scene.load.spritesheet(key, packUrl(`Enemy Pack/${m.dir}/${file}`), { frameWidth: m.body.frame, frameHeight: m.body.frame });
    }
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

  const make = (side: Side, cls: Champion, anim: AnimName): void => {
    const key = unitKey(side, cls, anim);
    if (!scene.textures.exists(key)) return;
    if (scene.anims.exists(animKey(side, cls, anim))) return;
    const frames = frameCount(key);
    if (frames === 0) return;
    scene.anims.create({
      key: animKey(side, cls, anim),
      frames: scene.anims.generateFrameNumbers(key, { start: 0, end: frames - 1 }),
      // Attacks run faster than the loop poses: at 10fps a 7-frame
      // thrust spends its visible frames while the eye is elsewhere.
      frameRate: anim.startsWith("attack") ? ATTACK_FRAME_RATE : FRAME_RATE,
      repeat: anim === "idle" || anim === "run" ? -1 : 0,
    });
  };
  for (const [cls, m] of Object.entries(CHAMPION) as [MonsterClass, (typeof CHAMPION)[MonsterClass]][]) {
    for (const anim of Object.keys(m.poses) as AnimName[]) make("a", cls, anim);
  }

  for (const side of ["a", "b", "m"] as const) {
    for (const [cls, poses] of posesOf(side)) {
      for (const anim of Object.keys(poses) as AnimName[]) make(side, cls, anim);
    }
    if (side === "m" || scene.anims.exists(`${healKey(side)}_anim`)) continue;
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
  cls: Champion,
  anim: AnimName,
  mirrored = false,
): void {
  const body = bodyOf(side, cls);
  sprite.setOrigin(body.anchorX / body.frame, body.anchorY / body.frame);
  // The art faces right in both colors; side b holds the right half. On a
  // mirrored board - seat B's own view of the duel - it holds the left half
  // instead, so the flip goes the other way. Run and attack keep the
  // directional flip their callers set from screen-space movement, which is
  // already mirrored by the time they see it.
  if (anim === "idle") sprite.setFlipX((side === "b") !== mirrored);
  sprite.play(animKey(side, cls, anim), true);
}
