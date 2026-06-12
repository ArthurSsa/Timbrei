//! Integration tests for the stateful `Biquad` filter.
//!
//! These run as an external crate, so they exercise only the public surface
//! of `lemi`. In particular they confirm that `Biquad::coeffs()` is reachable
//! from `tests/` (US-28) even though it is `#[doc(hidden)]` and not part of
//! the stable API.

use lemi::{Biquad, BiquadCoeffs, FilterType, ValidParams};

fn nominal() -> ValidParams {
    ValidParams::new(1000.0, 44100.0, 1.0, 6.0, 1.0).unwrap()
}

#[test]
fn coeffs_is_reachable_from_integration_tests() {
    let p = nominal();
    let b = Biquad::from_params(&p, FilterType::Peaking);
    // The accessor is visible here precisely because it is `pub` (US-28).
    assert_eq!(b.coeffs(), BiquadCoeffs::peaking(&p));
}

#[test]
fn process_is_stable_for_all_filter_types() {
    let p = nominal();
    for ft in [FilterType::Peaking, FilterType::LowShelf, FilterType::HighShelf] {
        let mut b = Biquad::from_params(&p, ft);
        let mut y = b.process(1.0);
        for _ in 0..4000 {
            y = b.process(0.0);
        }
        assert!(y.abs() < 1e-9, "{:?}: impulse tail did not decay: {}", ft, y);
    }
}

#[test]
fn reset_matches_fresh_filter_output() {
    let p = nominal();
    let mut driven = Biquad::from_params(&p, FilterType::LowShelf);
    for &x in &[1.0, 0.5, -0.25, 0.125] {
        let _ = driven.process(x);
    }
    driven.reset();

    let mut fresh = Biquad::from_params(&p, FilterType::LowShelf);
    for &x in &[0.3, -0.6, 0.9, 0.0, 0.2] {
        assert_eq!(driven.process(x), fresh.process(x));
    }
}
