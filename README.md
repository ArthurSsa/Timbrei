# Timbrei

**Equalizador paramétrico visual para fones de ouvido e IEMs.**

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
