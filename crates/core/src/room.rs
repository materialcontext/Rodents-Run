//! The six rooms and how each level's board is generated (`LevelDraw` and the
//! `mplvl*` tables). Level `n` (0-based) uses room `n mod 6`, so levels repeat
//! every six with fewer blocks, more holes and traps, and faster cats.

use crate::field::{Field, CENTRE, LAST, SIZE};
use crate::rng::Rng;
use crate::tile::Tile;

#[derive(Clone, Copy, PartialEq, Eq, Debug)]
pub enum Pattern {
    /// A solid square of blocks in the middle.
    Square,
    /// A checkerboard of blocks.
    Checker,
    /// Blocks scattered at random.
    Scatter,
    /// A checkerboard of walls with blocks scattered over it.
    CheckerWalls,
}

#[derive(Clone, Copy, Debug)]
pub struct Room {
    pub pattern: Pattern,
    /// `mplvlpery`: percentage of obstacles that are blocks rather than walls.
    pub blocks: i32,
    /// `lvl6`: the room number, which also raises the hazard counts.
    pub difficulty: i32,
    /// `mplvlck`: cats when a batch arrives, in half-cats.
    pub batch: i32,
    /// `mplvldk`: cats added at each wave, in half-cats.
    pub wave: i32,
    /// `mplvlmin`: clock minutes between waves.
    pub interval: i32,
}

pub const ROOMS: [Room; 6] = [
    Room { pattern: Pattern::Square, blocks: 100, difficulty: 0, batch: 3, wave: 3, interval: 5 },
    Room { pattern: Pattern::Square, blocks: 90, difficulty: 1, batch: 3, wave: 3, interval: 4 },
    Room { pattern: Pattern::Scatter, blocks: 87, difficulty: 2, batch: 6, wave: 4, interval: 5 },
    Room { pattern: Pattern::Checker, blocks: 100, difficulty: 3, batch: 2, wave: 2, interval: 2 },
    Room { pattern: Pattern::Scatter, blocks: 50, difficulty: 4, batch: 4, wave: 3, interval: 3 },
    Room { pattern: Pattern::CheckerWalls, blocks: 50, difficulty: 5, batch: 4, wave: 3, interval: 4 },
];

pub fn room_for(level: i32) -> Room {
    ROOMS[level.rem_euclid(ROOMS.len() as i32) as usize]
}

/// Paints level `level` (0-based) onto an already erased field.
pub fn draw(field: &mut Field, level: i32, room: &Room, rng: &mut Rng) {
    let mut per_y = room.blocks;
    let mut per_b = 100 - per_y;
    let mut per_h = 0;
    let mut per_t = 0;
    let hazard = level + room.difficulty;
    if level >= 3 {
        per_h = (2 * (hazard - 4)).clamp(0, 15);
        per_y = (per_y - per_h).max(0);
    }
    if level >= 6 {
        per_t = (hazard - 5).clamp(0, 10);
        per_b = (per_b - per_t).max(0);
    }
    if per_y < per_b - 15 {
        let total = per_b + per_y;
        per_y = total / 2 - 7;
        per_b = per_y + 15;
    }

    for i in 0..SIZE {
        field.set(i, 0, Tile::WALL);
        field.set(i, LAST, Tile::WALL);
        field.set(0, i, Tile::WALL);
        field.set(LAST, i, Tile::WALL);
    }

    let mut c_block = 200 - 5 * level - 5 * room.difficulty;
    if per_y > 0 && c_block * per_y < 7000 {
        c_block = 7000 / per_y;
    }

    let centred = |field: &mut Field, area: i32, pick: &dyn Fn(i32, i32) -> Option<Tile>| {
        let h = ((area.max(0) as f64).sqrt() as i32) / 2;
        for x in CENTRE - h..=CENTRE + h {
            for y in CENTRE - h..=CENTRE + h {
                if let Some(t) = pick(x, y) {
                    field.set(x, y, t);
                }
            }
        }
    };
    let scatter = |field: &mut Field, rng: &mut Rng, count: i32, tile: Tile| {
        for _ in 0..count {
            let x = 1 + rng.my_rand(SIZE - 3);
            let y = 1 + rng.my_rand(SIZE - 3);
            field.set(x, y, tile);
        }
    };

    match room.pattern {
        Pattern::Square => centred(field, c_block, &|_, _| Some(Tile::BLOCK)),
        Pattern::Checker => centred(field, 2 * c_block, &|x, y| ((x + y) & 1 == 1).then_some(Tile::BLOCK)),
        Pattern::Scatter | Pattern::CheckerWalls => {}
    }
    if room.pattern == Pattern::CheckerWalls {
        centred(field, 2 * per_b * c_block / 100, &|x, y| ((x + y) & 1 == 1).then_some(Tile::WALL));
    } else {
        scatter(field, rng, c_block * per_b / 100, Tile::WALL);
    }
    scatter(field, rng, c_block * per_h / 100, Tile::HOLE);
    scatter(field, rng, c_block * per_t / 100, Tile::TRAP);
    if matches!(room.pattern, Pattern::Scatter | Pattern::CheckerWalls) {
        // `For i = 0 To n`: one more than the count.
        scatter(field, rng, c_block * per_y / 100 + 1, Tile::BLOCK);
    }
}
