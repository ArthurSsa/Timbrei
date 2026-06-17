// Timbrei DSP facade.
//
// Exposes the three filters covered by the verified lemi backend (peaking and
// the two shelves) and dispatches at runtime to the best available backend:
//
//   WebAssembly (the `wasm/` crate, a shell over the verified Rust): preferred.
//   TypeScript port (`verifiedBiquad.ts`): faithful fallback, always present.
//
// Both produce the same coefficients (the TS port matches the backend fixtures
// bit for bit), so the switch is transparent to `filters.ts`. `initDsp()` must
// be called once at startup (see `main.tsx`); until then, and if the WASM fails
// to load, the TS port is used.

import * as TS from './verifiedBiquad';
import type { VBiquadCoeffs } from './verifiedBiquad';

export type { VBiquadCoeffs };

interface DspApi {
  peaking(f0: number, fs: number, q: number, gainDb: number): VBiquadCoeffs;
  lowShelf(f0: number, fs: number, s: number, gainDb: number): VBiquadCoeffs;
  highShelf(f0: number, fs: number, s: number, gainDb: number): VBiquadCoeffs;
}

export type DspBackend = 'wasm' | 'ts';

let active: DspApi = TS;
let backend: DspBackend = 'ts';

/** Tries to enable the WASM backend; on any failure keeps the TS port. */
export async function initDsp(): Promise<DspBackend> {
  try {
    const wasm = await import('./wasmBiquad');
    await wasm.initWasm();
    active = wasm;
    backend = 'wasm';
  } catch (err) {
    active = TS;
    backend = 'ts';
    console.warn('[dsp] WASM unavailable; using the verified TypeScript port.', err);
  }
  return backend;
}

/** Which backend is currently active ('wasm' or 'ts'). */
export const dspBackend = (): DspBackend => backend;

export const peaking = (f0: number, fs: number, q: number, gainDb: number): VBiquadCoeffs =>
  active.peaking(f0, fs, q, gainDb);
export const lowShelf = (f0: number, fs: number, s: number, gainDb: number): VBiquadCoeffs =>
  active.lowShelf(f0, fs, s, gainDb);
export const highShelf = (f0: number, fs: number, s: number, gainDb: number): VBiquadCoeffs =>
  active.highShelf(f0, fs, s, gainDb);
