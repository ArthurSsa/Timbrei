// ─────────────────────────────────────────────────────────────────────────
// Gera src/app/dsp/measurements.ts a partir das medições reais do AutoEq
// (fonte: oratory1990; alvos Harman/Diffuse/AutoEq). Cada curva é normalizada
// para 0 dB em 1 kHz e reamostrada numa grade log compacta. Reexecute com:
//   node scripts/build-measurements.mjs
// ─────────────────────────────────────────────────────────────────────────
import { writeFileSync } from 'fs';

const RAW = 'https://raw.githubusercontent.com/jaakkopasanen/AutoEq/master';

// id do dispositivo → caminho do CSV no AutoEq (oratory1990).
const DEVICES = {
  // headphones (over-ear)
  hd600: 'measurements/oratory1990/data/over-ear/Sennheiser HD 600.csv',
  hd800s: 'measurements/oratory1990/data/over-ear/Sennheiser HD 800 S.csv',
  wh1000xm5: 'measurements/oratory1990/data/over-ear/Sony WH-1000XM5.csv',
  'dt900-pro-x': 'measurements/oratory1990/data/over-ear/Beyerdynamic DT 900 Pro X.csv',
  hd660s: 'measurements/oratory1990/data/over-ear/Sennheiser HD 660 S.csv',
  hd650: 'measurements/oratory1990/data/over-ear/Sennheiser HD 650.csv',
  hd6xx: 'measurements/oratory1990/data/over-ear/Sennheiser HD 6XX.csv',
  hd560s: 'measurements/oratory1990/data/over-ear/Sennheiser HD 560S.csv',
  hd800: 'measurements/oratory1990/data/over-ear/Sennheiser HD 800.csv',
  sundara: 'measurements/oratory1990/data/over-ear/HIFIMAN Sundara (post-2020 earpads).csv',
  he400se: 'measurements/oratory1990/data/over-ear/HIFIMAN HE400se.csv',
  'lcd-x': 'measurements/oratory1990/data/over-ear/Audeze LCD-X (2021).csv',
  'focal-clear': 'measurements/oratory1990/data/over-ear/Focal Clear.csv',
  k702: 'measurements/oratory1990/data/over-ear/AKG K702.csv',
  k371: 'measurements/oratory1990/data/over-ear/AKG K371.csv',
  'dt770-pro': 'measurements/oratory1990/data/over-ear/Beyerdynamic DT 770 Pro.csv',
  'dt990-pro': 'measurements/oratory1990/data/over-ear/Beyerdynamic DT 990 Pro.csv',
  shp9500: 'measurements/oratory1990/data/over-ear/Philips SHP9500.csv',
  'ath-m50x': 'measurements/oratory1990/data/over-ear/Audio-Technica ATH-M50x.csv',
  mdr7506: 'measurements/oratory1990/data/over-ear/Sony MDR-7506.csv',
  'airpods-max': 'measurements/oratory1990/data/over-ear/Apple AirPods Max.csv',
  qc45: 'measurements/oratory1990/data/over-ear/Bose QuietComfort 45.csv',
  // IEMs (in-ear)
  'moondrop-aria': 'measurements/oratory1990/data/in-ear/Moondrop Aria.csv',
  '7hz-zero': 'measurements/oratory1990/data/in-ear/7Hz Salnotes Zero.csv',
  blessing2: 'measurements/oratory1990/data/in-ear/Moondrop Blessing 2.csv',
  'letshuoer-s12': 'measurements/oratory1990/data/in-ear/Shuoer S12 Pro.csv',
  'truthear-zero': 'measurements/oratory1990/data/in-ear/Truthear x Crinacle Zero.csv',
  er2xr: 'measurements/oratory1990/data/in-ear/Etymotic ER2XR.csv',
  'moondrop-chu': 'measurements/oratory1990/data/in-ear/Moondrop Chu.csv',
  'truthear-hexa': 'measurements/oratory1990/data/in-ear/Truthear Hexa.csv',
  '7hz-timeless': 'measurements/oratory1990/data/in-ear/7Hz Timeless.csv',
  er4xr: 'measurements/oratory1990/data/in-ear/Etymotic ER4XR.csv',
  'tin-t2': 'measurements/oratory1990/data/in-ear/Tin HiFi T2.csv',
  'final-e3000': 'measurements/oratory1990/data/in-ear/Final Audio E3000.csv',
};

// id do alvo → caminho do CSV (mesmo referencial das medições).
const TARGETS = {
  'harman-iem-2019': 'targets/Harman in-ear 2019.csv',
  'harman-oe-2018': 'targets/Harman over-ear 2018.csv',
  'ief-neutral': 'targets/AutoEq in-ear.csv',
  'diffuse-field': 'targets/Diffuse field GRAS KEMAR.csv',
};

// Grade log compacta (~1/16 oitava) de 20 Hz a 20 kHz.
const F0 = 20, F1 = 20000;
const N = 160;
const LOG0 = Math.log10(F0), LOG1 = Math.log10(F1);
const GRID = Array.from({ length: N }, (_, i) => 10 ** (LOG0 + (i / (N - 1)) * (LOG1 - LOG0)));

async function fetchCsv(path) {
  const res = await fetch(`${RAW}/${path.split('/').map(encodeURIComponent).join('/')}`);
  if (!res.ok) throw new Error(`HTTP ${res.status} para ${path}`);
  const text = await res.text();
  const fs = [], db = [];
  for (const line of text.split('\n')) {
    const t = line.trim();
    if (!t || /[a-zA-Z]/.test(t)) continue; // pula cabeçalho "frequency,raw"
    const [f, v] = t.split(',').map(Number);
    if (Number.isFinite(f) && Number.isFinite(v)) { fs.push(f); db.push(v); }
  }
  if (fs.length < 10) throw new Error(`poucos pontos em ${path}`);
  return { fs, db };
}

// Interpolação log-linear (linear em log f, linear em dB), com clamp nas bordas.
function interp(fs, db, f) {
  if (f <= fs[0]) return db[0];
  if (f >= fs[fs.length - 1]) return db[db.length - 1];
  let lo = 0, hi = fs.length - 1;
  while (hi - lo > 1) { const m = (lo + hi) >> 1; (fs[m] <= f ? lo = m : hi = m); }
  const t = (Math.log10(f) - Math.log10(fs[lo])) / (Math.log10(fs[hi]) - Math.log10(fs[lo]));
  return db[lo] + t * (db[hi] - db[lo]);
}

// Reamostra na GRID e normaliza para 0 dB em 1 kHz.
function process({ fs, db }) {
  const norm = interp(fs, db, 1000);
  return GRID.map(f => +(interp(fs, db, f) - norm).toFixed(2));
}

async function run() {
  const out = {};
  const report = [];
  for (const [groupName, group] of [['device', DEVICES], ['target', TARGETS]]) {
    for (const [id, path] of Object.entries(group)) {
      try {
        out[id] = process(await fetchCsv(path));
        report.push(`  ✓ ${groupName} ${id}`);
      } catch (e) {
        report.push(`  ✗ ${groupName} ${id} — ${e.message}`);
      }
    }
  }

  const grid = `[${GRID.map(f => +f.toFixed(2)).join(',')}]`;
  const entries = Object.entries(out).map(([id, arr]) => `  ${JSON.stringify(id)}: [${arr.join(',')}],`).join('\n');
  const ts = `// GERADO por scripts/build-measurements.mjs — NÃO editar à mão.
// Medições reais de resposta de frequência do AutoEq (fonte: oratory1990;
// alvos Harman/Diffuse/AutoEq). Cada curva está normalizada para 0 dB em 1 kHz
// e reamostrada em ${N} pontos log de ${F0} Hz a ${F1 / 1000} kHz (MEAS_FREQS).
// Licença das medições: CC BY-NC-SA 4.0 (oratory1990). Ver ATTRIBUTIONS.md.

/** Grade de frequências (Hz, log) das curvas em MEASUREMENTS. */
export const MEAS_FREQS: number[] = ${grid};

/** id de dispositivo/alvo → resposta medida (dB) alinhada a MEAS_FREQS. */
export const MEASUREMENTS: Record<string, number[]> = {
${entries}
};
`;
  writeFileSync(new URL('../src/app/dsp/measurements.ts', import.meta.url), ts);
  console.log(report.join('\n'));
  console.log(`\nTotal: ${Object.keys(out).length} curvas escritas em src/app/dsp/measurements.ts`);
}
run();
