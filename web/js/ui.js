// Menus and dialogs: the game menu, controls, high scores, name entry.

import { SPEED_NAMES, loadScores } from "./store.js";

const $ = (id) => document.getElementById(id);

export function createUI({ settings, update, actions, onModal }) {
  const dialogs = ["menuDlg", "controlsDlg", "scoresDlg", "nameDlg", "helpDlg", "aboutDlg"].map($);
  let open = 0;

  for (const dlg of dialogs) {
    dlg.addEventListener("close", () => {
      open = Math.max(0, open - 1);
      if (open === 0) onModal(false);
    });
    // Tapping the backdrop closes, as tapping outside a sheet does.
    dlg.addEventListener("click", (e) => {
      if (e.target === dlg && dlg.id !== "nameDlg") dlg.close();
    });
    dlg.querySelectorAll('[data-act="close"]').forEach((b) => b.addEventListener("click", () => dlg.close()));
  }

  function show(dlg) {
    if (dlg.open) return;
    if (open === 0) onModal(true);
    open++;
    dlg.showModal();
  }

  // ---- game menu ----
  const speedSeg = $("speedSeg");
  SPEED_NAMES.forEach((name, i) => {
    const b = document.createElement("button");
    b.textContent = name;
    b.dataset.speed = i;
    b.addEventListener("click", () => {
      update({ speed: i });
      syncMenu();
    });
    speedSeg.append(b);
  });

  const menu = $("menuDlg");
  const startLevel = $("startLevel");
  function syncMenu() {
    const s = settings();
    speedSeg.querySelectorAll("button").forEach((b) => b.setAttribute("aria-pressed", String(+b.dataset.speed === s.speed)));
    startLevel.value = String(s.startLevel + 1);
    startLevel.textContent = String(s.startLevel + 1);
    $("resumeItem").hidden = !actions.canResume();
  }
  const menuActs = {
    "new-game": () => {
      menu.close();
      actions.newGame();
    },
    resume: () => menu.close(),
    "level-down": () => {
      update({ startLevel: Math.max(0, settings().startLevel - 1) });
      syncMenu();
    },
    "level-up": () => {
      update({ startLevel: Math.min(49, settings().startLevel + 1) });
      syncMenu();
    },
    controls: () => {
      syncControls();
      show($("controlsDlg"));
    },
    scores: () => showScores(),
    help: () => show($("helpDlg")),
    about: () => show($("aboutDlg")),
  };
  menu.querySelectorAll("[data-act]").forEach((b) => {
    const act = menuActs[b.dataset.act];
    if (act) b.addEventListener("click", act);
  });

  // ---- controls ----
  const padSeg = $("padSeg");
  const repeatSeg = $("repeatSeg");
  function syncControls() {
    const s = settings();
    padSeg.querySelectorAll("button").forEach((b) => b.setAttribute("aria-pressed", String(b.dataset.pad === s.padSide)));
    repeatSeg.querySelectorAll("button").forEach((b) => b.setAttribute("aria-pressed", String(b.dataset.repeat === s.repeat)));
    $("swipeChk").checked = s.swipe;
    $("hapticChk").checked = s.haptics;
  }
  padSeg.querySelectorAll("button").forEach((b) =>
    b.addEventListener("click", () => {
      update({ padSide: b.dataset.pad });
      syncControls();
    }));
  repeatSeg.querySelectorAll("button").forEach((b) =>
    b.addEventListener("click", () => {
      update({ repeat: b.dataset.repeat });
      syncControls();
    }));
  $("swipeChk").addEventListener("change", (e) => update({ swipe: e.target.checked }));
  $("hapticChk").addEventListener("change", (e) => update({ haptics: e.target.checked }));

  // ---- high scores ----
  function fill(list, entries, highlight) {
    list.replaceChildren();
    if (entries.length === 0) {
      const li = document.createElement("li");
      li.className = "empty";
      li.textContent = "No scores yet.";
      list.append(li);
      return;
    }
    entries.forEach((e, i) => {
      const li = document.createElement("li");
      if (highlight && e.when === highlight.when && e.score === highlight.score) li.className = "new";
      const rank = document.createElement("span");
      rank.className = "rank";
      rank.textContent = `${i + 1}.`;
      const who = document.createElement("span");
      who.className = "who";
      who.textContent = e.name || "Anonymous";
      const lvl = document.createElement("span");
      lvl.className = "lvl";
      lvl.textContent = `L${e.level}`;
      const pts = document.createElement("b");
      pts.textContent = e.score.toLocaleString("en-US");
      li.append(rank, who, lvl, pts);
      list.append(li);
    });
  }
  function showScores(highlight) {
    const { allTime, today } = loadScores();
    fill($("allTime"), allTime, highlight);
    fill($("today"), today, highlight);
    const dlg = $("scoresDlg");
    show(dlg);
    return new Promise((resolve) => dlg.addEventListener("close", resolve, { once: true }));
  }

  // ---- name entry ----
  function askName(score, level) {
    const dlg = $("nameDlg");
    const input = $("nameInput");
    $("nameScore").textContent = score.toLocaleString("en-US");
    $("nameLevel").textContent = String(level);
    input.value = settings().lastName;
    show(dlg);
    input.focus();
    input.select();
    return new Promise((resolve) => {
      dlg.addEventListener("close", () => resolve(input.value.trim().slice(0, 24)), { once: true });
    });
  }

  return {
    openMenu() {
      syncMenu();
      show(menu);
    },
    toggleMenu() {
      if (menu.open) menu.close();
      else this.openMenu();
    },
    showScores,
    askName,
    get modal() {
      return open > 0;
    },
  };
}
