//! Integration tests for RBJ coefficient computations.
//!
//! These tests use the shared helpers in `tests/common/mod.rs` and verify
//! end-to-end behavior of `BiquadCoeffs` against published expectations.

mod common;

use lemi::{BiquadCoeffs, ValidParams};

// At gain=0 dB, A=1 for all three filter types, the numerator and
// denominator polynomials become identical: b0 == 1 and b_k == a_k for
// k = 1, 2. The transfer function H(z) = (b0 + b1*z^-1 + b2*z^-2) /
// (1 + a1*z^-1 + a2*z^-2) reduces to 1 (identity). Individual b1, b2,
// a1, a2 are NOT zero; they cancel in the transfer function.
// Each test checks b0 ~ 1, b1 - a1 ~ 0, b2 - a2 ~ 0.
#[test]
fn unity_gain_is_identity_peaking() {
    let p = ValidParams::new(1000.0, 44100.0, 1.0, 0.0, 1.0).unwrap();
    let c = BiquadCoeffs::peaking(&p);
    common::assert_coeffs_within_ulp(
        "peaking@0dB",
        (c.b0, c.b1 - c.a1, c.b2 - c.a2, 0.0, 0.0),
        (1.0, 0.0, 0.0, 0.0, 0.0),
        4,
    );
}

#[test]
fn unity_gain_is_identity_low_shelf() {
    let p = ValidParams::new(1000.0, 44100.0, 1.0, 0.0, 1.0).unwrap();
    let c = BiquadCoeffs::low_shelf(&p);
    common::assert_coeffs_within_ulp(
        "low_shelf@0dB",
        (c.b0, c.b1 - c.a1, c.b2 - c.a2, 0.0, 0.0),
        (1.0, 0.0, 0.0, 0.0, 0.0),
        4,
    );
}

#[test]
fn unity_gain_is_identity_high_shelf() {
    let p = ValidParams::new(1000.0, 44100.0, 1.0, 0.0, 1.0).unwrap();
    let c = BiquadCoeffs::high_shelf(&p);
    common::assert_coeffs_within_ulp(
        "high_shelf@0dB",
        (c.b0, c.b1 - c.a1, c.b2 - c.a2, 0.0, 0.0),
        (1.0, 0.0, 0.0, 0.0, 0.0),
        4,
    );
}
