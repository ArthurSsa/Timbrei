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


def generate_fixtures(out_path: str = "fixtures/rbj_coefficients.json") -> int:
    """Generates the full ULP conformance matrix and writes it as JSON.

    The matrix sweeps every filter type across two sample rates
    (44100 and 48000 Hz), four centre frequencies, the bandwidth
    parameter (Q for peaking, slope S for the shelves), and a five-point
    gain ladder spanning cut and boost. Each record carries the inputs,
    the filter type, and the five coefficients computed by the Python
    reference. The Rust ULP conformance suite (US-36) loads this file via
    `include_str!` and verifies agreement to <= 4 ULP for every record.

    Field convention: `q` is meaningful for peaking records and `s` for
    shelf records; the unused parameter is fixed to a valid placeholder
    (1.0) so each record still constructs a valid `ValidParams` on the
    Rust side.

    Returns the number of records written.
    """
    import json
    import os

    sample_rates = (44100.0, 48000.0)
    freqs = (100.0, 1000.0, 5000.0, 10000.0)
    gains = (-12.0, -6.0, 0.0, 6.0, 12.0)
    q_values = (0.5, 1.0, 2.0, 4.0)
    s_values = (0.5, 1.0)

    records: list[dict] = []

    # Peaking: sweep Q (slope S held at the placeholder 1.0).
    for fs in sample_rates:
        for f0 in freqs:
            for q in q_values:
                for gain in gains:
                    c = peaking(f0, fs, q, gain)
                    records.append({
                        "type": "peaking",
                        "f0": f0, "fs": fs, "q": q, "gain": gain, "s": 1.0,
                        **c,
                    })

    # Low / High Shelf: sweep slope S (Q held at the placeholder 1.0).
    for kind, fn in (("low_shelf", low_shelf), ("high_shelf", high_shelf)):
        for fs in sample_rates:
            for f0 in freqs:
                for s in s_values:
                    for gain in gains:
                        c = fn(f0, fs, s, gain)
                        records.append({
                            "type": kind,
                            "f0": f0, "fs": fs, "q": 1.0, "gain": gain, "s": s,
                            **c,
                        })

    os.makedirs(os.path.dirname(out_path), exist_ok=True)
    with open(out_path, "w", encoding="utf-8") as f:
        json.dump(records, f, indent=2)
        f.write("\n")

    return len(records)


if __name__ == "__main__":
    n = generate_fixtures()
    print(f"wrote {n} fixture records to fixtures/rbj_coefficients.json")
