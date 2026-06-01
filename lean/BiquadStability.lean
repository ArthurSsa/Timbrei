import Mathlib
import FilterParams

/-!
# RBJ denominator coefficients over ℝ

Noncomputable real-valued definitions of the two denominator coefficients
`a₁`, `a₂` of the normalized biquad transfer function for each of the three
RBJ parametric filters (peaking, low shelf, high shelf).

These mirror, term for term, the `f64` formulas in `src/coefficients.rs` and
the Python reference in `eval/rbj_reference.py`, lifted to exact real
arithmetic. They are the inputs to the pole-containment (stability) theorems
`peaking_stability`, `low_shelf_stability`, and `high_shelf_stability`
(US-15 to US-17), each of which feeds these coefficients to
`SchurCohn.schur_cohn_degree2`.

`a₀` (the normalizing denominator) is factored out as its own definition for
each filter so the stability proofs can reason about it directly.
-/

namespace BiquadStability

open Real

/-! ## Peaking -/

/-- Peaking bandwidth parameter `α = sin ω₀ / (2Q)`. -/
noncomputable def alphaPeak (p : ValidParams) : ℝ :=
  Real.sin p.omega / (2 * p.q)

/-- Peaking normalizing coefficient `a₀ = 1 + α / A`. -/
noncomputable def a0_peak (p : ValidParams) : ℝ :=
  1 + alphaPeak p / p.A

/-- Peaking `a₁ = (-2 cos ω₀) / a₀`. -/
noncomputable def a1_peak (p : ValidParams) : ℝ :=
  (-2 * Real.cos p.omega) / a0_peak p

/-- Peaking `a₂ = (1 - α / A) / a₀`. -/
noncomputable def a2_peak (p : ValidParams) : ℝ :=
  (1 - alphaPeak p / p.A) / a0_peak p

/-! ## Shelving filters

Both shelves share the slope-based bandwidth parameter `α` and the
`2 √A · α` term. -/

/-- Shelf bandwidth parameter `α = (sin ω₀ / 2) · √((A + 1/A)(1/S − 1) + 2)`. -/
noncomputable def alphaShelf (p : ValidParams) : ℝ :=
  (Real.sin p.omega / 2) * Real.sqrt ((p.A + 1 / p.A) * (1 / p.s - 1) + 2)

/-- The recurring shelf term `2 √A · α`. -/
noncomputable def twoSqrtAAlpha (p : ValidParams) : ℝ :=
  2 * Real.sqrt p.A * alphaShelf p

/-! ### Low shelf -/

/-- Low-shelf normalizing coefficient
`a₀ = (A+1) + (A−1) cos ω₀ + 2 √A · α`. -/
noncomputable def a0_lowshelf (p : ValidParams) : ℝ :=
  (p.A + 1) + (p.A - 1) * Real.cos p.omega + twoSqrtAAlpha p

/-- Low-shelf `a₁ = (−2 ((A−1) + (A+1) cos ω₀)) / a₀`. -/
noncomputable def a1_lowshelf (p : ValidParams) : ℝ :=
  (-2 * ((p.A - 1) + (p.A + 1) * Real.cos p.omega)) / a0_lowshelf p

/-- Low-shelf `a₂ = ((A+1) + (A−1) cos ω₀ − 2 √A · α) / a₀`. -/
noncomputable def a2_lowshelf (p : ValidParams) : ℝ :=
  ((p.A + 1) + (p.A - 1) * Real.cos p.omega - twoSqrtAAlpha p) / a0_lowshelf p

/-! ### High shelf -/

/-- High-shelf normalizing coefficient
`a₀ = (A+1) − (A−1) cos ω₀ + 2 √A · α`. -/
noncomputable def a0_highshelf (p : ValidParams) : ℝ :=
  (p.A + 1) - (p.A - 1) * Real.cos p.omega + twoSqrtAAlpha p

/-- High-shelf `a₁ = (2 ((A−1) − (A+1) cos ω₀)) / a₀`. -/
noncomputable def a1_highshelf (p : ValidParams) : ℝ :=
  (2 * ((p.A - 1) - (p.A + 1) * Real.cos p.omega)) / a0_highshelf p

/-- High-shelf `a₂ = ((A+1) − (A−1) cos ω₀ − 2 √A · α) / a₀`. -/
noncomputable def a2_highshelf (p : ValidParams) : ℝ :=
  ((p.A + 1) - (p.A - 1) * Real.cos p.omega - twoSqrtAAlpha p) / a0_highshelf p

end BiquadStability
