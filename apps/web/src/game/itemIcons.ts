// Each good's picture: a 32 px cell of Shikashi's Fantasy Icons Pack (Matt Firth, CC BY 4.0, credited in the README),
// by row and column.

import type { ItemName } from "@greyfall/engine";

import type { ShopIcon } from "./AtlasScene";

const CELL: Record<ItemName, [number, number]> = {
  "Smoked Haunch": [15, 2],
  "Ember Shard": [18, 3],
  "Brenna's Edge": [5, 1],
  "Keener Edge": [5, 2],
  "Grey-Iron Edge": [5, 3],
  "Pine Resin": [15, 9],
  "Banded Shield": [6, 1],
  "Kindled Shard": [12, 15],
  "Prospector's Purse": [12, 6],
  "The Forty's Banner": [17, 7],
  "Ansel's Edge": [5, 4],
  "The Thrown Coin": [12, 7],
  "Smuggler's Coat": [7, 14],
  "Sister's Candle": [10, 11],
  "Hollow Water": [19, 5],
  "Mum's Bread": [14, 13],
  "Digger's Torch": [10, 10],
  "Stilled Bell": [11, 8],
  "Salt-Glass Lantern": [10, 9],
  "Hollis's Gaff": [16, 1],
  "Drowned Locket": [8, 6],
  "Notched Whetstone": [17, 1],
  "Tinder Tin": [4, 2],
  "Gull-Picked Purse": [12, 11],
  "Gnome Powder": [20, 8],
  "Tinker's Buckler": [6, 0],
  "Wheel Cog": [16, 13],
};

export const ITEM_ICON = Object.fromEntries(Object.entries(CELL).map(([item, [row, col]]) => [item, { x: col * 32, y: row * 32 }])) as Record<ItemName, ShopIcon>;
