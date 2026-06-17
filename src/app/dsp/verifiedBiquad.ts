// Faithful TypeScript port of the formally verified DSP in the lemi backend.
//
// Mirrors, character by character in evaluation order, the Rust files:
//   backend/src/params.rs        (ValidParams: omega, a_factor)
//   backend/src/coefficients.rs  (RBJ peaking, low_shelf, high_shelf)
//   backend/src/frequency.rs     (complex response H(e^{jω}))
//
// The coefficients therefore agree with the verified reference (and with the
// RBJ Cookbook) to within a few ULP. See backend/fixtures/rbj_coefficients.json
// and the proofs in backend/lean/{FilterParams,BiquadStability,SchurCohn}.lean.
// Peaking uses the quality factor Q; the shelves use the slope S in (0, 1].

/** Transfer-function coefficients, already normalized by a0 (a0 = 1).
 *  H(z) = (b0 + b1 z⁻¹ + b2 z⁻²) / (1 + a1 z⁻¹ + a2 z⁻²) */
export interface VBiquadCoeffs {
  b0: number; b1: number; b2: number; a1: number; a2: number;
}

/** ω = 2π f0 / fs (rad/sample). params.rs::omega */
export const omega = (f0: number, fs: number): number => (2 * Math.PI * f0) / fs;

/** A = √(10^(gain/20)) = 10^(gain/40). params.rs::a_factor */
export const aFactor = (gainDb: number): number => Math.sqrt(Math.pow(10, gainDb / 20));

/** Peaking EQ. coefficients.rs::peaking (RBJ Cookbook §3.5). Uses Q. */
export function peaking(f0: number, fs: number, q: number, gainDb: number): VBiquadCoeffs {
  const w = omega(f0, fs);
  const sinW = Math.sin(w);
  const cosW = Math.cos(w);
  const A = aFactor(gainDb);
  const alpha = sinW / (2.0 * q);

  const a0 = 1.0 + alpha / A;
  return {
    b0: (1.0 + alpha * A) / a0,
    b1: (-2.0 * cosW) / a0,
    b2: (1.0 - alpha * A) / a0,
    a1: (-2.0 * cosW) / a0,
    a2: (1.0 - alpha / A) / a0,
  };
}

/** Shelf alpha. coefficients.rs (uses the slope S, not Q). */
function shelfAlpha(sinW: number, A: number, s: number): number {
  return (sinW / 2.0) * Math.sqrt((A + 1.0 / A) * (1.0 / s - 1.0) + 2.0);
}

/** Low Shelf. coefficients.rs::low_shelf (RBJ Cookbook §3.6). Uses S. */
export function lowShelf(f0: number, fs: number, s: number, gainDb: number): VBiquadCoeffs {
  const w = omega(f0, fs);
  const sinW = Math.sin(w);
  const cosW = Math.cos(w);
  const A = aFactor(gainDb);
  const alpha = shelfAlpha(sinW, A, s);
  const twoSqrtAAlpha = 2.0 * Math.sqrt(A) * alpha;

  const a0 = (A + 1.0) + (A - 1.0) * cosW + twoSqrtAAlpha;
  return {
    b0: (A * ((A + 1.0) - (A - 1.0) * cosW + twoSqrtAAlpha)) / a0,
    b1: (2.0 * A * ((A - 1.0) - (A + 1.0) * cosW)) / a0,
    b2: (A * ((A + 1.0) - (A - 1.0) * cosW - twoSqrtAAlpha)) / a0,
    a1: (-2.0 * ((A - 1.0) + (A + 1.0) * cosW)) / a0,
    a2: ((A + 1.0) + (A - 1.0) * cosW - twoSqrtAAlpha) / a0,
  };
}

/** High Shelf. coefficients.rs::high_shelf (RBJ Cookbook §3.7). Uses S. */
export function highShelf(f0: number, fs: number, s: number, gainDb: number): VBiquadCoeffs {
  const w = omega(f0, fs);
  const sinW = Math.sin(w);
  const cosW = Math.cos(w);
  const A = aFactor(gainDb);
  const alpha = shelfAlpha(sinW, A, s);
  const twoSqrtAAlpha = 2.0 * Math.sqrt(A) * alpha;

  const a0 = (A + 1.0) - (A - 1.0) * cosW + twoSqrtAAlpha;
  return {
    b0: (A * ((A + 1.0) + (A - 1.0) * cosW + twoSqrtAAlpha)) / a0,
    b1: (-2.0 * A * ((A - 1.0) + (A + 1.0) * cosW)) / a0,
    b2: (A * ((A + 1.0) + (A - 1.0) * cosW - twoSqrtAAlpha)) / a0,
    a1: (2.0 * ((A - 1.0) - (A + 1.0) * cosW)) / a0,
    a2: ((A + 1.0) - (A - 1.0) * cosW - twoSqrtAAlpha) / a0,
  };
}

/** Complex response H(e^{jω}) = (re, im). frequency.rs::response (normalized coeffs). */
export function responseComplex(c: VBiquadCoeffs, w: number): [number, number] {
  const c1 = Math.cos(w);
  const s1 = Math.sin(w);
  const c2 = Math.cos(2.0 * w);
  const s2 = Math.sin(2.0 * w);

  const numRe = c.b0 + c.b1 * c1 + c.b2 * c2;
  const numIm = -(c.b1 * s1 + c.b2 * s2);
  const denRe = 1.0 + c.a1 * c1 + c.a2 * c2;
  const denIm = -(c.a1 * s1 + c.a2 * s2);

  const denMag2 = denRe * denRe + denIm * denIm;
  return [
    (numRe * denRe + numIm * denIm) / denMag2,
    (numIm * denRe - numRe * denIm) / denMag2,
  ];
}

/** Magnitude in dB: 20·log10|H| = 10·log10(|H|²). */
export function magnitudeDb(c: VBiquadCoeffs, w: number): number {
  const [re, im] = responseComplex(c, w);
  const mag2 = re * re + im * im;
  return mag2 === 0 ? 0 : 10 * Math.log10(mag2);
}
