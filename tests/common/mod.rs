//! Test-only numerical helpers shared across integration tests.
//!
//! Cargo treats `tests/common/mod.rs` as a non-test submodule (the file is
//! `mod.rs` inside a subdirectory). It is included via `mod common;` from
//! each integration test file.

#![allow(dead_code)]

/// Distance between two `f64` values in units in the last place (ULPs).
///
/// Panics if either argument is NaN. `assert_coeffs_within_ulp` and similar
/// helpers rely on this so that a silent NaN propagation does not pass an
/// ULP comparison.
///
/// `+0.0` and `-0.0` are normalized to the same bit pattern before
/// comparison, so `ulp_distance(0.0, -0.0)` returns 0.
pub fn ulp_distance(a: f64, b: f64) -> u64 {
    if a.is_nan() || b.is_nan() {
        panic!("ulp_distance: NaN input (a = {}, b = {})", a, b);
    }
    let normalize = |x: f64| if x == 0.0 { 0.0 } else { x };
    let a = normalize(a);
    let b = normalize(b);
    let ai = a.to_bits() as i64;
    let bi = b.to_bits() as i64;
    // Convert from biased two's-complement representation so adjacent
    // finite f64 values differ by exactly 1.
    let to_lex = |x: i64| if x >= 0 { x } else { i64::MIN - x };
    (to_lex(ai) - to_lex(bi)).unsigned_abs()
}
