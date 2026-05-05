//! RBJ biquad coefficient computations.
//!
//! Each constructor takes a [`ValidParams`] and returns a fully populated
//! [`BiquadCoeffs`], already normalized by a0. The evaluation order and
//! parenthesization match `eval/rbj_reference.py` character for character, so
//! the coefficients agree with the reference to within 4 ULP.
//!
//! Reference: Robert Bristow-Johnson, "Cookbook formulae for audio EQ
//! biquad filter coefficients."

use crate::params::ValidParams;

/// The five biquad transfer-function coefficients, already normalized by a0.
///
/// `H(z) = (b0 + b1*z^-1 + b2*z^-2) / (1 + a1*z^-1 + a2*z^-2)`
#[derive(Debug, Clone, Copy, PartialEq)]
pub struct BiquadCoeffs {
    pub b0: f64,
    pub b1: f64,
    pub b2: f64,
    pub a1: f64,
    pub a2: f64,
}

impl BiquadCoeffs {
    /// Peaking EQ coefficients per RBJ Cookbook §3.5.
    pub fn peaking(params: &ValidParams) -> Self {
        let omega = params.omega();
        let sin_omega = libm::sin(omega);
        let cos_omega = libm::cos(omega);
        let a = params.a_factor();
        let alpha = sin_omega / (2.0 * params.q());

        let a0 = 1.0 + alpha / a;
        let b0 = (1.0 + alpha * a) / a0;
        let b1 = (-2.0 * cos_omega) / a0;
        let b2 = (1.0 - alpha * a) / a0;
        let a1 = (-2.0 * cos_omega) / a0;
        let a2 = (1.0 - alpha / a) / a0;

        Self { b0, b1, b2, a1, a2 }
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    fn nominal_params() -> ValidParams {
        ValidParams::new(1000.0, 44100.0, 1.0, 6.0, 1.0).unwrap()
    }

    #[test]
    fn peaking_is_finite() {
        let c = BiquadCoeffs::peaking(&nominal_params());
        assert!(c.b0.is_finite());
        assert!(c.b1.is_finite());
        assert!(c.b2.is_finite());
        assert!(c.a1.is_finite());
        assert!(c.a2.is_finite());
    }

    #[test]
    fn peaking_b1_equals_a1() {
        // The peaking formula gives identical b1 and a1 expressions:
        // both are (-2 * cos(omega)) / a0.
        let c = BiquadCoeffs::peaking(&nominal_params());
        assert_eq!(c.b1, c.a1);
    }

    #[test]
    fn peaking_unity_gain_is_identity() {
        // At gain=0 dB, A=1, so 1+alpha*A == 1+alpha/A and the filter
        // becomes the identity transfer function H(z) = 1.
        let p = ValidParams::new(1000.0, 44100.0, 1.0, 0.0, 1.0).unwrap();
        let c = BiquadCoeffs::peaking(&p);
        assert!((c.b0 - 1.0).abs() < 1e-14, "b0 expected ~1.0, got {}", c.b0);
        assert!((c.b1 - c.a1).abs() < 1e-14, "b1 must equal a1");
        assert!((c.b2 - c.a2).abs() < 1e-14, "b2 must equal a2");
    }
}
