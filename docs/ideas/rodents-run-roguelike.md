# Rodent's Run: a roguelike Rodent's Revenge

A brainstorm for turning Rodent's Revenge into a run-based roguelike that
keeps the original's mechanics at its centre.

## What has to stay

These are what make it Rodent's Revenge; everything else can change:

1. **One square per move, eight directions.**
2. **Pushing a whole row of blocks.**
3. **The trapping rule:** cats only turn to cheese when *every* cat is stuck
   at once.
4. **The clock:** more cats keep arriving, so you can't play slowly.

The roguelike layer should make you see the board differently from run to
run, without replacing those four.

## Run structure

- **One run is a short climb.** About 3 floors of 5–7 boards each, choosing a
  route on a branching map like Slay the Spire. Aim for 10–15 minutes, which
  suits phones.
- **Kinds of board:**
  - Normal: trap the waves; the original's clock rule decides when you've won.
  - Elite: one dangerous cat breed, better reward.
  - Puzzle: a fixed layout, a set number of cats, no clock. Solve it for a
    guaranteed reward.
  - Shop ("Pantry"): spend cheese.
  - Rest ("Mouse hole"): get a life back, or swap a trait.
  - Event: a choice with a catch.
  - Boss at the end of each floor.
- **Cheese becomes your money.** Trapped cats still turn to cheese, but
  whatever you eat is banked for the shop. That's a real decision: dash out
  for cheese while the next wave is coming, or play safe.
- **Lives last the whole run** (start with 3), which makes the mouse hole
  valuable.
- **The clock gets teeth.** In the original, hitting minute 30 with cats
  loose drains your score. Here it could bring in **the Dog**, a fast enemy
  that can't be trapped and only leaves when the board is cleared. Dawdling
  becomes the danger.

## Traits (powers you pick up)

Each one should change how pushing or trapping works. Fewer, rule-bending
traits beat many small number bonuses.

| Trait | Effect |
|---|---|
| Strong Shoulders | Blocks pushed into a sink hole fill it instead of disappearing. |
| Sticky Paws | Step away from a block and pull it with you. |
| Burrower | Once per board, dig through one block. |
| Heavy Paws | Pushed blocks crush yarn balls instead of stopping at them. |
| Whiskers | See which wall tile a yarn ball is hiding in before it stirs. |
| Bait | Drop a piece of cheese to lure cats toward a spot. |
| Lucky Tail | The first time a cat would catch you on each board, it flinches instead. |
| Cheese Magnet | Cheese next to you is eaten automatically. |
| Wave Breaker | Trapping everything early gives bonus cheese per remaining minute. |
| Domino | A row that hits a wall knocks the last block sideways. |

**One-use tools**, a few slots:

- **Firecracker:** clears 3×3 of blocks.
- **Portable block:** place one anywhere.
- **Catnip:** all cats sleep for 3 seconds.
- **Mouse hole:** a one-time teleport between two points.

## Cat breeds

Breeds that bend the trapping rule are where the depth comes from.

| Breed | Behaviour |
|---|---|
| Tabby | The original cat. |
| Siamese | Moves twice per tick. |
| Kitten | Slips through diagonal gaps between blocks, so you need tighter cages. |
| Fat Cat | Takes up a square that can't be pushed into; pushing a row into it fails. |
| Alley Cat | An open diagonal still counts as an escape, so it needs walls on all eight sides. |
| Persian | Shoves blocks back at you. |
| Mother Cat | Drops a kitten every few ticks until trapped. |
| Ghost Cat | Walks through blocks but not walls, so only walls can trap it. |

**Bosses:**

- **Tom:** a 2×2 cat that needs a 2×2 cage.
- **The Vacuum:** pulls blocks toward itself.
- **The Exterminator:** lays mouse traps as he walks.

## Board modifiers

- **Ice floor:** pushed blocks slide until they hit something.
- **Stone blocks:** too heavy to push in a row; one at a time only.
- **Cracked blocks:** break after two pushes.
- **Conveyors:** move blocks or cats along each tick.
- **Darkness:** you only see a small radius around the mouse.
- **Magnet blocks:** pull nearby blocks in.

## Between runs

- **Starting characters**, each a different push rule:
  - **Field Mouse:** balanced.
  - **Rat:** pushes two rows at once.
  - **Hamster:** faster, but can't push diagonally.
  - **Mole:** digs.
  - **Shrew:** tiny and fast, one life only.
- **Unlocks:** finishing runs adds traits, breeds and characters to the pool.
  Don't sell plain stat boosts.
- **Daily run:** everyone gets the same seed each day. The high-score dialog
  already has a "Past 24 Hours" table, so it nearly comes free. The Rust
  core's random numbers are already seedable, so a run can be replayed
  exactly.

## How it fits the code

- **Keep classic mode untouched.** Add a new crate, `rodent-run`, that builds
  on `rodent-core`.
- **Extension points in the core.** Add hooks so traits and breeds plug in,
  rather than branching through `game.rs`:
  - push behaviour (what happens at the end of a row)
  - cat movement (one movement rule per breed)
  - what counts as "stuck"
  - tile types
- **Traits and breeds as data.** Write them as plain enums with their
  effects, tested the same way as the current rules.
- **Front end.** The renderer, controls and window carry over. New screens
  are the map, the pantry, and trait picks.

## Where to start

A small playable slice first:

- one floor of about 6 boards with a map
- cheese as currency, plus the pantry
- 6 traits, 3 breeds (Tabby, Kitten, Fat Cat) and Tom as the boss
- the daily seed

That's enough to find out whether pushing plus rule-bending traits is fun
before building more.

## Open questions

1. **Real-time or turn-based?** The original is real-time, but turn-based
   (cats move when you move) is the roguelike norm and plays better on
   phones.
2. **How long should a run be?** A 10-minute phone session or a 45-minute
   deep run.
3. **Same look or new look?** Keep the Windows 3.1 style, or a fresh one for
   the new game?
