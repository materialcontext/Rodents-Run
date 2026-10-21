# Rodent's Revenge — for phones

A faithful remake of **Rodent's Revenge** (Microsoft Entertainment Pack,
1991) that plays in any browser and is built for touch screens.

The rules are a Rust re-implementation of the original program's logic
(recovered from its Visual Basic p-code): the same six rooms, cat AI, push
rules, clock, waves, yarn balls, sink holes, traps, speeds and scoring. See
[`docs/ORIGINAL_RULES.md`](docs/ORIGINAL_RULES.md) for the rules and the few
places this remake deliberately differs.

## Playing

Push blocks to trap the cats. When every cat is stuck they turn into
cheese; eat it. More cats arrive each time the stopwatch's minute hand
reaches the blue mark. Trap them all after the last batch to clear the level.

| | Touch | Keyboard |
|---|---|---|
| Move (8 ways) | Thumb pad: touch anywhere around it and slide to aim; hold to keep walking | Arrows / numpad, Home PgUp End PgDn for diagonals; or WASD + QEZC |
| Move, alternative | Swipe on the field: each short drag is one step | |
| New game | Tap the field on the title screen, or Menu → New Game | F2 |
| Pause | ❚❚ button (also automatic when you leave the app) | F3 or P |
| Menu | ▬ button (top left) | Esc |

The menu has the original's five speeds (Snail … Blazing) and starting
level (1–50). Controls lets you put the pad left, centre or right, tune
hold-to-repeat, and turn swipes and vibration on or off. Landscape puts the
field in the middle with the pad at the side.

Add it to your home screen for full-screen, offline play.

## Building

Needs Rust (stable) with the WebAssembly target:

```sh
rustup target add wasm32-unknown-unknown
cargo xtask dist
```

This writes:

- `web/rodent.wasm`, so `web/` can be served directly while developing
  (`python3 -m http.server -d web`),
- `dist/site/`, the static site,
- `dist/rodents-revenge.html`, one self-contained file that runs from disk.

`cargo test` runs the rules tests. Pushes to `main` build and deploy the
site to GitHub Pages (enable Pages with source "GitHub Actions" in the
repository settings).

## Layout

| Path | What |
|---|---|
| `crates/core` | The game: rules, rooms, cats, yarn, clock, score. No platform code. |
| `crates/wasm` | A plain C ABI over the core for the browser (no wasm-bindgen). |
| `xtask` | `cargo xtask dist`: builds and bundles. |
| `web/` | The page: canvas renderer, controls, menus, high scores, PWA files. |

The page drives the core like the original's timer control: it calls
`tick()` every `tick_ms()` milliseconds, forwards each move to `input()`,
and draws the 23 × 23 tile grid the core exposes.

## Credits

Rodent's Revenge was created by Christopher Lee Fraley and published by
Microsoft. This is an unofficial fan remake; it contains none of the
original's code or graphics. The original rules were documented by the
[Open Revenge](https://github.com/christopher-roelofs/Open-Revenge) project
(MIT licence).
