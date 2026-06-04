# Traceability

This table links each requirement to the user stories that satisfy it, the
verifiable completion criterion for each, and the section of the project
scope (§9) it falls under. Every requirement maps to a documented, checkable
criterion.

**§9 scope areas**

- **§9.1 Formal core**: Lean theorems (parameters, bilinear transform,
  Schur-Cohn, pole containment).
- **§9.2 Numerical implementation**: Rust `no_std` filter and coefficients.
- **§9.3 Conformance**: Python reference, fixtures, ULP suite.
- **§9.4 Embedded and performance**: Cortex-M4, allocation-free hot path.
- **§9.5 Reproducibility and documentation**: CI, visualization, papers.

## Functional requirements

| Req | Stories | Completion criterion | §9 |
|-----|---------|----------------------|----|
| RF-L1 | US-05, US-06, US-07 | `ValidParams`, `FilterType`, `ω₀`, `A` defined; `FilterParams.lean` builds | §9.1 |
| RF-L2 | US-08, US-09 | `bilinear_maps_disk_to_lhp` proved without `sorry` | §9.1 |
| RF-L3 | US-10 to US-13 | `schur_cohn_degree2` (and both cases) proved, standalone, no `sorry` | §9.1 |
| RF-L4 | US-14 to US-17 | `peaking/low_shelf/high_shelf_stability` proved without `sorry` | §9.1 |
| RF-L5 | US-18, US-42 | `lean/README.md` documents every theorem; article prototype compiles | §9.5 |
| RF-R1 | US-19, US-20, US-21 | `FilterParamError`, checked `ValidParams::new`, `no_std` accessors | §9.2 |
| RF-R2 | US-22, US-23, US-24 | RBJ `peaking`/`low_shelf`/`high_shelf` within 4 ULP | §9.2 |
| RF-R3 | US-25, US-26, US-28 | `Biquad::from_params`/`process`/`coeffs` correct | §9.2 |
| RF-R4 | US-29 | `frequency::evaluate` callable from eval scripts (subprocess) | §9.5 |
| RF-R5 | US-27 | `Biquad::reset` clears state without reallocation | §9.2 |
| RF-E1 | US-30, US-31, US-32 | Python reference and `rbj_coefficients.json` fixture generated | §9.3 |
| RF-E2 | US-35, US-36 | Full ULP matrix passes (`cargo test`) | §9.3 |
| RF-E3 | US-38 | `rbj_compare.py` plots; Rust vs Python below 1e-10 dB | §9.5 |

## Non-functional requirements

| Req | Stories | Completion criterion | §9 |
|-----|---------|----------------------|----|
| RNF-M1 | US-04 | CI runs lake, cargo, Cortex-M4, and Python on every PR | §9.5 |
| RNF-M3 | US-01, US-41 | Structured repo; traceability table complete (this file) | §9.5 |
| RNF-P1 | US-02 | `cargo build` and `--no-default-features` build cleanly | §9.4 |
| RNF-P2 | US-39 | Cortex-M4 cross-compile: no errors, no warnings (`-D warnings`) | §9.4 |
| RNF-P3 | US-40 | No `Box`/`Vec`/`String` on the hot path; `no_std` links | §9.4 |
| RNF-C1 | US-43 | No `sorry` in any Lean file | §9.1 |
| RNF-C2 | US-03 | Mathlib revision pinned; reproducible `lake build` | §9.5 |
| RNF-C3 | US-34 | `assert_coeffs_within_ulp` reports label/coeff/got/exp/ULP | §9.3 |
| RNF-C4 | US-37 | `unity_gain_is_identity` holds for all three filter types | §9.3 |
| RNF-N3 | US-33 | `ulp_distance` with NaN guard and signed-zero normalization | §9.3 |
