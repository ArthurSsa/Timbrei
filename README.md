# Timbrei

**Visual parametric equalizer for headphones and IEMs, on a formally verified DSP core.**

[timbrei.netlify.app](https://timbrei.netlify.app/)

Timbrei loads measurement curves live from squig.link / CrinGraph, compares
them, and adjusts a parametric EQ band by band — peaking and low/high shelf, the
same three filter types proved stable in `lean/`. AutoEQ fits a bank of peaking
filters against a target curve or another loaded device, bands are edited
directly on the canvas graph (drag for frequency and gain, scroll for Q,
double-click to add), and the result exports to EqualizerAPO and compatible
tools.

![Timbrei](public/timbrei-logo.png)

## Build

```bash
npm install
npm run dev      # Vite dev server (with the squig.link data proxy)
npm run build    # production build in dist/
npm run start    # build, then serve dist/ on http://localhost:4178
```

`npm run start` is the one-command way to run Timbrei locally: it builds the app
and serves the build through a small Node server (`scripts/serve.mjs`) that also
proxies measurement data. No Rust toolchain and no external services are
required.

Stack: React 18, TypeScript, Vite, Tailwind CSS v4. The frequency graph is drawn
on a `<canvas>`.

## Measurement data

Device curves are fetched live from squig.link / CrinGraph databases; none are
vendored into the repository. Pick a source in the navbar, search for a device,
and its frequency response loads on demand. AutoEQ can target a parametric curve
(defined in `filters.ts`) or another loaded device.

Browsers cannot read those databases directly (no CORS, and some instances use
hotlink protection), so requests pass through a local proxy mounted at `/squig`
(`scripts/squig-proxy.mjs`), wired into the Vite dev and preview servers and into
`scripts/serve.mjs`. The proxy is restricted to an allowlist of squig.link-style
hosts. Sources live in `src/app/dsp/squig.ts`.

## Layout

- `src/app/App.tsx` — layout, navbar, and top-level state.
- `src/app/components/FrequencyChart.tsx` — canvas graph and on-graph band editing.
- `src/app/components/EQPanel.tsx` — bottom panel with tabs.
- `src/app/utils/filters.ts` — DSP (biquads), targets, and AutoEQ.
- `src/app/dsp/squig.ts` — squig.link / CrinGraph sources and measurement loading.
- `src/app/dsp/biquad.ts` — DSP facade (selects WASM or the TS port at runtime).
- `src/app/dsp/verifiedBiquad.ts` — TypeScript port of the verified DSP (fallback).
- `src/app/dsp/wasm-pkg/` — generated WebAssembly package (versioned artifact).
- `src/coefficients.rs`, `src/frequency.rs`, `src/biquad.rs` — the verified core (below).
- `lean/` — the formal proofs.
- `wasm/` — wasm-bindgen bridge over the core.

## Verified core

The parametric equalization math (RBJ coefficients and frequency response) has a
reference implementation in Rust, formally verified in Lean 4 / Mathlib, at the
repository root:

- `src/coefficients.rs` — RBJ coefficients (peaking, low/high shelf).
- `src/frequency.rs` — frequency response `H(e^{jω})`.
- `src/biquad.rs` — per-sample processing (`no_std`, embeddable on Cortex-M4).
- `lean/` — stability proofs (Schur-Cohn, bilinear transform).

```bash
cargo build      # Rust core (requires the Rust toolchain)
lake build       # Lean 4 proofs (requires Lean / elan)
```

## WebAssembly

The frontend runs the verified Rust in the browser through WebAssembly. The
`wasm/` crate (`timbrei-dsp-wasm`) is a thin `wasm-bindgen` shell over the root
crate (it depends on it by path and duplicates none of the mathematics). At
runtime `src/app/dsp/biquad.ts` enables the WASM backend and, if it fails to
load, falls back to the TypeScript port `verifiedBiquad.ts`; both produce the
same coefficients (they match `fixtures/rbj_coefficients.json` bit for bit).

```bash
rustup target add wasm32-unknown-unknown
npm run build:wasm   # compiles wasm/ to src/app/dsp/wasm-pkg/ (versioned artifact)
```

The artifact in `src/app/dsp/wasm-pkg/` is committed on purpose, so the Netlify
build (without a Rust toolchain) only consumes it. Rebuild it whenever the code
in `wasm/` or the verified core changes.

IFCE · APS 2026.1
