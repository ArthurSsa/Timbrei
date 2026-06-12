# lemi

**Formalization of Digital Filter Theory with Applications to Parametric Audio Equalization**

IFCE · APS 2026.1

## Mathlib4 commit

Pinned to commit `35aa1b81562b286c55beabdf02fa78e7f4b43b3f` via `lake-manifest.json`.

## Build

```bash
lake build                              # Lean 4
cargo build                            # Rust std
cargo build --no-default-features      # Rust no_std
```

## Embedded / `no_std`

The library targets the Cortex-M4 (`thumbv7em-none-eabihf`) and builds with
no errors and no warnings:

```bash
rustup target add thumbv7em-none-eabihf
RUSTFLAGS="-D warnings" cargo build --target thumbv7em-none-eabihf --no-default-features
```

The signal path (`ValidParams`, `BiquadCoeffs` and its three RBJ
constructors, and `Biquad` with `from_params`, `process`, and `reset`) uses
only fixed-size `f64` values and `libm`. It contains no `Box`, `Vec`, or
`String`, so coefficient generation and per-sample processing perform no heap
allocation. The `no_std` build above links without an allocator, which would
fail if any heap allocation were present.

The only `std`-dependent code is `src/frequency.rs` and the `rbj_eval`
binary, used by the offline evaluation scripts. Both are gated behind
`#[cfg(feature = "std")]` and are excluded from the embedded build.

## Evaluation

```bash
python eval/rbj_reference.py            # regenerate ULP fixtures
python eval/rbj_compare.py              # Rust vs Python response plots (eval/*.svg)
```
