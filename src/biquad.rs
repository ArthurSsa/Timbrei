//! The biquad filter as a stateful object.
//!
//! `Biquad` owns its [`BiquadCoeffs`] and the two delay-line samples
//! (`w1`, `w2`) used by Direct Form II Transposed. Construction via
//! [`Biquad::from_params`] yields a filter with zero initial state;
//! [`Biquad::process`] runs the difference equation, [`Biquad::reset`]
//! zeroes the delay line in place, and [`Biquad::coeffs`] exposes the
//! coefficients for test inspection.

use crate::coefficients::BiquadCoeffs;
use crate::params::ValidParams;

/// Filter topology selector. Matches `FilterType` in `lean/FilterParams.lean`.
#[derive(Debug, Clone, Copy, PartialEq, Eq)]
pub enum FilterType {
    Peaking,
    LowShelf,
    HighShelf,
}

/// A second-order IIR filter (biquad) in Direct Form II Transposed.
///
/// Holds five coefficients and two delay-line samples of fixed size, with
/// no heap allocation. Usable in `no_std` builds.
#[derive(Debug, Clone, Copy)]
pub struct Biquad {
    coeffs: BiquadCoeffs,
    w1: f64,
    w2: f64,
}

impl Biquad {
    /// Constructs a `Biquad` with coefficients chosen by `filter_type`
    /// applied to `params`, with the delay-line state zeroed.
    pub fn from_params(params: &ValidParams, filter_type: FilterType) -> Self {
        let coeffs = match filter_type {
            FilterType::Peaking => BiquadCoeffs::peaking(params),
            FilterType::LowShelf => BiquadCoeffs::low_shelf(params),
            FilterType::HighShelf => BiquadCoeffs::high_shelf(params),
        };
        Self { coeffs, w1: 0.0, w2: 0.0 }
    }

    /// Processes one input sample `x`, returning the filtered output `y`.
    ///
    /// Implements the Direct Form II Transposed recurrence, which uses two
    /// state words:
    ///
    /// ```text
    /// y   = b0·x + w1
    /// w1' = b1·x − a1·y + w2
    /// w2' = b2·x − a2·y
    /// ```
    ///
    /// The two `f64` state words are updated in place, with no heap allocation.
    pub fn process(&mut self, x: f64) -> f64 {
        let y = self.coeffs.b0 * x + self.w1;
        self.w1 = self.coeffs.b1 * x - self.coeffs.a1 * y + self.w2;
        self.w2 = self.coeffs.b2 * x - self.coeffs.a2 * y;
        y
    }

    /// Clears the delay line, returning the filter to its post-construction
    /// state without touching the coefficients and without reallocating.
    ///
    /// After `reset`, the filter behaves identically to a fresh
    /// [`Biquad::from_params`] built with the same coefficients.
    pub fn reset(&mut self) {
        self.w1 = 0.0;
        self.w2 = 0.0;
    }

    /// Returns the filter's coefficients.
    ///
    /// `#[doc(hidden)]`: this accessor exists so integration tests under
    /// `tests/` can inspect the coefficients of a constructed filter. It is
    /// not re-exported at the crate root and is not part of the stable
    /// public API. It is intended for test use only.
    #[doc(hidden)]
    pub fn coeffs(&self) -> BiquadCoeffs {
        self.coeffs
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    fn nominal_params() -> ValidParams {
        ValidParams::new(1000.0, 44100.0, 1.0, 6.0, 1.0).unwrap()
    }

    #[test]
    fn from_params_peaking_zeros_state() {
        let b = Biquad::from_params(&nominal_params(), FilterType::Peaking);
        assert_eq!(b.w1, 0.0);
        assert_eq!(b.w2, 0.0);
    }

    #[test]
    fn from_params_low_shelf_zeros_state() {
        let b = Biquad::from_params(&nominal_params(), FilterType::LowShelf);
        assert_eq!(b.w1, 0.0);
        assert_eq!(b.w2, 0.0);
    }

    #[test]
    fn from_params_high_shelf_zeros_state() {
        let b = Biquad::from_params(&nominal_params(), FilterType::HighShelf);
        assert_eq!(b.w1, 0.0);
        assert_eq!(b.w2, 0.0);
    }

    #[test]
    fn from_params_dispatches_to_correct_constructor() {
        let p = nominal_params();
        let b_peak = Biquad::from_params(&p, FilterType::Peaking);
        let b_ls = Biquad::from_params(&p, FilterType::LowShelf);
        // Different filter types must produce different coefficient sets.
        assert_ne!(b_peak.coeffs.b0, b_ls.coeffs.b0);
    }

    #[test]
    fn process_first_output_is_b0_for_unit_impulse() {
        // With zero initial state, the first output of an impulse is exactly
        // y0 = b0·1 + w1 = b0.
        let mut b = Biquad::from_params(&nominal_params(), FilterType::Peaking);
        let y0 = b.process(1.0);
        assert_eq!(y0, b.coeffs.b0);
    }

    #[test]
    fn process_impulse_response_decays_to_zero() {
        // A stable biquad (poles strictly inside the unit circle) has an
        // impulse response that decays to zero. Feed a unit impulse followed
        // by zeros and check the tail is negligible.
        let mut b = Biquad::from_params(&nominal_params(), FilterType::Peaking);
        let mut y = b.process(1.0);
        for _ in 0..2000 {
            y = b.process(0.0);
        }
        assert!(y.abs() < 1e-9, "impulse response failed to decay: {}", y);
    }

    #[test]
    fn process_zero_input_from_zero_state_is_zero() {
        let mut b = Biquad::from_params(&nominal_params(), FilterType::LowShelf);
        assert_eq!(b.process(0.0), 0.0);
        assert_eq!(b.process(0.0), 0.0);
    }

    #[test]
    fn reset_zeroes_delay_state() {
        let mut b = Biquad::from_params(&nominal_params(), FilterType::Peaking);
        // Drive the filter so the delay line is non-zero.
        let _ = b.process(1.0);
        let _ = b.process(0.5);
        assert!(b.w1 != 0.0 || b.w2 != 0.0);
        b.reset();
        assert_eq!(b.w1, 0.0);
        assert_eq!(b.w2, 0.0);
    }

    #[test]
    fn reset_restores_fresh_instance_behavior() {
        let p = nominal_params();
        let mut driven = Biquad::from_params(&p, FilterType::HighShelf);
        for &x in &[1.0, -0.3, 0.7, 0.2] {
            let _ = driven.process(x);
        }
        driven.reset();

        // Post-reset state must equal a freshly constructed filter, so the
        // two produce bit-identical output for the same input stream.
        let mut fresh = Biquad::from_params(&p, FilterType::HighShelf);
        for &x in &[0.9, -0.1, 0.4] {
            assert_eq!(driven.process(x), fresh.process(x));
        }
    }

    #[test]
    fn coeffs_returns_constructor_coefficients() {
        let p = nominal_params();
        let b = Biquad::from_params(&p, FilterType::Peaking);
        assert_eq!(b.coeffs(), BiquadCoeffs::peaking(&p));
    }
}
