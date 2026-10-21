// Controls. The original moved the mouse one cell per key press, with the
// keyboard's auto-repeat for held keys; every control here produces the
// same thing: discrete steps in one of eight directions.
//
//  - Keyboard: arrows, numpad, Home/PgUp/End/PgDn (as the original), plus
//    WASD with Q/E/Z/C for diagonals.
//  - Thumb pad: an eight-way pad. The whole control deck is its touch area,
//    so the thumb need not land on it exactly; sliding round it changes
//    direction without lifting, and holding repeats like a held key.
//  - Board swipes: drag anywhere on the field; each stretch of travel is one
//    step, and holding after a step repeats it.
//  - Mouse: press on the field and the mouse steps toward the pointer, and
//    keeps walking toward it while the button is held.

export const DIRS = ["N", "NE", "E", "SE", "S", "SW", "W", "NW"];

// Held-direction timing. The original rode the keyboard's typematic repeat,
// which on Windows defaults to a short delay and then about 30 steps a
// second; "fast" matches that, "normal" is a touch gentler for thumbs.
export const REPEAT = {
  off: null,
  slow: { delay: 350, every: 110 },
  normal: { delay: 220, every: 55 },
  fast: { delay: 180, every: 33 },
};

const KEYS = {
  ArrowUp: 0, ArrowRight: 2, ArrowDown: 4, ArrowLeft: 6,
  PageUp: 1, PageDown: 3, End: 5, Home: 7,
  Numpad8: 0, Numpad9: 1, Numpad6: 2, Numpad3: 3,
  Numpad2: 4, Numpad1: 5, Numpad4: 6, Numpad7: 7,
  KeyW: 0, KeyE: 1, KeyD: 2, KeyC: 3, KeyS: 4, KeyZ: 5, KeyA: 6, KeyQ: 7,
};

// Screen vector (y down) to direction 0..7, clockwise from north.
export function vectorToDir(dx, dy) {
  const a = Math.atan2(dx, -dy);
  return (Math.round(a / (Math.PI / 4)) + 8) % 8;
}

// Steps once now, then again while held, like a key's typematic repeat.
function repeater(step, getRepeat) {
  let timer = 0;
  let dir = -1;
  const stop = () => {
    clearTimeout(timer);
    timer = 0;
  };
  return {
    press(d) {
      stop();
      dir = d;
      step(d);
      // The step may have released us (it started a game, say): stay idle.
      const r = getRepeat();
      if (!r || dir !== d) return;
      const again = () => {
        step(dir);
        if (dir === d) timer = setTimeout(again, r.every);
      };
      timer = setTimeout(again, r.delay);
    },
    release() {
      stop();
      dir = -1;
    },
    get dir() {
      return dir;
    },
  };
}

const SVG = "http://www.w3.org/2000/svg";

function el(name, attrs, parent) {
  const e = document.createElementNS(SVG, name);
  for (const [k, v] of Object.entries(attrs)) e.setAttribute(k, v);
  parent?.appendChild(e);
  return e;
}

// The pad: a bevelled grey disc, eight wedges with arrows, a dead centre.
// The disc is drawn once and never repaints. The pressed wedge is one of
// two overlays (a straight one and a diagonal one), each on its own layer,
// that the compositor turns to the direction and shows or hides, so
// pressing costs no painting at all.
const INNER = 30;
const OUTER = 89;

function wedgePath(d) {
  const a0 = ((d - 0.5) * Math.PI) / 4 - Math.PI / 2;
  const a1 = ((d + 0.5) * Math.PI) / 4 - Math.PI / 2;
  const p = (r, a) => `${(r * Math.cos(a)).toFixed(2)} ${(r * Math.sin(a)).toFixed(2)}`;
  return `M${p(INNER, a0)} L${p(OUTER, a0)} A${OUTER} ${OUTER} 0 0 1 ${p(OUTER, a1)} L${p(INNER, a1)} A${INNER} ${INNER} 0 0 0 ${p(INNER, a0)}Z`;
}

function arrowPoints(d) {
  const a = (d * Math.PI) / 4 - Math.PI / 2;
  const r = d % 2 ? 64 : 62;
  const s = d % 2 ? 10 : 12;
  const cx = r * Math.cos(a);
  const cy = r * Math.sin(a);
  const pts = [a, a + 2.3, a - 2.3].map((t) => [cx + s * Math.cos(t), cy + s * Math.sin(t)]);
  return pts.map((q) => q.map((v) => v.toFixed(2)).join(",")).join(" ");
}

function buildPad(host) {
  const svg = el("svg", { viewBox: "-100 -100 200 200", class: "pad-svg", "aria-hidden": "true" });
  const defs = el("defs", {}, svg);
  const bevel = el("linearGradient", { id: "padBevel", x1: "0", y1: "0", x2: "1", y2: "1" }, defs);
  el("stop", { offset: "0", "stop-color": "#ffffff" }, bevel);
  el("stop", { offset: "0.5", "stop-color": "#c0c0c0" }, bevel);
  el("stop", { offset: "1", "stop-color": "#404040" }, bevel);
  el("circle", { r: 98, fill: "url(#padBevel)" }, svg);
  el("circle", { r: 91, fill: "#c0c0c0", stroke: "#000", "stroke-width": 1.5 }, svg);
  for (let d = 0; d < 8; d++) {
    el("polygon", { points: arrowPoints(d), fill: d % 2 ? "#404040" : "#000" }, svg);
    const a = ((d + 0.5) * Math.PI) / 4 - Math.PI / 2;
    el("line", {
      x1: INNER * Math.cos(a), y1: INNER * Math.sin(a), x2: OUTER * Math.cos(a), y2: OUTER * Math.sin(a),
      stroke: "#808080", "stroke-width": 1.2,
    }, svg);
  }
  el("circle", { r: INNER, fill: "url(#padBevel)" }, svg);
  el("circle", { r: INNER - 5, fill: "#c0c0c0" }, svg);

  // Overlays for north (straight) and north-east (diagonal), turned as needed.
  const overlay = (d) => {
    const o = el("svg", { viewBox: "-100 -100 200 200", class: "pad-hl", "aria-hidden": "true" });
    el("path", { d: wedgePath(d), fill: "#000080" }, o);
    el("polygon", { points: arrowPoints(d), fill: "#fff" }, o);
    return o;
  };
  const straight = overlay(0);
  const diagonal = overlay(1);
  host.replaceChildren(svg, straight, diagonal);

  let shown = -1;
  return {
    svg,
    show(dir) {
      if (dir === shown) return;
      shown = dir;
      const diag = dir % 2 === 1;
      straight.style.opacity = dir >= 0 && !diag ? "1" : "0";
      diagonal.style.opacity = diag ? "1" : "0";
      if (dir >= 0) (diag ? diagonal : straight).style.transform = `rotate(${(dir - (dir % 2)) * 45}deg)`;
    },
  };
}

export function createInput({ deck, padHost, board, settings, mouseCell, onStep, onAction }) {
  const repeat = () => REPEAT[settings().repeat] ?? null;
  const pad = buildPad(padHost);

  // ---- keyboard ----
  window.addEventListener("keydown", (e) => {
    if (e.target instanceof HTMLInputElement) return;
    if (e.ctrlKey && e.shiftKey && (e.code === "PageDown" || e.code === "PageUp")) {
      onAction("skip-level");
      e.preventDefault();
      return;
    }
    if (e.ctrlKey || e.metaKey || e.altKey) return;
    const actions = { F2: "new-game", F3: "pause", Escape: "menu", KeyP: "pause", Enter: "start", Space: "start" };
    if (e.code in actions) {
      if (!e.repeat || e.code !== "F3") onAction(actions[e.code]);
      e.preventDefault();
      return;
    }
    const dir = KEYS[e.code];
    if (dir !== undefined) {
      onStep(dir);
      e.preventDefault();
    }
  });

  // ---- thumb pad ----
  const padRep = repeater(onStep, repeat);
  let padPointer = null;
  let padRect = null; // measured once per touch: reading layout mid-gesture is slow
  const padDir = (e) => {
    const r = padRect;
    const dx = e.clientX - (r.left + r.width / 2);
    const dy = e.clientY - (r.top + r.height / 2);
    const dead = (r.width / 2) * 0.26;
    return dx * dx + dy * dy < dead * dead ? -1 : vectorToDir(dx, dy);
  };
  const padUpdate = (e) => {
    const d = padDir(e);
    if (d === padRep.dir) return;
    if (d < 0) padRep.release();
    else padRep.press(d);
    pad.show(d);
  };
  deck.addEventListener("pointerdown", (e) => {
    if (padPointer !== null || e.target.closest("button")) return;
    padPointer = e.pointerId;
    padRect = pad.svg.getBoundingClientRect();
    deck.setPointerCapture(e.pointerId);
    padUpdate(e);
    e.preventDefault();
  });
  deck.addEventListener("pointermove", (e) => {
    if (e.pointerId === padPointer) padUpdate(e);
  });
  const padEnd = (e) => {
    if (e.pointerId !== padPointer) return;
    padPointer = null;
    padRep.release();
    pad.show(-1);
  };
  deck.addEventListener("pointerup", padEnd);
  deck.addEventListener("pointercancel", padEnd);
  deck.addEventListener("lostpointercapture", padEnd);

  // ---- mouse: walk toward the pointer ----
  let aim = null; // { id, x, y, timer }
  let boardRect = null; // measured once per press
  const aimDir = () => {
    const r = boardRect;
    const cell = r.width / 23;
    const { x, y } = mouseCell();
    const dx = aim.x - (r.left + (x + 0.5) * cell);
    const dy = aim.y - (r.top + (y + 0.5) * cell);
    if (Math.abs(dx) < cell / 2 && Math.abs(dy) < cell / 2) return -1; // on the mouse
    return vectorToDir(dx, dy);
  };
  const aimStep = () => {
    const d = aimDir();
    if (d >= 0) onStep(d);
  };
  const aimEnd = (e) => {
    if (!aim || e.pointerId !== aim.id) return;
    clearTimeout(aim.timer);
    aim = null;
  };
  function aimStart(e) {
    aim = { id: e.pointerId, x: e.clientX, y: e.clientY, timer: 0 };
    boardRect = board.getBoundingClientRect();
    board.setPointerCapture(e.pointerId);
    const d = aimDir();
    // A click on the mouse itself starts, resumes or continues, like a tap.
    if (d < 0) onAction("tap");
    else onStep(d);
    const r = repeat();
    if (!r || !aim) return;
    const again = () => {
      if (!aim) return;
      aimStep();
      aim.timer = setTimeout(again, r.every);
    };
    aim.timer = setTimeout(again, r.delay);
  }
  board.addEventListener("contextmenu", (e) => e.preventDefault());

  // ---- board swipes ----
  const swipeRep = repeater(onStep, repeat);
  let swipe = null; // { id, x, y, moved, t }
  // A little under one cell of travel per step, so the mouse keeps up with
  // the finger, but never so short that a tap jitters.
  const stepLength = () => Math.max(14, Math.min(32, (boardRect.width / 23) * 0.85));
  board.addEventListener("pointerdown", (e) => {
    if (e.pointerType === "mouse") {
      if (e.button === 0 && !aim) aimStart(e);
      e.preventDefault();
      return;
    }
    if (swipe) return;
    swipe = { id: e.pointerId, x: e.clientX, y: e.clientY, moved: false, t: performance.now() };
    boardRect = board.getBoundingClientRect();
    board.setPointerCapture(e.pointerId);
    e.preventDefault();
  });
  board.addEventListener("pointermove", (e) => {
    if (aim && e.pointerId === aim.id) {
      aim.x = e.clientX;
      aim.y = e.clientY;
      return;
    }
    if (!swipe || e.pointerId !== swipe.id || !settings().swipe) return;
    const dx = e.clientX - swipe.x;
    const dy = e.clientY - swipe.y;
    const len = stepLength();
    if (dx * dx + dy * dy < len * len) return;
    swipe.x = e.clientX;
    swipe.y = e.clientY;
    swipe.moved = true;
    swipeRep.press(vectorToDir(dx, dy));
  });
  const swipeEnd = (e) => {
    if (!swipe || e.pointerId !== swipe.id) return;
    const tap = !swipe.moved && performance.now() - swipe.t < 500;
    swipe = null;
    swipeRep.release();
    if (tap && e.type === "pointerup") onAction("tap");
  };
  for (const type of ["pointerup", "pointercancel", "lostpointercapture"]) {
    board.addEventListener(type, (e) => {
      aimEnd(e);
      if (type !== "lostpointercapture") swipeEnd(e);
    });
  }

  return {
    releaseAll() {
      padRep.release();
      swipeRep.release();
      if (aim) aimEnd({ pointerId: aim.id });
      pad.show(-1);
    },
  };
}
