//! The 23×23 playing field (`field100.dll`). Every actor is also painted into
//! it, and the rules read the tiles back, so the grid is the game's state.

use crate::tile::Tile;

pub const SIZE: i32 = 23;
pub const LAST: i32 = SIZE - 1;
pub const CENTRE: i32 = SIZE / 2;

#[derive(Clone)]
pub struct Field {
    /// Row-major: `tiles[y * SIZE + x]`.
    tiles: [Tile; (SIZE * SIZE) as usize],
}

impl Default for Field {
    fn default() -> Self {
        Field { tiles: [Tile::OPEN; (SIZE * SIZE) as usize] }
    }
}

impl Field {
    pub const fn in_bounds(x: i32, y: i32) -> bool {
        x >= 0 && y >= 0 && x < SIZE && y < SIZE
    }

    pub const fn on_border(x: i32, y: i32) -> bool {
        x <= 0 || y <= 0 || x >= LAST || y >= LAST
    }

    /// `FldGet`: outside the field reads as open, as the DLL did.
    pub fn get(&self, x: i32, y: i32) -> Tile {
        if Self::in_bounds(x, y) {
            self.tiles[(y * SIZE + x) as usize]
        } else {
            Tile::OPEN
        }
    }

    /// `FldDraw`: writes outside the field are ignored.
    pub fn set(&mut self, x: i32, y: i32, tile: Tile) {
        if Self::in_bounds(x, y) {
            self.tiles[(y * SIZE + x) as usize] = tile;
        }
    }

    pub fn fill(&mut self, tile: Tile) {
        self.tiles.fill(tile);
    }

    pub fn count(&self, tile: Tile) -> usize {
        self.tiles.iter().filter(|&&t| t == tile).count()
    }

    pub fn as_bytes(&self) -> &[u8] {
        // SAFETY: Tile is repr(transparent) over u8.
        unsafe { core::slice::from_raw_parts(self.tiles.as_ptr().cast::<u8>(), self.tiles.len()) }
    }
}
