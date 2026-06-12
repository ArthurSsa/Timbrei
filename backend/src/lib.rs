#![cfg_attr(not(feature = "std"), no_std)]

pub mod biquad;
pub mod coefficients;
pub mod error;
/// Offline frequency-response evaluation (eval scripts only; `std`-gated so it
/// stays out of the `no_std` hot path).
#[cfg(feature = "std")]
pub mod frequency;
pub mod params;

pub use biquad::{Biquad, FilterType};
pub use coefficients::BiquadCoeffs;
pub use error::FilterParamError;
pub use params::ValidParams;
