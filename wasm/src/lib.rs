//! WebAssembly bridge to the verified DSP in `lemi`.
//!
//! This crate is a thin shell: all the mathematics (parameter validation, RBJ
//! coefficients, and frequency response) comes unchanged from the `lemi` crate,
//! the reference Rust implementation formally verified in Lean 4. Here we only
//! translate the API across the JavaScript boundary via wasm-bindgen.
//!
//! Coefficients are returned as `[b0, b1, b2, a1, a2]` (already normalized by
//! a0, identical to `lemi::BiquadCoeffs`) in a `Vec<f64>` that wasm-bindgen
//! converts to `Float64Array`. This avoids managing JS-side object lifetimes by
//! hand.

use lemi::coefficients::BiquadCoeffs;
use lemi::frequency;
use lemi::params::ValidParams;
use wasm_bindgen::prelude::*;

/// `s` is irrelevant for peaking (which uses Q), but `ValidParams` requires a
/// valid value in (0, 1]; we use unity. This mirrors what `verifiedBiquad.ts`
/// does implicitly by not consuming S on the peaking path.
const PEAKING_S: f64 = 1.0;
/// `q` is irrelevant for the shelves (which use the slope S), but `ValidParams`
/// requires a positive Q; we use a nominal value.
const SHELF_Q: f64 = 0.707;

fn coeffs_to_vec(c: BiquadCoeffs) -> Vec<f64> {
    vec![c.b0, c.b1, c.b2, c.a1, c.a2]
}

fn to_js_err(e: lemi::FilterParamError) -> JsError {
    JsError::new(&format!("invalid filter parameters: {:?}", e))
}

/// Peaking EQ. `lemi::BiquadCoeffs::peaking`. Uses the quality factor Q.
/// Returns `[b0, b1, b2, a1, a2]`.
#[wasm_bindgen]
pub fn peaking(f0: f64, fs: f64, q: f64, gain_db: f64) -> Result<Vec<f64>, JsError> {
    let p = ValidParams::new(f0, fs, q, gain_db, PEAKING_S).map_err(to_js_err)?;
    Ok(coeffs_to_vec(BiquadCoeffs::peaking(&p)))
}

/// Low Shelf. `lemi::BiquadCoeffs::low_shelf`. Uses the slope S in (0, 1].
/// Returns `[b0, b1, b2, a1, a2]`.
#[wasm_bindgen]
pub fn low_shelf(f0: f64, fs: f64, s: f64, gain_db: f64) -> Result<Vec<f64>, JsError> {
    let p = ValidParams::new(f0, fs, SHELF_Q, gain_db, s).map_err(to_js_err)?;
    Ok(coeffs_to_vec(BiquadCoeffs::low_shelf(&p)))
}

/// High Shelf. `lemi::BiquadCoeffs::high_shelf`. Uses the slope S in (0, 1].
/// Returns `[b0, b1, b2, a1, a2]`.
#[wasm_bindgen]
pub fn high_shelf(f0: f64, fs: f64, s: f64, gain_db: f64) -> Result<Vec<f64>, JsError> {
    let p = ValidParams::new(f0, fs, SHELF_Q, gain_db, s).map_err(to_js_err)?;
    Ok(coeffs_to_vec(BiquadCoeffs::high_shelf(&p)))
}

/// Magnitude in dB of a normalized biquad at ω (rad/sample), using the verified
/// complex response `lemi::frequency::response`.
/// `20·log10|H| = 10·log10(|H|²)`.
#[wasm_bindgen]
pub fn magnitude_db(b0: f64, b1: f64, b2: f64, a1: f64, a2: f64, w: f64) -> f64 {
    let c = BiquadCoeffs { b0, b1, b2, a1, a2 };
    let (re, im) = frequency::response(&c, w);
    let mag2 = re * re + im * im;
    if mag2 == 0.0 {
        0.0
    } else {
        10.0 * mag2.log10()
    }
}
