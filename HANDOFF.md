# Handoff

Living note. Roadmap: [ROADMAP.md](ROADMAP.md).

## Status

- No sand spray when you press. Sand shows up inside the bucket and on the shovel blade only.
- The castle mold is a round green bucket with a crenellated rim. A damp or fully wet stamp stays packed until you kick it. Very dry sand still slumps.
- Scoop and Shovel stay on top of the sand and turn with the drag.
- The shovel is a short yellow kids' beach shovel with a T-grip.


## Where to edit

- `src/components/sandbox/overlay.tsx` — play lock and menu
- `src/components/sandbox/world.tsx` — cursors, shore, tools, snapshot
- `src/components/sandbox/sim.ts` — mold stamp, undo history, beach moisture
- `src/components/sandbox/store.ts` — tool names, place, menu
- `src/components/sandbox/props.tsx` — bucket, shovel, mold, foot, hand
- `src/components/sandbox/textures.ts` — sand, wood, grass

## Not done

- GitHub (`stevebrueckner/dunebox`) has this playable version on `main`.
- Social images are still not in git.
- Undo does not rewind toy positions, only the sand grids and the bucket fill.
