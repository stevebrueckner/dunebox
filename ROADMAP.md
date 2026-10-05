# Dunebox roadmap

Plan from the latest playtest notes. Do these in order. Update [HANDOFF.md](HANDOFF.md) as each item lands.

## 1. Play lock

The moisture slider and toolbar sit on top of the sand and steal clicks.

- Add a play lock. While locked, hide every control except two buttons: **Menu** and **Look**.
- **Look** orbits, pans, and zooms. It does not dig.
- **Menu** freezes the sand (no scoop, dig, castle, kick, or grab) and shows the tools, moisture, finds, undo, snapshot, and beach toggle.
- Closing the menu hides those controls again and gives the sand back.
- The moisture control lives only inside the menu, with a large hit target.

## 2. Tools

| Old | New | What you see |
| --- | --- | --- |
| Scoop | Scoop | Only the bucket. No shovel mixed in. |
| Dig | Shovel | A shovel in the sand. |
| Keep | Castle | A plastic castle mold, like a green beach bucket. |
| Smash | Kick | A foot. |
| Pick | Grab | A hand. Hold what you pick up. |
| Look | Look | Camera only. Stays available in play lock. |

## 3. Animations

One press should read as a toy moving, not an instant stamp.

- **Scoop.** Press lowers the bucket into the sand. Dragging fills it. Release lifts it. Dumping still happens where you let go, after the lift.
- **Shovel.** Press sets the blade. Dragging cuts and throws spoil. Release lifts the shovel out.
- **Castle.** Press plants the mold and packs a castle the shape of the bucket (crenellations, flared base). Release lifts the empty mold. Castles can be stacked if the one below is damp enough to hold.
- **Kick.** Press drives a foot into the sand, then it pulls back.
- **Grab.** A hand closes on the toy and keeps holding it until you drop it.

## 4. Beach

Add a place switch: **Pit** or **Beach**.

- Beach is wider than the wooden pit.
- The shore has real water and a slow wave that wets the sand, then fades to damp, then to dry.
- More toys and buried finds, spread across the beach, not piled in the middle.
- Digging goes deeper than the pit floor. Beach has no wooden bottom in the way.

## 5. Snapshot

A **Snapshot** button saves the current view as an image the player can keep.

## 6. Sounds

Replace the current taps. They read as hammering wood.

- Scoop: grain sliding into a plastic bucket.
- Shovel: a blade cutting sand, not a knock.
- Castle: a soft plastic plant and a lift.
- Kick: a dull thud into sand.
- Grab: a small grip, then a drop.
- Water: a thin wash, not a click.
- Find: a short bright chime, still quiet.

## 7. Undo

An **Oops!** button rewinds the last sand edit or tool action. Several steps, not just one.

## Out of scope

- No accounts, no saved cloud pits.
- Do not publish social-card art from this pass.
- Do not change the GitHub repo visibility.
