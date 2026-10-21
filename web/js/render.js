// Drawing: the 23×23 field, the HUD strip (spare lives, stopwatch, score)
// and the game-over melt. The field is redrawn only when it changes.

import { ART, FORM, PALETTE, T, buildTiles } from "./sprites.js";
import { FIELD_SIZE } from "./core.js";

const SPARE_SLOTS = 5;

export function createRenderer({ board, lives, clock, score }) {
  const g = board.getContext("2d");
  let tile = 0;
  let tiles = new Map();
  let hudTiles = new Map();
  let last = null; // field bytes last drawn
  let lastHud = "";
  let melting = false;

  function fitCanvas(canvas, cssW, cssH) {
    const dpr = window.devicePixelRatio || 1;
    canvas.width = Math.round(cssW * dpr);
    canvas.height = Math.round(cssH * dpr);
    canvas.style.width = `${cssW}px`;
    canvas.style.height = `${cssH}px`;
  }

  // Sizes the board to the largest whole-pixel tile that fits its box,
  // preferring an exact multiple of the 16-pixel art (every art pixel the
  // same size) when that gives up little room.
  function resize() {
    const dpr = window.devicePixelRatio || 1;
    const box = board.parentElement.getBoundingClientRect();
    const avail = Math.max(64, Math.min(box.width, box.height));
    tile = Math.max(4, Math.floor((avail * dpr) / FIELD_SIZE));
    const exact = Math.floor(tile / ART) * ART;
    if (exact >= ART && exact >= tile * 0.85) tile = exact;
    const px = tile * FIELD_SIZE;
    board.width = board.height = px;
    board.style.width = board.style.height = `${px / dpr}px`;
    tiles = buildTiles(tile);

    const lb = lives.parentElement.getBoundingClientRect();
    const hudTile = Math.max(12, Math.floor(Math.min(lb.height * 0.62, (lb.width - 8) / SPARE_SLOTS)));
    fitCanvas(lives, hudTile * SPARE_SLOTS, hudTile);
    hudTiles = buildTiles(Math.round(hudTile * dpr), FORM);

    const cb = clock.parentElement.getBoundingClientRect();
    const size = Math.max(28, Math.floor(Math.min(cb.width, cb.height) - 4));
    fitCanvas(clock, size, size);
    last = null;
    lastHud = "";
  }

  function drawField(field) {
    if (melting) return;
    const n = FIELD_SIZE;
    for (let y = 0; y < n; y++) {
      for (let x = 0; x < n; x++) {
        const i = y * n + x;
        const id = field[i];
        if (last && last[i] === id) continue;
        const img = tiles.get(id) ?? tiles.get(T.OPEN);
        g.drawImage(img, x * tile, y * tile);
      }
    }
    last = Uint8Array.from(field);
  }

  function drawLives(spare) {
    const lg = lives.getContext("2d");
    const s = lives.width / SPARE_SLOTS;
    for (let i = 0; i < SPARE_SLOTS; i++) {
      lg.drawImage(hudTiles.get(i < spare ? T.GUY_GREY : T.GREY), Math.round(i * s), 0, Math.round(s), lives.height);
    }
  }

  // The stopwatch: the hour hand counts levels, the minute hand runs once
  // round per level (30 clock minutes), the red hand sweeps each minute,
  // and the blue mark is when the next cats arrive.
  function drawClock(st) {
    const cg = clock.getContext("2d");
    const w = clock.width;
    const c = w / 2;
    const r = w / 2 - Math.max(1, w * 0.03);
    cg.clearRect(0, 0, w, w);
    const lw = Math.max(1, w / 40);

    // crown and bezel
    cg.fillStyle = PALETTE.d;
    cg.fillRect(c - w * 0.07, 0, w * 0.14, w * 0.1);
    cg.beginPath();
    cg.arc(c, c + w * 0.03, r * 0.94, 0, Math.PI * 2);
    cg.fillStyle = PALETTE.d;
    cg.fill();
    const face = r * 0.8;
    const cy = c + w * 0.03;
    cg.beginPath();
    cg.arc(c, cy, face, 0, Math.PI * 2);
    cg.fillStyle = PALETTE.w;
    cg.fill();
    cg.lineWidth = lw;
    cg.strokeStyle = PALETTE.k;
    cg.stroke();

    const at = (frac, len) => {
      const a = frac * Math.PI * 2 - Math.PI / 2;
      return [c + Math.cos(a) * len, cy + Math.sin(a) * len];
    };
    const line = (frac, from, to, colour, width) => {
      const [x1, y1] = at(frac, from);
      const [x2, y2] = at(frac, to);
      cg.beginPath();
      cg.moveTo(x1, y1);
      cg.lineTo(x2, y2);
      cg.strokeStyle = colour;
      cg.lineWidth = width;
      cg.lineCap = "round";
      cg.stroke();
    };
    for (let i = 0; i < 12; i++) line(i / 12, face * 0.82, face * 0.96, PALETTE.k, lw);
    if (st.mode !== 1) line(st.nextWave / 30, face * 0.45, face * 0.98, PALETTE.B, lw * 2.2);

    const minute = Math.min(1, (st.minute + st.second / 30) / 30);
    line(((st.level % 12) + minute) / 12, 0, face * 0.45, PALETTE.k, lw * 2.2);
    line(minute, 0, face * 0.72, PALETTE.k, lw * 1.6);
    line(st.second / 30, 0, face * 0.88, PALETTE.R, lw);
    cg.beginPath();
    cg.arc(c, cy, lw * 1.5, 0, Math.PI * 2);
    cg.fillStyle = PALETTE.k;
    cg.fill();
  }

  function drawHud(st) {
    const key = `${st.lives}|${st.minute}|${st.second}|${st.nextWave}|${st.level}|${st.mode}|${st.score}`;
    if (key === lastHud) return;
    lastHud = key;
    drawLives(Math.min(SPARE_SLOTS, Math.max(0, st.lives - 1)));
    drawClock(st);
    score.textContent = Math.floor(st.score).toLocaleString("en-US");
  }

  // FldMelt: the field slides away in uneven columns, left to right.
  function melt(background = "#ffffff") {
    melting = true;
    const snap = document.createElement("canvas");
    snap.width = board.width;
    snap.height = board.height;
    snap.getContext("2d").drawImage(board, 0, 0);
    const cols = FIELD_SIZE * 2;
    const cw = board.width / cols;
    const start = performance.now();
    const delay = Array.from({ length: cols }, (_, i) => i * 22 + Math.random() * 160);
    const speed = Array.from({ length: cols }, () => 0.6 + Math.random() * 0.9);
    return new Promise((resolve) => {
      function frame(now) {
        const t = now - start;
        g.fillStyle = background;
        g.fillRect(0, 0, board.width, board.height);
        let done = true;
        for (let i = 0; i < cols; i++) {
          const dt = Math.max(0, t - delay[i]);
          const dy = (dt * dt * speed[i] * board.height) / 400000;
          if (dy < board.height) done = false;
          const sx = Math.round(i * cw);
          const sw = Math.round((i + 1) * cw) - sx;
          g.drawImage(snap, sx, 0, sw, board.height, sx, dy, sw, board.height);
        }
        if (done) resolve();
        else requestAnimationFrame(frame);
      }
      requestAnimationFrame(frame);
    });
  }

  return {
    resize,
    draw(field, st) {
      drawField(field);
      drawHud(st);
    },
    melt,
    endMelt() {
      melting = false;
      last = null;
    },
    get tileCss() {
      return tile / (window.devicePixelRatio || 1);
    },
  };
}
