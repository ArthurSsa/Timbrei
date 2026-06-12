//! Ponte WebAssembly para o DSP verificado do `lemi`.
//!
//! Este crate é uma casca fina: toda a matemática (validação de parâmetros,
//! coeficientes RBJ e resposta em frequência) vem, sem alterações, do crate
//! `lemi` — a implementação de referência em Rust formalmente verificada em
//! Lean 4. Aqui só traduzimos a API para o limite JavaScript via wasm-bindgen.
//!
//! Os coeficientes são devolvidos como `[b0, b1, b2, a1, a2]` (já normalizados
//! por a0, idêntico a `lemi::BiquadCoeffs`), num `Vec<f64>` que o wasm-bindgen
//! converte para `Float64Array`. Isso evita gerir manualmente o ciclo de vida
//! de objetos do lado JS.

use lemi::coefficients::BiquadCoeffs;
use lemi::frequency;
use lemi::params::ValidParams;
use wasm_bindgen::prelude::*;

/// `s` é irrelevante para o peaking (que usa Q), mas `ValidParams` exige um
/// valor válido em (0, 1]; usamos a unidade. Espelha o que `verifiedBiquad.ts`
/// faz implicitamente ao não consumir S no caminho do peaking.
const PEAKING_S: f64 = 1.0;
/// `q` é irrelevante para os shelves (que usam a inclinação S), mas
/// `ValidParams` exige um Q positivo; usamos um valor nominal.
const SHELF_Q: f64 = 0.707;

fn coeffs_to_vec(c: BiquadCoeffs) -> Vec<f64> {
    vec![c.b0, c.b1, c.b2, c.a1, c.a2]
}

fn to_js_err(e: lemi::FilterParamError) -> JsError {
    JsError::new(&format!("parâmetros de filtro inválidos: {:?}", e))
}

/// Peaking EQ — `lemi::BiquadCoeffs::peaking`. Usa o fator de qualidade Q.
/// Devolve `[b0, b1, b2, a1, a2]`.
#[wasm_bindgen]
pub fn peaking(f0: f64, fs: f64, q: f64, gain_db: f64) -> Result<Vec<f64>, JsError> {
    let p = ValidParams::new(f0, fs, q, gain_db, PEAKING_S).map_err(to_js_err)?;
    Ok(coeffs_to_vec(BiquadCoeffs::peaking(&p)))
}

/// Low Shelf — `lemi::BiquadCoeffs::low_shelf`. Usa a inclinação S ∈ (0, 1].
/// Devolve `[b0, b1, b2, a1, a2]`.
#[wasm_bindgen]
pub fn low_shelf(f0: f64, fs: f64, s: f64, gain_db: f64) -> Result<Vec<f64>, JsError> {
    let p = ValidParams::new(f0, fs, SHELF_Q, gain_db, s).map_err(to_js_err)?;
    Ok(coeffs_to_vec(BiquadCoeffs::low_shelf(&p)))
}

/// High Shelf — `lemi::BiquadCoeffs::high_shelf`. Usa a inclinação S ∈ (0, 1].
/// Devolve `[b0, b1, b2, a1, a2]`.
#[wasm_bindgen]
pub fn high_shelf(f0: f64, fs: f64, s: f64, gain_db: f64) -> Result<Vec<f64>, JsError> {
    let p = ValidParams::new(f0, fs, SHELF_Q, gain_db, s).map_err(to_js_err)?;
    Ok(coeffs_to_vec(BiquadCoeffs::high_shelf(&p)))
}

/// Magnitude em dB de um biquad normalizado em ω (rad/amostra), usando a
/// resposta complexa verificada `lemi::frequency::response`.
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
