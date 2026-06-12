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
- `src/app/theme.ts` — tokens visuais
- `backend/` — biblioteca **lemi** (DSP de referência, ver abaixo)

## Backend (`backend/`) — biblioteca `lemi`

A lógica de equalização paramétrica (coeficientes RBJ e resposta em frequência)
tem uma implementação de **referência em Rust**, formalmente verificada em
**Lean 4 / Mathlib**, em [`backend/`](backend/):

- `backend/src/coefficients.rs` — coeficientes RBJ (peaking, low/high shelf)
- `backend/src/frequency.rs` — resposta em frequência `H(e^{jω})`
- `backend/src/biquad.rs` — processamento por amostra (`no_std`, embarcável em Cortex-M4)
- `backend/lean/` — provas formais (estabilidade via Schur–Cohn, transformada bilinear)

O frontend executa essa mesma matemática portada para TypeScript em
`src/app/utils/filters.ts`. O backend serve como fonte de verdade verificada,
alvo embarcado e base para uma futura integração via WebAssembly.

```bash
cd backend
cargo build        # Rust (requer toolchain Rust)
lake build         # provas Lean 4 (requer Lean/elan)
```

> Backend desenvolvido em parceria — projeto acadêmico IFCE · APS 2026.1.
