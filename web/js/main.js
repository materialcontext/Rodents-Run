// Wiring: the game timer, input, drawing, the game-over sequence, and the
// phone niceties (auto-pause when hidden, keep the screen awake, haptics).

import { EVENT, MODE, loadCore } from "./core.js";
import { createInput } from "./input.js";
import { createRenderer } from "./render.js";
import { addScore, loadSettings, qualifies, saveSettings } from "./store.js";
import { createUI } from "./ui.js";

const $ = (id) => document.getElementById(id);
const app = $("app");
const coarse = matchMedia("(pointer: coarse)").matches;

let settings = loadSettings();
app.dataset.pad = settings.padSide;

const core = await loadCore();
core.init(settings.speed, settings.startLevel);

const renderer = createRenderer({ board: $("board"), lives: $("lives"), clock: $("clock"), score: $("score") });

let dirty = true;
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
  dirty = true;
}

function newGame() {
  if (gameOver) return;
  input.releaseAll();
  core.newGame();
  dirty = true;
}

function setPaused(paused) {
  if (!isPlaying() || gameOver) return;
  core.setPaused(paused);
  if (paused) input.releaseAll();
  dirty = true;
}

const ui = createUI({
  settings: () => settings,
  update,
  actions: { newGame, canResume: () => isPlaying() && !gameOver },
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
    }
    dirty = true;
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
  dirty = true;
}

function onStep(dir) {
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
}

function onAction(name) {
  if (name === "menu") return ui.toggleMenu();
  if (ui.modal) return;
  const st = core.state();
  switch (name) {
    case "new-game":
      return newGame();
    case "pause":
      return setPaused(!st.paused);
    case "skip-level":
      core.skipLevel();
      dirty = true;
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
    showLabel("Game Over", coarse ? "Tap to continue." : "Press Enter to continue.");
    await new Promise((resolve) => {
      continueGameOver = resolve;
    });
    continueGameOver = null;
  }
  core.tick(); // EndGame -> the title screen
  core.takeEvents();
  renderer.endMelt();
  gameOver = null;
  dirty = true;
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

let lastStatus = "";
function draw() {
  dirty = false;
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
    if (st.mode === MODE.DEMO) showLabel("Rodent's Revenge", coarse ? "Tap to start" : "Press F2 to start");
    else if (st.paused) showLabel("Paused.", coarse ? "Tap to continue." : "Press F3 to continue.");
    else showLabel("", "");
  }
  syncWakeLock(isPlaying(st) && !st.paused && !gameOver && document.visibilityState === "visible");
}

// ---- the game timer (the original's `t` timer control) ----

let nextTick = performance.now() + core.tickMs();
function frame(now) {
  if (gameOver) {
    nextTick = now + core.tickMs();
  } else if (now >= nextTick) {
    const ms = core.tick();
    nextTick += ms;
    if (now - nextTick > 200) nextTick = now + ms; // fell behind (hidden tab)
    handleEvents(core.takeEvents());
    dirty = true;
  }
  if (dirty) draw();
  requestAnimationFrame(frame);
}

function layout() {
  renderer.resize();
  dirty = true;
  lastStatus = "";
}
new ResizeObserver(layout).observe(app);
layout();
requestAnimationFrame(frame);

document.addEventListener("visibilitychange", () => {
  if (document.visibilityState === "hidden") {
    input.releaseAll();
    if (isPlaying() && !gameOver) core.setPaused(true);
  }
  lastStatus = "";
  dirty = true;
});

if ("serviceWorker" in navigator && location.protocol.startsWith("http") && !globalThis.RODENT_WASM) {
  navigator.serviceWorker.register("sw.js").catch(() => {});
}

// `?debug` exposes the core for automated tests and curious players.
if (new URLSearchParams(location.search).has("debug")) globalThis.rodent = { core };
