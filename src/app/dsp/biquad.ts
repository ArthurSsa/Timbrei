// ─────────────────────────────────────────────────────────────────────────
// Facade de DSP do Timbrei.
//
// Expõe os três filtros cobertos pelo backend verificado `lemi` (peaking e os
// dois shelves) e despacha em runtime para o melhor backend disponível:
//
//   • WebAssembly (crate `wasm/`, casca sobre o Rust verificado) — preferido;
//   • porta TypeScript (`verifiedBiquad.ts`) — fallback fiel, sempre presente.
//
// Ambos produzem os mesmos coeficientes (a porta TS bate bit a bit com as
// fixtures do backend), então a troca é transparente para `filters.ts`.
// `initDsp()` deve ser chamado uma vez no arranque (ver `main.tsx`); até lá, e
// caso o WASM falhe ao carregar, a porta TS é usada.
// ─────────────────────────────────────────────────────────────────────────

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

/** Tenta ativar o backend WASM; em qualquer falha mantém a porta TS. */
export async function initDsp(): Promise<DspBackend> {
  try {
    const wasm = await import('./wasmBiquad');
    await wasm.initWasm();
    active = wasm;
    backend = 'wasm';
  } catch (err) {
    active = TS;
    backend = 'ts';
    console.warn('[dsp] WASM indisponível; usando a porta TypeScript verificada.', err);
  }
  return backend;
}

/** Qual backend está ativo no momento ('wasm' ou 'ts'). */
export const dspBackend = (): DspBackend => backend;

export const peaking = (f0: number, fs: number, q: number, gainDb: number): VBiquadCoeffs =>
  active.peaking(f0, fs, q, gainDb);
export const lowShelf = (f0: number, fs: number, s: number, gainDb: number): VBiquadCoeffs =>
  active.lowShelf(f0, fs, s, gainDb);
export const highShelf = (f0: number, fs: number, s: number, gainDb: number): VBiquadCoeffs =>
  active.highShelf(f0, fs, s, gainDb);
