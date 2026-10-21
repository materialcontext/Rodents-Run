use crate::field::{CENTRE, LAST, SIZE};
use crate::game::{event, Game, Mode};
use crate::rng::Rng;
use crate::{Dir, Tile};

/// A game in play on `level` (0-based) with its first cats out.
fn playing(level: i32, seed: u64) -> Game {
    let mut g = Game::new(seed, 1, level);
    g.new_game();
    g.tick(); // BeginGame -> BeginLevel
    g.tick(); // BeginLevel -> Begin
    g.tick(); // Begin -> Play
    assert_eq!(g.mode(), Mode::Play);
    g
}

/// An empty walled room with the mouse in the centre and no cats.
fn empty_room() -> Game {
    let mut g = playing(0, 7);
    g.clear_bads();
    let f = g.field_mut();
    for y in 1..LAST {
        for x in 1..LAST {
            f.set(x, y, Tile::OPEN);
        }
    }
    g.put_mouse(CENTRE, CENTRE);
    g
}

#[test]
fn level_one_is_a_fifteen_block_square() {
    let g = Game::new(1, 1, 0);
    let f = g.field();
    for y in 0..SIZE {
        for x in 0..SIZE {
            let expected = if x == 0 || y == 0 || x == LAST || y == LAST {
                Tile::WALL
            } else if (4..=18).contains(&x) && (4..=18).contains(&y) {
                Tile::BLOCK
            } else {
                Tile::OPEN
            };
            assert_eq!(f.get(x, y), expected, "({x}, {y})");
        }
    }
}

#[test]
fn a_game_starts_with_the_mouse_amid_the_blocks_and_one_cat() {
    let g = playing(0, 3);
    assert_eq!(g.mouse(), (CENTRE, CENTRE));
    assert_eq!(g.field().get(CENTRE, CENTRE), Tile::GUY);
    // Three half-cats: one cat now, the half carries over.
    assert_eq!(g.bads().len(), 1);
    let cat = g.bads()[0];
    assert_eq!(g.field().get(cat.x, cat.y), Tile::KAT);
    assert!((cat.x - CENTRE).pow(2) + (cat.y - CENTRE).pow(2) >= 100);
    assert_eq!(g.lives(), 3);
    assert_eq!(g.tick_ms(), 1000);
}

#[test]
fn pushing_moves_the_whole_row() {
    let mut g = playing(0, 3);
    g.clear_bads();
    g.input(Dir::N);
    assert_eq!(g.mouse(), (CENTRE, CENTRE - 1));
    assert_eq!(g.field().get(CENTRE, 3), Tile::BLOCK);
    assert_eq!(g.field().get(CENTRE, CENTRE), Tile::OPEN);
    for y in 4..CENTRE - 1 {
        assert_eq!(g.field().get(CENTRE, y), Tile::BLOCK);
    }
    assert_ne!(g.take_events() & event::PUSH, 0);
}

#[test]
fn walls_stop_a_push() {
    let mut g = empty_room();
    for y in 1..CENTRE {
        g.field_mut().set(CENTRE, y, Tile::BLOCK);
    }
    g.input(Dir::N);
    assert_eq!(g.mouse(), (CENTRE, CENTRE));
    assert_ne!(g.take_events() & event::BUMP, 0);
}

#[test]
fn diagonal_pushes_work() {
    let mut g = empty_room();
    g.field_mut().set(CENTRE + 1, CENTRE + 1, Tile::BLOCK);
    g.field_mut().set(CENTRE + 2, CENTRE + 2, Tile::BLOCK);
    g.input(Dir::SE);
    assert_eq!(g.mouse(), (CENTRE + 1, CENTRE + 1));
    assert_eq!(g.field().get(CENTRE + 3, CENTRE + 3), Tile::BLOCK);
}

#[test]
fn blocks_vanish_into_holes_and_crush_cheese() {
    let mut g = empty_room();
    g.field_mut().set(CENTRE + 1, CENTRE, Tile::BLOCK);
    g.field_mut().set(CENTRE + 2, CENTRE, Tile::HOLE);
    g.input(Dir::E);
    assert_eq!(g.field().get(CENTRE + 2, CENTRE), Tile::HOLE);
    assert_eq!(g.field().count(Tile::BLOCK), 0);

    g.field_mut().set(CENTRE, CENTRE + 1, Tile::BLOCK);
    g.field_mut().set(CENTRE, CENTRE + 2, Tile::CHEESE);
    g.put_mouse(CENTRE, CENTRE);
    g.input(Dir::S);
    assert_eq!(g.field().get(CENTRE, CENTRE + 2), Tile::BLOCK);
    assert_eq!(g.field().count(Tile::CHEESE), 0);
}

#[test]
fn traps_block_pushes() {
    let mut g = empty_room();
    g.field_mut().set(CENTRE + 1, CENTRE, Tile::BLOCK);
    g.field_mut().set(CENTRE + 2, CENTRE, Tile::TRAP);
    g.input(Dir::E);
    assert_eq!(g.mouse(), (CENTRE, CENTRE));
}

#[test]
fn a_boxed_in_cat_turns_to_cheese_and_the_clock_races() {
    let mut g = empty_room();
    // A cat boxed into the corner.
    g.put_cat(1, 1);
    for (x, y) in [(2, 1), (1, 2), (2, 2)] {
        g.field_mut().set(x, y, Tile::BLOCK);
    }
    g.tick();
    assert_eq!(g.mode(), Mode::PlayFast);
    assert_eq!(g.field().get(1, 1), Tile::CHEESE);
    assert!(g.bads().is_empty());
    assert_ne!(g.take_events() & event::CATS_TRAPPED, 0);
    assert_eq!(g.tick_ms(), 50);

    // Racing to minute 5 brings the next batch.
    while g.mode() == Mode::PlayFast {
        g.tick();
    }
    assert_eq!(g.mode(), Mode::End);
    assert_eq!(g.minute(), 5);
    g.tick();
    assert_eq!(g.mode(), Mode::Begin);
    g.tick();
    assert_eq!(g.mode(), Mode::Play);
    assert!(!g.bads().is_empty());

    // Eating the cheese pays 100 + 25 per level.
    let before = g.score();
    g.field_mut().set(2, 2, Tile::OPEN);
    g.put_mouse(2, 2);
    g.input(Dir::NW);
    assert_eq!(g.score() - before, 100);
}

#[test]
fn cats_trapped_together_count_even_with_room_to_spare() {
    let mut g = empty_room();
    // Two cats sharing a 1x2 pocket: each blocks the other.
    g.put_cat(1, 1);
    g.put_cat(2, 1);
    for (x, y) in [(1, 2), (2, 2), (3, 2), (3, 1)] {
        g.field_mut().set(x, y, Tile::BLOCK);
    }
    g.tick();
    assert_eq!(g.mode(), Mode::PlayFast);
    assert_eq!(g.field().count(Tile::CHEESE), 2);
}

#[test]
fn a_cat_reaching_the_mouse_costs_a_life() {
    let mut g = empty_room();
    g.put_cat(CENTRE + 1, CENTRE);
    for _ in 0..20 {
        g.tick();
        if g.mode() == Mode::Dying {
            break;
        }
    }
    assert_eq!(g.mode(), Mode::Dying);
    for _ in 0..5 {
        g.tick();
        assert_eq!(g.mode(), Mode::Dying);
    }
    g.tick();
    assert_eq!(g.mode(), Mode::Restart);
    assert_eq!(g.lives(), 2);
    assert_ne!(g.take_events() & event::LIFE_LOST, 0);
    g.tick();
    assert_eq!(g.mode(), Mode::Play);
}

#[test]
fn losing_every_life_ends_the_game() {
    let mut g = empty_room();
    for _ in 0..3 {
        let (mx, my) = g.mouse();
        g.field_mut().set(mx + 1, my, Tile::TRAP);
        g.input(Dir::E);
        assert_eq!(g.mode(), Mode::Dying);
        while g.mode() == Mode::Dying {
            g.tick();
        }
        if g.mode() == Mode::Restart {
            g.tick();
        }
    }
    assert_eq!(g.mode(), Mode::EndGame);
    assert_ne!(g.take_events() & event::GAME_OVER, 0);
    g.tick();
    assert_eq!(g.mode(), Mode::Demo);
}

#[test]
fn sink_holes_hold_the_mouse_for_ten_ticks_and_are_used_up() {
    let mut g = empty_room();
    g.field_mut().set(CENTRE + 1, CENTRE, Tile::HOLE);
    g.input(Dir::E);
    assert_eq!(g.field().get(CENTRE + 1, CENTRE), Tile::HOLE_GUY);
    assert!(g.stunned());
    for _ in 0..9 {
        g.tick();
        g.input(Dir::E);
        assert_eq!(g.mouse(), (CENTRE + 1, CENTRE));
    }
    g.tick();
    assert!(!g.stunned());
    g.input(Dir::E);
    assert_eq!(g.mouse(), (CENTRE + 2, CENTRE));
    assert_eq!(g.field().get(CENTRE + 1, CENTRE), Tile::OPEN);
}

#[test]
fn the_level_ends_when_cats_are_trapped_after_minute_25() {
    let mut g = empty_room();
    // Run the clock with no cats to minute 25 and on: with nothing loose it
    // races, collecting batches as they come.
    let mut guard = 0;
    while g.mode() != Mode::BeginLevel && guard < 100_000 {
        g.clear_bads();
        g.tick();
        guard += 1;
    }
    assert_eq!(g.level(), 1);
    assert_ne!(g.take_events() & event::LEVEL_CLEARED, 0);
}

#[test]
fn cats_speed_up_with_level_and_waves() {
    assert_eq!(playing(0, 1).tick_ms(), 1000);
    assert_eq!(playing(1, 1).tick_ms(), 980);
    assert_eq!(playing(10, 1).tick_ms(), 817);
    let mut g = Game::new(1, 4, 0);
    g.new_game();
    for _ in 0..3 {
        g.tick();
    }
    assert_eq!(g.tick_ms(), 180);
}

#[test]
fn rooms_repeat_every_six_levels() {
    for level in 0..12 {
        let g = Game::new(5, 1, level);
        assert_eq!(g.room().difficulty, level % 6);
    }
}

#[test]
fn my_rand_stays_in_range() {
    let mut r = Rng::new(9);
    for _ in 0..10_000 {
        let v = r.my_rand(20);
        assert!((0..20).contains(&v));
    }
}

/// Random play on every room and speed: no panics, and the board stays
/// consistent with the actors.
#[test]
fn random_play_keeps_the_board_consistent() {
    let mut rng = Rng::new(42);
    for level in 0..60 {
        let mut g = Game::new(level as u64 * 7 + 1, (level % 5) as usize, level);
        g.new_game();
        for step in 0..6_000 {
            if rng.rnd() < 0.6 {
                g.input(Dir::from_index(rng.my_rand(8) as u8).unwrap());
            }
            g.tick();
            if g.mode() == Mode::Demo {
                break;
            }
            let f = g.field();
            assert!(f.count(Tile::GUY) + f.count(Tile::HOLE_GUY) <= 1, "level {level} step {step}");
            assert!(g.bads().len() <= 20);
            for b in g.bads() {
                assert!(crate::Field::in_bounds(b.x, b.y));
            }
            for i in 0..SIZE {
                for (x, y) in [(i, 0), (i, LAST), (0, i), (LAST, i)] {
                    let t = f.get(x, y);
                    assert!(
                        matches!(t, Tile::WALL | Tile::VERT | Tile::HORZ) || t.is_yarn(),
                        "border ({x}, {y}) = {t:?} on level {level} step {step}"
                    );
                }
            }
        }
    }
}
