import { useRef, useEffect, useState, useCallback } from 'react';
import {
  EQBandDef, DeviceProfile, TargetProfile,
  deviceResponse, targetResponse, calcEQCurve, LOG_FREQS, FREQ_BANDS,
} from '../utils/filters';
import { C } from '../theme';

// Domínio total do eixo de frequência (20 Hz–20 kHz). Usado para indexar
// LOG_FREQS, independentemente do zoom do eixo X.
const FULL_MIN = Math.log10(20);
const FULL_MAX = Math.log10(20000);
const PAD = { t: 14, r: 20, b: 62, l: 52 };

// Ticks rotulados (1-2-5 por década na visão completa; mais finos quando há
// zoom numa faixa estreita) dentro de [fLo, fHi].
function genFreqTicks(fLo: number, fHi: number): number[] {
  const span = Math.log10(fHi / fLo);
  const mults = span > 1.4 ? [1, 2, 5] : [1, 1.5, 2, 3, 5, 7];
  const ticks: number[] = [];
  const d0 = Math.floor(Math.log10(fLo)), d1 = Math.ceil(Math.log10(fHi));
  for (let d = d0; d <= d1; d++) for (const m of mults) {
    const f = m * 10 ** d;
    if (f >= fLo - 1e-6 && f <= fHi + 1e-6) ticks.push(f);
  }
  if (ticks.length === 0) { ticks.push(fLo, fHi); }
  return ticks;
}

// Grade menor (1..9 por década) dentro de [fLo, fHi].
function genFreqGrid(fLo: number, fHi: number): number[] {
  const g: number[] = [];
  const d0 = Math.floor(Math.log10(fLo)), d1 = Math.ceil(Math.log10(fHi));
  for (let d = d0; d <= d1; d++) for (let m = 1; m <= 9; m++) {
    const f = m * 10 ** d;
    if (f >= fLo - 1e-6 && f <= fHi + 1e-6) g.push(f);
  }
  return g;
}

const fmtFreq = (f: number) => (f >= 1000 ? `${+(f / 1000).toFixed(1)}k` : `${Math.round(f)}`);

const dbToY = (db: number, h: number, dbMin: number, dbMax: number) =>
  (1 - (db - dbMin) / (dbMax - dbMin)) * h;
const yToDb = (y: number, h: number, dbMin: number, dbMax: number) =>
  dbMin + (1 - y / h) * (dbMax - dbMin);

function getDbTicks(dbMin: number, dbMax: number): number[] {
  const step = dbMax - dbMin > 30 ? 10 : dbMax - dbMin > 15 ? 5 : 2;
  const ticks: number[] = [];
  for (let db = Math.ceil(dbMin / step) * step; db <= dbMax; db += step) ticks.push(db);
  return ticks;
}

export interface SelectedDevice {
  id: string;
  profile: DeviceProfile;
  color: string;
}

interface FrequencyChartProps {
  devices: SelectedDevice[];
  target: TargetProfile | null;
  eqBands: EQBandDef[];
  showEQ: boolean;
  yScale: number;
  preamp?: number;
  hoveredBand: string | null;
  onBandHover: (bandId: string | null) => void;
  /** Faixa [fLo, fHi] visível no eixo X (zoom por banda). null = 20 Hz–20 kHz. */
  freqRange?: [number, number] | null;
}

export function FrequencyChart({
  devices, target, eqBands, showEQ, yScale, preamp = 0,
  hoveredBand, onBandHover, freqRange = null,
}: FrequencyChartProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const wrapRef = useRef<HTMLDivElement>(null);
  const [size, setSize] = useState({ w: 0, h: 0 });
  const [cursor, setCursor] = useState<{ cx: number; cy: number } | null>(null);

  // Limites visíveis do eixo X (com zoom) e mapeamentos freq⇄pixel derivados.
  const [fLo, fHi] = freqRange && freqRange[0] < freqRange[1] ? freqRange : [20, 20000];
  const logMin = Math.log10(fLo);
  const logMax = Math.log10(fHi);
  const fToX = (f: number, w: number) => (Math.log10(f) - logMin) / (logMax - logMin) * w;
  const xToF = (x: number, w: number) => 10 ** (logMin + (x / w) * (logMax - logMin));

  useEffect(() => {
    const el = wrapRef.current;
    if (!el) return;
    const ro = new ResizeObserver(([e]) => {
      const { width, height } = e.contentRect;
      setSize({ w: width, h: height });
    });
    ro.observe(el);
    return () => ro.disconnect();
  }, []);

  const cw = size.w - PAD.l - PAD.r;
  const ch = size.h - PAD.t - PAD.b;

  // Dynamic dB range based on yScale
  const DB_RANGE = 45 / yScale;
  const DB_MIN = -(DB_RANGE * 0.62);
  const DB_MAX = DB_RANGE * 0.38;
  const DB_TICKS = getDbTicks(DB_MIN, DB_MAX);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas || cw <= 0 || ch <= 0) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    const dpr = window.devicePixelRatio || 1;
    canvas.width = size.w * dpr;
    canvas.height = size.h * dpr;
    ctx.scale(dpr, dpr);

    // ── Background ──────────────────────────────────────────────────
    ctx.fillStyle = C.bg;
    ctx.fillRect(0, 0, size.w, size.h);

    ctx.save();
    ctx.translate(PAD.l, PAD.t);

    // Clip to chart area
    ctx.save();
    ctx.beginPath();
    ctx.rect(0, 0, cw, ch);
    ctx.clip();

    // Chart background — flat white plot (brutalist, no gradient)
    ctx.fillStyle = C.surface;
    ctx.fillRect(0, 0, cw, ch);

    // ── Frequency band regions ──────────────────────────────────────
    FREQ_BANDS.forEach(band => {
      const x1 = fToX(band.fLow, cw);
      const x2 = fToX(band.fHigh, cw);
      const isHovered = hoveredBand === band.id;

      ctx.fillStyle = isHovered ? band.fillHover : band.fill;
      ctx.fillRect(x1, 0, x2 - x1, ch);

      // Left border of each band
      if (band.id !== 'sub') {
        ctx.strokeStyle = isHovered ? band.labelColor + '66' : '#e4dabc';
        ctx.lineWidth = 1;
        ctx.setLineDash([]);
        ctx.beginPath();
        ctx.moveTo(x1, 0);
        ctx.lineTo(x1, ch);
        ctx.stroke();
      }

      // Hz range annotation when hovered
      if (isHovered) {
        const cx = (x1 + x2) / 2;
        const loLabel = band.fLow >= 1000 ? `${band.fLow / 1000}kHz` : `${band.fLow}Hz`;
        const hiLabel = band.fHigh >= 1000 ? `${band.fHigh / 1000}kHz` : `${band.fHigh}Hz`;
        const rangeText = `${loLabel} – ${hiLabel}`;

        ctx.font = '500 11px ui-sans-serif, system-ui, sans-serif';
        ctx.textAlign = 'center';
        ctx.fillStyle = band.labelColor + 'cc';

        // Background pill — white with hard dark border (brutalist)
        const tw = ctx.measureText(rangeText).width + 16;
        const ty = 10;
        ctx.fillStyle = C.surface;
        ctx.beginPath();
        ctx.rect(cx - tw / 2, ty, tw, 20);
        ctx.fill();
        ctx.strokeStyle = band.labelColor;
        ctx.lineWidth = 2;
        ctx.stroke();

        ctx.fillStyle = band.labelColor;
        ctx.fillText(rangeText, cx, ty + 14);

        // Vertical markers at band edges
        ctx.strokeStyle = band.labelColor + '88';
        ctx.lineWidth = 1;
        ctx.setLineDash([4, 3]);
        ctx.beginPath();
        ctx.moveTo(x1, 0); ctx.lineTo(x1, ch);
        ctx.moveTo(x2, 0); ctx.lineTo(x2, ch);
        ctx.stroke();
        ctx.setLineDash([]);
      }
    });

    // ── Minor frequency grid ────────────────────────────────────────
    genFreqGrid(fLo, fHi).forEach(f => {
      const x = fToX(f, cw);
      const isDecade = Number.isInteger(Math.log10(f));
      ctx.strokeStyle = isDecade ? '#cbbf9e' : '#ece3ca';
      ctx.lineWidth = 1;
      ctx.setLineDash([]);
      ctx.beginPath();
      ctx.moveTo(x, 0);
      ctx.lineTo(x, ch);
      ctx.stroke();
    });

    // ── dB grid ─────────────────────────────────────────────────────
    DB_TICKS.forEach(db => {
      const y = dbToY(db, ch, DB_MIN, DB_MAX);
      if (y < 0 || y > ch) return;
      ctx.strokeStyle = db === 0 ? '#b9ac88' : '#ece3ca';
      ctx.lineWidth = db === 0 ? 1.5 : 1;
      ctx.setLineDash([]);
      ctx.beginPath();
      ctx.moveTo(0, y);
      ctx.lineTo(cw, y);
      ctx.stroke();
    });

    // 0 dB dashed highlight
    if (DB_MIN < 0 && DB_MAX > 0) {
      ctx.setLineDash([6, 4]);
      ctx.strokeStyle = C.ink;
      ctx.lineWidth = 1;
      ctx.beginPath();
      ctx.moveTo(0, dbToY(0, ch, DB_MIN, DB_MAX));
      ctx.lineTo(cw, dbToY(0, ch, DB_MIN, DB_MAX));
      ctx.stroke();
      ctx.setLineDash([]);
    }

    // ── Precompute curves ────────────────────────────────────────────
    const deviceCurves = devices.map(d => deviceResponse(d.profile, LOG_FREQS));
    const targetCurve = target ? targetResponse(target, LOG_FREQS) : null;
    const hasActiveEQ = showEQ && eqBands.some(b => b.enabled);
    const eqCurve = hasActiveEQ ? calcEQCurve(eqBands, LOG_FREQS).map(v => v + preamp) : null;

    // ── Target curve ─────────────────────────────────────────────────
    if (targetCurve) {
      ctx.save();
      ctx.strokeStyle = 'rgba(20, 20, 20, 0.55)';
      ctx.lineWidth = 1.75;
      ctx.setLineDash([9, 6]);
      ctx.lineJoin = 'round';
      ctx.beginPath();
      LOG_FREQS.forEach((f, i) => {
        const x = fToX(f, cw), y = dbToY(targetCurve[i], ch, DB_MIN, DB_MAX);
        i === 0 ? ctx.moveTo(x, y) : ctx.lineTo(x, y);
      });
      ctx.stroke();
      ctx.setLineDash([]);
      ctx.restore();
    }

    // ── Device curves ─────────────────────────────────────────────────
    devices.forEach(({ color }, di) => {
      const data = deviceCurves[di];
      ctx.save();

      // Gradient fill (subtle wash under the curve)
      const grad = ctx.createLinearGradient(0, 0, 0, ch);
      grad.addColorStop(0, color + '24');
      grad.addColorStop(0.5, color + '0e');
      grad.addColorStop(1, color + '00');
      ctx.beginPath();
      LOG_FREQS.forEach((f, i) => {
        const x = fToX(f, cw), y = dbToY(data[i], ch, DB_MIN, DB_MAX);
        i === 0 ? ctx.moveTo(x, y) : ctx.lineTo(x, y);
      });
      ctx.lineTo(fToX(LOG_FREQS[LOG_FREQS.length - 1], cw), ch + 2);
      ctx.lineTo(fToX(LOG_FREQS[0], cw), ch + 2);
      ctx.closePath();
      ctx.fillStyle = grad;
      ctx.fill();

      // Main line — flat & crisp (no glow)
      ctx.strokeStyle = color;
      ctx.lineWidth = 2.5;
      ctx.lineJoin = 'round';
      ctx.beginPath();
      LOG_FREQS.forEach((f, i) => {
        const x = fToX(f, cw), y = dbToY(data[i], ch, DB_MIN, DB_MAX);
        i === 0 ? ctx.moveTo(x, y) : ctx.lineTo(x, y);
      });
      ctx.stroke();
      ctx.restore();
    });

    // ── EQ curve ─────────────────────────────────────────────────────
    if (eqCurve) {
      ctx.save();
      ctx.strokeStyle = C.accent;
      ctx.lineWidth = 3;
      ctx.lineJoin = 'round';
      ctx.beginPath();
      LOG_FREQS.forEach((f, i) => {
        const x = fToX(f, cw), y = dbToY(eqCurve[i], ch, DB_MIN, DB_MAX);
        i === 0 ? ctx.moveTo(x, y) : ctx.lineTo(x, y);
      });
      ctx.stroke();
      ctx.restore();
    }

    // ── Crosshair & hover dots ────────────────────────────────────────
    if (cursor) {
      const { cx: curX, cy: curY } = cursor;
      if (curX >= 0 && curX <= cw && curY >= 0 && curY <= ch) {
        ctx.strokeStyle = 'rgba(20, 20, 20, 0.18)';
        ctx.lineWidth = 1;
        ctx.setLineDash([]);
        ctx.beginPath();
        ctx.moveTo(curX, 0); ctx.lineTo(curX, ch);
        ctx.moveTo(0, curY); ctx.lineTo(cw, curY);
        ctx.stroke();

        const logF = Math.log10(xToF(curX, cw));
        const fi = Math.max(0, Math.min(LOG_FREQS.length - 1,
          Math.round((logF - FULL_MIN) / (FULL_MAX - FULL_MIN) * (LOG_FREQS.length - 1))));

        devices.forEach(({ color }, di) => {
          const db = deviceCurves[di][fi];
          const y = dbToY(db, ch, DB_MIN, DB_MAX);
          if (y < -4 || y > ch + 4) return;
          ctx.beginPath();
          ctx.arc(curX, y, 4.5, 0, 2 * Math.PI);
          ctx.fillStyle = color;
          ctx.fill();
          ctx.strokeStyle = C.ink;
          ctx.lineWidth = 1.5;
          ctx.stroke();
        });

        if (eqCurve) {
          const db = eqCurve[fi];
          const y = dbToY(db, ch, DB_MIN, DB_MAX);
          if (y >= -4 && y <= ch + 4) {
            ctx.beginPath();
            ctx.arc(curX, y, 4.5, 0, 2 * Math.PI);
            ctx.fillStyle = C.accent;
            ctx.fill();
            ctx.strokeStyle = C.ink;
            ctx.lineWidth = 1.5;
            ctx.stroke();
          }
        }
      }
    }

    ctx.restore(); // end clip
    ctx.restore(); // end translate → back to identity for absolute-coord drawing below

    // ── Band labels strip (below chart) ────────────────────────────
    const bandLabelY = PAD.t + ch + 44;
    FREQ_BANDS.forEach(band => {
      const x1 = PAD.l + fToX(band.fLow, cw);
      const x2 = PAD.l + fToX(band.fHigh, cw);
      const cx = (x1 + x2) / 2;
      // Não desenhar rótulos de bandas fora da faixa visível (com zoom).
      if (cx < PAD.l - 2 || cx > PAD.l + cw + 2) return;
      const isHovered = hoveredBand === band.id;

      if (isHovered) {
        ctx.fillStyle = band.labelColor + '22';
        ctx.beginPath();
        const tw = Math.min(ctx.measureText ? 90 : 90, x2 - x1 - 6);
        ctx.rect(cx - tw / 2 - 6, bandLabelY - 12, tw + 12, 20);
        ctx.fill();
      }

      ctx.font = `${isHovered ? '700' : '500'} 10px ui-sans-serif, system-ui, sans-serif`;
      ctx.textAlign = 'center';
      ctx.fillStyle = isHovered ? band.labelColor : C.inkSoft;
      ctx.fillText(band.short, cx, bandLabelY);
    });

    // Band separator ticks (apenas os visíveis na faixa atual)
    [80, 300, 2000, 8000, 12000].forEach(f => {
      if (f < fLo || f > fHi) return;
      const x = PAD.l + fToX(f, cw);
      ctx.strokeStyle = '#cbbf9e';
      ctx.lineWidth = 1;
      ctx.beginPath();
      ctx.moveTo(x, PAD.t + ch + 1);
      ctx.lineTo(x, PAD.t + ch + 36);
      ctx.stroke();
    });

    // ── Freq axis labels ─────────────────────────────────────────────
    ctx.fillStyle = C.inkSoft;
    ctx.font = '10px ui-monospace, "Courier New", monospace';
    ctx.textAlign = 'center';
    genFreqTicks(fLo, fHi).forEach(f => {
      const x = PAD.l + fToX(f, cw);
      ctx.fillText(fmtFreq(f), x, PAD.t + ch + 20);
    });

    // ── dB axis labels ───────────────────────────────────────────────
    ctx.font = '10px ui-monospace, "Courier New", monospace';
    ctx.textAlign = 'right';
    DB_TICKS.forEach(db => {
      const y = PAD.t + dbToY(db, ch, DB_MIN, DB_MAX);
      if (y < PAD.t - 2 || y > PAD.t + ch + 2) return;
      ctx.fillStyle = db === 0 ? C.ink : C.inkFaint;
      ctx.fillText(`${db > 0 ? '+' : ''}${db}`, PAD.l - 7, y + 3.5);
    });

    // ── Chart border — heavy brutalist frame ─────────────────────────
    ctx.strokeStyle = C.ink;
    ctx.lineWidth = 2;
    ctx.strokeRect(PAD.l, PAD.t, cw, ch);
  }, [devices, target, eqBands, showEQ, yScale, preamp, hoveredBand, size, cursor, cw, ch, DB_MIN, DB_MAX, DB_TICKS, fLo, fHi]);

  const handleMouseMove = useCallback((e: React.MouseEvent<HTMLCanvasElement>) => {
    const rect = canvasRef.current!.getBoundingClientRect();
    const mx = e.clientX - rect.left;
    const my = e.clientY - rect.top;
    const cx = mx - PAD.l;
    const cy = my - PAD.t;

    if (cx >= 0 && cx <= cw && cy >= 0 && cy <= ch) {
      setCursor({ cx, cy });
      onBandHover(null);
    } else if (cy > ch + 30 && cy < ch + 58 && cx >= 0 && cx <= cw) {
      // Band label strip hover
      const f = xToF(cx, cw);
      const band = FREQ_BANDS.find(b => f >= b.fLow && f < b.fHigh);
      onBandHover(band?.id ?? null);
      setCursor(null);
    } else {
      setCursor(null);
      onBandHover(null);
    }
  }, [cw, ch, onBandHover, fLo, fHi]);

  const hoverInfo = cursor && cw > 0 && ch > 0 ? (() => {
    const freq = xToF(cursor.cx, cw);
    const db = yToDb(cursor.cy, ch, DB_MIN, DB_MAX);
    const freqStr = freq >= 10000 ? `${(freq / 1000).toFixed(1)} kHz`
      : freq >= 1000 ? `${(freq / 1000).toFixed(2)} kHz`
      : `${Math.round(freq)} Hz`;
    return { freqStr, dbStr: `${db >= 0 ? '+' : ''}${db.toFixed(1)} dB` };
  })() : null;

  return (
    <div ref={wrapRef} className="relative w-full h-full">
      <canvas
        ref={canvasRef}
        style={{ width: '100%', height: '100%', display: 'block', cursor: 'crosshair' }}
        onMouseMove={handleMouseMove}
        onMouseLeave={() => { setCursor(null); onBandHover(null); }}
      />
      {hoverInfo && cursor && (
        <div
          className="absolute pointer-events-none px-2.5 py-1.5 text-xs font-mono"
          style={{
            left: Math.min(PAD.l + cursor.cx + 14, size.w - 150),
            top: Math.max(PAD.t + cursor.cy - 36, 4),
            background: C.surface,
            border: `2px solid ${C.ink}`,
            boxShadow: C.shadowSm,
            color: C.inkSoft,
            whiteSpace: 'nowrap',
            letterSpacing: '0.02em',
          }}
        >
          <span style={{ color: C.inkSoft }}>{hoverInfo.freqStr}</span>
          <span style={{ color: C.inkFaint }}> · </span>
          <span style={{ color: C.ink, fontWeight: 700 }}>{hoverInfo.dbStr}</span>
        </div>
      )}
    </div>
  );
}
