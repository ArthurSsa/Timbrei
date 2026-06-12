// ─────────────────────────────────────────────────────────────────────────
// Adaptador do módulo WebAssembly gerado a partir do crate `wasm/`
// (timbrei-dsp-wasm), que por sua vez é uma casca fina sobre o DSP verificado
// do backend `lemi`. O artefato compilado vive em `./wasm-pkg/` e é versionado
// (ver `npm run build:wasm`), de modo que o build do Vite no Netlify não
// precisa da toolchain Rust.
//
// Expõe a mesma forma de `verifiedBiquad.ts` (VBiquadCoeffs) para que o facade
// `biquad.ts` possa trocar de backend de forma transparente.
// ─────────────────────────────────────────────────────────────────────────

import type { VBiquadCoeffs } from './verifiedBiquad';
// Import estático do glue gerado pelo wasm-pack (--target web). O `init`
// (export default) baixa e instancia o .wasm; as funções são síncronas depois.
import init, {
  peaking as wasmPeaking,
  low_shelf as wasmLowShelf,
  high_shelf as wasmHighShelf,
} from './wasm-pkg/timbrei_dsp';

let ready = false;

/** Instancia o módulo WASM. Idempotente; rejeita se o .wasm não carregar. */
export async function initWasm(): Promise<void> {
  if (ready) return;
  await init();
  ready = true;
}

export const isReady = (): boolean => ready;

const toCoeffs = (a: Float64Array | number[]): VBiquadCoeffs => ({
  b0: a[0], b1: a[1], b2: a[2], a1: a[3], a2: a[4],
});

export function peaking(f0: number, fs: number, q: number, gainDb: number): VBiquadCoeffs {
  return toCoeffs(wasmPeaking(f0, fs, q, gainDb));
}

export function lowShelf(f0: number, fs: number, s: number, gainDb: number): VBiquadCoeffs {
  return toCoeffs(wasmLowShelf(f0, fs, s, gainDb));
}

export function highShelf(f0: number, fs: number, s: number, gainDb: number): VBiquadCoeffs {
  return toCoeffs(wasmHighShelf(f0, fs, s, gainDb));
}
