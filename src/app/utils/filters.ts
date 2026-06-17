import * as V from '../dsp/biquad';

export const SAMPLE_RATE = 44100;

export interface FreqBand {
  id: string;
  name: string;
  short: string;
  fLow: number;
  fHigh: number;
  fill: string;
  fillHover: string;
  labelColor: string;
}

// Fills tuned for a light cream background (subtle washes, stronger on hover).
export const FREQ_BANDS: FreqBand[] = [
  { id: 'sub', name: 'Sub bass', short: 'Sub', fLow: 20, fHigh: 80, fill: 'rgba(124,58,237,0.10)', fillHover: 'rgba(124,58,237,0.22)', labelColor: '#6d28d9' },
  { id: 'bass', name: 'Mid bass', short: 'Mid bass', fLow: 80, fHigh: 300, fill: 'rgba(37,99,235,0.09)', fillHover: 'rgba(37,99,235,0.20)', labelColor: '#1d4ed8' },
  { id: 'lowmid', name: 'Lower midrange', short: 'Lower mid', fLow: 300, fHigh: 2000, fill: 'rgba(5,150,105,0.09)', fillHover: 'rgba(5,150,105,0.20)', labelColor: '#047857' },
  { id: 'upmid', name: 'Upper midrange', short: 'Upper mid', fLow: 2000, fHigh: 8000, fill: 'rgba(217,119,6,0.10)', fillHover: 'rgba(217,119,6,0.22)', labelColor: '#b45309' },
  { id: 'treble', name: 'Treble', short: 'Treble', fLow: 8000, fHigh: 12000, fill: 'rgba(220,38,38,0.09)', fillHover: 'rgba(220,38,38,0.20)', labelColor: '#b91c1c' },
  { id: 'air', name: 'Air', short: 'Air', fLow: 12000, fHigh: 20000, fill: 'rgba(8,145,178,0.10)', fillHover: 'rgba(8,145,178,0.22)', labelColor: '#0e7490' },
];

// Only the filter types formally verified in the lemi backend are exposed:
// peaking and the two shelves. There are no pass or notch filters.
export type FilterType = 'peak' | 'lowShelf' | 'highShelf';

export interface ProfileFilter {
  type: FilterType;
  freq: number;
  gain: number;
  q: number;
}

export interface EQBandDef {
  id: string;
  enabled: boolean;
  type: FilterType;
  frequency: number;
  gain: number;
  q: number;
}

// A named EQ curve attached to a device (or a manual session). It is drawn on
// the graph like a measurement, toggled on and off by the EQ ON/OFF control,
// and can be removed. AutoEQ and manual editing both produce these layers.
export interface EQLayer {
  id: string;
  name: string;
  deviceId: string | null;
  color: string;
  enabled: boolean;
  bands: EQBandDef[];
}

export interface TargetProfile {
  id: string;
  name: string;
  filters: Array<{ type: FilterType; freq: number; gain: number; q: number }>;
}

// squig.link (CrinGraph) listener palette, ordered for distinctness and
// legibility on a light background. Used for device curves.
export const DEVICE_COLORS = [
  '#0070c5', '#ff001f', '#008a6c', '#e48f00',
  '#95009e', '#00ac00', '#003a9d', '#cac100',
];

// Palette for EQ layer curves, kept distinct from the device colors so an EQ
// curve is not confused with a measurement.
export const EQ_LAYER_COLORS = [
  '#ff5a00', '#7c3aed', '#0e7490', '#b45309',
  '#be123c', '#15803d',
];

function clamp(v: number, lo: number, hi: number) {
  return Math.max(lo, Math.min(hi, v));
}

// Biquad coefficients. All three filter types (peaking and the two shelves)
// are covered by the lemi backend and run through the formally verified DSP via
// the ../dsp/biquad facade (WebAssembly when available, otherwise the TS port).
// Peaking uses Q; the shelves use the slope S in (0, 1] (the band's Q field is
// reused as S and clamped to that interval).
function biquadCoeffs(type: FilterType, freq: number, gain: number, q: number) {
  const f = clamp(freq, 1, SAMPLE_RATE / 2 - 1);

  switch (type) {
    case 'peak':
      return { ...V.peaking(f, SAMPLE_RATE, Math.max(0.001, q), gain), a0: 1 };
    case 'lowShelf':
      return { ...V.lowShelf(f, SAMPLE_RATE, clamp(q, 0.001, 1), gain), a0: 1 };
    case 'highShelf':
      return { ...V.highShelf(f, SAMPLE_RATE, clamp(q, 0.001, 1), gain), a0: 1 };
  }
}

function biquadResponse(c: ReturnType<typeof biquadCoeffs>, f: number): number {
  const w = 2 * Math.PI * f / SAMPLE_RATE;
  const cw = Math.cos(w), c2w = Math.cos(2*w), sw = Math.sin(w), s2w = Math.sin(2*w);
  const { b0, b1, b2, a0, a1, a2 } = c;
  const nr = b0 + b1*cw + b2*c2w, ni = -(b1*sw + b2*s2w);
  const dr = a0 + a1*cw + a2*c2w, di = -(a1*sw + a2*s2w);
  const dSq = dr*dr + di*di;
  return dSq === 0 ? 0 : 10 * Math.log10((nr*nr + ni*ni) / dSq);
}

function getLogFreqs(n = 600): number[] {
  const lMin = Math.log10(20), lMax = Math.log10(20000);
  return Array.from({ length: n }, (_, i) => 10 ** (lMin + (i / (n-1)) * (lMax - lMin)));
}

export const LOG_FREQS = getLogFreqs(600);

export function calcProfileCurve(
  filters: Array<{ type: FilterType; freq: number; gain: number; q: number }>,
  freqs: number[]
): number[] {
  if (filters.length === 0) return freqs.map(() => 0);
  const coeffsList = filters.map(f => biquadCoeffs(f.type, f.freq, f.gain, f.q));
  return freqs.map(f => coeffsList.reduce((s, c) => s + biquadResponse(c, f), 0));
}

export function calcEQCurve(bands: EQBandDef[], freqs: number[]): number[] {
  const active = bands.filter(b => b.enabled);
  if (active.length === 0) return freqs.map(() => 0);
  const coeffsList = active.map(b => biquadCoeffs(b.type, b.frequency, b.gain, b.q));
  return freqs.map(f => coeffsList.reduce((s, c) => s + biquadResponse(c, f), 0));
}

// Frequency response of a target, evaluated from its parametric filter chain.
// Device responses come from live measurements (see ../dsp/squig).
function profileResponse(p: { filters: ProfileFilter[] }, freqs: number[]): number[] {
  return calcProfileCurve(p.filters, freqs);
}

/** Target frequency response on `freqs`. */
export function targetResponse(target: TargetProfile, freqs: number[]): number[] {
  return profileResponse(target, freqs);
}

export function exportEqualizerAPO(bands: EQBandDef[], preamp = -6): string {
  const active = bands.filter(b => b.enabled);
  const typeMap: Record<FilterType, string> = { peak: 'PK', lowShelf: 'LSC', highShelf: 'HSC' };
  const lines = [`Preamp: ${preamp >= 0 ? '+' : ''}${preamp.toFixed(1)} dB`];
  active.forEach((b, i) => {
    const gainStr = ` Gain ${b.gain >= 0 ? '+' : ''}${b.gain.toFixed(1)} dB`;
    lines.push(`Filter ${i + 1}: ON ${typeMap[b.type]} Fc ${Math.round(b.frequency)} Hz${gainStr} Q ${b.q.toFixed(2)}`);
  });
  return lines.join('\n');
}

// Suggested preamp to avoid clipping: negative of the largest positive gain.
// Preamp is an output level trim for the exported profile only; it does not
// change the displayed frequency response.
export function suggestPreamp(bands: EQBandDef[]): number {
  const maxBoost = bands.filter(b => b.enabled).reduce((m, b) => Math.max(m, b.gain), 0);
  return Math.round(-maxBoost * 10) / 10 || 0;
}

// Fixed bank of peaking filters at roughly half-octave centers, used as the
// basis functions of the AutoEQ fit. Half-octave spacing tracks the target far
// more closely than an octave bank while staying coarse enough not to chase
// measurement noise.
const AUTOEQ_CENTERS = [
  20, 28, 40, 57, 80, 113, 160, 225, 320, 450,
  640, 900, 1250, 1800, 2500, 3500, 5000, 7000, 10000, 14000,
];
const AUTOEQ_Q = 2.0;
const AUTOEQ_MAX_GAIN = 12;
// Refinement passes, and the gain threshold below which a band is left disabled
// (negligible effect, cleaner export).
const AUTOEQ_ITERATIONS = 3;
const AUTOEQ_MIN_GAIN = 0.2;

// Unit-gain (1 dB) magnitude response of each basis filter on LOG_FREQS, used to
// linearize each refinement step. Computed once and reused.
let autoEQBasis: number[][] | null = null;
function getAutoEQBasis(): number[][] {
  if (!autoEQBasis) {
    autoEQBasis = AUTOEQ_CENTERS.map(fc => {
      const c = biquadCoeffs('peak', fc, 1, AUTOEQ_Q);
      return LOG_FREQS.map(f => biquadResponse(c, f));
    });
  }
  return autoEQBasis;
}

// Solves a linear system M x = b by Gaussian elimination with partial pivoting.
// The systems here are small (one unknown per basis filter).
function solveLinear(M: number[][], b: number[]): number[] {
  const n = b.length;
  const a = M.map((row, i) => [...row, b[i]]);
  for (let col = 0; col < n; col++) {
    let pivot = col;
    for (let r = col + 1; r < n; r++) {
      if (Math.abs(a[r][col]) > Math.abs(a[pivot][col])) pivot = r;
    }
    [a[col], a[pivot]] = [a[pivot], a[col]];
    const d = a[col][col] || 1e-9;
    for (let r = 0; r < n; r++) {
      if (r === col) continue;
      const factor = a[r][col] / d;
      for (let k = col; k <= n; k++) a[r][k] -= factor * a[col][k];
    }
  }
  return a.map((row, i) => row[n] / (row[i] || 1e-9));
}

// Fits the basis bank to a residual curve (target minus source, in dB) by least
// squares, returning the per-filter gains in dB. Solving the coupled normal
// equations (B^T B + lambda I) g = B^T r accounts for the overlap between
// neighbouring bands, which a per-band reading of the residual ignores; that
// overlap is what makes naive AutoEQ overshoot.
function fitAutoEQGains(residual: number[]): number[] {
  const basis = getAutoEQBasis();
  const n = basis.length;
  const m = residual.length;
  const lambda = 1e-2;
  const BtB: number[][] = Array.from({ length: n }, () => new Array(n).fill(0));
  const Btr: number[] = new Array(n).fill(0);
  for (let i = 0; i < n; i++) {
    for (let j = i; j < n; j++) {
      let s = 0;
      for (let k = 0; k < m; k++) s += basis[i][k] * basis[j][k];
      BtB[i][j] = BtB[j][i] = s + (i === j ? lambda : 0);
    }
    let sr = 0;
    for (let k = 0; k < m; k++) sr += basis[i][k] * residual[k];
    Btr[i] = sr;
  }
  return solveLinear(BtB, Btr);
}

// Light moving-average smoothing in log-frequency space, so the fit follows the
// target trend instead of chasing per-point measurement noise.
function smooth(curve: number[], radius: number): number[] {
  return curve.map((_, i) => {
    const lo = Math.max(0, i - radius);
    const hi = Math.min(curve.length - 1, i + radius);
    let s = 0;
    for (let j = lo; j <= hi; j++) s += curve[j];
    return s / (hi - lo + 1);
  });
}

// Rendered magnitude (dB) of the whole bank at the given gains, using the real
// (non-linearized) peaking response.
function renderBank(gains: number[]): number[] {
  const coeffs = AUTOEQ_CENTERS.map((fc, k) =>
    gains[k] !== 0 ? biquadCoeffs('peak', fc, gains[k], AUTOEQ_Q) : null,
  );
  return LOG_FREQS.map(f => coeffs.reduce((s, c) => (c ? s + biquadResponse(c, f) : s), 0));
}

// Fits an EQ that moves `sourceCurve` toward `targetCurve` (both sampled on
// LOG_FREQS) using only verified peaking filters.
//
// The goal for the bank is the smoothed error (target minus source). Because a
// peaking filter's dB response is not exactly proportional to its gain, the
// gains are refined over a few passes: each pass renders the real response of
// the current gains and fits the error that remains, so the rendered sum
// converges to the goal rather than to its linear approximation.
export function autoEQBands(sourceCurve: number[], targetCurve: number[], startId = 0): EQBandDef[] {
  const goal = smooth(LOG_FREQS.map((_, i) => targetCurve[i] - sourceCurve[i]), 5);
  const gains = new Array(AUTOEQ_CENTERS.length).fill(0);
  for (let iter = 0; iter < AUTOEQ_ITERATIONS; iter++) {
    const rendered = renderBank(gains);
    const remaining = LOG_FREQS.map((_, i) => goal[i] - rendered[i]);
    const delta = fitAutoEQGains(remaining);
    for (let k = 0; k < gains.length; k++) {
      gains[k] = Math.max(-AUTOEQ_MAX_GAIN, Math.min(AUTOEQ_MAX_GAIN, gains[k] + delta[k]));
    }
  }
  return AUTOEQ_CENTERS.map((fc, i) => {
    const gain = Math.round(gains[i] * 10) / 10;
    return {
      id: `auto_${startId + i}`,
      enabled: Math.abs(gain) >= AUTOEQ_MIN_GAIN,
      type: 'peak' as FilterType,
      frequency: fc,
      gain,
      q: AUTOEQ_Q,
    };
  });
}

export const TARGET_CURVES: TargetProfile[] = [
  { id: 'harman-iem-2019', name: 'Harman IEM 2019', filters: [
    { type: 'lowShelf', freq: 105, gain: 3.0, q: 0.7 },
    { type: 'peak', freq: 3500, gain: 3.5, q: 1.5 },
    { type: 'peak', freq: 6000, gain: -3.0, q: 2.0 },
    { type: 'highShelf', freq: 10000, gain: -7.0, q: 0.8 },
  ]},
  { id: 'harman-oe-2018', name: 'Harman OE 2018', filters: [
    { type: 'lowShelf', freq: 120, gain: 5.0, q: 0.7 },
    { type: 'peak', freq: 3500, gain: 3.5, q: 1.5 },
    { type: 'peak', freq: 6000, gain: -3.5, q: 2.0 },
    { type: 'highShelf', freq: 10000, gain: -6.0, q: 0.8 },
  ]},
  { id: 'ief-neutral', name: 'AutoEq in-ear', filters: [
    { type: 'lowShelf', freq: 100, gain: 1.0, q: 0.7 },
    { type: 'peak', freq: 3200, gain: 4.0, q: 1.5 },
    { type: 'peak', freq: 6500, gain: -4.0, q: 2.2 },
    { type: 'highShelf', freq: 10000, gain: -9.0, q: 0.8 },
  ]},
  { id: 'diffuse-field', name: 'Diffuse Field', filters: [
    { type: 'lowShelf', freq: 100, gain: -3.5, q: 0.7 },
    { type: 'peak', freq: 3200, gain: 4.5, q: 1.5 },
    { type: 'peak', freq: 8500, gain: 4.0, q: 2.0 },
    { type: 'highShelf', freq: 12000, gain: -3.0, q: 0.8 },
  ]},
  { id: 'harman-ie-2019-v2', name: 'Harman IE 2019 v2', filters: [
    { type: 'lowShelf', freq: 110, gain: 6.5, q: 0.7 },
    { type: 'peak', freq: 2700, gain: 3.0, q: 1.4 },
    { type: 'peak', freq: 5200, gain: -3.0, q: 2.0 },
    { type: 'highShelf', freq: 10000, gain: -8.0, q: 0.8 },
  ]},
  { id: 'jm1', name: 'JM-1', filters: [
    { type: 'lowShelf', freq: 110, gain: 4.0, q: 0.7 },
    { type: 'peak', freq: 3000, gain: 3.0, q: 1.4 },
    { type: 'peak', freq: 6000, gain: -3.0, q: 2.0 },
    { type: 'highShelf', freq: 12000, gain: -4.0, q: 0.8 },
  ]},
];
