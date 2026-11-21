# The world

Everything told about the Shattered Reach: its story, its folk and their lines, and the keepers who hold its ways.

- [reach.md](reach.md): the rules for telling it, the world's story, what the art can carry, the glossary, the audit and the open questions.
- [questline.md](questline.md): how talks, flags and moving on work, what sets each flag, every questline at a glance, and the forks.

Each land is a folder with its `lore.md` (the canon for that land, and its folk), `questline.md` (its folk's lines, station by station, and who passes through) and, where a boss keeps it, `bosses.md`. A boss's arena belongs to the land it guards the way out of. The Emberwood and Tinker Crags also keep `design.md`, the district-by-district layout the map is built to.

| Land | Areas (ids) | Bosses |
| --- | --- | --- |
| [The Landing](landing/) | `landing`, `ring` | the Cinder Troll |
| [Last Harbour](last-harbour/) | `harbour` | none: the hub |
| [The Castle](castle/) | `burg`, `ramparts`, `chapel`, `keep`, `bullwall`, `belfry` | the Rampart Boar, the Stone Warden |
| [The Emberwood](emberwood/) | `emberwood`, `trollpit` | the Ember Bull |
| [Tinker Crags](tinker-crags/) | `crags`, `peak` | Old Bamboo |
| [Saltreach](saltreach/) | `saltreach` | none |
| [Barrowmoor](barrowmoor/) | `barrowmoor`, `barrow` | the Barrow King |
| [Lizard Fen](lizard-fen/) | `fen` | none |
| [The Greyfall](greyfall/) | `greyfall`, `throne` | the Grey Warlord |
| [Skyward Steps](skyward-steps/) | `steps` | none |
| [The Gilded City](gilded-city/) | `gilded`, `sunhall` | the Sun Sentinel |
| [The Undercroft](undercroft/) | `undercroft` | none built (`ATLAS.md` plans an Ossuary Warden) |
| [Barrow Deeps](barrow-deeps/) | `deeps`, `web` | the Weaver |
| [The Drowned Hollow](drowned-hollow/) | `hollow`, `shellisle` | the Shell Below |

When a line of dialogue changes in `packages/engine/src/npcs.ts`, change it in the speaker's land `questline.md` too; a new flag goes in [questline.md](questline.md).
