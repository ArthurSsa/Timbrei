import Mathlib

/-!
# Bilinear Transform

Formal statement that the standard bilinear transform maps the open unit
disk to the open left half-plane. The real proof is deferred to Sprint 5
(US-09); `sorry` is used as a placeholder, permitted in sprints S1 to S3.
-/

open Complex

/-- The bilinear transform: s = (z − 1) / (z + 1). -/
noncomputable def bilinearMap (z : ℂ) : ℂ := (z - 1) / (z + 1)

/-- Every z with |z| < 1 maps to a point with strictly negative real part
    (the open left half-plane). -/
theorem bilinear_maps_disk_to_lhp (z : ℂ) (hz : Complex.abs z < 1) :
    (bilinearMap z).re < 0 := by
  sorry
