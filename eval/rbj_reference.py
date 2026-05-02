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


def _intermediates(f0: float, fs: float, q: float, gain: float) -> tuple[float, float, float, float]:
    """Returns (omega, sin_omega, cos_omega, A).

    These four values appear in every RBJ formula. Computing them once
    and re-using guarantees the same intermediate floating-point values
    are seen by every coefficient expression.
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
    _omega, sin_omega, cos_omega, a = _intermediates(f0, fs, q, gain)
    alpha = sin_omega / (2.0 * q)

    a0 = 1.0 + alpha / a
    b0 = (1.0 + alpha * a) / a0
    b1 = (-2.0 * cos_omega) / a0
    b2 = (1.0 - alpha * a) / a0
    a1 = (-2.0 * cos_omega) / a0
    a2 = (1.0 - alpha / a) / a0

    return {"b0": b0, "b1": b1, "b2": b2, "a1": a1, "a2": a2}


if __name__ == "__main__":
    nominal = peaking(1000.0, 44100.0, 1.0, 6.0)
    print(f"peaking(1000, 44100, 1.0, 6.0) = {nominal}")
