//! Full ULP compliance matrix (US-36).
//!
//! Loads every record in `fixtures/rbj_coefficients.json`, the matrix
//! produced by `eval/rbj_reference.py::generate_fixtures`. It covers all three
//! filter types across two sample rates, four centre frequencies, the
//! bandwidth parameter (Q or slope S), and a five-point gain ladder, and
//! verifies that the Rust implementation agrees with the Python reference to
//! within 4 ULP on every coefficient of every record.

mod common;

use lemi::{BiquadCoeffs, ValidParams};
use serde_json::Value;

const TOLERANCE_ULP: u64 = 4;

/// Rebuilds `ValidParams` from a fixture record and computes the coefficients
/// for the record's filter type, dispatching the same way `Biquad` does.
fn compute_for_record(record: &Value) -> BiquadCoeffs {
    let f0 = record["f0"].as_f64().unwrap();
    let fs = record["fs"].as_f64().unwrap();
    let q = record["q"].as_f64().unwrap();
    let gain = record["gain"].as_f64().unwrap();
    let s = record["s"].as_f64().unwrap();
    let params = ValidParams::new(f0, fs, q, gain, s)
        .expect("fixture parameters must be valid");

    match record["type"].as_str().unwrap() {
        "peaking" => BiquadCoeffs::peaking(&params),
        "low_shelf" => BiquadCoeffs::low_shelf(&params),
        "high_shelf" => BiquadCoeffs::high_shelf(&params),
        other => panic!("unknown filter type in fixture: {}", other),
    }
}

#[test]
fn full_ulp_matrix_within_tolerance() {
    let fixture_text = include_str!("../fixtures/rbj_coefficients.json");
    let records: Vec<Value> =
        serde_json::from_str(fixture_text).expect("fixture must parse");

    assert!(!records.is_empty(), "fixture matrix must not be empty");

    for record in &records {
        let computed = compute_for_record(record);
        let got = (
            computed.b0,
            computed.b1,
            computed.b2,
            computed.a1,
            computed.a2,
        );
        let expected = (
            record["b0"].as_f64().unwrap(),
            record["b1"].as_f64().unwrap(),
            record["b2"].as_f64().unwrap(),
            record["a1"].as_f64().unwrap(),
            record["a2"].as_f64().unwrap(),
        );

        // A descriptive label so a failure pinpoints the offending record.
        let label = format!(
            "{}@f0={},fs={},q={},gain={},s={}",
            record["type"].as_str().unwrap(),
            record["f0"], record["fs"], record["q"], record["gain"], record["s"],
        );
        common::assert_coeffs_within_ulp(&label, got, expected, TOLERANCE_ULP);
    }
}

#[test]
fn matrix_covers_all_three_filter_types() {
    let fixture_text = include_str!("../fixtures/rbj_coefficients.json");
    let records: Vec<Value> =
        serde_json::from_str(fixture_text).expect("fixture must parse");

    for ty in ["peaking", "low_shelf", "high_shelf"] {
        assert!(
            records.iter().any(|r| r["type"] == ty),
            "matrix is missing records for filter type {}",
            ty
        );
    }
}
