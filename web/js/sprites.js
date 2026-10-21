// 16×16 pixel art in the Windows 3.1 16-colour palette, drawn in the style
// of the 1991 game (these are new drawings, not the original bitmaps).
// Keys are the core's tile ids; '.' is transparent and shows the floor.

export const ART = 16;

export const PALETTE = {
  k: "#000000", w: "#ffffff", s: "#c0c0c0", d: "#808080",
  r: "#800000", R: "#ff0000", o: "#808000", Y: "#ffff00",
  g: "#008000", G: "#00ff00", t: "#008080", C: "#00ffff",
  n: "#000080", B: "#0000ff", p: "#800080", M: "#ff00ff",
};

export const FLOOR = PALETTE.o;
export const FORM = PALETTE.s;

export const T = {
  OPEN: 0x00, BLOCK: 0x01, WALL: 0x02, VERT: 0x03, HORZ: 0x04, HOLE: 0x05,
  TRAP: 0x06, CHEESE: 0x07, HOLE_GUY: 0x08, KAT: 0x10, YARN: 0x11,
  YARN2: 0x12, YARN3: 0x13, YARN_LAST: 0x14, GUY_GREY: 0x15, GREY: 0x16,
  KAT_SLEEP: 0x17, GUY: 0x20, DEAD1: 0x21, DEAD2: 0x22, DEAD3: 0x23,
  DEAD4: 0x24, DEAD: 0x25,
};

const MOUSE = [
  "................",
  "................",
  "................",
  "..........kk....",
  ".........ksdk...",
  "..kk.....kssk...",
  ".k......kksskk..",
  ".k...kkkssssssk.",
  ".k..kssssssskssk",
  "..kksssssssssssR",
  "....kssssssssskk",
  ".....kssssssskk.",
  "......kkkkkkk...",
  "......k.k..k.k..",
  ".....k.k..k.k...",
  "................",
];

const WALL = [
  "CCCCCCCCCCCCCCCt",
  "CCCCCCCCCCCCCCtt",
  "CCssssssssssssst",
  "CCssssssssssssst",
  "CCsstttttttCssst",
  "CCsstssssssCssst",
  "CCsstssssssCssst",
  "CCsstssddssCssst",
  "CCsstssddssCssst",
  "CCsstssssssCssst",
  "CCsstssssssCssst",
  "CCsstCCCCCCCssst",
  "CCssssssssssssst",
  "CCssssssssssssst",
  "Cttttttttttttttt",
  "tttttttttttttttt",
];

// A ball stirring inside the border: the wall's face turns to yarn.
const wallWithBall = (stripes) => WALL.map((row, y) => {
  if (y < 4 || y > 11) return row;
  const ball = stripes[y - 4];
  return row.slice(0, 4) + ball + row.slice(12);
});

export const SPRITES = {
  [T.OPEN]: [],
  [T.BLOCK]: [
    "GGGGGGGGGGGGGGGd",
    "Ggggsggggggsgggd",
    "Ggggsgggggsggggd",
    "Gggsggggggsggggd",
    "Gsssggggsssssggd",
    "Ggggsssssgggsssd",
    "Gggsgggggsggggsd",
    "Ggsgggggggsgggsd",
    "Ggsgggggggsggsgd",
    "Gsssgggggsssssgd",
    "Ggggssssgsggggsd",
    "Ggggsgggsgggggsd",
    "Gggsggggsggggsgd",
    "Gggsgggsgggggsgd",
    "Gssssssgggggsggd",
    "dddddddddddddddd",
  ],
  [T.WALL]: WALL,
  [T.HORZ]: wallWithBall([
    ".pMMMMp.", "pMMpMMMp", "MMpMMpMM", "MpMMMMpM", "MMMMpMMM", "MpMMpMMM", "pMMMMpMp", ".pMMMMp.",
  ]),
  [T.VERT]: wallWithBall([
    ".pMMMMp.", "pMpMMpMp", "MMpMMpMM", "MMpMMpMM", "MMpMMpMM", "MMpMMpMM", "pMpMMpMp", ".pMMMMp.",
  ]),
  [T.HOLE]: [
    "................",
    "................",
    "................",
    "................",
    "....dddddddd....",
    "..ddkkkkkkkkdd..",
    ".dkkggggggggkkd.",
    ".dkgggggggggggd.",
    "dkkkgggggggggkkd",
    "dkkkkkkkkkkkkkkd",
    "dkkkkkkkkkkkkkkd",
    ".dkkkkkkkkkkkkd.",
    ".ddkkkkkkkkkkdd.",
    "...dddkkkkddd...",
    "......dddd......",
    "................",
  ],
  [T.TRAP]: [
    "................",
    ".......kk.......",
    "......kYYk......",
    ".....kYYYYk.....",
    "....kYnnnnYk....",
    "...kYnYYYYnYk...",
    "..kYYnYYYYnYYk..",
    ".kYYYnYsRYnYYYk.",
    "kYYYYnYsRYnYYYYk",
    ".kYYYnYYYYnYYYk.",
    "..kYYnnnnnnYYk..",
    "...kYYYYYYYYkd..",
    "....kYYYYYYkd...",
    ".....kYYYYkd....",
    "......kkkkd.....",
    "................",
  ],
  [T.CHEESE]: [
    "................",
    "................",
    "................",
    "..............k.",
    "...........kkkYk",
    "........kkkYYYYk",
    ".....kkkYYYoYYYk",
    "..kkkYYYYYYYYYYk",
    ".kYYYYoYYYYYYoYk",
    ".kkkkkkkkkkkkkkk",
    ".kYYYYYYYYYYYYYk",
    ".kYYoYYYYYYYoYYk",
    ".kYYYYYYoYYYYYYk",
    ".kkkkkkkkkkkkkkk",
    "................",
    "................",
  ],
  [T.HOLE_GUY]: [
    "................",
    "................",
    "..........kk....",
    ".........kssk...",
    ".........ksdk...",
    "....dddkkkskkk..",
    "..ddkkksssssskk.",
    ".dkkgksssssssksk",
    ".dkggksssssssssR",
    "dkkkgkssssssskkd",
    "dkkkkkksssskkkkd",
    "dkkkkkkkkkkkkkkd",
    ".dkkkkkkkkkkkkd.",
    ".ddkkkkkkkkkkdd.",
    "...dddkkkkddd...",
    "......dddd......",
  ],
  [T.KAT]: [
    "...........k...k",
    "..........kYk.kY",
    "..k.......kYYkYY",
    ".k........kYYYYY",
    ".k........YBYYBY",
    ".k........YYYYYY",
    "..k.......kYRRYk",
    "..k...kkkkkYYYk.",
    "...kkkYYYYYYYYk.",
    "....kYYYYYYYYYk.",
    "....kYYYYYYYYk..",
    "....kYYYYYYYYk..",
    "....kYkkkkkkYk..",
    "....kYk....kYk..",
    "....kYk....kYk..",
    "...kk.....kk....",
  ],
  [T.KAT_SLEEP]: [
    "................",
    "................",
    "................",
    "................",
    "...........k...k",
    "..........kYk.kY",
    "..........kYYkYY",
    "..........kYYYYY",
    "..k.......YkkYkk",
    ".k...kkkkkYYYYYY",
    ".k..kYYYYYkYRRYk",
    "..kkYYYYYYYYYYk.",
    "....kYYYYYYYYYYk",
    "...kYYYYYYYYYYYk",
    "...kkkkkkkkkkkk.",
    "................",
  ],
  [T.YARN]: [
    "................",
    "................",
    ".....pppppp.....",
    "....pMMMMMMp....",
    "...pMMpMMMMMp...",
    "..pMMpMMMpMMMp..",
    "..pMpMMMpMMpMp..",
    "..pMpMMpMMpMMp..",
    "..pMMMpMMpMMMp..",
    "..pMMpMMpMMpMp..",
    "..pMpMMpMMMMMp..",
    "...pMMMMMpMMp...",
    "....pMMMMMMp....",
    ".....pppppp.....",
    "................",
    "................",
  ],
  [T.YARN2]: [
    "................",
    "................",
    "................",
    ".....p.pp.p.....",
    "....pMMMMMMp....",
    "...pMMpMMMpMp...",
    "...MpMMMpMMpM...",
    "...pMMMpMMpMp...",
    "...MMpMMpMMMM...",
    "...pMpMMMMpMp...",
    "....pMMMpMMp....",
    ".....p.pp.p.....",
    "................",
    "................",
    "................",
    "................",
  ],
  [T.YARN3]: [
    "................",
    "................",
    "................",
    "................",
    "......p..p......",
    ".....pM.MMp.....",
    "....p.MpM.Mp....",
    "....MM.MpM.M....",
    "....pM.MM.Mp....",
    ".....pM.MMp.....",
    "......p..p......",
    "................",
    "................",
    "................",
    "................",
    "................",
  ],
  [T.YARN_LAST]: [
    "................",
    "................",
    "................",
    "................",
    "................",
    ".......p........",
    ".....M...M......",
    "........p.......",
    "......M...M.....",
    "........M.......",
    "................",
    "................",
    "................",
    "................",
    "................",
    "................",
  ],
  [T.GUY]: MOUSE,
  [T.DEAD1]: [
    "................",
    "................",
    "................",
    "..........k.....",
    ".........s.k....",
    "..k......k.s....",
    ".k......k.k.k.k.",
    ".k...k.k.s.s.k.k",
    "..k.k.s.s.s.s.k.",
    "...k.s.s.s.s.s.R",
    "....k.s.s.s.sk..",
    ".....k.s.s.s....",
    "......k.k.k.....",
    "......k...k.k...",
    ".....k.k.....k..",
    "................",
  ],
  [T.DEAD2]: [
    "................",
    "................",
    "................",
    "................",
    "......s...s.....",
    "....s..s.s..s...",
    "......s.d.s.....",
    "...s.s.d.d.s.s..",
    ".....d.dsd.d....",
    "...s.s.d.d.s.s..",
    "......s.d.s.....",
    "....s..s.s..s...",
    "......s...s.....",
    "................",
    "................",
    "................",
  ],
  [T.DEAD3]: [
    "................",
    ".w.....s.....w..",
    "..w....s....w...",
    "...s...s...s....",
    "....s..d..s.....",
    ".....s.d.s......",
    "......sds.......",
    ".sssddswsddsss..",
    "......sds.......",
    ".....s.d.s......",
    "....s..d..s.....",
    "...s...s...s....",
    "..w....s....w...",
    ".w.....s.....w..",
    "................",
    "................",
  ],
  [T.DEAD4]: [
    "................",
    "................",
    "....s...s...s...",
    "................",
    "......s.d.s.....",
    "..s.............",
    "....d..s.s..d...",
    "......d.w.d...s.",
    "..s.d..s.s..d...",
    "................",
    "......s.d.s.....",
    "..............s.",
    "....s...s...s...",
    "................",
    "................",
    "................",
  ],
  [T.DEAD]: [
    "................",
    "................",
    "................",
    "................",
    "........s.......",
    "...s............",
    "............s...",
    ".......d........",
    "................",
    ".....s.....d....",
    "................",
    "..d.......s.....",
    "................",
    "................",
    "................",
    "................",
  ],
};

// HUD tiles drawn on the form's grey rather than the floor.
const LIFE_BG = "s";
SPRITES[T.GUY_GREY] = MOUSE.map((row) => row.replaceAll(".", LIFE_BG));
SPRITES[T.GREY] = Array(ART).fill(LIFE_BG.repeat(ART));

function validate() {
  for (const [id, rows] of Object.entries(SPRITES)) {
    if (rows.length === 0) continue;
    if (rows.length !== ART || rows.some((r) => r.length !== ART)) {
      throw new Error(`sprite ${id} is not ${ART}x${ART}`);
    }
    for (const r of rows) for (const c of r) {
      if (c !== "." && !(c in PALETTE)) throw new Error(`sprite ${id}: colour '${c}'`);
    }
  }
}
validate();

// Floor-backed sprites at `size` device pixels, keyed by tile id. Each
// art pixel covers an integer span so rows and columns stay crisp.
export function buildTiles(size, background = FLOOR) {
  const out = new Map();
  const edges = Array.from({ length: ART + 1 }, (_, i) => Math.round((i * size) / ART));
  for (const [key, rows] of Object.entries(SPRITES)) {
    const c = document.createElement("canvas");
    c.width = c.height = size;
    const g = c.getContext("2d");
    g.fillStyle = background;
    g.fillRect(0, 0, size, size);
    rows.forEach((row, y) => {
      for (let x = 0; x < ART; x++) {
        const ch = row[x];
        if (ch === ".") continue;
        g.fillStyle = PALETTE[ch];
        g.fillRect(edges[x], edges[y], edges[x + 1] - edges[x], edges[y + 1] - edges[y]);
      }
    });
    out.set(Number(key), c);
  }
  return out;
}
