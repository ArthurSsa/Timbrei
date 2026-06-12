# Timbrei

**Equalizador paramétrico visual para fones de ouvido e IEMs.**

🔗 Demo ao vivo: **[timbrei.netlify.app](https://timbrei.netlify.app/)**

Timbrei deixa você comparar curvas de resposta de frequência, ajustar um EQ paramétrico
banda a banda, aplicar **Auto EQ** contra curvas-alvo (Harman, IEF, etc.), usar **presets**
prontos e **exportar** para EqualizerAPO / Peace / Roon / Wavelet.

![Timbrei](public/timbrei-logo.png)

## Recursos

- 📈 Gráfico de resposta de frequência com regiões por banda (Sub, Mid bass, Mids, Treble, **Air**)
- 🎛️ EQ paramétrico (peak, shelves, pass, notch) com preamp, undo/redo e bypass
- ⚡ **Auto EQ** contra curvas-alvo e **presets** (Bass Boost, V-Shape, Vocal, etc.)
- 🧰 Painel inferior com abas: Funções, Bandas, Presets, Exportar, Análise
- 📤 Exportação para EqualizerAPO e compatíveis
- 📱 Interface responsiva (desktop e celular), estilo brutalista

## Desenvolvimento

```bash
npm install
npm run dev      # servidor de desenvolvimento (Vite)
npm run build    # build de produção em dist/
```

Stack: React 18 + TypeScript + Vite + Tailwind CSS v4. O gráfico é renderizado em `<canvas>`.

## Estrutura

- `src/app/App.tsx` — layout, navbar e estado principal
- `src/app/components/FrequencyChart.tsx` — gráfico em canvas
- `src/app/components/EQPanel.tsx` — painel inferior com abas
- `src/app/utils/filters.ts` — DSP (biquads), perfis, alvos e presets
- `src/app/dsp/biquad.ts` — facade de DSP (escolhe WASM ou porta TS em runtime)
- `src/app/dsp/verifiedBiquad.ts` — porta TypeScript do DSP verificado (fallback)
- `src/app/dsp/wasm-pkg/` — pacote WebAssembly gerado (artefato versionado)
- `src/app/theme.ts` — tokens visuais
- `backend/` — biblioteca **lemi** (DSP de referência, ver abaixo)
- `wasm/` — ponte WebAssembly (casca `wasm-bindgen` sobre o `lemi`)

## Backend (`backend/`) — biblioteca `lemi`

A lógica de equalização paramétrica (coeficientes RBJ e resposta em frequência)
tem uma implementação de **referência em Rust**, formalmente verificada em
**Lean 4 / Mathlib**, em [`backend/`](backend/):

- `backend/src/coefficients.rs` — coeficientes RBJ (peaking, low/high shelf)
- `backend/src/frequency.rs` — resposta em frequência `H(e^{jω})`
- `backend/src/biquad.rs` — processamento por amostra (`no_std`, embarcável em Cortex-M4)
- `backend/lean/` — provas formais (estabilidade via Schur–Cohn, transformada bilinear)

```bash
cd backend
cargo build        # Rust (requer toolchain Rust)
lake build         # provas Lean 4 (requer Lean/elan)
```

## Integração WebAssembly (`wasm/`)

O frontend roda **o próprio código Rust verificado no navegador**, via WebAssembly.
O crate [`wasm/`](wasm/) (`timbrei-dsp-wasm`) é uma casca fina de `wasm-bindgen`
sobre o `lemi` (depende dele por path, sem duplicar a matemática). Em runtime, o
facade `src/app/dsp/biquad.ts` ativa o backend WASM e, se ele falhar ao carregar,
cai automaticamente na porta TypeScript `verifiedBiquad.ts` — ambos produzem os
mesmos coeficientes (batem **bit a bit** com `backend/fixtures/rbj_coefficients.json`).

Gerar o pacote WASM (requer toolchain Rust + `wasm-pack`):

```bash
rustup target add wasm32-unknown-unknown
npm run build:wasm   # compila wasm/ → src/app/dsp/wasm-pkg/ (artefato versionado)
```

O artefato em `src/app/dsp/wasm-pkg/` é commitado de propósito, para que o build
do Vite no Netlify (sem toolchain Rust) apenas o consuma. Rode `npm run build:wasm`
sempre que alterar o código em `wasm/` ou `backend/`.

> Backend desenvolvido em parceria — projeto acadêmico IFCE · APS 2026.1.
