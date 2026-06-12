import Mathlib

/-!
# Bilinear Transform

The standard bilinear transform `s = (z − 1) / (z + 1)` maps the open unit
disk into the open left half-plane. This is the analytic counterpart of the
discrete-time stability criterion: a pole inside the unit circle of the
`z`-plane corresponds to a pole with negative real part in the `s`-plane.

The proof computes the real part explicitly,
`Re(s) = (‖z‖² − 1) / ‖z + 1‖²`, whose numerator is negative on the open
disk and whose denominator is positive (`z + 1 ≠ 0` there).
-/

open Complex

/-- The bilinear transform: s = (z − 1) / (z + 1). -/
noncomputable def bilinearMap (z : ℂ) : ℂ := (z - 1) / (z + 1)

/-- Every z with `‖z‖ < 1` maps to a point with strictly negative real part
    (the open left half-plane). -/
theorem bilinear_maps_disk_to_lhp (z : ℂ) (hz : ‖z‖ < 1) :
    (bilinearMap z).re < 0 := by
  -- On the open disk `z + 1 ≠ 0` (else `z = -1` and `‖z‖ = 1`).
  have hz1 : z + 1 ≠ 0 := by
    intro h
    have hzval : z = -1 := by linear_combination h
    rw [hzval] at hz
    simp at hz
  -- The real part as a single real fraction with denominator `‖z + 1‖²`.
  have hre : (bilinearMap z).re
      = (Complex.normSq z - 1) / Complex.normSq (z + 1) := by
    rw [bilinearMap, Complex.div_re, ← add_div]
    congr 1
    simp only [Complex.sub_re, Complex.sub_im, Complex.add_re, Complex.add_im,
      Complex.one_re, Complex.one_im, Complex.normSq_apply]
    ring
  rw [hre]
  apply div_neg_of_neg_of_pos
  · -- numerator: `‖z‖² − 1 < 0`
    have hlt : Complex.normSq z < 1 := by
      rw [Complex.normSq_eq_norm_sq]
      nlinarith [norm_nonneg z, hz]
    linarith
  · -- denominator: `‖z + 1‖² > 0`
    exact Complex.normSq_pos.mpr hz1
