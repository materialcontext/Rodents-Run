# How the original plays, and how this remake matches it

Rodent's Revenge (Christopher Lee Fraley, Microsoft Entertainment Pack 2,
1991) is a Visual Basic 1.0 program. Its rules were recovered from the
program's p-code by the [Open Revenge](https://github.com/christopher-roelofs/Open-Revenge)
project (MIT licence), whose procedure-by-procedure C transcription and
`docs/GAME_LOGIC.md` this remake used as its reference. `crates/core`
re-implements the same procedures in Rust; comments there name the original
procedure (`GuyMove`, `FPushBlock`, `BadFMoveKat`, `YarnMove` …) each
function corresponds to.

## The board

- 23 × 23 cells; the outer ring is wall. The mouse starts in the centre.
- Level `n` uses room `n mod 6`, so the six rooms repeat with fewer blocks,
  more hazards and faster cats each time round:

  | Room | Layout | Blocks % | First batch (½-cats) | Wave (½-cats) | Minutes between waves |
  |---|---|---|---|---|---|
  | 1 | solid square of blocks | 100 | 3 | 3 | 5 |
  | 2 | square, a few walls | 90 | 3 | 3 | 4 |
  | 3 | scattered | 87 | 6 | 4 | 5 |
  | 4 | checkerboard of blocks | 100 | 2 | 2 | 2 |
  | 5 | rubble | 50 | 4 | 3 | 3 |
  | 6 | checkerboard of walls | 50 | 4 | 3 | 4 |

- Sink holes appear from level 4, mouse traps from level 7, both in growing
  numbers (`LevelDraw`, in `room.rs`).

## Moving and pushing

- The mouse moves one cell per key press in eight directions; it moves on
  input, not on the game timer.
- Walking into a block pushes the whole row behind it if the row ends in an
  open cell. A row pushed into **cheese** crushes it; into a **sink hole**,
  the front block vanishes; a **trap**, wall or yarn ball stops the push.
- A row pushed into an awake cat first lets the cat step aside; if it can't,
  the cat is pushed along with the row.
- A sink hole holds the mouse for 10 cat moves and is used up.

## Cats

Each cat move (`BadFMoveKat`): 90% of the time it steps straight at the
mouse (diagonal first, then one axis); otherwise, or when blocked, it tries
random steps that still close in on one axis, then any free neighbour. A cat
that cannot move at all sleeps.

When **no cat on the board can move**, all of them turn into cheese at once
(100 points + 25 per level after the first). Cats boxed in together count,
however much room they share.

## The clock

- The stopwatch runs 30 minutes of 30 ticks. Cat moves happen on ticks, so
  the cats' speed sets the clock's pace.
- Tick length = speed base (Snail 2000, Slow 1000, Medium 500, Fast 275,
  Blazing 180 ms) × 0.98^level × 0.945^(waves so far).
- Every *interval* minutes up to minute 25, more cats arrive (in half-cats:
  the remainder carries over, even between levels).
- With every cat trapped, the clock races (50 ms ticks, 5 seconds a tick) to
  the next wave time, where a new batch arrives. Trap them all after minute
  25 and it races to 30: the level is won (bonus 100 × level number).
- If the clock reaches 30 with cats loose, the score drains until they are
  trapped. Losing a life rewinds the clock to the start of the current wave
  interval.

## Yarn

From level 4, balls of yarn lurk in the border looking like wall. A ball
stirs (its wall tile changes), shows itself, and fires at the mouse
according to one of five temperaments: when the mouse is near its row or
column, when on its axis, when exactly lined up, or mostly-aimed. It rolls a
cell every 50 ms, kills the mouse on contact, bounces off blocks and walls,
and then either comes to rest (more likely on later levels) or fades away.

## Score

- Every play tick: 66.67 / tick-ms (so faster speeds score faster).
- While a ball rolls: 200 / tick-ms per cat move.
- While racing after minute 25: 0.67 a tick.
- Cheese: 100 + 25 × (level − 1). Level clear: 100 × level.
- After minute 30 the per-tick amounts turn negative; the score never goes
  below zero.

## Lives

Three mice; the spare ones are shown top left. Death by cat, trap or yarn
plays the five-frame animation. Losing the last ends the game with the
field "melting" away, then the high-score tables (best overall and past 24
hours, as in the Entertainment Pack score dialog).

## Where this remake differs

Deliberate changes, all in edge cases:

1. **Cats turn to cheese in the same tick.** The original removes trapped
   cats while looping over the list it is removing from, which can leave a
   cat for the next tick or, with yarn balls in the list, drop the wrong
   entry. Here all trapped cats convert together and yarn is untouched.
2. **A fired yarn ball always starts a fresh roll.** In the original, a roll
   cut short (the level racing on mid-flight) left stale state that the next
   ball inherited, sending it the old way.
3. **Cat placement can't hang.** The original searches for an open cell ten
   cells from the mouse forever; on a packed board this takes the furthest
   open cell instead.
4. **Random numbers** come from a different generator with the same
   distributions (including the bias of the original's `MyRand`).
5. **Phone behaviour:** the game pauses while a menu is open or the app is
   in the background; game over waits for a tap.
6. **Graphics** are new drawings in the original's style and 16-colour
   palette; the original bitmaps are Microsoft's and are not used.
