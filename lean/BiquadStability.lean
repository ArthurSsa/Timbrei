import Mathlib
import FilterParams
import SchurCohn

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

/-! ## Pole containment (stability)

The three theorems below show that each filter's poles lie strictly inside
the unit disk, by verifying the two Schur-Cohn inequalities `|a₂| < 1` and
`|a₁| < 1 + a₂` for the RBJ coefficients and feeding them to
`SchurCohn.schur_cohn_degree2`.

All three reduce to the same elementary facts about a `ValidParams`:
`0 < ω₀ < π` (so `sin ω₀ > 0` and `cos² ω₀ < 1`), `A > 0`, and, for the
shelves, that the `2 √A · α` term is strictly positive. -/

/-- The Schur-Cohn conditions for a normalized pair `a₁ = n₁/a₀`,
`a₂ = n₂/a₀` follow from the sign bounds on the *unnormalized* numerators:
`|n₂| < a₀` and `|n₁| < a₀ + n₂`. -/
theorem schur_cond {a0 n1 n2 : ℝ} (ha0 : 0 < a0)
    (h2gt : -a0 < n2) (h2lt : n2 < a0)
    (h1gt : -(a0 + n2) < n1) (h1lt : n1 < a0 + n2) :
    |n2 / a0| < 1 ∧ |n1 / a0| < 1 + n2 / a0 := by
  refine ⟨?_, ?_⟩
  · rw [abs_div, abs_of_pos ha0, div_lt_one ha0]
    exact abs_lt.mpr ⟨h2gt, h2lt⟩
  · have hrw : (1 : ℝ) + n2 / a0 = (a0 + n2) / a0 := by field_simp
    rw [hrw, abs_div, abs_of_pos ha0]
    gcongr
    exact abs_lt.mpr ⟨h1gt, h1lt⟩

/-! ### Elementary `ValidParams` facts -/

/-- `0 < ω₀`. -/
theorem omega_pos (p : ValidParams) : 0 < p.omega := by
  unfold ValidParams.omega
  exact div_pos (mul_pos (mul_pos two_pos Real.pi_pos) p.hf0) p.hfs

/-- `ω₀ < π`, equivalent to the Nyquist constraint `f₀ < fₛ/2`. -/
theorem omega_lt_pi (p : ValidParams) : p.omega < Real.pi := by
  unfold ValidParams.omega
  rw [div_lt_iff₀ p.hfs]
  nlinarith [mul_pos Real.pi_pos (show (0 : ℝ) < p.fs / 2 - p.f0 by linarith [p.hNyquist])]

/-- `0 < sin ω₀`. -/
theorem sin_omega_pos (p : ValidParams) : 0 < Real.sin p.omega :=
  Real.sin_pos_of_pos_of_lt_pi (omega_pos p) (omega_lt_pi p)

/-- `cos ω₀ < 1`. -/
theorem cos_omega_lt_one (p : ValidParams) : Real.cos p.omega < 1 := by
  nlinarith [Real.sin_sq_add_cos_sq p.omega, pow_pos (sin_omega_pos p) 2]

/-- `-1 < cos ω₀`. -/
theorem neg_one_lt_cos_omega (p : ValidParams) : -1 < Real.cos p.omega := by
  nlinarith [Real.sin_sq_add_cos_sq p.omega, pow_pos (sin_omega_pos p) 2]

/-- `0 < A`. -/
theorem A_pos (p : ValidParams) : 0 < p.A := by
  unfold ValidParams.A
  exact Real.sqrt_pos.mpr (Real.rpow_pos_of_pos (by norm_num) _)

/-! ### Peaking stability -/

/-- The peaking RBJ coefficients satisfy the Schur-Cohn conditions. -/
theorem peaking_schur (p : ValidParams) :
    |a2_peak p| < 1 ∧ |a1_peak p| < 1 + a2_peak p := by
  have halpha : 0 < alphaPeak p := by
    unfold alphaPeak; exact div_pos (sin_omega_pos p) (by linarith [p.hq])
  have hu : 0 < alphaPeak p / p.A := div_pos halpha (A_pos p)
  have ha0 : 0 < a0_peak p := by unfold a0_peak; linarith [hu]
  have hclt := cos_omega_lt_one p
  have hcgt := neg_one_lt_cos_omega p
  have key := schur_cond ha0
    (n2 := 1 - alphaPeak p / p.A) (n1 := -2 * Real.cos p.omega)
    (by unfold a0_peak; linarith [hu])
    (by unfold a0_peak; linarith [hu])
    (by unfold a0_peak; nlinarith [hclt, hcgt, hu])
    (by unfold a0_peak; nlinarith [hclt, hcgt, hu])
  simpa only [a1_peak, a2_peak] using key

/-- **Peaking stability.** Every pole of the peaking biquad lies strictly
inside the unit disk. -/
theorem peaking_stability (p : ValidParams) (z : ℂ)
    (hz : z ^ 2 + (a1_peak p : ℂ) * z + (a2_peak p : ℂ) = 0) :
    ‖z‖ < 1 := by
  obtain ⟨h2, h1⟩ := peaking_schur p
  exact SchurCohn.schur_cohn_degree2 (a1_peak p) (a2_peak p) h2 h1 z hz

/-! ### Shelf positivity facts -/

/-- The shelf radicand `(A + 1/A)(1/S − 1) + 2` is strictly positive. -/
theorem shelf_radicand_pos (p : ValidParams) :
    0 < (p.A + 1 / p.A) * (1 / p.s - 1) + 2 := by
  have hA := A_pos p
  have hAinv : 0 < p.A + 1 / p.A := add_pos hA (one_div_pos.mpr hA)
  have hsinv : 1 ≤ 1 / p.s := by rw [le_div_iff₀ p.hs]; nlinarith [p.hs1]
  nlinarith [mul_nonneg hAinv.le (by linarith : (0 : ℝ) ≤ 1 / p.s - 1)]

/-- `0 < α` for the shelves. -/
theorem alphaShelf_pos (p : ValidParams) : 0 < alphaShelf p := by
  unfold alphaShelf
  exact mul_pos (by linarith [sin_omega_pos p]) (Real.sqrt_pos.mpr (shelf_radicand_pos p))

/-- `0 < 2 √A · α`. -/
theorem twoSqrtAAlpha_pos (p : ValidParams) : 0 < twoSqrtAAlpha p := by
  unfold twoSqrtAAlpha
  exact mul_pos (mul_pos two_pos (Real.sqrt_pos.mpr (A_pos p))) (alphaShelf_pos p)

/-! ### Low-shelf stability -/

/-- The low-shelf RBJ coefficients satisfy the Schur-Cohn conditions. -/
theorem low_shelf_schur (p : ValidParams) :
    |a2_lowshelf p| < 1 ∧ |a1_lowshelf p| < 1 + a2_lowshelf p := by
  have hA := A_pos p
  have hclt := cos_omega_lt_one p
  have hcgt := neg_one_lt_cos_omega p
  have hβ := twoSqrtAAlpha_pos p
  -- the recurring positive bracket (A+1) + (A-1) cos ω₀
  have hbr : 0 < (p.A + 1) + (p.A - 1) * Real.cos p.omega := by
    nlinarith [mul_pos hA (by linarith : (0 : ℝ) < 1 + Real.cos p.omega),
      (by linarith : (0 : ℝ) < 1 - Real.cos p.omega)]
  have ha0 : 0 < a0_lowshelf p := by unfold a0_lowshelf; linarith [hbr, hβ]
  have key := schur_cond ha0
    (n2 := (p.A + 1) + (p.A - 1) * Real.cos p.omega - twoSqrtAAlpha p)
    (n1 := -2 * ((p.A - 1) + (p.A + 1) * Real.cos p.omega))
    (by unfold a0_lowshelf; linarith [hbr])
    (by unfold a0_lowshelf; linarith [hβ])
    (by unfold a0_lowshelf; nlinarith [mul_pos hA (by linarith : (0 : ℝ) < 1 - Real.cos p.omega)])
    (by unfold a0_lowshelf; nlinarith [mul_pos hA (by linarith : (0 : ℝ) < 1 + Real.cos p.omega)])
  simpa only [a1_lowshelf, a2_lowshelf] using key

/-- **Low-shelf stability.** Every pole of the low-shelf biquad lies strictly
inside the unit disk. -/
theorem low_shelf_stability (p : ValidParams) (z : ℂ)
    (hz : z ^ 2 + (a1_lowshelf p : ℂ) * z + (a2_lowshelf p : ℂ) = 0) :
    ‖z‖ < 1 := by
  obtain ⟨h2, h1⟩ := low_shelf_schur p
  exact SchurCohn.schur_cohn_degree2 (a1_lowshelf p) (a2_lowshelf p) h2 h1 z hz

/-! ### High-shelf stability -/

/-- The high-shelf RBJ coefficients satisfy the Schur-Cohn conditions. -/
theorem high_shelf_schur (p : ValidParams) :
    |a2_highshelf p| < 1 ∧ |a1_highshelf p| < 1 + a2_highshelf p := by
  have hA := A_pos p
  have hclt := cos_omega_lt_one p
  have hcgt := neg_one_lt_cos_omega p
  have hβ := twoSqrtAAlpha_pos p
  -- the recurring positive bracket (A+1) - (A-1) cos ω₀
  have hbr : 0 < (p.A + 1) - (p.A - 1) * Real.cos p.omega := by
    nlinarith [mul_pos hA (by linarith : (0 : ℝ) < 1 - Real.cos p.omega),
      (by linarith : (0 : ℝ) < 1 + Real.cos p.omega)]
  have ha0 : 0 < a0_highshelf p := by unfold a0_highshelf; linarith [hbr, hβ]
  have key := schur_cond ha0
    (n2 := (p.A + 1) - (p.A - 1) * Real.cos p.omega - twoSqrtAAlpha p)
    (n1 := 2 * ((p.A - 1) - (p.A + 1) * Real.cos p.omega))
    (by unfold a0_highshelf; linarith [hbr])
    (by unfold a0_highshelf; linarith [hβ])
    (by unfold a0_highshelf; nlinarith [mul_pos hA (by linarith : (0 : ℝ) < 1 - Real.cos p.omega)])
    (by unfold a0_highshelf; nlinarith [mul_pos hA (by linarith : (0 : ℝ) < 1 + Real.cos p.omega)])
  simpa only [a1_highshelf, a2_highshelf] using key

/-- **High-shelf stability.** Every pole of the high-shelf biquad lies
strictly inside the unit disk. -/
theorem high_shelf_stability (p : ValidParams) (z : ℂ)
    (hz : z ^ 2 + (a1_highshelf p : ℂ) * z + (a2_highshelf p : ℂ) = 0) :
    ‖z‖ < 1 := by
  obtain ⟨h2, h1⟩ := high_shelf_schur p
  exact SchurCohn.schur_cohn_degree2 (a1_highshelf p) (a2_highshelf p) h2 h1 z hz

end BiquadStability
