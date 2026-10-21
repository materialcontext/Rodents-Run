//! A plain C ABI over `rodent-core` for the browser: no wasm-bindgen, so the
//! module loads with `WebAssembly.instantiate` and nothing else. The page
//! owns the clock and input; it reads the board straight out of memory.

use rodent_core::{Dir, Game};
use std::cell::RefCell;

thread_local! {
    static GAME: RefCell<Option<Game>> = const { RefCell::new(None) };
}

fn with<R: Default>(f: impl FnOnce(&mut Game) -> R) -> R {
    GAME.with(|g| g.borrow_mut().as_mut().map(f).unwrap_or_default())
}

/// Starts (or restarts) the session on the title screen.
#[no_mangle]
pub extern "C" fn rr_init(seed_lo: u32, seed_hi: u32, speed: u32, start_level: i32) {
    let seed = (seed_hi as u64) << 32 | seed_lo as u64;
    GAME.with(|g| *g.borrow_mut() = Some(Game::new(seed, speed as usize, start_level)));
}

#[no_mangle]
pub extern "C" fn rr_new_game() {
    with(|g| g.new_game());
}

/// Runs one timer tick and returns the delay until the next one, in ms.
#[no_mangle]
pub extern "C" fn rr_tick() -> u32 {
    with(|g| {
        g.tick();
        g.tick_ms()
    })
}

#[no_mangle]
pub extern "C" fn rr_tick_ms() -> u32 {
    with(|g| g.tick_ms())
}

/// One step of the mouse; `dir` is 0..8 clockwise from north.
#[no_mangle]
pub extern "C" fn rr_input(dir: u32) {
    if let Some(d) = Dir::from_index(dir as u8) {
        with(|g| g.input(d));
    }
}

#[no_mangle]
pub extern "C" fn rr_set_paused(paused: u32) {
    with(|g| g.set_paused(paused != 0));
}

#[no_mangle]
pub extern "C" fn rr_set_speed(speed: u32) {
    with(|g| g.set_speed(speed as usize));
}

#[no_mangle]
pub extern "C" fn rr_set_start_level(level: i32) {
    with(|g| g.set_start_level(level));
}

#[no_mangle]
pub extern "C" fn rr_skip_level() {
    with(|g| g.skip_level());
}

/// Pointer to the 23×23 row-major tile ids.
#[no_mangle]
pub extern "C" fn rr_field_ptr() -> *const u8 {
    GAME.with(|g| g.borrow().as_ref().map_or(core::ptr::null(), |g| g.field().as_bytes().as_ptr()))
}

#[no_mangle]
pub extern "C" fn rr_take_events() -> u32 {
    with(|g| g.take_events())
}

#[no_mangle]
pub extern "C" fn rr_mode() -> u32 {
    with(|g| g.mode() as u32)
}

#[no_mangle]
pub extern "C" fn rr_paused() -> u32 {
    with(|g| g.paused() as u32)
}

#[no_mangle]
pub extern "C" fn rr_level() -> i32 {
    with(|g| g.level())
}

#[no_mangle]
pub extern "C" fn rr_lives() -> i32 {
    with(|g| g.lives())
}

/// The score as a double: exact far beyond any reachable score.
#[no_mangle]
pub extern "C" fn rr_score() -> f64 {
    with(|g| g.score() as f64)
}

#[no_mangle]
pub extern "C" fn rr_minute() -> i32 {
    with(|g| g.minute())
}

#[no_mangle]
pub extern "C" fn rr_second() -> i32 {
    with(|g| g.second())
}

#[no_mangle]
pub extern "C" fn rr_next_wave_minute() -> i32 {
    with(|g| g.next_wave_minute())
}

#[no_mangle]
pub extern "C" fn rr_mouse_x() -> i32 {
    with(|g| g.mouse().0)
}

#[no_mangle]
pub extern "C" fn rr_mouse_y() -> i32 {
    with(|g| g.mouse().1)
}

#[no_mangle]
pub extern "C" fn rr_stunned() -> u32 {
    with(|g| g.stunned() as u32)
}
