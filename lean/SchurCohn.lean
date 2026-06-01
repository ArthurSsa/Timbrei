import Mathlib

/-!
# The Schur-Cohn criterion for monic degree-two polynomials

This file is standalone: it imports only Mathlib and shares no declarations
with the rest of the project, so it can be checked in isolation (US-10).

For a monic real quadratic `z² + a₁·z + a₂`, the two Schur-Cohn / Jury
conditions

* `|a₂| < 1`
* `|a₁| < 1 + a₂`

are sufficient for every root to lie strictly inside the unit disk
(`‖z‖ < 1`). The proof follows the discriminant case split:

* `schur_cohn_complex_case`: a non-real root (negative discriminant) comes
  with its complex conjugate; their product is the constant term `a₂`, so by
  Vieta `‖z‖² = a₂ < 1`.
* `schur_cohn_real_case`: a real root (non-negative discriminant) is handled
  together with the companion root via the sign of `p(1)` and `p(-1)`.
* `schur_cohn_degree2`: the main theorem, dispatching on whether the root is
  real.
-/

namespace SchurCohn

open Complex

/-- **Complex (non-real) case.** A non-real root `z` of the monic real
quadratic `z² + a₁·z + a₂` satisfies `‖z‖ < 1` whenever `|a₂| < 1`.

The conjugate `conj z` is also a root, and it is distinct from `z` because
`z` is not real. Subtracting the two root equations gives the Vieta sum
`z + conj z = -a₁`, and substituting back gives the product
`z · conj z = a₂`. Since `z · conj z = ‖z‖²`, we get `‖z‖² = a₂ < 1`. -/
theorem schur_cohn_complex_case (a1 a2 : ℝ) (h2 : |a2| < 1)
    (z : ℂ) (hz : z ^ 2 + (a1 : ℂ) * z + (a2 : ℂ) = 0) (himg : z.im ≠ 0) :
    ‖z‖ < 1 := by
  -- The complex conjugate is also a root, as the coefficients are real.
  have hconj : (starRingEnd ℂ z) ^ 2 + (a1 : ℂ) * (starRingEnd ℂ z) + (a2 : ℂ) = 0 := by
    have h := congrArg (starRingEnd ℂ) hz
    simpa [map_add, map_mul, map_pow, Complex.conj_ofReal] using h
  -- A non-real number differs from its conjugate.
  have hzw : z ≠ starRingEnd ℂ z := by
    intro h
    apply himg
    have him : z.im = -z.im := by
      calc z.im = (starRingEnd ℂ z).im := by rw [← h]
        _ = -z.im := Complex.conj_im z
    linarith
  have hzwne : z - starRingEnd ℂ z ≠ 0 := sub_ne_zero.mpr hzw
  -- Subtracting the two root equations factors through `z - conj z`.
  have hfac : (z - starRingEnd ℂ z) * (z + starRingEnd ℂ z + (a1 : ℂ)) = 0 := by
    linear_combination hz - hconj
  have hsum : z + starRingEnd ℂ z + (a1 : ℂ) = 0 :=
    (mul_eq_zero.mp hfac).resolve_left hzwne
  -- Vieta: the product of the roots is the constant term `a₂`.
  have hprod : z * starRingEnd ℂ z = (a2 : ℂ) := by
    linear_combination z * hsum - hz
  -- `z · conj z = ‖z‖²`, so `‖z‖² = a₂`.
  have hnsr : Complex.normSq z = a2 := by
    have hcast : (Complex.normSq z : ℂ) = (a2 : ℂ) := by
      rw [← Complex.mul_conj z]; exact hprod
    exact_mod_cast hcast
  have ha2lt : a2 < 1 := (abs_lt.mp h2).2
  have hsqlt : ‖z‖ ^ 2 < 1 := by
    rw [← Complex.normSq_eq_norm_sq, hnsr]; exact ha2lt
  nlinarith [norm_nonneg z, hsqlt]

/-- **Real case.** A real root `x` of `x² + a₁·x + a₂` satisfies `|x| < 1`
whenever `|a₂| < 1` and `|a₁| < 1 + a₂`.

Writing `s = -a₁ - x` for the companion root (so `x + s = -a₁` and
`x · s = a₂`), the hypotheses give `p(1) = (1-x)(1-s) > 0` and
`p(-1) = (1+x)(1+s) > 0`; their product is `(1-x²)(1-s²) > 0`. Combined with
`(x·s)² = a₂² < 1` this forces `x² < 1`. -/
theorem schur_cohn_real_case (a1 a2 : ℝ) (h2 : |a2| < 1) (h1 : |a1| < 1 + a2)
    (x : ℝ) (hx : x ^ 2 + a1 * x + a2 = 0) :
    |x| < 1 := by
  sorry

/-- **Schur-Cohn for degree two.** Every root of the monic real quadratic
`z² + a₁·z + a₂` lies strictly inside the unit disk, given `|a₂| < 1` and
`|a₁| < 1 + a₂`. The proof splits on whether the root is real, applying the
two auxiliary lemmas. -/
theorem schur_cohn_degree2 (a1 a2 : ℝ) (h2 : |a2| < 1) (h1 : |a1| < 1 + a2)
    (z : ℂ) (hz : z ^ 2 + (a1 : ℂ) * z + (a2 : ℂ) = 0) :
    ‖z‖ < 1 := by
  sorry

end SchurCohn
