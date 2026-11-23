// An area map's report for whoever is building it: density against Lanternport's, runback from each way out to the
// nearest bonfire, foes within resting range of a fire, and with --map the grid itself. In builder coordinates.
//   pnpm area greyfall          the numbers
//   pnpm area greyfall --map    and the map
import { FOES, MAPPED_AREAS, REST_CLEAR, areaMap, cellKey, stepsFrom, tileDistance, useIsland, type AreaId } from "../src/index.ts";

const BUILDINGS = new Set(["archery", "barracks", "castle", "house1", "house2", "house3", "monastery", "tower", "watchtower", "goblinHut", "gnomeHut", "gnomeTower", "fishHut", "goldMine", "cave"]);

const id = process.argv[2] as AreaId;
if (!MAPPED_AREAS.includes(id)) {
  console.error(`usage: pnpm area <${MAPPED_AREAS.join("|")}> [--map]`);
  process.exit(1);
}

function density(a: AreaId) {
  const m = areaMap(a);
  const land = m.island.rows.join("").replace(/[~T%]/g, "").length;
  return {
    props: +((100 * m.props.length) / land).toFixed(1),
    buildings: m.props.filter((p) => BUILDINGS.has(p.art)).length,
    working: m.dwellers.filter((d) => d.act).length,
    trees: m.island.rows.join("").split("T").length - 1,
  };
}

const m = areaMap(id);
// A surface or sky map is padded three tiles by areaMap(); the underneath is not.
const pad = m.base === "rock" ? 0 : 3;
const at = (c: { col: number; row: number }) => `${Math.round(c.col - pad)},${Math.round(c.row - pad)}`;

const here = density(id);
const bar = density("harbour");
console.log(`${id}: ${here.props} props per 100 land tiles (Lanternport ${bar.props}), ${here.buildings} buildings (${bar.buildings}), ${here.working} folk at work (${bar.working}), ${here.trees} wooded tiles (${bar.trees})`);

useIsland(m.island);
const dist = new Map<number, number>();
const queue = m.fires.map((f) => (dist.set(cellKey(f), 0), f));
for (let i = 0; i < queue.length; i++) {
  for (const n of stepsFrom(queue[i]!)) {
    if (dist.has(cellKey(n))) continue;
    dist.set(cellKey(n), dist.get(cellKey(queue[i]!))! + 1);
    queue.push(n);
  }
}
// An exit or a fire is often a tile off the walkable ground: take the nearest step beside it.
const runback = (c: { col: number; row: number }) => Math.min(...[-1, 0, 1].flatMap((dr) => [-1, 0, 1].map((dc) => dist.get(cellKey({ col: c.col + dc, row: c.row + dr })) ?? Infinity)));
let far = { d: 0, at: "" };
m.island.rows.forEach((line, row) => [...line].forEach((_, col) => {
  const d = dist.get(cellKey({ col, row }));
  if (d !== undefined && d > far.d) far = { d, at: at({ col, row }) };
}));
console.log(`fires: ${m.fires.map(at).join("  ")}`);
console.log(`runback: ${m.exits.map((e) => `${e.name} ${runback(e.at)}`).join(", ")}; farthest tile ${far.d} at ${far.at}`);

// Not a fault on its own: a fire with foes this near must be cleared before it can be rested at.
for (const f of m.fires) {
  const near = m.dwellers.filter((d) => FOES[d.kind] && [d, d.to ?? d].some((c) => tileDistance(c, f) <= REST_CLEAR));
  if (near.length) console.log(`foes within ${REST_CLEAR} of the fire at ${at(f)}: ${near.map((d) => `${d.kind} ${at(d)}${d.to ? `->${at(d.to)}` : ""}`).join(", ")}`);
}

if (process.argv.includes("--map")) {
  // Ground by height (. # ^ 4 5, ~ water, T wood, stairs as drawn); over it H a building, p a prop, @ a folk, F a fire,
  // E a way out. The ruler counts builder columns.
  const grid = m.island.rows.map((l) => [...l]);
  const mark = (c: { col: number; row: number }, ch: string) => {
    const [x, y] = [Math.round(c.col), Math.round(c.row)];
    if (grid[y]?.[x] !== undefined) grid[y]![x] = ch;
  };
  for (const p of m.props) mark(p, BUILDINGS.has(p.art) ? "H" : "p");
  for (const d of m.dwellers) if (!d.when) mark(d, "@");
  for (const f of m.fires) mark(f, "F");
  for (const e of m.exits) mark(e.at, "E");
  const cols = grid[0]!.length;
  console.log("     " + Array.from({ length: cols - pad }, (_, i) => (i % 10 === 0 ? String((i / 10) % 10) : " ")).join(""));
  for (let r = pad; r < grid.length - pad; r++) console.log(String(r - pad).padStart(4) + " " + grid[r]!.slice(pad, cols - pad).join(""));
}
