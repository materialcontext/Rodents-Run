//! Random numbers. The original used VB's `Rnd`; any uniform source plays the
//! same, so this is a small seedable generator (SplitMix64) that keeps games
//! reproducible in tests.

#[derive(Clone, Debug)]
pub struct Rng(u64);

impl Rng {
    pub fn new(seed: u64) -> Self {
        Rng(seed)
    }

    fn next_u64(&mut self) -> u64 {
        self.0 = self.0.wrapping_add(0x9E37_79B9_7F4A_7C15);
        let mut z = self.0;
        z = (z ^ (z >> 30)).wrapping_mul(0xBF58_476D_1CE4_E5B9);
        z = (z ^ (z >> 27)).wrapping_mul(0x94D0_49BB_1331_11EB);
        z ^ (z >> 31)
    }

    /// `Rnd`: uniform in [0, 1).
    pub fn rnd(&mut self) -> f64 {
        (self.next_u64() >> 11) as f64 / (1u64 << 53) as f64
    }

    /// `MyRand(max) = CInt(max * Rnd)` clamped to `max - 1`. The rounding makes
    /// 0 half as likely and `max - 1` one and a half times as likely as the
    /// rest; the original's rooms and cats were placed with that bias.
    pub fn my_rand(&mut self, max: i32) -> i32 {
        let r = (max as f64 * self.rnd()).round() as i32;
        r.min(max - 1).max(0)
    }
}
