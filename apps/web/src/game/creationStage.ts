// Character creation's window: the title screen's War island, whole, with only the classes' four buildings spread over
// it, each class at its building's door, far enough apart that no close-up shows another. The whole island fills the window, the
// caption pane over the sea at its bottom right; a class is framed close with its building and the camera glides
// from one to the next.

import type { HeroClass } from "@greyfall/engine";
import * as Phaser from "phaser";

import { DPR } from "./boot";
import { buildIntroIsland } from "./introIsland";
import { CELL, cell, loadGroundColours, loadMapArt, makeMapAnims } from "./islandMap";
import { loadUnits, makeAnims, playPose, unitKey, type AnimName } from "./sprites";
import { DEPTH, addBuilding, addDecor, addShadow, buildWater, loadBuildings, loadTerrain, prepareTerrain, standing } from "./terrain";

/** The title's island, whole, with its south-west knoll levelled for the barracks. */
const MAP = [
  "~~~~~####~~~~~~~~~~~~~~~~~",
  "~~~##########~~~~~~~~~~~~~",
  "~~#############~~~~~~~~~~~",
  "~~#############....~~~~~~~",
  "~~.############.....~.~~~~",
  "~~~..###.####>.........~~~",
  "~~..............~.......~~",
  "~~~....#####.....~~.....~~",
  "~~....####>.....~~~....~~~",
  "~~~.............~~~~..~~~~",
  "~~..........~~~~~~~~~~~~~~",
  "~~~........~~~~~~~~~~~~~~~",
  "~~.........~~~~~~~~~~~~~~~",
  "~~........~~~~~~~~~~~~~~~~",
  "~~~~......~~~~~~~~~~~~~~~~",
  "~~~~~~~..~~~~~~~~~~~~~~~~~",
  "~~~~~~~~~~~~~~~~~~~~~~~~~~",
];

/** Each class's feet, in cells, and its building, one to each corner of the island so a close-up (about 8 cells across,
 *  5.5 down) never holds two: the Lancer's tower at the high ground's west end, the Monk's chapel at its east end, the
 *  Warrior's barracks on the south-west green, the Archer's butts out on the east shore. In the order A and D walk them. */
const SETS: Record<HeroClass, { col: number; row: number; built: ReturnType<typeof cell> }> = {
  lancer: { col: 3.75, row: 3.55, built: cell("a", "tower", 3, 3) },
  warrior: { col: 6.2, row: 12.9, built: cell("a", "barracks", 5.5, 12.3) },
  monk: { col: 13.2, row: 4.2, built: cell("a", "monastery", 12.5, 3.6) },
  archer: { col: 21.3, row: 7.9, built: cell("a", "archery", 20.6, 7.3) },
};
/** Only the classes' own buildings. */
const BUILT = Object.values(SETS).map((s) => s.built);
/** What each shows between spells of idling: the Warrior's cut and guard, the Lancer's thrust and brace. */
const MOVES: Record<HeroClass, readonly AnimName[]> = { warrior: ["attack", "guard"], lancer: ["attack", "guard"], archer: ["attack"], monk: ["attack"] };
/** The island's bounds in cells, roofs and all, for the whole view. */
const WHOLE = { col0: 1.6, col1: 25, row0: -0.4, row1: 16 } as const;
/** The window's share across left of the caption pane: a class is centred in it; the whole island takes the window,
 *  the pane over the sea at its bottom right. */
const SIDE = 0.5;
/** Cells the window is tall close up: the class, its door and the lower half of its building, roofs cropped. */
const TALL = 3;
/** The camera's glide between views, in ms: the shortest, and the longest for the farthest. */
const GLIDE = { min: 650, max: 1300 } as const;

/** The stage in the creation window, while one is up, and the class it is to show (none: the whole island). */
let stage: CreationStage | null = null;
let wanted: HeroClass | null = null;
/** Glides the window to `cls` and its building, or with none to the whole island. */
export function showClass(cls: HeroClass | null): void {
  wanted = cls;
  stage?.show(cls);
}

export class CreationStage extends Phaser.Scene {
  /** Each class's next move, played on its own. */
  private acts = new Map<HeroClass, () => void>();
  private answer?: Phaser.Time.TimerEvent;
  private glide?: Phaser.Tweens.Tween;

  constructor() {
    super("creation-stage");
  }

  preload(): void {
    loadTerrain(this);
    loadUnits(this);
    loadMapArt(this);
    loadGroundColours(this);
    loadBuildings(this, BUILT);
  }

  create(): void {
    prepareTerrain(this);
    makeAnims(this);
    makeMapAnims(this);
    buildWater(this);
    buildIntroIsland(this, MAP);
    for (const s of BUILT) addBuilding(this, s);
    this.dress();
    for (const cls of Object.keys(SETS) as HeroClass[]) this.cast(cls);
    const fit = (): void => this.frame(wanted);
    this.scale.on(Phaser.Scale.Events.RESIZE, fit);
    this.events.once(Phaser.Scenes.Events.DESTROY, () => (this.scale.off(Phaser.Scale.Events.RESIZE, fit), stage === this && (stage = null)));
    stage = this;
    fit();
  }

  /**
   * One eased glide to `cls` or the whole island, pan and zoom as one move: the zoom eased by its ratio, not its
   * difference, and the pan paced by the zoom so the ground under the camera slides evenly instead of swimming. Between
   * two classes far apart it draws back a little at the midpoint, so the move reads as travel, not a smear. Longer
   * moves take longer. The class answers as it arrives.
   */
  show(cls: HeroClass | null): void {
    const to = this.view(cls);
    const cam = this.cameras.main;
    const from = { zoom: cam.zoom, x: cam.midPoint.x, y: cam.midPoint.y };
    this.glide?.stop();
    const screens = (Math.hypot(to.x - from.x, to.y - from.y) * Math.min(from.zoom, to.zoom)) / this.scale.width;
    const level = Math.abs(Math.log(to.zoom / from.zoom)) < 0.2;
    const dip = level ? Math.min(0.18, screens * 0.15) : 0;
    const duration = Phaser.Math.Clamp(GLIDE.min + (screens + Math.abs(Math.log(to.zoom / from.zoom))) * 350, GLIDE.min, GLIDE.max);
    const [a, b] = [1 / from.zoom, 1 / to.zoom];
    this.glide = this.tweens.addCounter({
      from: 0,
      to: 1,
      duration,
      ease: "Sine.easeInOut",
      onUpdate: (tw) => {
        const t = tw.getValue() ?? 1;
        const zoom = from.zoom * Math.pow(to.zoom / from.zoom, t);
        const w = Math.abs(b - a) > 1e-6 ? (1 / zoom - a) / (b - a) : t;
        cam.setZoom(zoom * (1 - dip * Math.sin(Math.PI * t))).centerOn(Phaser.Math.Linear(from.x, to.x, w), Phaser.Math.Linear(from.y, to.y, w));
      },
    });
    this.answer?.remove();
    if (cls) this.answer = this.time.delayedCall(duration * 0.85, () => this.acts.get(cls)?.());
  }

  /** The camera straight onto its view, no glide: on a resize, and at the start. */
  private frame(cls: HeroClass | null): void {
    this.glide?.stop();
    const { zoom, x, y } = this.view(cls);
    this.cameras.main.setZoom(zoom).centerOn(x, y);
  }

  /** One zoom for every class, so each close-up feels the same: `TALL` cells to the window's height, a quarter step,
   *  never under 1. */
  private close(): number {
    return Math.max(1, Math.floor((this.scale.height / (TALL * CELL)) * 4) / 4);
  }

  /** Close up: the class at its door, centred in the share of the window left of the caption pane. Else the whole
   *  island. */
  private view(cls: HeroClass | null): { zoom: number; x: number; y: number } {
    const { width: w, height: h } = this.scale;
    if (!cls) {
      const zoom = Math.min(w / ((WHOLE.col1 - WHOLE.col0) * CELL), h / ((WHOLE.row1 - WHOLE.row0) * CELL));
      return { zoom, x: ((WHOLE.col0 + WHOLE.col1) / 2) * CELL, y: ((WHOLE.row0 + WHOLE.row1) / 2) * CELL };
    }
    const zoom = this.close();
    const { col, row, built } = SETS[cls];
    // Between the class and its building's middle across; level with its shoulders and the door down.
    const [fx, fy] = [((col + built.x / CELL) / 2) * CELL, (row - 0.9) * CELL];
    return { zoom, x: fx + (w * (1 - SIDE)) / 2 / zoom, y: fy };
  }

  update(): void {
    // Screen px to an art px, and where the class looked at has its feet, for the gift the page lays beside them.
    const cam = this.cameras.main;
    const style = this.game.canvas.parentElement?.style;
    style?.setProperty("--k", `${cam.zoom / DPR}`);
    if (!wanted) return;
    const { col, row } = SETS[wanted];
    const at = cam.getWorldPoint(0, 0);
    style?.setProperty("--sx", `${((col * CELL - at.x) * cam.zoom) / DPR}px`);
    style?.setProperty("--sy", `${((row * CELL - at.y) * cam.zoom) / DPR}px`);
  }

  /** Woods along the coasts and between the places, a great tree on the middle knoll for a landmark, sheep on the
   *  green, rocks in the shallows. */
  private dress(): void {
    const put = (kind: "tree" | "bush" | "rock" | "waterRock", spots: [number, number][]): Phaser.GameObjects.Sprite[] =>
      spots.map(([c, r]) => addDecor(this, kind, c * CELL, r * CELL, 1, `stage-${kind}-${c}-${r}`));
    addDecor(this, "tree", 8.8 * CELL, 8.3 * CELL, 1.6, "stage-landmark");
    put("bush", [[7.1, 8.4], [10.5, 7.7]]);
    put("tree", [[2.6, 2.4], [3.4, 1.7], [5.6, 1.4], [7, 2.2], [9.4, 1.6], [10.2, 2.8], [2.5, 6.9], [2.4, 8.4], [4.6, 7.4], [9.4, 11.2], [13.4, 9.4], [3.2, 11.4], [3.2, 13.4], [8.4, 13.4], [19.3, 4.9], [22.6, 5.6], [23.1, 6.9], [22.9, 9.3]]);
    put("bush", [[5.6, 3.6], [7.6, 3.4], [3.6, 12.6], [12.5, 6.5], [15.4, 4.4], [18.4, 3.7], [14.6, 8.4], [20.2, 9.4]]);
    put("rock", [[6.6, 3.2], [10.6, 3.2], [8.6, 12.2], [11.6, 10.8], [16.2, 7.2], [17.6, 4.4]]);
    put("waterRock", [[1.2, 6.4], [17.5, 1.6], [13.8, 10.9], [18.3, 11.6], [10.8, 15.4], [6.2, 17.2], [7.5, -0.6], [20.4, -1.1], [25.3, 3.6], [24.6, 10.2]]).forEach((s) => s.setDepth(DEPTH.foam));
    for (const [c, r, flip] of [[16.8, 7.4, false], [3.6, 9.2, true], [10.6, 10.4, false]] as const) {
      this.add.sprite(c * CELL, r * CELL, "sheep").setOrigin(0.5, 0.66).setDepth(standing(r * CELL)).setFlipX(flip).play("sheep_anim");
    }
  }

  /** The class at its building: idling; only the one looked at shows its moves, every few seconds, as Diablo II's
   *  fireside has the hovered one stir while the rest wait. */
  private cast(cls: HeroClass): void {
    const { col, row } = SETS[cls];
    const [x, y] = [col * CELL, row * CELL];
    addShadow(this, x, y, cls === "lancer" ? 0.8 : 0.62);
    const unit = this.add.sprite(x, y, unitKey("a", cls, "idle")).setDepth(DEPTH.unit + y);
    playPose(unit, "a", cls, "idle");
    let n = 0;
    const act = (): void => {
      playPose(unit, "a", cls, MOVES[cls][n++ % MOVES[cls].length]!);
      unit.once(Phaser.Animations.Events.ANIMATION_COMPLETE, () => playPose(unit, "a", cls, "idle"));
    };
    this.acts.set(cls, act);
    this.time.addEvent({ delay: 3200, loop: true, callback: () => wanted === cls && act() });
  }
}
