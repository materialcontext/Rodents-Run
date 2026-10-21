// Settings and high scores, kept in this browser. Storage can be missing
// (private mode, blocked site data), so every access falls back quietly.

const SETTINGS_KEY = "rodent.settings.v1";
const SCORES_KEY = "rodent.scores.v1";
const DAY_MS = 24 * 60 * 60 * 1000;
const TABLE_SIZE = 10;

export const SPEED_NAMES = ["Snail", "Slow", "Medium", "Fast", "Blazing"];

export const DEFAULT_SETTINGS = {
  speed: 1, // Slow, the original's default
  startLevel: 0,
  padSide: "center", // portrait: left | center | right; landscape: left | right
  swipe: true, // drag on the board to move
  repeat: "normal", // held direction: off | slow | normal | fast
  haptics: true,
  desktopPad: false, // computers: show the direction pad beside the field
  lastName: "",
};

function read(key, fallback) {
  try {
    const raw = localStorage.getItem(key);
    return raw ? JSON.parse(raw) : fallback;
  } catch {
    return fallback;
  }
}

function write(key, value) {
  try {
    localStorage.setItem(key, JSON.stringify(value));
  } catch {
    // Not saved; the game still plays.
  }
}

export function loadSettings() {
  return { ...DEFAULT_SETTINGS, ...read(SETTINGS_KEY, {}) };
}

export function saveSettings(settings) {
  write(SETTINGS_KEY, settings);
}

// The Entertainment Pack score dialog kept two tables: the best games ever
// and the best of the past 24 hours.
function tables(all, now) {
  const byScore = (a, b) => b.score - a.score || a.when - b.when;
  return {
    allTime: [...all].sort(byScore).slice(0, TABLE_SIZE),
    today: all.filter((e) => now - e.when < DAY_MS).sort(byScore).slice(0, TABLE_SIZE),
  };
}

const readScores = () => read(SCORES_KEY, []).filter((e) => e && typeof e.score === "number");

export function loadScores(now = Date.now()) {
  return tables(readScores(), now);
}

export function qualifies(score, now = Date.now()) {
  if (score <= 0) return false;
  const { allTime, today } = loadScores(now);
  const makes = (t) => t.length < TABLE_SIZE || score > t[t.length - 1].score;
  return makes(allTime) || makes(today);
}

export function addScore(entry) {
  const all = [...readScores(), entry];
  const { allTime, today } = tables(all, entry.when);
  // Keep only what either table can still show.
  const keep = new Set([...allTime, ...today]);
  write(SCORES_KEY, all.filter((e) => keep.has(e)));
}
