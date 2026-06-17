// Live measurement data from squig.link / CrinGraph databases.
//
// Each source exposes `<base>/data/phone_book.json` (a list of brands, each
// with a list of phones) and per-device frequency response files at
// `<base>/data/<file> L.txt` and `<file> R.txt` (REW exports). Requests go
// through the local /squig proxy (see scripts/squig-proxy.mjs), which adds the
// headers the upstream servers require and the CORS the browser needs.

import { LOG_FREQS } from '../utils/filters';

export interface SquigSource {
  id: string;
  label: string;
  base: string;
}

// Sources verified to serve both the manifest and the FR files end to end.
export const SQUIG_SOURCES: SquigSource[] = [
  { id: 'precog', label: 'Precogvision (IEM, 5128)', base: 'https://precog.squig.link' },
  { id: 'timmyv', label: 'TimmyV', base: 'https://timmyv.squig.link' },
  { id: 'squiglink', label: 'squig.link (aggregate)', base: 'https://squig.link' },
];

export interface PhoneEntry {
  id: string;
  brand: string;
  model: string;
  file: string;
}

const proxied = (url: string) => `/squig/${encodeURIComponent(url)}`;

async function getText(url: string): Promise<string> {
  const r = await fetch(proxied(url));
  if (!r.ok) throw new Error(`HTTP ${r.status} for ${url}`);
  return r.text();
}

interface RawBrand {
  name: string;
  phones?: Array<{ name: string; file: string | string[]; suffix?: string | string[] }>;
}

// Flattens a CrinGraph phone_book.json into a flat list of selectable entries.
// A phone with several files (measurement variants) expands to one entry per
// variant, named with its suffix.
export async function fetchPhoneBook(source: SquigSource): Promise<PhoneEntry[]> {
  const book = JSON.parse(await getText(`${source.base}/data/phone_book.json`)) as RawBrand[];
  const out: PhoneEntry[] = [];
  for (const brand of book) {
    if (!brand?.name || brand.name.startsWith('_')) continue; // internal entries, e.g. _EQ
    for (const phone of brand.phones ?? []) {
      const files = Array.isArray(phone.file) ? phone.file : [phone.file];
      const suffixes = Array.isArray(phone.suffix)
        ? phone.suffix
        : phone.suffix != null
          ? [phone.suffix]
          : [];
      files.forEach((file, i) => {
        if (!file) return;
        const variant = suffixes[i] ? ` ${suffixes[i]}` : files.length > 1 ? ` (${i + 1})` : '';
        out.push({
          id: `${source.id}:${file}`,
          brand: brand.name,
          model: `${phone.name}${variant}`,
          file,
        });
      });
    }
  }
  return out;
}

// Parses an REW / CrinGraph FR export: skips comment lines (which start with
// `*` or a letter) and reads the frequency and SPL columns.
function parseFR(text: string): { freqs: number[]; spl: number[] } {
  const freqs: number[] = [];
  const spl: number[] = [];
  for (const line of text.split('\n')) {
    const t = line.trim();
    if (!t || t[0] === '*' || /[a-zA-Z]/.test(t[0])) continue;
    const parts = t.split(/[\s,]+/);
    const f = parseFloat(parts[0]);
    const v = parseFloat(parts[1]);
    if (Number.isFinite(f) && Number.isFinite(v) && f > 0) {
      freqs.push(f);
      spl.push(v);
    }
  }
  return { freqs, spl };
}

// Log-linear interpolation with edge clamp.
function interp(freqs: number[], vals: number[], f: number): number {
  if (f <= freqs[0]) return vals[0];
  if (f >= freqs[freqs.length - 1]) return vals[vals.length - 1];
  let lo = 0;
  let hi = freqs.length - 1;
  while (hi - lo > 1) {
    const m = (lo + hi) >> 1;
    if (freqs[m] <= f) lo = m;
    else hi = m;
  }
  const t = (Math.log10(f) - Math.log10(freqs[lo])) / (Math.log10(freqs[hi]) - Math.log10(freqs[lo]));
  return vals[lo] + t * (vals[hi] - vals[lo]);
}

// Resamples a raw curve onto LOG_FREQS and normalizes it to 0 dB at 1 kHz.
function toCurve(freqs: number[], spl: number[]): number[] {
  if (freqs.length < 2) throw new Error('measurement has too few points');
  const norm = interp(freqs, spl, 1000);
  return LOG_FREQS.map(f => interp(freqs, spl, f) - norm);
}

async function tryFetch(url: string): Promise<string | null> {
  try {
    return await getText(url);
  } catch {
    return null;
  }
}

// Loads a device measurement: averages L and R when both exist, with a single
// channel fallback. Returns a LOG_FREQS-aligned curve normalized to 0 dB at
// 1 kHz, ready to plot or to feed to AutoEQ.
export async function fetchMeasurement(source: SquigSource, file: string): Promise<number[]> {
  const d = `${source.base}/data`;

  const left = await tryFetch(`${d}/${file} L.txt`);
  if (left) {
    const lc = parseFR(left);
    const right = await tryFetch(`${d}/${file} R.txt`);
    if (right) {
      const rc = parseFR(right);
      const avg = lc.freqs.map((f, i) => (lc.spl[i] + interp(rc.freqs, rc.spl, f)) / 2);
      return toCurve(lc.freqs, avg);
    }
    return toCurve(lc.freqs, lc.spl);
  }

  const single = await tryFetch(`${d}/${file}.txt`);
  if (single) {
    const c = parseFR(single);
    return toCurve(c.freqs, c.spl);
  }

  throw new Error(`no measurement file for "${file}"`);
}
