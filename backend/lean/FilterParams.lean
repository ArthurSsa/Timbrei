import Mathlib

/-!
# Filter Parameters

Defines `ValidParams`, the validated parameter record used as the hypothesis
of the filter stability theorems in this library.
-/

/-- Validated parameters for a parametric biquad filter. All constraints
    are embedded as field hypotheses, so any `ValidParams` value satisfies
    all of them. -/
structure ValidParams where
  f0   : ℝ  -- centre frequency (Hz)
  fs   : ℝ  -- sample rate (Hz)
  q    : ℝ  -- quality factor
  gain : ℝ  -- shelf/peaking gain (dB), may be negative
  s    : ℝ  -- shelf slope in (0, 1]
  hf0      : 0 < f0
  hfs      : 0 < fs
  hNyquist : f0 < fs / 2
  hq       : 0 < q
  hs       : 0 < s
  hs1      : s ≤ 1

/-- Filter topology used in RBJ parametric biquad formulas. -/
inductive FilterType
  | Peaking   : FilterType
  | LowShelf  : FilterType
  | HighShelf : FilterType
  deriving Repr, DecidableEq

/-- Angular centre frequency in radians per sample: ω₀ = 2π · f₀ / fₛ -/
noncomputable def ValidParams.omega (p : ValidParams) : ℝ :=
  2 * Real.pi * p.f0 / p.fs

/-- Gain amplitude factor: A = √(10^(gain/20)) -/
noncomputable def ValidParams.A (p : ValidParams) : ℝ :=
  Real.sqrt (10 ^ (p.gain / 20))
