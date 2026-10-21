// Drawing: the 23×23 field, the HUD strip (spare lives, stopwatch, score)
// and the game-over melt.
//
// Built to cost next to nothing per frame. The field and the lives are drawn
// at the original's own resolution (16 pixels a tile, 368×368 for the
// field) and enlarged by the compositor with nearest-neighbour scaling, so a
// step redraws a few 16×16 tiles and the browser copies a 0.5 MB canvas
// rather than one the size of the screen. Each part redraws only when what
// it shows has changed.

import { ART, FORM, PALETTE, T, buildTiles } from "./sprites.js";
import { FIELD_SIZE } from "./core.js";

const SPARE_SLOTS = 5;
const FIELD_PX = FIELD_SIZE * ART;

export function createRenderer({ board, lives, clock, score }) {
  board.width = board.height = FIELD_PX;
  const g = board.getContext("2d", { alpha: false });
  const tiles = buildTiles(ART);

  lives.width = SPARE_SLOTS * ART;
  lives.height = ART;
  const lg = lives.getContext("2d", { alpha: false });
  const hudTiles = buildTiles(ART, FORM);

  const last = new Uint8Array(FIELD_SIZE * FIELD_SIZE); // field as last drawn
  let fieldValid = false;
  let lastSpare = -1;
  let lastClock = "";
  let lastScore = -1;
  let melting = false;

  // Device pixels for a CSS length, so canvases land on whole pixels.
  const dpr = () => window.devicePixelRatio || 1;

  // The field fills its box. When a whole number of screen pixels per art
  // pixel fits with little room lost, use exactly that, so every art pixel
  // is the same size.
  function resize() {
    const box = board.parentElement.getBoundingClientRect();
    let device = Math.floor(Math.max(64, Math.min(box.width, box.height)) * dpr());
    const whole = Math.floor(device / FIELD_PX) * FIELD_PX;
    if (whole >= FIELD_PX && whole >= device * 0.85) device = whole;
    board.style.width = board.style.height = `${device / dpr()}px`;

    const lb = lives.parentElement.getBoundingClientRect();
    const hudTile = Math.max(12, Math.floor(Math.min(lb.height * 0.62, (lb.width - 8) / SPARE_SLOTS)));
    lives.style.width = `${hudTile * SPARE_SLOTS}px`;
    lives.style.height = `${hudTile}px`;

    // The stopwatch is drawn with smooth lines, so at screen resolution.
    const cb = clock.parentElement.getBoundingClientRect();
    const size = Math.max(28, Math.floor(Math.min(cb.width, cb.height) - 4));
    const px = Math.round(size * dpr());
    if (clock.width !== px) {
      clock.width = clock.height = px;
      clock.style.width = clock.style.height = `${size}px`;
      lastClock = "";
    }
  }

  function drawField(field) {
    if (melting) return;
    const n = FIELD_SIZE;
    for (let i = 0; i < n * n; i++) {
      const id = field[i];
      if (fieldValid && last[i] === id) continue;
      last[i] = id;
      g.drawImage(tiles.get(id) ?? tiles.get(T.OPEN), (i % n) * ART, ((i / n) | 0) * ART);
    }
    fieldValid = true;
  }

  function drawLives(spare) {
    if (spare === lastSpare) return;
    lastSpare = spare;
    for (let i = 0; i < SPARE_SLOTS; i++) lg.drawImage(hudTiles.get(i < spare ? T.GUY_GREY : T.GREY), i * ART, 0);
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
    drawLives(Math.min(SPARE_SLOTS, Math.max(0, st.lives - 1)));
    const clockKey = `${st.minute}|${st.second}|${st.nextWave}|${st.level}|${st.mode === 1}`;
    if (clockKey !== lastClock) {
      lastClock = clockKey;
      drawClock(st);
    }
    const points = Math.floor(st.score);
    if (points !== lastScore) {
      lastScore = points;
      score.textContent = points.toLocaleString("en-US");
    }
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
      fieldValid = false;
    },
  };
}
