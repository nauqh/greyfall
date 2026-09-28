// Fog of war over the war map, in two layers: black where nobody has
// been yet, grey where someone has been but nobody looks now. What a side
// sees is the engine's (visibleCells); what it has explored and which enemy
// buildings it has spotted are this player's memory, so they live here.

import { STRAT_COLS, STRAT_ROWS, cellKey, plotCells, reaches, sightsOf, visibleCells, type MatchState, type WarSide } from "@greyfall/engine";
import * as Phaser from "phaser";

import { CELL } from "./islandMap";

/** Tiles of fog past each edge of the map, to reach any edge the camera shows. */
const PAD = 30;
const W = STRAT_COLS + 2 * PAD;
const H = STRAT_ROWS + 2 * PAD;
/** The pack's deep water, darkened: fog reads as dusk over the sea, not a hole. */
const SHADE = [12, 30, 40] as const;
const ALPHA = { unexplored: 235, explored: 120, visible: 0 } as const;

export class Fog {
  private seen = new Set<number>();
  private explored = new Set<number>();
  /** The sea past the map's edge, explored or not, by texel. */
  private exploredOff = new Uint8Array(W * H);
  /** Enemy buildings this side has spotted: shown, as last seen, in the grey. */
  private spotted = new Set<string>();
  private readonly tex: Phaser.Textures.CanvasTexture;
  private readonly pixels: ImageData;

  constructor(scene: Phaser.Scene, private readonly side: WarSide, depth: number) {
    const key = `fog-${side}`;
    if (scene.textures.exists(key)) scene.textures.remove(key);
    this.tex = scene.textures.createCanvas(key, W, H)!;
    // One texel a tile, stretched smooth: soft edges for free.
    this.pixels = this.tex.context.createImageData(W, H);
    scene.add.image(-PAD * CELL, -PAD * CELL, key).setOrigin(0).setScale(CELL).setDepth(depth);
  }

  /** Look again from where `state` has this side's units and buildings. */
  update(state: MatchState): void {
    const sights = sightsOf(state, this.side);
    this.seen = visibleCells(state, this.side, sights);
    for (const k of this.seen) this.explored.add(k);
    for (const b of Object.values(state.buildings)) {
      if (b.side !== this.side && plotCells(b).some((c) => this.seen.has(cellKey(c)))) this.spotted.add(b.id);
    }
    const data = this.pixels.data;
    for (let y = 0; y < H; y++) {
      for (let x = 0; x < W; x++) {
        const c = x - PAD;
        const r = y - PAD;
        let seen: boolean;
        let been: boolean;
        if (c >= 0 && r >= 0 && c < STRAT_COLS && r < STRAT_ROWS) {
          const k = r * STRAT_COLS + c;
          seen = this.seen.has(k);
          been = this.explored.has(k);
        } else {
          // Past the map's edge is open sea: the sight circles run on over it.
          seen = sights.some((s) => reaches(s, c, r));
          if (seen) this.exploredOff[y * W + x] = 1;
          been = this.exploredOff[y * W + x] === 1;
        }
        const i = (y * W + x) * 4;
        data[i] = SHADE[0];
        data[i + 1] = SHADE[1];
        data[i + 2] = SHADE[2];
        data[i + 3] = seen ? ALPHA.visible : been ? ALPHA.explored : ALPHA.unexplored;
      }
    }
    this.tex.context.putImageData(this.pixels, 0, 0);
    this.tex.refresh();
    // refresh() uploads with the game's pixel-art filter; the fog wants its blur back.
    this.tex.setFilter(Phaser.Textures.FilterMode.LINEAR);
  }

  /** A new match: nothing explored, nothing spotted. */
  reset(): void {
    this.seen.clear();
    this.explored.clear();
    this.exploredOff.fill(0);
    this.spotted.clear();
  }

  /** Whether this side has ever seen the tile. */
  known(col: number, row: number): boolean {
    return this.explored.has(cellKey({ col, row }));
  }

  /** Whether this side sees the tile now. */
  sees(col: number, row: number): boolean {
    return this.seen.has(cellKey({ col, row }));
  }

  /** Whether an enemy building has ever been in sight. */
  knows(plotId: string): boolean {
    return this.spotted.has(plotId);
  }
}
