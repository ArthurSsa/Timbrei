//! Validated parameter record for parametric biquad filters.
//!
//! Mirrors `ValidParams` from `lean/FilterParams.lean`. Construction via
//! [`ValidParams::new`] enforces the same six predicate conditions that the
//! Lean structure carries as embedded hypothesis fields.

use crate::error::FilterParamError;

/// Validated parameters for a parametric biquad filter.
///
/// Construct via [`ValidParams::new`]. Direct field initialization is
/// prevented by the private fields, so any `ValidParams` value satisfies
/// the six predicate conditions.
#[derive(Debug, Clone, Copy, PartialEq)]
pub struct ValidParams {
    f0: f64,
    fs: f64,
    q: f64,
    gain: f64,
    s: f64,
}

impl ValidParams {
    /// Constructs a `ValidParams`, checking all six predicate conditions.
    ///
    /// Returns `Err` immediately on the first violated condition; conditions
    /// are checked in field-declaration order.
    pub fn new(
        f0: f64,
        fs: f64,
        q: f64,
        gain: f64,
        s: f64,
    ) -> Result<Self, FilterParamError> {
        if f0 <= 0.0 {
            return Err(FilterParamError::FrequencyNotPositive);
        }
        if fs <= 0.0 {
            return Err(FilterParamError::SampleRateNotPositive);
        }
        if f0 >= fs / 2.0 {
            return Err(FilterParamError::FrequencyExceedsNyquist);
        }
        if q <= 0.0 {
            return Err(FilterParamError::QNotPositive);
        }
        if s <= 0.0 {
            return Err(FilterParamError::ShelfSlopeNotPositive);
        }
        if s > 1.0 {
            return Err(FilterParamError::ShelfSlopeExceedsOne);
        }
        Ok(Self { f0, fs, q, gain, s })
    }

    /// Centre frequency f0 in Hz.
    pub fn f0(&self) -> f64 {
        self.f0
    }

    /// Sample rate fs in Hz.
    pub fn fs(&self) -> f64 {
        self.fs
    }

    /// Quality factor q.
    pub fn q(&self) -> f64 {
        self.q
    }

    /// Shelf/peaking gain in dB. May be negative.
    pub fn gain(&self) -> f64 {
        self.gain
    }

    /// Shelf slope s, constrained to (0, 1].
    pub fn s(&self) -> f64 {
        self.s
    }

    /// Angular centre frequency in radians per sample: omega = 2*pi*f0/fs.
    pub fn omega(&self) -> f64 {
        2.0 * core::f64::consts::PI * self.f0 / self.fs
    }

    /// Gain amplitude factor: A = sqrt(10^(gain/20)).
    pub fn a_factor(&self) -> f64 {
        libm::sqrt(libm::pow(10.0, self.gain / 20.0))
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    fn nominal() -> ValidParams {
        ValidParams::new(1000.0, 44100.0, 1.0, 6.0, 1.0).expect("nominal must be valid")
    }

    #[test]
    fn nominal_constructs() {
        let _ = nominal();
    }

    #[test]
    fn rejects_non_positive_frequency() {
        assert_eq!(
            ValidParams::new(0.0, 44100.0, 1.0, 0.0, 1.0),
            Err(FilterParamError::FrequencyNotPositive)
        );
        assert_eq!(
            ValidParams::new(-1.0, 44100.0, 1.0, 0.0, 1.0),
            Err(FilterParamError::FrequencyNotPositive)
        );
    }

    #[test]
    fn rejects_non_positive_sample_rate() {
        assert_eq!(
            ValidParams::new(1000.0, 0.0, 1.0, 0.0, 1.0),
            Err(FilterParamError::SampleRateNotPositive)
        );
    }

    #[test]
    fn rejects_frequency_at_or_above_nyquist() {
        assert_eq!(
            ValidParams::new(22050.0, 44100.0, 1.0, 0.0, 1.0),
            Err(FilterParamError::FrequencyExceedsNyquist)
        );
        assert_eq!(
            ValidParams::new(30000.0, 44100.0, 1.0, 0.0, 1.0),
            Err(FilterParamError::FrequencyExceedsNyquist)
        );
    }

    #[test]
    fn rejects_non_positive_q() {
        assert_eq!(
            ValidParams::new(1000.0, 44100.0, 0.0, 0.0, 1.0),
            Err(FilterParamError::QNotPositive)
        );
    }

    #[test]
    fn rejects_non_positive_shelf_slope() {
        assert_eq!(
            ValidParams::new(1000.0, 44100.0, 1.0, 0.0, 0.0),
            Err(FilterParamError::ShelfSlopeNotPositive)
        );
    }

    #[test]
    fn rejects_shelf_slope_above_one() {
        assert_eq!(
            ValidParams::new(1000.0, 44100.0, 1.0, 0.0, 1.5),
            Err(FilterParamError::ShelfSlopeExceedsOne)
        );
    }

    #[test]
    fn accepts_negative_gain() {
        let p = ValidParams::new(1000.0, 44100.0, 1.0, -12.0, 1.0);
        assert!(p.is_ok());
    }

    #[test]
    fn accessors_return_constructor_values() {
        let p = ValidParams::new(1000.0, 44100.0, 1.5, 6.0, 0.5).unwrap();
        assert_eq!(p.f0(), 1000.0);
        assert_eq!(p.fs(), 44100.0);
        assert_eq!(p.q(), 1.5);
        assert_eq!(p.gain(), 6.0);
        assert_eq!(p.s(), 0.5);
    }

    #[test]
    fn omega_is_correct_for_nominal() {
        let p = ValidParams::new(1000.0, 44100.0, 1.0, 0.0, 1.0).unwrap();
        let expected = 2.0 * core::f64::consts::PI * 1000.0 / 44100.0;
        assert_eq!(p.omega(), expected);
    }

    #[test]
    fn a_factor_unity_for_zero_gain() {
        let p = ValidParams::new(1000.0, 44100.0, 1.0, 0.0, 1.0).unwrap();
        // sqrt(10^0) = sqrt(1) = 1
        let a = p.a_factor();
        assert!((a - 1.0).abs() < 1e-15, "expected ~1.0, got {}", a);
    }

    #[test]
    fn a_factor_above_unity_for_positive_gain() {
        let p = ValidParams::new(1000.0, 44100.0, 1.0, 6.0, 1.0).unwrap();
        let a = p.a_factor();
        // sqrt(10^0.3) ~ sqrt(1.9953) ~ 1.4125
        assert!(a > 1.0, "positive gain should give A > 1, got {}", a);
        assert!((a - 1.4125375446227544).abs() < 1e-12, "got {}", a);
    }

    #[test]
    fn a_factor_below_unity_for_negative_gain() {
        let p = ValidParams::new(1000.0, 44100.0, 1.0, -6.0, 1.0).unwrap();
        let a = p.a_factor();
        assert!(a < 1.0, "negative gain should give A < 1, got {}", a);
    }
}
