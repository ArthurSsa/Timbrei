# timbrei-dsp-wasm — ponte WebAssembly

Casca fina de [`wasm-bindgen`](https://github.com/rustwasm/wasm-bindgen) que expõe
o DSP formalmente verificado do crate [`lemi`](../backend) (RBJ peaking, low/high
shelf e resposta em frequência) ao frontend Timbrei, compilado para WebAssembly.

Este crate **não contém matemática própria**: depende do `lemi` por path e apenas
traduz a API para o limite JavaScript. Assim, o navegador roda exatamente o mesmo
código de referência verificado em Lean 4 — sem reimplementar nada.

## API exportada (`src/lib.rs`)

Todas devolvem `[b0, b1, b2, a1, a2]` (já normalizados por a0):

- `peaking(f0, fs, q, gain_db)` — usa o fator de qualidade Q
- `low_shelf(f0, fs, s, gain_db)` — usa a inclinação S ∈ (0, 1]
- `high_shelf(f0, fs, s, gain_db)` — usa a inclinação S ∈ (0, 1]
- `magnitude_db(b0, b1, b2, a1, a2, w)` — magnitude em dB em ω (rad/amostra)

Parâmetros inválidos (via `lemi::ValidParams`) lançam um erro JS.

## Build

```bash
rustup target add wasm32-unknown-unknown
# a partir da raiz do repositório:
npm run build:wasm
# equivale a:
# wasm-pack build wasm --target web --release \
#   --out-dir ../src/app/dsp/wasm-pkg --out-name timbrei_dsp
```

O pacote gerado vai para `src/app/dsp/wasm-pkg/` e é versionado (o build do
Netlify não tem toolchain Rust). O facade `src/app/dsp/biquad.ts` consome o
pacote e cai na porta TypeScript `verifiedBiquad.ts` caso o WASM não carregue.
