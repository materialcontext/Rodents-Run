//! The game: a transcription of the original's timer-driven mode machine
//! (`t_timer` / `ModeSet` in RODENT2.FRM). Names in comments are the
//! original procedure and variable names.
//!
//! The host calls [`Game::tick`] every [`Game::tick_ms`] milliseconds, and
//! [`Game::input`] on every key press (the mouse moves on input, not on the
//! timer, exactly as the original moved on each `KeyDown`).

use crate::dir::Dir;
use crate::field::{Field, CENTRE, LAST, SIZE};
use crate::rng::Rng;
use crate::room::{self, Room};
use crate::tile::Tile;

/// `mpitime`: the cats' base tick for Snail, Slow, Medium, Fast and Blazing.
pub const SPEED_MS: [u32; 5] = [2000, 1000, 500, 275, 180];
/// The original's default speed (Slow).
pub const DEFAULT_SPEED: usize = 1;
/// Levels offered as starting points; play continues past the last one.
pub const START_LEVELS: i32 = 50;

/// `cbadMaxC`: cats and yarn balls on the board at once.
const MAX_BADS: usize = 20;
/// Yarn balls are not added once this many bad guys are out.
const MAX_BADS_FOR_YARN: usize = MAX_BADS - 3;
const START_LIVES: i32 = 3;
/// Ticks the mouse stays stuck in a sink hole.
const HOLE_STUN: i32 = 10;
/// The clock runs 30 minutes of 30 ticks each.
const LAST_MINUTE: i32 = 30;
const LAST_WAVE_MINUTE: i32 = 25;
const TICKS_PER_MINUTE: i32 = 30;

#[derive(Clone, Copy, PartialEq, Eq, Debug)]
#[repr(u8)]
pub enum Mode {
    /// Title screen: the starting level is shown, nothing moves.
    Demo = 1,
    BeginGame,
    BeginLevel,
    /// The mouse was just put back after losing a life.
    Restart,
    /// A batch of cats is about to arrive.
    Begin,
    Play,
    /// Every cat is trapped: the clock races to the next batch (or level end).
    PlayFast,
    /// A yarn ball is rolling.
    Yarn,
    Dying,
    /// The clock reached the next batch while racing.
    End,
    EndLevel,
    EndGame,
}

impl Mode {
    /// `mpmodetime`: modes with their own timer interval. The others keep
    /// the interval that was running when they started.
    const fn tick_ms(self) -> Option<u32> {
        match self {
            Mode::Demo => Some(500),
            Mode::BeginGame | Mode::BeginLevel | Mode::Begin | Mode::Dying | Mode::EndLevel | Mode::EndGame => {
                Some(100)
            }
            Mode::PlayFast | Mode::Yarn => Some(50),
            Mode::Restart | Mode::Play | Mode::End => None,
        }
    }

    /// Modes in which the player's moves count.
    pub const fn accepts_input(self) -> bool {
        !matches!(self, Mode::Demo | Mode::BeginGame | Mode::Dying | Mode::EndGame)
    }
}

/// Things that happened since the host last asked, for sound, haptics and UI.
pub mod event {
    pub const PUSH: u32 = 1 << 0;
    pub const CHEESE: u32 = 1 << 1;
    /// Every cat was trapped and turned into cheese.
    pub const CATS_TRAPPED: u32 = 1 << 2;
    /// The mouse was caught (death animation starts).
    pub const CAUGHT: u32 = 1 << 3;
    pub const LIFE_LOST: u32 = 1 << 4;
    pub const LEVEL_CLEARED: u32 = 1 << 5;
    pub const GAME_OVER: u32 = 1 << 6;
    pub const YARN_ROLLING: u32 = 1 << 7;
    pub const STUCK_IN_HOLE: u32 = 1 << 8;
    pub const CATS_ARRIVED: u32 = 1 << 9;
    pub const LEVEL_STARTED: u32 = 1 << 10;
    /// The mouse tried to move but nothing gave way.
    pub const BUMP: u32 = 1 << 11;
}

#[derive(Clone, Copy, PartialEq, Eq, Debug)]
pub enum BadKind {
    Cat,
    /// `aim` (0..=4) picks how eagerly the ball fires at the mouse.
    Yarn {
        aim: i32,
    },
}

impl BadKind {
    const fn pending_slot(self) -> usize {
        match self {
            BadKind::Cat => 0,
            BadKind::Yarn { .. } => 1,
        }
    }
}

/// `GUYTYPE`: a cat or yarn ball.
#[derive(Clone, Copy, Debug)]
pub struct Bad {
    pub x: i32,
    pub y: i32,
    pub ch: Tile,
    pub kind: BadKind,
}

#[derive(Clone, Copy, Debug)]
struct Mouse {
    x: i32,
    y: i32,
    ch: Tile,
}

/// The rolling yarn ball's direction and the tile it is covering
/// (`YarnMove`'s statics).
#[derive(Clone, Copy, Debug)]
struct Flight {
    dx: i32,
    dy: i32,
    under: Tile,
}

/// `YarnFillDir`: directions whose neighbour is inside the border and not a
/// block or wall.
#[derive(Clone, Copy, Default)]
struct DirSet {
    list: [Option<Dir>; 8],
    len: usize,
    ok: [bool; 8],
}

impl DirSet {
    fn pick(&self, rng: &mut Rng) -> Dir {
        self.list[rng.my_rand(self.len as i32) as usize].expect("pick from a non-empty set")
    }
}

#[derive(Clone)]
pub struct Game {
    rng: Rng,
    field: Field,
    mode: Mode,
    paused: bool,
    level: i32,
    start_level: i32,
    room: Room,
    minute: i32,
    second: i32,
    lives: i32,
    speed: usize,
    stun: i32,
    score: i64,
    /// Fractional score in 1/10000 points (VB `Currency`).
    score_frac: i64,
    tick_ms: u32,
    /// `modYarn`: yarn-mode ticks per cat move.
    yarn_every: u32,
    yarn_tick: u32,
    mouse: Mouse,
    bads: Vec<Bad>,
    /// `cbadPending`: half-cats and half-balls carried between batches.
    /// It is a `Static` in the original, so it carries across levels too.
    pending: [i32; 2],
    /// `ibadYarn`: the ball that has fired; blocks others from firing.
    yarn_armed: Option<usize>,
    dir_yarn: Dir,
    flight: Option<Flight>,
    /// `BadFMoveKat`'s neighbour list, reshuffled a little on every use.
    cat_dirs: [(i32, i32); 8],
    events: u32,
}

const fn sgn(v: i32) -> i32 {
    (v > 0) as i32 - (v < 0) as i32
}

/// VB `CInt`: round half to even.
fn cint(v: f64) -> i64 {
    let floor = v.floor();
    let diff = v - floor;
    let r = if diff > 0.5 || (diff == 0.5 && floor.rem_euclid(2.0) == 1.0) { floor + 1.0 } else { floor };
    r as i64
}

impl Game {
    /// A game showing `start_level` (0-based) on the title screen.
    pub fn new(seed: u64, speed: usize, start_level: i32) -> Game {
        let mut cat_dirs = [(0, 0); 8];
        let mut i = 0;
        for dx in -1..=1 {
            for dy in -1..=1 {
                if dx != 0 || dy != 0 {
                    cat_dirs[i] = (dx, dy);
                    i += 1;
                }
            }
        }
        let mut game = Game {
            rng: Rng::new(seed),
            field: Field::default(),
            mode: Mode::Demo,
            paused: false,
            level: start_level.max(0),
            start_level: start_level.max(0),
            room: room::room_for(start_level),
            minute: 0,
            second: 0,
            lives: START_LIVES,
            speed: speed.min(SPEED_MS.len() - 1),
            stun: 0,
            score: 0,
            score_frac: 0,
            tick_ms: 500,
            yarn_every: 1,
            yarn_tick: 0,
            mouse: Mouse { x: CENTRE, y: CENTRE, ch: Tile::GUY },
            bads: Vec::with_capacity(MAX_BADS),
            pending: [0; 2],
            yarn_armed: None,
            dir_yarn: Dir::N,
            flight: None,
            cat_dirs,
            events: 0,
        };
        game.set_mode(Mode::Demo);
        game
    }

    // ---- host interface -------------------------------------------------

    /// `uNew_Click`.
    pub fn new_game(&mut self) {
        self.paused = false;
        self.set_mode(Mode::BeginGame);
    }

    /// `uSpeed_Click`.
    pub fn set_speed(&mut self, speed: usize) {
        self.speed = speed.min(SPEED_MS.len() - 1);
        if self.mode == Mode::Play {
            self.set_timer();
        }
    }

    /// The starting level (0-based); redraws the title screen.
    pub fn set_start_level(&mut self, level: i32) {
        self.start_level = level.max(0);
        if self.mode == Mode::Demo {
            self.level_new(Some(self.start_level));
        }
    }

    /// Ctrl+Shift+PgDn: skips to the next level mid-game.
    pub fn skip_level(&mut self) {
        if self.mode == Mode::Demo {
            self.set_start_level(self.start_level + 1);
        } else {
            self.set_mode(Mode::BeginLevel);
        }
    }

    /// `uPause_Click` (F3).
    pub fn set_paused(&mut self, paused: bool) {
        if self.mode != Mode::Demo {
            self.paused = paused;
        }
    }

    /// `fld_KeyDown`: one step of the mouse.
    pub fn input(&mut self, dir: Dir) {
        if self.paused || !self.mode.accepts_input() {
            return;
        }
        self.guy_move(dir);
    }

    /// `t_timer`: one tick of the game timer.
    pub fn tick(&mut self) {
        if self.paused {
            return;
        }
        match self.mode {
            Mode::Demo => {}
            Mode::BeginGame => self.set_mode(Mode::BeginLevel),
            Mode::BeginLevel => self.set_mode(Mode::Begin),
            Mode::Restart => {
                self.time_add(1);
                self.set_mode(Mode::Play);
            }
            Mode::Begin => {
                self.bad_new(self.room.batch, BadKind::Cat);
                if self.level > 3 {
                    self.bad_new(2, BadKind::Yarn { aim: 0 });
                }
                self.set_mode(Mode::Play);
            }
            Mode::Play => {
                self.yarn_armed = None;
                self.bad_move();
                self.time_add(1);
                let sign = if self.minute == LAST_MINUTE { -2.0 } else { 1.0 };
                self.score_add(66.67 / self.tick_ms as f64 * sign);
            }
            Mode::PlayFast => {
                self.bad_move();
                self.second -= self.second % 5;
                self.time_add(5);
                if self.minute >= LAST_WAVE_MINUTE {
                    self.score_add(0.67);
                }
                if self.minute >= LAST_MINUTE {
                    self.set_mode(Mode::EndLevel);
                }
                if self.minute <= LAST_WAVE_MINUTE && self.second == 0 && self.min_mod() == 0 {
                    self.set_mode(Mode::End);
                }
            }
            Mode::Yarn => {
                self.yarn_move();
                self.yarn_tick = (self.yarn_tick + 1) % self.yarn_every.max(1);
                if self.yarn_tick == 0 {
                    self.bad_move();
                    self.time_add(1);
                    let sign = if self.minute == LAST_MINUTE { -1.0 } else { 1.0 };
                    self.score_add(200.0 / self.tick_ms as f64 * sign);
                }
            }
            Mode::Dying => {
                if self.mouse.ch.0 < Tile::DEAD.0 {
                    self.mouse.ch = self.mouse.ch.next();
                    self.field.set(self.mouse.x, self.mouse.y, self.mouse.ch);
                } else {
                    self.field.set(self.mouse.x, self.mouse.y, Tile::OPEN);
                    self.guy_kill();
                }
            }
            Mode::End => {
                self.time_add(1);
                self.set_mode(Mode::Begin);
            }
            Mode::EndLevel => {
                self.score_add(100.0 * (self.level + 1) as f64);
                self.events |= event::LEVEL_CLEARED;
                self.set_mode(Mode::BeginLevel);
            }
            Mode::EndGame => self.set_mode(Mode::Demo),
        }
    }

    pub fn take_events(&mut self) -> u32 {
        std::mem::take(&mut self.events)
    }

    // ---- read-only state ------------------------------------------------

    pub fn field(&self) -> &Field {
        &self.field
    }
    pub fn mode(&self) -> Mode {
        self.mode
    }
    pub fn paused(&self) -> bool {
        self.paused
    }
    /// 0-based level number.
    pub fn level(&self) -> i32 {
        self.level
    }
    pub fn start_level(&self) -> i32 {
        self.start_level
    }
    pub fn room(&self) -> &Room {
        &self.room
    }
    /// Lives left, counting the mouse on the board.
    pub fn lives(&self) -> i32 {
        self.lives
    }
    pub fn score(&self) -> i64 {
        self.score
    }
    pub fn speed(&self) -> usize {
        self.speed
    }
    pub fn minute(&self) -> i32 {
        self.minute
    }
    pub fn second(&self) -> i32 {
        self.second
    }
    pub fn stunned(&self) -> bool {
        self.stun != 0
    }
    pub fn mouse(&self) -> (i32, i32) {
        (self.mouse.x, self.mouse.y)
    }
    pub fn bads(&self) -> &[Bad] {
        &self.bads
    }
    /// The interval until the next [`Game::tick`] (`timeG`).
    pub fn tick_ms(&self) -> u32 {
        self.tick_ms
    }
    /// The clock minute at which the next cats arrive, or 30 (level end)
    /// when no more waves are due.
    pub fn next_wave_minute(&self) -> i32 {
        let interval = self.room.interval;
        let next = (self.minute / interval + 1) * interval;
        if next <= LAST_WAVE_MINUTE {
            next
        } else {
            LAST_MINUTE
        }
    }

    // ---- ModeSet ----------------------------------------------------------

    fn set_mode(&mut self, mode: Mode) {
        match mode {
            Mode::Demo => {
                self.minute = 0;
                self.second = 0;
                self.lives = START_LIVES;
                self.level_new(Some(self.start_level));
                self.yarn_armed = None;
            }
            Mode::BeginGame => {
                self.lives = START_LIVES;
                self.score = 0;
                self.level = self.start_level - 1;
            }
            Mode::BeginLevel => {
                self.level_new(None);
                self.minute = 0;
                self.second = 0;
                self.bads.clear();
                self.guy_new(false);
                self.yarn_armed = None;
                self.events |= event::LEVEL_STARTED;
            }
            Mode::Restart => {
                self.second = 0;
                self.minute -= self.min_mod();
                self.guy_new(true);
                self.yarn_armed = None;
                self.stun = 0;
            }
            Mode::Play => self.set_timer(),
            Mode::Yarn => self.events |= event::YARN_ROLLING,
            Mode::Dying => self.events |= event::CAUGHT,
            Mode::EndGame => self.events |= event::GAME_OVER,
            Mode::Begin | Mode::PlayFast | Mode::End | Mode::EndLevel => {}
        }
        self.mode = mode;
        if let Some(ms) = mode.tick_ms() {
            self.tick_ms = ms;
        }
    }

    /// `SetTimer`: cats speed up with the level and with each wave.
    fn set_timer(&mut self) {
        let base = SPEED_MS[self.speed] as f64;
        let waves = self.minute / self.room.interval;
        self.tick_ms = cint(base * 0.98f64.powi(self.level) * 0.945f64.powi(waves)).max(1) as u32;
        self.yarn_every = 2 * self.tick_ms / 50;
    }

    fn min_mod(&self) -> i32 {
        self.minute % self.room.interval
    }

    fn time_add(&mut self, seconds: i32) {
        self.second += seconds;
        if self.second >= TICKS_PER_MINUTE {
            self.minute = (self.minute + self.second / TICKS_PER_MINUTE).min(LAST_MINUTE);
            self.second %= TICKS_PER_MINUTE;
        }
    }

    /// `ScoreAdd`: accumulates in `Currency` and never drops below zero.
    fn score_add(&mut self, points: f64) {
        self.score_frac += cint(points * 10_000.0);
        let whole = self.score_frac.div_euclid(10_000);
        self.score = (self.score + whole).max(0);
        self.score_frac -= whole * 10_000;
    }

    // ---- level and mouse --------------------------------------------------

    /// `LevelNew`: `None` advances to the next level.
    fn level_new(&mut self, level: Option<i32>) {
        self.field.fill(Tile::OPEN);
        self.level = level.unwrap_or(self.level + 1);
        self.room = room::room_for(self.level);
        room::draw(&mut self.field, self.level, &self.room, &mut self.rng);
    }

    /// `GuyNew`: back in the centre, or somewhere random if a bad guy is near.
    fn guy_new(&mut self, avoid_bads: bool) {
        let (mut x, mut y) = (CENTRE, CENTRE);
        self.mouse.ch = Tile::GUY;
        if avoid_bads {
            let mut tries = 50;
            let mut i = 0;
            while i < self.bads.len() {
                let b = self.bads[i];
                let (dx, dy) = (b.x - x, b.y - y);
                if dx * dx + dy * dy < tries {
                    x = self.rng.my_rand(SIZE - 2) + 1;
                    y = self.rng.my_rand(SIZE - 2) + 1;
                    tries -= 1;
                    i = 0;
                    continue;
                }
                self.field.set(b.x, b.y, b.ch);
                i += 1;
            }
        }
        self.field.set(x, y, Tile::GUY);
        self.mouse.x = x;
        self.mouse.y = y;
    }

    /// `GuyKill`.
    fn guy_kill(&mut self) {
        self.lives -= 1;
        self.events |= event::LIFE_LOST;
        self.set_mode(if self.lives <= 0 { Mode::EndGame } else { Mode::Restart });
    }

    fn step_mouse(&mut self, x: i32, y: i32, ch: Tile) {
        self.field.set(self.mouse.x, self.mouse.y, Tile::OPEN);
        self.mouse.x = x;
        self.mouse.y = y;
        self.field.set(x, y, ch);
    }

    /// `GuyMove`.
    fn guy_move(&mut self, dir: Dir) {
        if self.stun != 0 {
            return;
        }
        let (dx, dy) = (dir.dx(), dir.dy());
        let (x, y) = (self.mouse.x + dx, self.mouse.y + dy);
        match self.field.get(x, y) {
            Tile::OPEN => self.step_mouse(x, y, Tile::GUY),
            Tile::BLOCK => {
                if self.push(Tile::BLOCK, x, y, dx, dy) {
                    self.events |= event::PUSH;
                    self.step_mouse(x, y, Tile::GUY);
                } else {
                    self.events |= event::BUMP;
                }
            }
            Tile::TRAP => {
                self.step_mouse(x, y, Tile::GUY);
                self.set_mode(Mode::Dying);
            }
            Tile::HOLE => {
                self.stun = HOLE_STUN;
                self.events |= event::STUCK_IN_HOLE;
                self.step_mouse(x, y, Tile::HOLE_GUY);
            }
            Tile::CHEESE => {
                self.score_add((100 + 25 * self.level) as f64);
                self.events |= event::CHEESE;
                self.step_mouse(x, y, Tile::GUY);
            }
            _ => self.events |= event::BUMP,
        }
    }

    /// `FPushBlock`: moves a row of blocks (and any cat that can't get out of
    /// the way) one cell along. `(x, y)` is the first cell of the row.
    fn push(&mut self, ch: Tile, x: i32, y: i32, dx: i32, dy: i32) -> bool {
        let (mut x, mut y) = (x + dx, y + dy);
        loop {
            match self.field.get(x, y) {
                Tile::OPEN | Tile::CHEESE => {
                    self.field.set(x, y, ch);
                    return true;
                }
                Tile::HOLE => {
                    // Blocks vanish into holes; a pushed cat covers it.
                    if ch != Tile::BLOCK {
                        self.field.set(x, y, ch);
                    }
                    return true;
                }
                Tile::KAT => {
                    let Some(i) = self.bads.iter().position(|b| b.x == x && b.y == y) else {
                        return false;
                    };
                    if !self.kat_move(i) {
                        continue; // the cat stepped aside: look again
                    }
                    let pushed = self.push(Tile::KAT, x, y, dx, dy);
                    if pushed {
                        self.field.set(x, y, ch);
                        self.bads[i].x += dx;
                        self.bads[i].y += dy;
                    }
                    return pushed;
                }
                Tile::BLOCK if ch != Tile::BLOCK => {
                    let pushed = self.push(Tile::BLOCK, x, y, dx, dy);
                    if pushed {
                        self.field.set(x, y, ch);
                    }
                    return pushed;
                }
                Tile::BLOCK => {
                    x += dx;
                    y += dy;
                }
                _ => return false,
            }
        }
    }

    // ---- cats and yarn ----------------------------------------------------

    /// `BadNew`: adds `count` half-cats (or half-balls).
    fn bad_new(&mut self, count: i32, kind: BadKind) {
        let slot = kind.pending_slot();
        self.pending[slot] += count;
        if self.pending[slot] < 2 {
            return;
        }
        let n = self.pending[slot] / 2;
        self.pending[slot] -= 2 * n;
        if n as usize + self.bads.len() > MAX_BADS {
            return;
        }
        match kind {
            BadKind::Cat => {
                for _ in 0..n {
                    let Some((x, y)) = self.cat_spawn_cell() else {
                        break;
                    };
                    self.bads.push(Bad { x, y, ch: Tile::KAT, kind });
                    self.field.set(x, y, Tile::KAT);
                }
                self.events |= event::CATS_ARRIVED;
            }
            BadKind::Yarn { .. } => {
                if self.bads.len() + n as usize > MAX_BADS_FOR_YARN {
                    return;
                }
                for _ in 0..n {
                    let kinds = (self.level - 2).min(5);
                    let aim = if kinds > 0 { self.rng.my_rand(kinds) } else { 0 };
                    let mut x = self.rng.my_rand(SIZE);
                    let mut y = x;
                    if self.rng.rnd() < 0.25 {
                        x = 0;
                    } else if self.rng.rnd() < 0.333333 {
                        x = LAST;
                    } else if self.rng.rnd() < 0.5 {
                        y = 0;
                    } else {
                        y = LAST;
                    }
                    // Hidden in the border, looking like wall until it stirs.
                    self.bads.push(Bad { x, y, ch: Tile::WALL, kind: BadKind::Yarn { aim } });
                }
            }
        }
    }

    /// A random open cell at least 10 cells from the mouse.
    fn cat_spawn_cell(&mut self) -> Option<(i32, i32)> {
        let (mx, my) = (self.mouse.x, self.mouse.y);
        let far = |x: i32, y: i32| (x - mx).pow(2) + (y - my).pow(2) >= 100;
        for _ in 0..10_000 {
            let x = self.rng.my_rand(SIZE);
            let y = self.rng.my_rand(SIZE);
            if self.field.get(x, y) == Tile::OPEN && far(x, y) {
                return Some((x, y));
            }
        }
        // A crowded board: the original would search forever; take the
        // open cell furthest from the mouse instead.
        (0..SIZE * SIZE)
            .map(|i| (i % SIZE, i / SIZE))
            .filter(|&(x, y)| self.field.get(x, y) == Tile::OPEN)
            .max_by_key(|&(x, y)| (x - mx).pow(2) + (y - my).pow(2))
    }

    /// `BadMove`: one step for every cat and yarn ball.
    fn bad_move(&mut self) {
        if self.stun != 0 {
            self.stun -= 1;
            if self.stun == 0 {
                self.field.set(self.mouse.x, self.mouse.y, Tile::GUY);
            }
        }
        if self.second == 0 && self.minute != 0 && self.min_mod() == 0 && self.minute <= LAST_WAVE_MINUTE {
            self.bad_new(self.room.wave, BadKind::Cat);
        }
        if self.level > 2 && self.rng.rnd() < 1.0 - 0.99f64.powi(self.level) {
            self.bad_new(1, BadKind::Yarn { aim: 0 });
        }

        let mut stuck = 0;
        for i in 0..self.bads.len() {
            let b = self.bads[i];
            match b.kind {
                BadKind::Yarn { .. } => {
                    stuck += 1;
                    self.bad_move_yarn(i);
                }
                BadKind::Cat => {
                    if self.mode == Mode::Yarn && self.field.get(b.x, b.y).is_yarn() {
                        continue; // the ball is rolling over this cat
                    }
                    if self.kat_move(i) {
                        stuck += 1;
                    }
                }
            }
        }

        // No cat could move: they are trapped together, whatever the shape
        // of their prison, and all turn to cheese at once.
        if stuck == self.bads.len() {
            if self.mode != Mode::PlayFast {
                self.set_mode(Mode::PlayFast);
            }
            let before = self.bads.len();
            let field = &mut self.field;
            self.bads.retain(|b| {
                let cat = b.kind == BadKind::Cat;
                if cat {
                    field.set(b.x, b.y, Tile::CHEESE);
                }
                !cat
            });
            if self.bads.len() != before {
                self.events |= event::CATS_TRAPPED;
            }
        }
    }

    /// `BadFMoveKat`: returns true when the cat could not move (it sleeps).
    fn kat_move(&mut self, i: usize) -> bool {
        let Bad { x: bx, y: by, .. } = self.bads[i];
        let (mx, my) = (self.mouse.x, self.mouse.y);
        let (sx, sy) = (sgn(mx - bx), sgn(my - by));
        let open = |game: &Game, x: i32, y: i32| game.field.get(x, y).cat_can_enter();

        let mut dest = None;
        // Usually straight at the mouse: diagonally, else along one axis.
        if self.rng.rnd() >= 0.1 {
            dest = if open(self, bx + sx, by + sy) {
                Some((bx + sx, by + sy))
            } else if self.rng.rnd() < 0.5 && open(self, bx, by + sy) {
                Some((bx, by + sy))
            } else if open(self, bx + sx, by) {
                Some((bx + sx, by))
            } else if open(self, bx, by + sy) {
                Some((bx, by + sy))
            } else {
                None
            };
        }
        // Otherwise a random step that still closes in on one axis.
        if dest.is_none() {
            let dirs = self.fill_dirs(bx, by, true);
            if dirs.len > 0 {
                for _ in 0..8 {
                    let d = dirs.pick(&mut self.rng);
                    let (dx, dy) = (d.dx(), d.dy());
                    if open(self, bx + dx, by + dy) && ((dx != 0 && dx == sx) || (dy != 0 && dy == sy)) {
                        dest = Some((bx + dx, by + dy));
                        break;
                    }
                }
            }
        }
        // Otherwise any free neighbour.
        if dest.is_none() {
            let r1 = self.rng.my_rand(8) as usize;
            let r2 = self.rng.my_rand(8) as usize;
            self.cat_dirs.swap(r1, r2);
            dest = self.cat_dirs.iter().map(|&(dx, dy)| (bx + dx, by + dy)).find(|&(x, y)| open(self, x, y));
        }

        let Some((x, y)) = dest else {
            self.field.set(bx, by, Tile::KAT_SLEEP);
            return true;
        };
        self.field.set(bx, by, Tile::OPEN);
        self.bads[i].x = x;
        self.bads[i].y = y;
        if (x, y) == (mx, my) {
            self.set_mode(Mode::Dying);
        } else {
            self.field.set(x, y, Tile::KAT);
        }
        false
    }

    /// `YarnFillDir`.
    fn fill_dirs(&self, x: i32, y: i32, diagonals: bool) -> DirSet {
        let mut set = DirSet::default();
        for dir in Dir::ALL.into_iter().filter(|d| diagonals || !d.is_diagonal()) {
            let (tx, ty) = (x + dir.dx(), y + dir.dy());
            if tx > 0 && tx < LAST && ty > 0 && ty < LAST {
                let t = self.field.get(tx, ty);
                if t != Tile::BLOCK && t != Tile::WALL {
                    set.list[set.len] = Some(dir);
                    set.len += 1;
                    set.ok[dir.index()] = true;
                }
            }
        }
        set
    }

    /// `BadMoveYarn`: a ball in the wall stirs, shows itself, then may fire.
    fn bad_move_yarn(&mut self, i: usize) {
        let b = self.bads[i];
        let mut ch = b.ch;
        match ch {
            Tile::WALL => {
                if self.rng.rnd() < 0.1 {
                    ch = if b.x == 0 || b.x == LAST { Tile::HORZ } else { Tile::VERT };
                }
            }
            Tile::HORZ | Tile::VERT => ch = Tile::YARN,
            Tile::YARN => {
                if let Some(dir) = self.yarn_fire_dir(i) {
                    self.dir_yarn = dir;
                    self.flight = None;
                    self.set_mode(Mode::Yarn);
                }
            }
            _ => {}
        }
        self.bads[i].ch = ch;
        self.field.set(b.x, b.y, ch);
    }

    /// `YarnDirFFire`: the direction to fire ball `i` in, if it fires.
    fn yarn_fire_dir(&mut self, i: usize) -> Option<Dir> {
        #[derive(Clone, Copy)]
        enum Step {
            NearCheck,
            FireRandom,
            AxisCheck,
            Aimed,
            Default,
        }

        if self.yarn_armed.is_some() {
            return None;
        }
        let b = self.bads[i];
        let BadKind::Yarn { aim } = b.kind else {
            return None;
        };
        let (mx, my) = (self.mouse.x, self.mouse.y);

        let mut step = if self.rng.rnd() < 0.075 {
            Step::FireRandom
        } else {
            match aim {
                1 => Step::NearCheck,
                2 => Step::AxisCheck,
                3 => Step::Aimed,
                _ => Step::Default,
            }
        };
        let fired = loop {
            match step {
                Step::NearCheck => {
                    if (b.y - my).abs() <= 1 || (b.x - mx).abs() <= 1 {
                        step = Step::FireRandom;
                    } else {
                        break None;
                    }
                }
                Step::FireRandom => {
                    let dirs = self.fill_dirs(b.x, b.y, self.level > 3);
                    break (dirs.len > 0).then(|| dirs.pick(&mut self.rng));
                }
                Step::AxisCheck => {
                    if self.rng.rnd() < 0.1 {
                        step = Step::NearCheck;
                        continue;
                    }
                    let near = if b.x == 0 || b.x == LAST { (b.y - my).abs() <= 1 } else { (b.x - mx).abs() <= 1 };
                    if near {
                        step = Step::FireRandom;
                    } else {
                        break None;
                    }
                }
                Step::Aimed => {
                    if self.rng.rnd() < 0.1 {
                        step = Step::AxisCheck;
                        continue;
                    }
                    let ok = self.fill_dirs(b.x, b.y, true).ok;
                    let try_dir = |d: Dir| ok[d.index()].then_some(d);
                    let mut aimed = None;
                    if b.y == my {
                        aimed = aimed.or(try_dir(if b.x < mx { Dir::E } else { Dir::W }));
                    }
                    if b.x == mx {
                        aimed = aimed.or(try_dir(if b.y < my { Dir::S } else { Dir::N }));
                    }
                    if b.x - mx == b.y - my {
                        aimed = aimed.or(try_dir(if b.y < my { Dir::SE } else { Dir::NW }));
                    }
                    if b.x - mx == my - b.y {
                        aimed = aimed.or(try_dir(if b.x > mx { Dir::SW } else { Dir::NE }));
                    }
                    break aimed;
                }
                Step::Default => {
                    if self.rng.rnd() < 0.05 {
                        step = Step::AxisCheck;
                        continue;
                    }
                    if self.rng.rnd() < 0.9 {
                        step = Step::Aimed;
                        continue;
                    }
                    let dirs = self.fill_dirs(b.x, b.y, true);
                    if dirs.len == 0 {
                        break None;
                    }
                    let (sx, sy) = (sgn(mx - b.x), sgn(my - b.y));
                    let mut chosen = None;
                    for _ in 0..8 {
                        let d = dirs.pick(&mut self.rng);
                        if d.dx() == sx || d.dy() == sy {
                            chosen = Some(d);
                            break;
                        }
                    }
                    break chosen;
                }
            }
        };
        if fired.is_some() {
            self.yarn_armed = Some(i);
        }
        fired
    }

    #[cfg(test)]
    pub(crate) fn field_mut(&mut self) -> &mut Field {
        &mut self.field
    }

    /// Test setup: a cat at `(x, y)`.
    #[cfg(test)]
    pub(crate) fn put_cat(&mut self, x: i32, y: i32) {
        self.bads.push(Bad { x, y, ch: Tile::KAT, kind: BadKind::Cat });
        self.field.set(x, y, Tile::KAT);
    }

    /// Test setup: moves the mouse to `(x, y)`.
    #[cfg(test)]
    pub(crate) fn put_mouse(&mut self, x: i32, y: i32) {
        self.step_mouse(x, y, Tile::GUY);
    }

    #[cfg(test)]
    pub(crate) fn clear_bads(&mut self) {
        for b in std::mem::take(&mut self.bads) {
            self.field.set(b.x, b.y, Tile::OPEN);
        }
    }

    fn end_flight(&mut self) {
        self.mode = Mode::Play;
        self.set_timer();
        self.flight = None;
        self.yarn_armed = None;
    }

    /// `YarnMove`: the fired ball rolls one cell per 50 ms tick.
    fn yarn_move(&mut self) {
        let Some(i) =
            self.yarn_armed.filter(|&i| matches!(self.bads.get(i), Some(b) if matches!(b.kind, BadKind::Yarn { .. })))
        else {
            self.end_flight();
            return;
        };
        let mut b = self.bads[i];
        let mut flight = self.flight.unwrap_or(Flight {
            dx: self.dir_yarn.dx(),
            dy: self.dir_yarn.dy(),
            under: if Field::on_border(b.x, b.y) { Tile::WALL } else { Tile::OPEN },
        });

        // Fading out after a bounce.
        if b.ch.0 > Tile::YARN.0 && b.ch.0 <= Tile::YARN_LAST.0 {
            if b.ch == Tile::YARN_LAST {
                let under = if Field::on_border(b.x, b.y) { Tile::WALL } else { Tile::OPEN };
                self.field.set(b.x, b.y, under);
                self.bads.swap_remove(i);
                self.end_flight();
                for b in &self.bads {
                    self.field.set(b.x, b.y, b.ch);
                }
            } else {
                b.ch = b.ch.next();
                self.field.set(b.x, b.y, b.ch);
                self.bads[i] = b;
                self.flight = Some(flight);
            }
            return;
        }

        self.field.set(b.x, b.y, flight.under);
        b.x += flight.dx;
        b.y += flight.dy;
        flight.under = if Field::on_border(b.x, b.y) { Tile::WALL } else { self.field.get(b.x, b.y) };
        match flight.under {
            Tile::BLOCK | Tile::WALL => {
                b.x -= flight.dx;
                b.y -= flight.dy;
                let back = self.field.get(b.x, b.y);
                self.field.set(b.x, b.y, Tile::YARN);
                let per = (0.05 * self.level as f64 + 0.05 * self.room.difficulty as f64).min(0.9);
                if self.rng.rnd() < per && matches!(back, Tile::OPEN | Tile::HOLE | Tile::TRAP) {
                    // The ball comes to rest here, ready to fire again.
                    self.bads[i] = b;
                    self.end_flight();
                    return;
                }
                b.ch = Tile::YARN.next();
            }
            Tile::GUY | Tile::HOLE_GUY => {
                self.flight = None;
                self.set_mode(Mode::Dying);
                self.bads.swap_remove(i);
                return;
            }
            _ => {}
        }
        self.field.set(b.x, b.y, b.ch);
        self.bads[i] = b;
        self.flight = Some(flight);
    }
}
