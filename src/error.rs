//! Error type for `ValidParams` construction.

/// Reasons why filter parameters can fail validation.
///
/// Returned by [`crate::ValidParams::new`] when a parameter
/// violates one of the six predicate conditions documented in
/// `lean/FilterParams.lean`.
#[derive(Debug, Clone, Copy, PartialEq, Eq)]
pub enum FilterParamError {
    /// Centre frequency `f0` must be strictly positive.
    FrequencyNotPositive,
    /// Centre frequency `f0` must be below the Nyquist frequency `fs / 2`.
    FrequencyExceedsNyquist,
    /// Sample rate `fs` must be strictly positive.
    SampleRateNotPositive,
    /// Quality factor `q` must be strictly positive.
    QNotPositive,
    /// Shelf slope `s` must be strictly positive.
    ShelfSlopeNotPositive,
    /// Shelf slope `s` must not exceed 1.
    ShelfSlopeExceedsOne,
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn each_variant_constructs() {
        let _ = FilterParamError::FrequencyNotPositive;
        let _ = FilterParamError::FrequencyExceedsNyquist;
        let _ = FilterParamError::SampleRateNotPositive;
        let _ = FilterParamError::QNotPositive;
        let _ = FilterParamError::ShelfSlopeNotPositive;
        let _ = FilterParamError::ShelfSlopeExceedsOne;
    }

    #[test]
    fn variants_are_distinct() {
        assert_ne!(
            FilterParamError::FrequencyNotPositive,
            FilterParamError::QNotPositive
        );
    }
}
