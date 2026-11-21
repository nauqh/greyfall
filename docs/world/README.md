# The world

Everything told about Aurum: its story, its folk and their lines, and the keepers who hold its ways.

- [reach.md](reach.md): the rules for telling it, the world's story, what the art can carry, the audit and the open questions.
- [peoples.md](peoples.md): the other folk of Aurum, from gnomes to finfolk, and how the cold put them on the roads.
- [questline.md](questline.md): how talks, flags and moving on work, what sets each flag, every questline at a glance, and the forks.
- [inspirations.md](inspirations.md): the nearest land in Dark Souls, Elden Ring and Skyrim to each of Aurum's, as a touchstone for tone.

Each land is a folder with its `lore.md` (the canon for that land, and its folk), `questline.md` (its folk's lines, station by station, and who passes through) and, where a boss keeps it, `bosses.md`. A boss's arena belongs to the land it guards the way out of. Emberwood and Brasscrag also keep `design.md`, the district-by-district layout the map is built to.

| Land | Areas (ids) | Bosses |
| --- | --- | --- |
| [Tidewake](tidewake/) | `landing`, `ring` | the Cinder Troll |
| [Lanternport](lanternport/) | `harbour` | none: the hub |
| [Highward](highward/) | `burg`, `ramparts`, `chapel`, `keep`, `bullwall`, `belfry` | the Rampart Boar, the Stone Warden |
| [Emberwood](emberwood/) | `emberwood`, `trollpit` | the Ember Bull |
| [Brasscrag](brasscrag/) | `crags`, `peak` | Old Bamboo |
| [Stiltwater](stiltwater/) | `saltreach` | none |
| [Kingsrest](kingsrest/) | `barrowmoor`, `barrow` | the Barrow King |
| [Stillmere](stillmere/) | `fen` | none |
| [Greyfall](greyfall/) | `greyfall`, `throne` | the Grey Warlord |
| [Cloudstair](cloudstair/) | `steps` | none |
| [Sunhold](sunhold/) | `gilded`, `sunhall` | the Sun Sentinel |
| [Underwell](underwell/) | `undercroft` | none built (`ATLAS.md` plans an Ossuary Warden) |
| [Graveroad](graveroad/) | `deeps`, `web` | the Weaver |
| [Hearthdeep](hearthdeep/) | `hollow`, `shellisle` | the Shell Below |

When a line of dialogue changes in `packages/engine/src/npcs.ts`, change it in the speaker's land `questline.md` too; a new flag goes in [questline.md](questline.md).
