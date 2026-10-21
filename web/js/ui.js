// Menus and dialogs: the menu bar (computers), the game menu (phones),
// controls, starting level, high scores, name entry.

import { SPEED_NAMES, loadScores } from "./store.js";

const $ = (id) => document.getElementById(id);

export function createUI({ settings, update, actions, onModal }) {
  const dialogs = ["menuDlg", "levelDlg", "controlsDlg", "scoresDlg", "nameDlg", "helpDlg", "aboutDlg"].map($);

  // Open menus and dialogs hold the game paused; the last to close lets go.
  let open = 0;
  const hold = () => {
    if (open++ === 0) onModal(true);
  };
  const release = () => {
    open = Math.max(0, open - 1);
    if (open === 0) onModal(false);
  };

  for (const dlg of dialogs) {
    dlg.addEventListener("close", release);
    // Tapping the backdrop closes, as tapping outside a sheet does.
    dlg.addEventListener("click", (e) => {
      if (e.target === dlg && dlg.id !== "nameDlg") dlg.close();
    });
    dlg.querySelectorAll('[data-act="close"]').forEach((b) => b.addEventListener("click", () => dlg.close()));
  }

  function show(dlg) {
    if (dlg.open) return;
    hold();
    dlg.showModal();
  }

  // ---- starting level ----
  const levelOut = $("levelOut");
  const syncLevel = () => {
    levelOut.textContent = String(settings().startLevel + 1);
  };
  const stepLevel = (d) => {
    update({ startLevel: Math.min(49, Math.max(0, settings().startLevel + d)) });
    syncLevel();
  };
  $("levelDown").addEventListener("click", () => stepLevel(-1));
  $("levelUp").addEventListener("click", () => stepLevel(1));
  function showLevel() {
    syncLevel();
    show($("levelDlg"));
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

  // ---- menu bar (computers) ----
  // Behaves like a Windows menu bar: click a title to drop its menu, slide
  // across titles while one is open, arrow keys to move, Esc or a click
  // elsewhere to close, Alt+underlined letter or F10 to open from the keyboard.
  const bar = $("menubar");
  const items = [...bar.querySelectorAll(".mb-item")];
  const titleOf = (i) => items[i].querySelector(".mb-title");
  const dropOf = (i) => items[i].querySelector(".mb-drop");
  const entriesOf = (i) => [...dropOf(i).querySelectorAll("button:not([disabled])")];
  let current = -1;

  const commands = {
    "new-game": () => actions.newGame(),
    pause: () => actions.togglePause(),
    scores: () => showScores(),
    level: () => showLevel(),
    controls: () => {
      syncControls();
      show($("controlsDlg"));
    },
    help: () => show($("helpDlg")),
    about: () => show($("aboutDlg")),
  };

  function syncBar() {
    const s = settings();
    bar.querySelectorAll("[data-speed]").forEach((b) => b.setAttribute("aria-checked", String(+b.dataset.speed === s.speed)));
    bar.querySelectorAll("[data-toggle]").forEach((b) => b.setAttribute("aria-checked", String(!!s[b.dataset.toggle])));
    const pause = $("mbPause");
    pause.disabled = !actions.canResume();
    pause.querySelector("span").textContent = actions.isPaused() ? "Continue" : "Pause";
  }

  function closeDrop(i) {
    dropOf(i).hidden = true;
    titleOf(i).setAttribute("aria-expanded", "false");
  }
  function openDrop(i, focusFirst) {
    i = (i + items.length) % items.length;
    if (current === i) return;
    if (current < 0) hold();
    else closeDrop(current);
    current = i;
    syncBar();
    dropOf(i).hidden = false;
    titleOf(i).setAttribute("aria-expanded", "true");
    if (focusFirst) entriesOf(i)[0]?.focus();
    else titleOf(i).focus({ preventScroll: true });
  }
  function closeBar() {
    if (current < 0) return;
    closeDrop(current);
    current = -1;
    document.activeElement?.blur?.();
    release();
  }

  items.forEach((_, i) => {
    const t = titleOf(i);
    t.addEventListener("click", () => (current === i ? closeBar() : openDrop(i, false)));
    t.addEventListener("pointerenter", () => {
      if (current >= 0 && current !== i) openDrop(i, false);
    });
    dropOf(i).addEventListener("click", (e) => {
      const b = e.target.closest("button");
      if (!b || b.disabled) return;
      closeBar();
      if (b.dataset.speed) update({ speed: +b.dataset.speed });
      else if (b.dataset.toggle) update({ [b.dataset.toggle]: !settings()[b.dataset.toggle] });
      else commands[b.dataset.cmd]?.();
    });
  });
  document.addEventListener("pointerdown", (e) => {
    if (current >= 0 && !bar.contains(e.target)) closeBar();
  });
  bar.addEventListener("keydown", (e) => {
    if (current < 0) return;
    const list = entriesOf(current);
    const at = list.indexOf(document.activeElement);
    const keys = {
      ArrowDown: () => list[(at + 1) % list.length]?.focus(),
      ArrowUp: () => list[(at - 1 + list.length) % list.length]?.focus(),
      ArrowRight: () => openDrop(current + 1, true),
      ArrowLeft: () => openDrop(current - 1, true),
      Escape: () => closeBar(),
      Tab: () => closeBar(),
    };
    if (keys[e.key]) {
      keys[e.key]();
      e.preventDefault();
      e.stopPropagation();
    }
  });
  window.addEventListener("keydown", (e) => {
    if (open > 0 && current < 0) return; // a dialog has the keyboard
    const letter = { g: 0, o: 1, h: 2 }[e.key.toLowerCase()];
    if ((e.altKey && letter !== undefined) || (e.key === "F10" && !e.shiftKey)) {
      openDrop(letter ?? 0, true);
      e.preventDefault();
      e.stopPropagation();
    }
  }, true);

  return {
    openBar(i = 0) {
      openDrop(i, true);
    },
    closeBar,
    get barOpen() {
      return current >= 0;
    },
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
