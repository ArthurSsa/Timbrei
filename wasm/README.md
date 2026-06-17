# timbrei-dsp-wasm: WebAssembly bridge

A thin [`wasm-bindgen`](https://github.com/rustwasm/wasm-bindgen) shell that
exposes the formally verified DSP of the [`lemi`](../backend) crate (RBJ
peaking, low/high shelf, and frequency response) to the Timbrei frontend,
compiled to WebAssembly.

This crate contains no mathematics of its own: it depends on `lemi` by path and
only translates the API across the JavaScript boundary. The browser therefore
runs exactly the same reference code verified in Lean 4, without reimplementing
anything.

## Exported API (`src/lib.rs`)

All return `[b0, b1, b2, a1, a2]` (already normalized by a0):

- `peaking(f0, fs, q, gain_db)`: uses the quality factor Q.
- `low_shelf(f0, fs, s, gain_db)`: uses the slope S in (0, 1].
- `high_shelf(f0, fs, s, gain_db)`: uses the slope S in (0, 1].
- `magnitude_db(b0, b1, b2, a1, a2, w)`: magnitude in dB at ω (rad/sample).

Invalid parameters (via `lemi::ValidParams`) raise a JS error.

## Build

```bash
rustup target add wasm32-unknown-unknown
# from the repository root:
npm run build:wasm
# equivalent to:
# wasm-pack build wasm --target web --release \
#   --out-dir ../src/app/dsp/wasm-pkg --out-name timbrei_dsp
```

The generated package goes to `src/app/dsp/wasm-pkg/` and is versioned (the
Netlify build has no Rust toolchain). The `src/app/dsp/biquad.ts` facade
consumes the package and falls back to the TypeScript port `verifiedBiquad.ts`
if the WASM fails to load.
