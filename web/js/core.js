// The Rust game core (rodent-core) compiled to WebAssembly, behind a small
// JS facade. The single-file build embeds the module as base64 in
// `globalThis.RODENT_WASM`; the served build fetches `rodent.wasm`.

export const MODE = {
  DEMO: 1, BEGIN_GAME: 2, BEGIN_LEVEL: 3, RESTART: 4, BEGIN: 5, PLAY: 6,
  PLAY_FAST: 7, YARN: 8, DYING: 9, END: 10, END_LEVEL: 11, END_GAME: 12,
};

export const EVENT = {
  PUSH: 1 << 0, CHEESE: 1 << 1, CATS_TRAPPED: 1 << 2, CAUGHT: 1 << 3,
  LIFE_LOST: 1 << 4, LEVEL_CLEARED: 1 << 5, GAME_OVER: 1 << 6,
  YARN_ROLLING: 1 << 7, STUCK_IN_HOLE: 1 << 8, CATS_ARRIVED: 1 << 9,
  LEVEL_STARTED: 1 << 10, BUMP: 1 << 11,
};

export const FIELD_SIZE = 23;

async function wasmBytes() {
  if (globalThis.RODENT_WASM) {
    const bin = atob(globalThis.RODENT_WASM);
    const bytes = new Uint8Array(bin.length);
    for (let i = 0; i < bin.length; i++) bytes[i] = bin.charCodeAt(i);
    return bytes;
  }
  const res = await fetch(new URL("../rodent.wasm", import.meta.url));
  if (!res.ok) throw new Error(`rodent.wasm: ${res.status}`);
  return res.arrayBuffer();
}

export async function loadCore() {
  const { instance } = await WebAssembly.instantiate(await wasmBytes(), {});
  const x = instance.exports;
  const seed = () => [
    (Math.random() * 2 ** 32) >>> 0,
    (Date.now() ^ (Math.random() * 2 ** 32)) >>> 0,
  ];
  return {
    init(speed, startLevel) {
      const [lo, hi] = seed();
      x.rr_init(lo, hi, speed, startLevel);
    },
    newGame: () => x.rr_new_game(),
    tick: () => x.rr_tick(),
    tickMs: () => x.rr_tick_ms(),
    input: (dir) => x.rr_input(dir),
    setPaused: (p) => x.rr_set_paused(p ? 1 : 0),
    setSpeed: (s) => x.rr_set_speed(s),
    setStartLevel: (l) => x.rr_set_start_level(l),
    skipLevel: () => x.rr_skip_level(),
    takeEvents: () => x.rr_take_events(),
    // A fresh view each call: memory can grow and detach older views.
    field: () => new Uint8Array(x.memory.buffer, x.rr_field_ptr(), FIELD_SIZE * FIELD_SIZE),
    state: () => ({
      mode: x.rr_mode(),
      paused: x.rr_paused() !== 0,
      level: x.rr_level(),
      lives: x.rr_lives(),
      score: x.rr_score(),
      minute: x.rr_minute(),
      second: x.rr_second(),
      nextWave: x.rr_next_wave_minute(),
      mouseX: x.rr_mouse_x(),
      mouseY: x.rr_mouse_y(),
      stunned: x.rr_stunned() !== 0,
    }),
  };
}
