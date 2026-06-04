//! Frequency-response evaluation for offline analysis.
//!
//! This module is used only by the evaluation scripts (for example
//! `eval/rbj_compare.py` via the `rbj_eval` binary). It is not part of the
//! real-time signal path and is gated behind the `std` feature, so it does
//! not participate in the `no_std` embedded build or the allocation-free hot
//! path.
//!
//! The transfer function of the normalized biquad is
//!
//! ```text
//!         b0 + b1 z^-1 + b2 z^-2
//! H(z) = ------------------------ ,   z = e^{jω}
//!          1 + a1 z^-1 + a2 z^-2
//! ```
//!
//! evaluated on the unit circle at normalized angular frequency `ω`
//! (radians per sample, `ω = 2π f / fs`).

use crate::coefficients::BiquadCoeffs;

/// Complex frequency response `H(e^{jω})` as `(re, im)`.
///
/// `ω` is the normalized angular frequency in radians per sample.
pub fn response(coeffs: &BiquadCoeffs, omega: f64) -> (f64, f64) {
    // e^{-jω} = cos ω − j sin ω;  e^{-2jω} = cos 2ω − j sin 2ω.
    let c1 = libm::cos(omega);
    let s1 = libm::sin(omega);
    let c2 = libm::cos(2.0 * omega);
    let s2 = libm::sin(2.0 * omega);

    let num_re = coeffs.b0 + coeffs.b1 * c1 + coeffs.b2 * c2;
    let num_im = -(coeffs.b1 * s1 + coeffs.b2 * s2);
    let den_re = 1.0 + coeffs.a1 * c1 + coeffs.a2 * c2;
    let den_im = -(coeffs.a1 * s1 + coeffs.a2 * s2);

    // H = num / den = num · conj(den) / |den|²
    let den_mag2 = den_re * den_re + den_im * den_im;
    let re = (num_re * den_re + num_im * den_im) / den_mag2;
    let im = (num_im * den_re - num_re * den_im) / den_mag2;
    (re, im)
}

/// Magnitude `|H(e^{jω})|` at each normalized angular frequency in `omegas`.
///
/// Intended for evaluation scripts; allocates a `Vec` for the result, which is
/// why the whole module is `std`-only.
pub fn evaluate(coeffs: &BiquadCoeffs, omegas: &[f64]) -> Vec<f64> {
    omegas
        .iter()
        .map(|&omega| {
            let (re, im) = response(coeffs, omega);
            libm::sqrt(re * re + im * im)
        })
        .collect()
}

#[cfg(test)]
mod tests {
    use super::*;
    use crate::params::ValidParams;

    fn nominal() -> ValidParams {
        ValidParams::new(1000.0, 44100.0, 1.0, 6.0, 1.0).unwrap()
    }

    #[test]
    fn dc_magnitude_matches_coefficient_sum() {
        // At ω = 0, H(1) = (b0 + b1 + b2) / (1 + a1 + a2), a real quantity.
        let c = BiquadCoeffs::peaking(&nominal());
        let mags = evaluate(&c, &[0.0]);
        let expected = ((c.b0 + c.b1 + c.b2) / (1.0 + c.a1 + c.a2)).abs();
        assert!((mags[0] - expected).abs() < 1e-12, "got {}, want {}", mags[0], expected);
    }

    #[test]
    fn unity_gain_filter_is_flat() {
        // A 0 dB peaking filter is the identity, so |H| ≈ 1 at every frequency.
        let p = ValidParams::new(1000.0, 44100.0, 1.0, 0.0, 1.0).unwrap();
        let c = BiquadCoeffs::peaking(&p);
        let omegas = [0.1, 0.5, 1.0, 2.0, 3.0];
        for m in evaluate(&c, &omegas) {
            assert!((m - 1.0).abs() < 1e-9, "expected flat ~1.0, got {}", m);
        }
    }

    #[test]
    fn peak_boost_exceeds_unity_at_center() {
        // A +6 dB peaking filter at f0 should have |H| > 1 near ω0.
        let p = nominal();
        let c = BiquadCoeffs::peaking(&p);
        let omega0 = p.omega();
        let (re, im) = response(&c, omega0);
        let mag = libm::sqrt(re * re + im * im);
        assert!(mag > 1.0, "expected boost at center, got {}", mag);
    }

    #[test]
    fn evaluate_length_matches_input() {
        let c = BiquadCoeffs::low_shelf(&nominal());
        let omegas = [0.0, 0.25, 0.5, 0.75, 1.0, 1.5];
        assert_eq!(evaluate(&c, &omegas).len(), omegas.len());
    }
}
