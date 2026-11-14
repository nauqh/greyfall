export type Bind = { action: string; keys: string[] };
export type Group = { title: string; binds: Bind[] };
export type Mode = { id: string; label: string; groups: Group[] };

export const CONTROLS: Mode[] = [
  {
    id: "atlas",
    label: "Atlas",
    groups: [
      {
        title: "Movement",
        binds: [
          { action: "Move up", keys: ["W", "Up"] },
          { action: "Move left", keys: ["A", "Left"] },
          { action: "Move down", keys: ["S", "Down"] },
          { action: "Move right", keys: ["D", "Right"] },
          { action: "Roll (backstep standing still)", keys: ["Space"] },
          { action: "Sprint (hold while moving)", keys: ["Space"] },
        ],
      },
      {
        title: "Combat",
        binds: [
          { action: "Attack toward cursor", keys: ["Mouse Left"] },
          { action: "Raise shield (hold)", keys: ["Mouse Right", "Shift"] },
          { action: "Drink flask", keys: ["R"] },
        ],
      },
      {
        title: "World",
        binds: [
          { action: "Interact, talk, rest, read", keys: ["E"] },
          { action: "Open the map", keys: ["M"] },
          { action: "Open the sack", keys: ["Tab"] },
          { action: "Show or hide the HUD", keys: ["H"] },
        ],
      },
      {
        title: "Band",
        binds: [
          { action: "Follow me", keys: ["1"] },
          { action: "Attack my target", keys: ["2"] },
          { action: "Hold here", keys: ["3"] },
        ],
      },
      {
        title: "Menus",
        binds: [
          { action: "Pick an option", keys: ["W", "S", "Up", "Down"] },
          { action: "Choose", keys: ["E", "Enter"] },
          { action: "Back or close", keys: ["Esc"] },
        ],
      },
      {
        title: "Map",
        binds: [
          { action: "Pick a bonfire", keys: ["W", "S", "Up", "Down"] },
          { action: "Change tier", keys: ["A", "D", "Left", "Right"] },
          { action: "Close the map", keys: ["Esc", "M"] },
          { action: "Pan", keys: ["Mouse Left"] },
          { action: "Zoom", keys: ["Wheel"] },
        ],
      },
      {
        title: "Story",
        binds: [
          { action: "Next line", keys: ["Space", "Enter"] },
          { action: "Skip (hold)", keys: ["Space", "Enter", "Esc"] },
        ],
      },
    ],
  },
  {
    id: "war",
    label: "The War",
    groups: [
      {
        title: "Camera",
        binds: [
          { action: "Pan", keys: ["Up", "Down", "Left", "Right"] },
          { action: "Pan (drag)", keys: ["Mouse Middle"] },
          { action: "Zoom", keys: ["Wheel"] },
        ],
      },
      {
        title: "Selection",
        binds: [
          { action: "Select", keys: ["Mouse Left"] },
          { action: "Box select (drag)", keys: ["Mouse Left"] },
          { action: "Add to selection", keys: ["Shift"] },
          { action: "Select all of a kind on screen", keys: ["Ctrl+Click", "Double Click"] },
          { action: "Select pawns", keys: ["F1"] },
          { action: "Select army", keys: ["F2"] },
          { action: "Set control group", keys: ["Ctrl+1-9"] },
          { action: "Recall control group", keys: ["1-9"] },
          { action: "Cancel and deselect", keys: ["Esc"] },
        ],
      },
      {
        title: "Orders",
        binds: [
          { action: "Move, attack or rally", keys: ["Mouse Right"] },
          { action: "Cancel placing", keys: ["Mouse Right"] },
          { action: "Command card", keys: ["Q", "W", "E", "A", "S", "D", "Z", "X", "C"] },
        ],
      },
      {
        title: "Menus",
        binds: [
          { action: "Pause", keys: ["Space"] },
          { action: "Game menu", keys: ["F10"] },
          { action: "Guide", keys: ["H"] },
          { action: "Close", keys: ["Esc"] },
        ],
      },
    ],
  },
  {
    id: "versus",
    label: "Versus",
    groups: [
      {
        title: "Shop",
        binds: [
          { action: "Buy shop slot", keys: ["1", "2", "3", "4", "5"] },
          { action: "Buy", keys: ["Mouse Left"] },
          { action: "Reroll", keys: ["D"] },
          { action: "Buy XP", keys: ["F"] },
        ],
      },
      {
        title: "Board",
        binds: [
          { action: "Move a unit (drag or click, then click)", keys: ["Mouse Left"] },
          { action: "Sell (drag to the shop)", keys: ["Mouse Left"] },
        ],
      },
      {
        title: "Menus",
        binds: [
          { action: "Handbook", keys: ["H"] },
          { action: "Close handbook, stop scouting", keys: ["Esc"] },
        ],
      },
    ],
  },
  {
    id: "menus",
    label: "Title menu",
    groups: [
      {
        title: "Menus",
        binds: [
          { action: "Move the pick", keys: ["W", "S", "Up", "Down"] },
          { action: "Choose", keys: ["Enter", "Mouse Left"] },
        ],
      },
    ],
  },
];
