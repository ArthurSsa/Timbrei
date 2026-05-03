"""RBJ Audio EQ Cookbook reference implementation.

Computes biquad coefficients (b0, b1, b2, a1, a2) for Peaking, Low Shelf,
and High Shelf filters using IEEE 754 double-precision arithmetic. The
formulas and evaluation order match the Rust implementation in
src/coefficients.rs character for character. Any divergence shifts the
result by several ULPs and breaks the ULP conformance tests.

Reference: Robert Bristow-Johnson, "Cookbook formulae for audio EQ
biquad filter coefficients."
"""

import math


def _intermediates(f0: float, fs: float, gain: float) -> tuple[float, float, float, float]:
    """Returns (omega, sin_omega, cos_omega, A).

    Shared by peaking, low_shelf, and high_shelf. The four values
    appear in every RBJ formula. Computing them once and reusing them
    keeps the intermediate floating-point values identical across every
    coefficient expression.

    NOTE: math.pow is used (not **) to mirror libm::pow on the Rust
    side. Do not "simplify" this.
    """
    omega = 2.0 * math.pi * f0 / fs
    sin_omega = math.sin(omega)
    cos_omega = math.cos(omega)
    a = math.sqrt(math.pow(10.0, gain / 20.0))
    return omega, sin_omega, cos_omega, a


def peaking(f0: float, fs: float, q: float, gain: float) -> dict[str, float]:
    """Peaking EQ filter coefficients per RBJ Cookbook §3.5.

    Returns a dict with keys b0, b1, b2, a1, a2, already normalized by a0.
    """
    _omega, sin_omega, cos_omega, a = _intermediates(f0, fs, gain)
    alpha = sin_omega / (2.0 * q)

    a0 = 1.0 + alpha / a
    b0 = (1.0 + alpha * a) / a0
    b1 = (-2.0 * cos_omega) / a0
    b2 = (1.0 - alpha * a) / a0
    a1 = (-2.0 * cos_omega) / a0
    a2 = (1.0 - alpha / a) / a0

    return {"b0": b0, "b1": b1, "b2": b2, "a1": a1, "a2": a2}


def low_shelf(f0: float, fs: float, s: float, gain: float) -> dict[str, float]:
    """Low Shelf filter coefficients per RBJ Cookbook §3.6.

    Uses shelf slope `s` instead of quality factor Q. Returns a dict
    with keys b0, b1, b2, a1, a2, already normalized by a0.
    """
    _omega, sin_omega, cos_omega, a = _intermediates(f0, fs, gain)
    # Shelf alpha differs from peaking alpha; it uses s, not Q.
    alpha = (sin_omega / 2.0) * math.sqrt((a + 1.0 / a) * (1.0 / s - 1.0) + 2.0)
    sqrt_a = math.sqrt(a)
    two_sqrt_a_alpha = 2.0 * sqrt_a * alpha

    a0 = (a + 1.0) + (a - 1.0) * cos_omega + two_sqrt_a_alpha
    b0 = (a * ((a + 1.0) - (a - 1.0) * cos_omega + two_sqrt_a_alpha)) / a0
    b1 = (2.0 * a * ((a - 1.0) - (a + 1.0) * cos_omega)) / a0
    b2 = (a * ((a + 1.0) - (a - 1.0) * cos_omega - two_sqrt_a_alpha)) / a0
    a1 = (-2.0 * ((a - 1.0) + (a + 1.0) * cos_omega)) / a0
    a2 = ((a + 1.0) + (a - 1.0) * cos_omega - two_sqrt_a_alpha) / a0

    return {"b0": b0, "b1": b1, "b2": b2, "a1": a1, "a2": a2}


def high_shelf(f0: float, fs: float, s: float, gain: float) -> dict[str, float]:
    """High Shelf filter coefficients per RBJ Cookbook §3.7.

    Uses shelf slope `s` instead of quality factor Q. Returns a dict
    with keys b0, b1, b2, a1, a2, already normalized by a0.
    """
    _omega, sin_omega, cos_omega, a = _intermediates(f0, fs, gain)
    alpha = (sin_omega / 2.0) * math.sqrt((a + 1.0 / a) * (1.0 / s - 1.0) + 2.0)
    sqrt_a = math.sqrt(a)
    two_sqrt_a_alpha = 2.0 * sqrt_a * alpha

    a0 = (a + 1.0) - (a - 1.0) * cos_omega + two_sqrt_a_alpha
    b0 = (a * ((a + 1.0) + (a - 1.0) * cos_omega + two_sqrt_a_alpha)) / a0
    b1 = (-2.0 * a * ((a - 1.0) + (a + 1.0) * cos_omega)) / a0
    b2 = (a * ((a + 1.0) + (a - 1.0) * cos_omega - two_sqrt_a_alpha)) / a0
    a1 = (2.0 * ((a - 1.0) - (a + 1.0) * cos_omega)) / a0
    a2 = ((a + 1.0) - (a - 1.0) * cos_omega - two_sqrt_a_alpha) / a0

    return {"b0": b0, "b1": b1, "b2": b2, "a1": a1, "a2": a2}


if __name__ == "__main__":
    nominal_p = peaking(1000.0, 44100.0, 1.0, 6.0)
    nominal_ls = low_shelf(1000.0, 44100.0, 1.0, 6.0)
    nominal_hs = high_shelf(1000.0, 44100.0, 1.0, 6.0)
    print(f"peaking    = {nominal_p}")
    print(f"low_shelf  = {nominal_ls}")
    print(f"high_shelf = {nominal_hs}")
