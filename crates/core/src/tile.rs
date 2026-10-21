//! Field tiles. The ids are the original `ch*` constants: the renderer maps
//! them straight to sprites, and some rules do arithmetic on them (the yarn
//! fade and the death animation count up through consecutive ids).

#[derive(Clone, Copy, PartialEq, Eq, Debug, Default, Hash)]
#[repr(transparent)]
pub struct Tile(pub u8);

impl Tile {
    pub const OPEN: Tile = Tile(0x00);
    pub const BLOCK: Tile = Tile(0x01);
    pub const WALL: Tile = Tile(0x02);
    /// A yarn ball about to leave the top or bottom border.
    pub const VERT: Tile = Tile(0x03);
    /// A yarn ball about to leave the left or right border.
    pub const HORZ: Tile = Tile(0x04);
    pub const HOLE: Tile = Tile(0x05);
    pub const TRAP: Tile = Tile(0x06);
    pub const CHEESE: Tile = Tile(0x07);
    /// The mouse stuck in a sink hole.
    pub const HOLE_GUY: Tile = Tile(0x08);
    pub const KAT: Tile = Tile(0x10);
    pub const YARN: Tile = Tile(0x11);
    /// Last frame of the yarn fade (`YARN + 1 ..= YARN_LAST` fade out).
    pub const YARN_LAST: Tile = Tile(0x14);
    /// Spare-life icon (HUD only).
    pub const GUY_GREY: Tile = Tile(0x15);
    /// Empty life slot (HUD only).
    pub const GREY: Tile = Tile(0x16);
    pub const KAT_SLEEP: Tile = Tile(0x17);
    pub const GUY: Tile = Tile(0x20);
    /// Last frame of the death animation (`GUY + 1 ..= DEAD`).
    pub const DEAD: Tile = Tile(0x25);

    pub const fn next(self) -> Tile {
        Tile(self.0 + 1)
    }

    pub const fn is_yarn(self) -> bool {
        self.0 >= Self::YARN.0 && self.0 <= Self::YARN_LAST.0
    }

    /// Cells a cat may step into (`BadFOpen`): stepping onto the mouse kills it.
    pub const fn cat_can_enter(self) -> bool {
        matches!(self, Self::GUY | Self::HOLE_GUY | Self::OPEN | Self::CHEESE)
    }
}
