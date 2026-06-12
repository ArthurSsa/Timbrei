"""Frequency-response comparison: Rust implementation vs Python reference.

For each of the three RBJ filter types this script

  1. computes the biquad coefficients with the Python reference
     (`rbj_reference.py`),
  2. evaluates the complex response H(e^{jω}) over a log-spaced frequency
     grid both in Python (via `cmath`) and in Rust (by calling the
     `rbj_eval` binary as a subprocess, the subprocess path of US-29),
  3. asserts the two agree to < 1e-10 dB on magnitude, and
  4. writes a magnitude + phase plot to `eval/rbj_<type>.svg`
     (solid = Rust, dashed = Python, logarithmic frequency axis).

Standard library only. The SVG is emitted by hand, with no plotting dependency.
"""

import cmath
import math
import os
import subprocess
import sys

HERE = os.path.dirname(os.path.abspath(__file__))
REPO = os.path.dirname(HERE)
sys.path.insert(0, HERE)

from rbj_reference import peaking, low_shelf, high_shelf  # noqa: E402

# Nominal demonstration parameters (peak/shelf boost of +6 dB at 1 kHz).
FS = 44100.0
F0 = 1000.0
GAIN = 6.0
Q = 1.0
S = 1.0
N_POINTS = 256
F_MIN = 20.0
F_MAX = FS / 2.0

FILTERS = [
    ("peaking", lambda: peaking(F0, FS, Q, GAIN)),
    ("low_shelf", lambda: low_shelf(F0, FS, S, GAIN)),
    ("high_shelf", lambda: high_shelf(F0, FS, S, GAIN)),
]


def log_freq_grid(n: int = N_POINTS) -> list[float]:
    """Logarithmically spaced frequencies in [F_MIN, F_MAX)."""
    lo, hi = math.log10(F_MIN), math.log10(F_MAX)
    return [10.0 ** (lo + (hi - lo) * i / (n - 1)) for i in range(n)]


def response_python(c: dict, omega: float) -> complex:
    """H(e^{jω}) from coefficients, evaluated with cmath."""
    z1 = cmath.exp(-1j * omega)
    z2 = cmath.exp(-2j * omega)
    num = c["b0"] + c["b1"] * z1 + c["b2"] * z2
    den = 1.0 + c["a1"] * z1 + c["a2"] * z2
    return num / den


def response_rust(c: dict, omegas: list[float]) -> list[complex]:
    """H(e^{jω}) from the Rust `rbj_eval` binary via subprocess."""
    args = ["cargo", "run", "-q", "--bin", "rbj_eval", "--"]
    args += [f"{c[k]:.17e}" for k in ("b0", "b1", "b2", "a1", "a2")]
    payload = "\n".join(f"{w:.17e}" for w in omegas)
    proc = subprocess.run(
        args, input=payload, capture_output=True, text=True, cwd=REPO, check=True
    )
    out = []
    for line in proc.stdout.split("\n"):
        line = line.strip()
        if not line:
            continue
        re_s, im_s = line.split()
        out.append(complex(float(re_s), float(im_s)))
    return out


def db(x: complex) -> float:
    return 20.0 * math.log10(abs(x)) if abs(x) > 0 else -math.inf


def deg(x: complex) -> float:
    return math.degrees(cmath.phase(x))


# --- Minimal hand-rolled SVG plotting (stdlib only) ----------------------

def _polyline(points, color, dashed):
    pts = " ".join(f"{x:.2f},{y:.2f}" for x, y in points)
    dash = ' stroke-dasharray="6,4"' if dashed else ""
    return (
        f'<polyline points="{pts}" fill="none" stroke="{color}" '
        f'stroke-width="1.8"{dash}/>'
    )


def _panel(x0, y0, w, h, freqs, series, ylabel, title):
    """One labelled panel; `series` = list of (values, color, dashed, label)."""
    lo_f, hi_f = math.log10(freqs[0]), math.log10(freqs[-1])
    ys = [v for vals, *_ in series for v in vals if math.isfinite(v)]
    ymin, ymax = min(ys), max(ys)
    if ymax - ymin < 1e-9:
        ymin, ymax = ymin - 1.0, ymax + 1.0
    pad = 0.08 * (ymax - ymin)
    ymin, ymax = ymin - pad, ymax + pad

    def sx(f):
        return x0 + (math.log10(f) - lo_f) / (hi_f - lo_f) * w

    def sy(v):
        return y0 + h - (v - ymin) / (ymax - ymin) * h

    out = [f'<rect x="{x0}" y="{y0}" width="{w}" height="{h}" fill="#fff" stroke="#888"/>']
    out.append(f'<text x="{x0 + w/2:.0f}" y="{y0 - 8}" text-anchor="middle" '
               f'font-size="14" font-family="sans-serif">{title}</text>')
    out.append(f'<text x="{x0 - 38}" y="{y0 + h/2:.0f}" text-anchor="middle" '
               f'font-size="11" font-family="sans-serif" '
               f'transform="rotate(-90 {x0 - 38} {y0 + h/2:.0f})">{ylabel}</text>')
    # decade gridlines
    d = math.ceil(lo_f)
    while d <= hi_f:
        gx = sx(10.0 ** d)
        out.append(f'<line x1="{gx:.1f}" y1="{y0}" x2="{gx:.1f}" y2="{y0+h}" '
                   f'stroke="#eee"/>')
        out.append(f'<text x="{gx:.1f}" y="{y0+h+14}" text-anchor="middle" '
                   f'font-size="10" font-family="sans-serif">{int(10**d)}</text>')
        d += 1
    for vals, color, dashed, _ in series:
        pts = [(sx(f), sy(v)) for f, v in zip(freqs, vals) if math.isfinite(v)]
        out.append(_polyline(pts, color, dashed))
    # legend
    ly = y0 + 14
    for vals, color, dashed, label in series:
        out.append(_polyline([(x0 + w - 120, ly), (x0 + w - 95, ly)], color, dashed))
        out.append(f'<text x="{x0 + w - 90}" y="{ly + 4}" font-size="11" '
                   f'font-family="sans-serif">{label}</text>')
        ly += 16
    return "\n".join(out)


def write_svg(path, name, freqs, mag_rust, mag_py, ph_rust, ph_py):
    W, H = 720, 560
    parts = [f'<svg xmlns="http://www.w3.org/2000/svg" width="{W}" height="{H}" '
             f'viewBox="0 0 {W} {H}">',
             f'<rect width="{W}" height="{H}" fill="#fff"/>',
             f'<text x="{W/2}" y="24" text-anchor="middle" font-size="17" '
             f'font-family="sans-serif">RBJ {name}: Rust vs Python (fs={FS:.0f} Hz)</text>']
    parts.append(_panel(70, 60, 600, 200, freqs,
                        [(mag_rust, "#1a6ec7", False, "Rust"),
                         (mag_py, "#b83c1f", True, "Python")],
                        "magnitude (dB)", "Magnitude response"))
    parts.append(_panel(70, 320, 600, 200, freqs,
                        [(ph_rust, "#1a6ec7", False, "Rust"),
                         (ph_py, "#b83c1f", True, "Python")],
                        "phase (deg)", "Phase response"))
    parts.append('<text x="70" y="548" font-size="10" font-family="sans-serif">'
                 'frequency (Hz, log scale)</text>')
    parts.append('</svg>')
    with open(path, "w", encoding="utf-8") as f:
        f.write("\n".join(parts) + "\n")


def main() -> int:
    freqs = log_freq_grid()
    omegas = [2.0 * math.pi * f / FS for f in freqs]
    worst = 0.0
    for name, make in FILTERS:
        c = make()
        h_py = [response_python(c, w) for w in omegas]
        h_rs = response_rust(c, omegas)

        mag_py = [db(h) for h in h_py]
        mag_rs = [db(h) for h in h_rs]
        ph_py = [deg(h) for h in h_py]
        ph_rs = [deg(h) for h in h_rs]

        diff = max(abs(a - b) for a, b in zip(mag_py, mag_rs)
                   if math.isfinite(a) and math.isfinite(b))
        worst = max(worst, diff)
        assert diff < 1e-10, f"{name}: magnitude diff {diff} dB exceeds 1e-10"

        out_path = os.path.join(HERE, f"rbj_{name}.svg")
        write_svg(out_path, name, freqs, mag_rs, mag_py, ph_rs, ph_py)
        print(f"{name}: max |Rust-Python| = {diff:.2e} dB  ->  {out_path}")

    print(f"all filters agree to {worst:.2e} dB (< 1e-10)")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
