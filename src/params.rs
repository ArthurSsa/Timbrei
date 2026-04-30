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
}
