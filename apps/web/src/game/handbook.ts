// Skirmish's handbook: every unit's numbers at each star, the traits, and the
// shop's odds and gold rules. Read off the balance tables, so it never drifts.

import { AUTO, BALANCE, CHAMPIONS, TRAIT_KEYS, type Champion } from "@greyfall/engine";
import * as Phaser from "phaser";

import { CLASS_NAME, PORTRAIT_INK, skillName, skillTip, traitEffect, traitOf, traitWho } from "./autoPlan";
import { WATER_SPAN } from "./boot";
import { DEPTH } from "./terrain";
import { ARROW, HAND, button, label, panel, ribbon } from "./ui";

type Tab = "units" | "traits" | "shop";

const TABS: [Tab, string][] = [
  ["units", "Units"],
  ["traits", "Traits"],
  ["shop", "Shop"],
];
const INK = { color: "#4a3a28", strokeThickness: 0 };
const SOFT = { color: "#7a6a52", strokeThickness: 0 };
const BLUE = { color: "#2f5d8a", strokeThickness: 0 };
const BY_TIER = [...CHAMPIONS].sort((a, b) => AUTO.tier[a] - AUTO.tier[b]);
const TIERS = [1, 2, 3, 4];
const pct = (f: number): string => `${Math.round(f * 100)}%`;

/** A stat at 1, 2 and 3 stars, as the battle rounds it. */
function starred(base: number): string {
  return [1, 2, 3].map((s) => Math.round(base * AUTO.starPower[s]!)).join(" / ");
}

/** Copies of each unit of a tier in the pool; a tier's units all have the same. */
function poolOf(tier: number): number {
  return AUTO.pool[BY_TIER.find((c) => AUTO.tier[c] === tier)!];
}

export class Handbook {
  private box: Phaser.GameObjects.Container | null = null;
  private tab: Tab = "units";

  constructor(
    private readonly scene: Phaser.Scene,
    /** Copies left in the shared pool, when a run is on. */
    private readonly pool: () => Record<Champion, number> | null,
    private readonly onToggle: (open: boolean) => void,
    private readonly onTip?: (text: string | null, x: number, y: number) => void,
  ) {
    scene.input.keyboard?.on("keydown-H", () => this.toggle());
    scene.input.keyboard?.on("keydown-ESC", () => this.box && this.toggle());
  }

  get open(): boolean {
    return this.box !== null;
  }

  toggle(): void {
    this.onTip?.(null, 0, 0);
    if (this.box) {
      this.box.destroy();
      this.box = null;
    } else this.build();
    this.scene.data.set("handbook", this.open);
    this.onToggle(this.open);
  }

  private build(): void {
    const s = this.scene;
    this.box?.destroy();
    this.onTip?.(null, 0, 0);
    const box = s.add.container(0, 0).setDepth(DEPTH.hud + 40);
    this.box = box;
    const veil = s.add
      .rectangle(600, 360, WATER_SPAN.w, WATER_SPAN.h, 0x0b1620, 0.55)
      .setInteractive({ cursor: ARROW })
      .on("pointerup", () => this.toggle());
    // Swallows clicks so only the veil outside the sheet closes it.
    const sheet = panel(s, "paper", 600, 366, 1010, 612).setInteractive({ cursor: ARROW });
    box.add([veil, sheet, ribbon(s, 600, 70, 340), label(s, 600, 66, "HANDBOOK", { fontSize: "20px" })]);

    TABS.forEach(([tab, name], i) => {
      const b = button(s, 600 + (i - 1) * 140, 120, 130, 54, name, "blue", () => {
        this.tab = tab;
        this.build();
      }, 0.5);
      if (this.tab !== tab) {
        (b.list[0] as Phaser.GameObjects.NineSlice).setTint(0x9aa4aa);
        (b.list[1] as Phaser.GameObjects.Text).setColor("#e4e8ea").setStroke("#4a5560", 3);
      }
      box.add(b);
    });

    if (this.tab === "units") this.units();
    else if (this.tab === "traits") this.traits();
    else this.shop();

    box.add(button(s, 600, 636, 150, 54, "Close", "blue", () => this.toggle(), 0.5));
    box.add(label(s, 1030, 636, "H or Esc", { ...SOFT, fontSize: "12px" }).setOrigin(1, 0.5));
  }

  private text(x: number, y: number, t: string, over: Phaser.Types.GameObjects.Text.TextStyle = {}): Phaser.GameObjects.Text {
    const go = label(this.scene, x, y, t, { ...INK, fontSize: "13px", ...over }).setOrigin(0, 0);
    this.box!.add(go);
    return go;
  }

  /** Text that explains itself on hover, through the page's tooltip. */
  private tipped(go: Phaser.GameObjects.Text, tip: string): void {
    const raise = (p: Phaser.Input.Pointer): void => {
      const e = p.event as MouseEvent | undefined;
      this.onTip?.(tip, e?.clientX ?? 0, e?.clientY ?? 0);
    };
    go.setInteractive({ cursor: HAND })
      .on("pointerover", raise)
      .on("pointermove", raise)
      .on("pointerout", () => this.onTip?.(null, 0, 0));
  }

  /** One row a unit, cheapest first; an ability's full rule is on its name. */
  private units(): void {
    const s = this.scene;
    const pool = this.pool();
    const head = { fontSize: "13px", fontStyle: "800" };
    const cols = { name: 176, hp: 336, dmg: 466, range: 590, vs: 640, ability: 752, trait: 900 };
    this.text(cols.hp, 156, "Health", head);
    this.text(cols.dmg, 156, "Damage", head);
    this.text(cols.range, 156, "Range", head);
    this.text(cols.vs, 156, "Beats", head);
    this.text(cols.ability, 156, "Skill", head);
    this.text(cols.trait, 156, "Trait", head);
    this.text(cols.hp, 172, "at 1 / 2 / 3 stars", { ...SOFT, fontSize: "11px" });
    this.text(cols.ability, 172, "hover for the rule", { ...SOFT, fontSize: "11px" });

    const counters: Partial<Record<Champion, Champion>> = BALANCE.counters;
    BY_TIER.forEach((cls, i) => {
      const y = 192 + i * 35;
      const u = BALANCE.units[cls];
      const [x0, y0, x1, y1] = PORTRAIT_INK[cls];
      this.box!.add(
        s.add
          .image(152, y + 14, `avatar_${cls}`)
          .setOrigin((x0 + x1) / 2 / 256, (y0 + y1) / 2 / 256)
          .setScale(28 / Math.max(x1 - x0, y1 - y0)),
      );
      this.text(cols.name, y, CLASS_NAME[cls], { fontSize: "14px", fontStyle: "800" });
      const left = pool ? `${pool[cls]}/${AUTO.pool[cls]} left` : `${AUTO.pool[cls]} copies`;
      this.text(cols.name, y + 17, `${AUTO.tier[cls]} gold, ${left}`, { ...SOFT, fontSize: "11px" });

      this.text(cols.hp, y + 4, starred(u.hp));
      this.text(cols.dmg, y + 4, u.heal > 0 ? `${starred(u.heal)} heal` : starred(u.damage));
      this.text(cols.range, y + 4, `${u.range}`);
      const beats = counters[cls];
      this.text(cols.vs, y + 4, beats ? `${CLASS_NAME[beats]}s +${pct(BALANCE.counterBonus)}` : "-");

      this.tipped(this.text(cols.ability, y, skillName(cls), { ...BLUE, fontStyle: "800" }), skillTip(cls));
      this.text(cols.ability, y + 17, `every ${AUTO.skills[cls].cooldown}s`, { ...SOFT, fontSize: "11px" });

      const t = AUTO.traits[traitOf(cls)];
      this.text(cols.trait, y + 4, t.name, { ...BLUE, fontStyle: "800" });
      this.text(cols.trait + 92, y + 4, `at ${t.at.join(", ")}${t.kinds ? " kinds" : ""}`, SOFT);
    });
  }

  private traits(): void {
    const monsters = AUTO.traits.horde.members.map((c) => CLASS_NAME[c]).join(", ");
    this.text(
      150,
      156,
      `Each knight class has its own trait. Monsters share the Horde, which counts different kinds on the board: ${monsters}. Each tier replaces the one below it.`,
      { ...SOFT, wordWrap: { width: 900 } },
    );
    let y = 206;
    for (const key of TRAIT_KEYS) {
      const t = AUTO.traits[key];
      this.text(150, y, t.name, { ...BLUE, fontSize: "16px", fontStyle: "800" });
      this.text(150, y + 22, traitWho(key), SOFT);
      t.at.forEach((n, k) => {
        this.text(330, y + k * 22, `${n}`, { fontSize: "14px", fontStyle: "800" });
        this.text(360, y + k * 22, traitEffect(key, k), { fontSize: "14px" });
      });
      y += Math.max(44, t.at.length * 22) + 12;
    }
    const triangle = Object.entries(BALANCE.counters)
      .map(([a, b]) => `${CLASS_NAME[a as Champion]} beats ${CLASS_NAME[b!]}`)
      .join(", ");
    this.text(150, y + 6, `Counters, always on: ${triangle}, each for ${pct(BALANCE.counterBonus)} more damage.`, SOFT);
  }

  private shop(): void {
    const head = { fontSize: "13px", fontStyle: "800" };
    const cols = [150, 210, 270, 370, 440, 510, 580];
    ["Level", "Board", "XP to next", ...TIERS.map((t) => `Tier ${t}`)].forEach((h, i) => this.text(cols[i]!, 162, h, head));
    for (let level = AUTO.startLevel; level <= AUTO.maxLevel; level++) {
      const y = 190 + (level - AUTO.startLevel) * 30;
      const odds = AUTO.odds[level]!;
      const xp = level >= AUTO.maxLevel ? "-" : `${AUTO.xpToNext[level]}`;
      [`${level}`, `${level}`, xp, ...odds.map((o) => (o > 0 ? `${o}%` : "-"))].forEach((v, i) =>
        this.text(cols[i]!, y, v, { fontSize: "14px" }),
      );
    }
    let y = 410;
    this.text(150, y, "Odds are per shop slot.", SOFT);
    for (const t of TIERS) {
      y += 20;
      const who = BY_TIER.filter((c) => AUTO.tier[c] === t).map((c) => CLASS_NAME[c]);
      this.text(150, y, `Tier ${t}, ${t} gold, ${poolOf(t)} copies each: ${who.join(", ")}`, { ...SOFT, wordWrap: { width: 480 } });
    }

    const streaks = AUTO.streakGold.flatMap((g, n) => (g > (AUTO.streakGold[n - 1] ?? 0) ? [`${n} pays +${g}`] : []));
    const rules = [
      `Every round pays ${AUTO.income} gold, and a win ${AUTO.winGold} more.`,
      `Interest: +1 for every 10 gold you hold, up to +${AUTO.interestMax}.`,
      `Streaks, of wins or of losses: ${streaks.join(", ")}.`,
      `Level up: ${AUTO.xpBuy.gold} gold for ${AUTO.xpBuy.xp} XP. Each round gives ${AUTO.xpPerRound} XP.`,
      `Reroll: ${AUTO.reroll} gold for a new shop of ${AUTO.shopSlots}.`,
      `Three copies merge into the next star: x${AUTO.starPower[2]} then x${AUTO.starPower[3]} health, damage and healing.`,
      "Selling pays the cost back for every copy inside: 1, 3 or 9.",
      `A loss costs ${AUTO.damage.base} plus 1 for every ${AUTO.damage.perRounds} rounds played, plus 1 for each star still standing on the winning side.`,
      `The bench holds ${AUTO.benchSlots}. All ${AUTO.seats} clans share one pool.`,
    ];
    y = 162;
    for (const r of rules) y += this.text(680, y, r, { wordWrap: { width: 380 } }).height + 9;
  }
}
