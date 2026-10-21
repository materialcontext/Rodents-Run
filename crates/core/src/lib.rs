//! Rodent's Revenge (Christopher Lee Fraley, Microsoft Entertainment Pack, 1991).
//!
//! The rules follow the original program's logic as recovered from its
//! Visual Basic p-code (see `docs/ORIGINAL_RULES.md`). The crate has no
//! platform code: a host drives [`Game::tick`] on a timer, forwards moves to
//! [`Game::input`] and draws [`Game::field`].

pub mod dir;
pub mod field;
pub mod game;
pub mod rng;
pub mod room;
pub mod tile;

pub use dir::Dir;
pub use field::Field;
pub use game::{event, Bad, BadKind, Game, Mode, DEFAULT_SPEED, SPEED_MS, START_LEVELS};
pub use tile::Tile;

#[cfg(test)]
mod tests;
