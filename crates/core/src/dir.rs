//! The eight move directions, numbered clockwise from north as in the
//! original (`mpdirdx` / `mpdirdy`).

#[derive(Clone, Copy, PartialEq, Eq, Debug, Hash)]
#[repr(u8)]
pub enum Dir {
    N = 0,
    NE,
    E,
    SE,
    S,
    SW,
    W,
    NW,
}

const DX: [i32; 8] = [0, 1, 1, 1, 0, -1, -1, -1];
const DY: [i32; 8] = [-1, -1, 0, 1, 1, 1, 0, -1];

impl Dir {
    pub const ALL: [Dir; 8] = [Dir::N, Dir::NE, Dir::E, Dir::SE, Dir::S, Dir::SW, Dir::W, Dir::NW];

    pub fn from_index(i: u8) -> Option<Dir> {
        Self::ALL.get(i as usize).copied()
    }

    pub const fn index(self) -> usize {
        self as usize
    }

    pub const fn dx(self) -> i32 {
        DX[self as usize]
    }

    pub const fn dy(self) -> i32 {
        DY[self as usize]
    }

    pub const fn is_diagonal(self) -> bool {
        (self as u8) & 1 == 1
    }
}
