// Wiring: the game timer, input, drawing, the game-over sequence, the
// phone niceties (auto-pause when hidden, keep the screen awake, haptics)
// and the computer layout (menu bar, mouse, optional pad).

import { EVENT, MODE, loadCore } from "./core.js";
import { createInput } from "./input.js";
import { createRenderer } from "./render.js";
import { addScore, loadSettings, qualifies, saveSettings } from "./store.js";
import { createUI } from "./ui.js";

const $ = (id) => document.getElementById(id);
const app = $("app");
const coarse = matchMedia("(pointer: coarse)").matches;
// Must match the desktop media query in style.css.
const desktopQuery = matchMedia("(hover: hover) and (pointer: fine) and (min-width: 720px) and (min-height: 540px)");
let desktop = desktopQuery.matches;

let settings = loadSettings();
app.dataset.pad = settings.padSide;
app.dataset.desktopPad = settings.desktopPad ? "on" : "off";

const core = await loadCore();
core.init(settings.speed, settings.startLevel);

const renderer = createRenderer({ board: $("board"), lives: $("lives"), clock: $("clock"), score: $("score") });

let pausedByDialog = false;
let gameOver = null; // the running game-over sequence
let continueGameOver = null; // resolves the "Game Over" wait

const isPlaying = (st = core.state()) => st.mode !== MODE.DEMO && st.mode !== MODE.END_GAME;

function update(patch) {
  settings = { ...settings, ...patch };
  saveSettings(settings);
  if ("speed" in patch) core.setSpeed(settings.speed);
  if ("startLevel" in patch) core.setStartLevel(settings.startLevel);
  if ("padSide" in patch) app.dataset.pad = settings.padSide;
  if ("desktopPad" in patch) app.dataset.desktopPad = settings.desktopPad ? "on" : "off";
  if ("speed" in patch) armTimer(); // a new speed applies at once, as in the original
  requestDraw();
}

function newGame() {
  if (gameOver) return;
  input.releaseAll();
  core.newGame();
  armTimer();
  requestDraw();
}

function setPaused(paused) {
  if (!isPlaying() || gameOver) return;
  core.setPaused(paused);
  if (paused) input.releaseAll();
  else armTimer();
  requestDraw();
}

const ui = createUI({
  settings: () => settings,
  update,
  actions: {
    newGame,
    canResume: () => isPlaying() && !gameOver,
    isPaused: () => core.state().paused,
    togglePause: () => setPaused(!core.state().paused),
  },
  onModal(open) {
    if (open) {
      input.releaseAll();
      if (isPlaying() && !core.state().paused && !gameOver) {
        core.setPaused(true);
        pausedByDialog = true;
      }
    } else if (pausedByDialog) {
      pausedByDialog = false;
      core.setPaused(false);
      armTimer();
    }
    requestDraw();
  },
});

const vibrate = (pattern) => {
  if (settings.haptics && navigator.vibrate) navigator.vibrate(pattern);
};

function handleEvents(ev) {
  if (!ev) return;
  if (ev & EVENT.CAUGHT) vibrate([60, 40, 140]);
  else if (ev & EVENT.LEVEL_CLEARED) vibrate([30, 60, 30, 60, 90]);
  else if (ev & EVENT.CATS_TRAPPED) vibrate([20, 40, 20]);
  else if (ev & EVENT.STUCK_IN_HOLE) vibrate(40);
  else if (ev & EVENT.CHEESE) vibrate(15);
  else if (ev & EVENT.PUSH) vibrate(8);
  if (ev & EVENT.GAME_OVER) gameOver = runGameOver();
}

function onStep(dir) {
  if (continueGameOver) return continueGameOver();
  if (gameOver || ui.modal) return;
  const st = core.state();
  if (st.mode === MODE.DEMO) {
    newGame();
    return;
  }
  if (st.paused) {
    setPaused(false);
    input.releaseAll();
    return;
  }
  core.input(dir);
  handleEvents(core.takeEvents());
  // Draw now, inside the input event, so the step shows on the very next
  // frame. (A plain step raises no event, so waiting for one would leave it
  // undrawn until the cats' next tick.)
  draw();
}

function onAction(name) {
  if (name === "menu") {
    if (ui.barOpen) return ui.closeBar();
    if (desktop && !ui.modal) return ui.openBar(0);
    return ui.toggleMenu();
  }
  if (ui.modal) return;
  const st = core.state();
  switch (name) {
    case "new-game":
      return newGame();
    case "pause":
      return setPaused(!st.paused);
    case "skip-level":
      core.skipLevel();
      requestDraw();
      return;
    case "start":
    case "tap":
      if (continueGameOver) return continueGameOver();
      if (st.mode === MODE.DEMO) return newGame();
      if (st.paused) return setPaused(false);
  }
}

const input = createInput({
  deck: $("deck"),
  padHost: $("pad"),
  board: $("board"),
  settings: () => settings,
  mouseCell: () => {
    const st = core.state();
    return { x: st.mouseX, y: st.mouseY };
  },
  onStep,
  onAction,
});

$("menuBtn").addEventListener("click", () => ui.openMenu());
$("pauseBtn").addEventListener("click", () => setPaused(!core.state().paused));

// ---- game over: melt, "Game Over", high scores, back to the title ----

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

async function runGameOver() {
  const st = core.state();
  const score = Math.floor(st.score);
  const level = st.level + 1;
  input.releaseAll();
  await renderer.melt();
  showLabel("Game Over", "");
  await sleep(900);
  if (qualifies(score)) {
    const name = await ui.askName(score, level);
    const entry = { name: name || "Anonymous", score, level, when: Date.now() };
    if (name) update({ lastName: name });
    addScore(entry);
    await ui.showScores(entry);
  } else {
    showLabel("Game Over", words.continueGame);
    await new Promise((resolve) => {
      continueGameOver = resolve;
    });
    continueGameOver = null;
  }
  core.tick(); // EndGame -> the title screen
  core.takeEvents();
  renderer.endMelt();
  gameOver = null;
  requestDraw();
}

// ---- drawing ----

const label = $("label");
function showLabel(top, bottom) {
  label.hidden = !top;
  $("label1").textContent = top ? ` ${top} ` : "";
  $("label2").textContent = bottom;
  $("label2").hidden = !bottom;
}

let wakeLock = null;
async function syncWakeLock(want) {
  if (!navigator.wakeLock) return;
  try {
    if (want && !wakeLock) {
      wakeLock = await navigator.wakeLock.request("screen");
      wakeLock.addEventListener("release", () => (wakeLock = null));
    } else if (!want && wakeLock) {
      await wakeLock.release();
      wakeLock = null;
    }
  } catch {
    // Not allowed right now; the screen may dim.
  }
}

// What the on-field messages tell you to press.
const WORDS = {
  touch: { start: "Tap to start", resume: "Tap to continue.", continueGame: "Tap to continue." },
  desktop: { start: "Press F2 or click to start", resume: "Press F3 or click to continue.", continueGame: "Click or press Enter to continue." },
};
let words = coarse && !desktop ? WORDS.touch : WORDS.desktop;

// Drawing happens only when something changed: straight away for a step,
// otherwise on the next animation frame. With nothing changing, no frames
// are requested at all.
let drawQueued = false;
function requestDraw() {
  if (drawQueued) return;
  drawQueued = true;
  requestAnimationFrame(() => {
    drawQueued = false;
    draw();
  });
}

let lastStatus = "";
function draw() {
  const st = core.state();
  renderer.draw(core.field(), st);

  const status = `${st.mode}|${st.paused}|${st.level}|${!!gameOver}`;
  if (status === lastStatus) return;
  lastStatus = status;
  $("title").textContent = `Rodent's Revenge [${st.level + 1}]`;
  const pauseBtn = $("pauseBtn");
  pauseBtn.classList.toggle("paused", st.paused);
  pauseBtn.setAttribute("aria-label", st.paused ? "Continue" : "Pause");
  pauseBtn.disabled = !isPlaying(st);
  if (!gameOver) {
    if (st.mode === MODE.DEMO) showLabel("Rodent's Revenge", words.start);
    else if (st.paused) showLabel("Paused.", words.resume);
    else showLabel("", "");
  }
  syncWakeLock(isPlaying(st) && !st.paused && !gameOver && document.visibilityState === "visible");
}

// ---- the game timer (the original's `t` timer control) ----
// A plain timer re-armed after every tick with the interval the game asks
// for. It aims at each tick's due time, so a slow device doesn't drift. It
// stops while paused, on the title screen and during game over, so an idle
// game costs nothing.

let tickTimer = 0;
let due = 0;
function armTimer(ms = core.tickMs(), fromDue = false) {
  clearTimeout(tickTimer);
  const now = performance.now();
  due = fromDue && now - due < 200 ? due + ms : now + ms;
  tickTimer = setTimeout(onTick, Math.max(0, due - now));
}

function onTick() {
  tickTimer = 0;
  const st = core.state();
  if (gameOver || st.paused || st.mode === MODE.DEMO) return;
  const ms = core.tick();
  handleEvents(core.takeEvents());
  requestDraw();
  if (!gameOver) armTimer(ms, true);
}

function layout() {
  renderer.resize();
  lastStatus = "";
  requestDraw();
}
new ResizeObserver(layout).observe(app);
desktopQuery.addEventListener("change", (e) => {
  desktop = e.matches;
  words = coarse && !desktop ? WORDS.touch : WORDS.desktop;
  layout();
});
layout();

document.addEventListener("visibilitychange", () => {
  if (document.visibilityState === "hidden") {
    input.releaseAll();
    if (isPlaying() && !gameOver) core.setPaused(true);
  }
  lastStatus = "";
  requestDraw();
});

if ("serviceWorker" in navigator && location.protocol.startsWith("http") && !globalThis.RODENT_WASM) {
  navigator.serviceWorker.register("sw.js").catch(() => {});
}

// `?debug` exposes the core for automated tests and curious players.
if (new URLSearchParams(location.search).has("debug")) globalThis.rodent = { core };
