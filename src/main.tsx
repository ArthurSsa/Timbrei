import { createRoot } from "react-dom/client";
import App from "./app/App.tsx";
import { initDsp } from "./app/dsp/biquad";
import "./styles/index.css";

// Ativa o backend de DSP (WebAssembly verificado, com fallback para a porta
// TypeScript) antes da primeira renderização, para que o cálculo das curvas
// seja síncrono no caminho quente. Qualquer falha mantém o fallback TS.
initDsp().finally(() => {
  createRoot(document.getElementById("root")!).render(<App />);
});
