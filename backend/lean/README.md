# Lean formalization

Machine-checked proofs for the digital-filter library. Every file below
builds under `lake build` with no `sorry` and no axioms beyond Mathlib's. The
theorems establish, in exact real and complex arithmetic, the stability
properties that the Rust implementation (`src/`) computes numerically.

| File | Role |
|------|------|
| `FilterParams.lean` | `ValidParams`, `FilterType`, `ω₀`, `A` |
| `BilinearTransform.lean` | disk to left-half-plane theorem |
| `SchurCohn.lean` | degree-two Schur-Cohn criterion (standalone) |
| `BiquadStability.lean` | RBJ coefficients and pole-containment theorems |

## `FilterParams.lean`: the validated parameter record

`ValidParams` bundles the five filter parameters (`f0`, `fs`, `q`, `gain`,
`s`) with their validity hypotheses as proof-carrying fields: `0 < f0`,
`0 < fs`, `f0 < fs/2` (Nyquist), `0 < q`, and `0 < s ≤ 1`. Any `ValidParams`
value therefore satisfies these conditions, matching the checked constructor
`ValidParams::new` in `src/params.rs`. The derived quantities

* `ValidParams.omega`, the angular centre frequency `ω₀ = 2π·f0/fs`,
* `ValidParams.A`, the gain amplitude `A = √(10^(gain/20))`,

correspond to `omega()` and `a_factor()` on the Rust side.

## `BilinearTransform.lean`: disk maps to the left half-plane

> **`bilinear_maps_disk_to_lhp`**: for `z : ℂ` with `‖z‖ < 1`, the bilinear
> transform `s = (z − 1)/(z + 1)` satisfies `Re(s) < 0`.

The real part is computed in closed form, `Re(s) = (‖z‖² − 1) / ‖z + 1‖²`. On
the open unit disk the numerator is negative (`‖z‖² < 1`) and the denominator
positive (`z + 1 ≠ 0`, since `z = −1` would force `‖z‖ = 1`), so the quotient
is negative. This is the analytic form of the discrete-time stability
condition: a `z`-plane pole inside the unit circle corresponds to an
`s`-plane pole with negative real part, the continuous counterpart of the
algebraic Schur-Cohn test used by the implementation.

## `SchurCohn.lean`: the degree-two stability criterion

A standalone development (it imports only Mathlib) of the Schur-Cohn / Jury
test for a monic real quadratic `z² + a₁·z + a₂`. The sufficient conditions
are `|a₂| < 1` and `|a₁| < 1 + a₂`.

> **`schur_cohn_complex_case`**: if a root `z` is non-real, then `‖z‖ < 1`.

A non-real root has its complex conjugate as the second root, and the two are
distinct. Subtracting the two root equations gives the Vieta sum
`z + conj z = −a₁`; back-substitution gives the product `z · conj z = a₂`.
Since `z · conj z = ‖z‖²`, this gives `‖z‖² = a₂ < 1`.

> **`schur_cohn_real_case`**: if a root `x` is real, then `|x| < 1`.

With the companion root `s = −a₁ − x`, the hypotheses give
`p(1) = (1−x)(1−s) > 0` and `p(−1) = (1+x)(1+s) > 0`, so `(1−x²)(1−s²) > 0`.
Together with `(x·s)² = a₂² < 1` this forces `x² < 1`.

> **`schur_cohn_degree2`**: every root of `z² + a₁·z + a₂` has `‖z‖ < 1`.

The main theorem splits on whether the root is real and applies the two
auxiliary lemmas.

## `BiquadStability.lean`: RBJ pole containment

Noncomputable real definitions of the denominator coefficients `a₁`, `a₂`
(and the normalizing `a₀`) for the peaking, low-shelf, and high-shelf
filters, taken term for term from `src/coefficients.rs`. The three theorems

> **`peaking_stability`**, **`low_shelf_stability`**,
> **`high_shelf_stability`**: every pole of the respective biquad satisfies
> `‖z‖ < 1`.

Each verifies the two Schur-Cohn inequalities for its RBJ coefficients and
applies `schur_cohn_degree2`. All three reduce to the same elementary facts
about a `ValidParams`:

* `0 < ω₀ < π` (from `0 < f0 < fs/2`), hence `sin ω₀ > 0` and `cos² ω₀ < 1`;
* `A > 0`;
* for the shelves, the term `2√A·α > 0` (its radicand is at least 2).

A helper, `schur_cond`, reduces `|n/a₀| < 1`-style goals on the normalized
coefficients to sign bounds on the unnormalized numerators.

These theorems correspond to `Biquad::process` (`src/biquad.rs`): for any
`ValidParams`, the Direct Form II Transposed recursion is BIBO-stable because
its poles lie strictly inside the unit circle. The ULP-conformance suite
(`tests/`) checks that the `f64` coefficients match this real-arithmetic
model.
