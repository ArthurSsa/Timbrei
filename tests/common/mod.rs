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

/// Asserts that two `BiquadCoeffs`-shaped values agree on all five
/// coefficients within `tol` ULPs.
///
/// Takes the five coefficients of each side as `f64` tuples so the helper
/// is decoupled from the concrete `BiquadCoeffs` type. Integration tests
/// pass `(c.b0, c.b1, c.b2, c.a1, c.a2)` for each side. This avoids sharing
/// a `#[macro_export]` macro between the `src/` crate and the `tests/`
/// integration test set.
///
/// On failure, the panic message includes the label, the offending
/// coefficient name, both values, and the actual ULP distance.
pub fn assert_coeffs_within_ulp(
    label: &str,
    got: (f64, f64, f64, f64, f64),
    expected: (f64, f64, f64, f64, f64),
    tol: u64,
) {
    let names = ["b0", "b1", "b2", "a1", "a2"];
    let got_arr = [got.0, got.1, got.2, got.3, got.4];
    let expected_arr = [expected.0, expected.1, expected.2, expected.3, expected.4];
    for (i, name) in names.iter().enumerate() {
        let g = got_arr[i];
        let e = expected_arr[i];
        let dist = ulp_distance(g, e);
        assert!(
            dist <= tol,
            "[{}] {} exceeded {} ULP: got = {:.17e}, expected = {:.17e}, distance = {} ULP",
            label, name, tol, g, e, dist
        );
    }
}
