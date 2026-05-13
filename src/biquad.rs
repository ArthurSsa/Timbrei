//! The biquad filter as a stateful object.
//!
//! `Biquad` owns its [`BiquadCoeffs`] and the two delay-line samples
//! (`w1`, `w2`) used by Direct Form II Transposed. Construction via
//! [`Biquad::from_params`] yields a filter with zero initial state.
//!
//! `process`, `reset`, and `coeffs` accessors are added in Sprint 5
//! (US-26, US-27, US-28).

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
#[allow(dead_code)] // fields consumed by process/reset/coeffs in Sprint 5 (US-26/27/28)
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
}
