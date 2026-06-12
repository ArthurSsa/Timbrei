//! `rbj_eval` is a small CLI bridge so evaluation scripts can obtain the Rust
//! frequency response by subprocess (used by `eval/rbj_compare.py`).
//!
//! Usage:
//!   rbj_eval B0 B1 B2 A1 A2 < omegas.txt
//!
//! The five normalized biquad coefficients are passed as arguments; the
//! whitespace-separated list of normalized angular frequencies ω (rad/sample)
//! is read from stdin. For each ω the program prints the complex response
//! `re im` (one pair per line) computed by `lemi::frequency::response`.

use std::io::Read;

use lemi::frequency;
use lemi::BiquadCoeffs;

fn main() {
    let args: Vec<f64> = std::env::args()
        .skip(1)
        .map(|s| s.parse().expect("coefficient must be a float"))
        .collect();
    assert_eq!(args.len(), 5, "expected 5 coefficients: B0 B1 B2 A1 A2");

    let coeffs = BiquadCoeffs {
        b0: args[0],
        b1: args[1],
        b2: args[2],
        a1: args[3],
        a2: args[4],
    };

    let mut input = String::new();
    std::io::stdin()
        .read_to_string(&mut input)
        .expect("failed to read omegas from stdin");

    let mut out = String::new();
    for tok in input.split_whitespace() {
        let omega: f64 = tok.parse().expect("omega must be a float");
        let (re, im) = frequency::response(&coeffs, omega);
        out.push_str(&format!("{:.17e} {:.17e}\n", re, im));
    }
    print!("{}", out);
}
