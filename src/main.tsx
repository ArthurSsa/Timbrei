import { createRoot } from "react-dom/client";
import App from "./app/App.tsx";
import { initDsp } from "./app/dsp/biquad";
import "./styles/index.css";

// Enables the DSP backend (verified WebAssembly, with a fallback to the
// TypeScript port) before the first render, so curve computation is synchronous
// on the hot path. Any failure keeps the TS fallback.
initDsp().finally(() => {
  createRoot(document.getElementById("root")!).render(<App />);
});
