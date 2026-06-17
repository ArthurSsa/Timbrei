import { useRef, useEffect, useState, useCallback } from 'react';
import { Camera } from 'lucide-react';
import { EQLayer, EQBandDef, calcEQCurve, LOG_FREQS, FREQ_BANDS } from '../utils/filters';
import { C } from '../theme';

// Full frequency-axis domain (20 Hz to 20 kHz), used to index LOG_FREQS
// independently of the X-axis zoom.
const FULL_MIN = Math.log10(20);
const FULL_MAX = Math.log10(20000);
const PAD = { t: 14, r: 20, b: 62, l: 52 };

// Labeled ticks (1-2-5 per decade in the full view; finer when zoomed into a
// narrow range) within [fLo, fHi].
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

// Minor grid (1..9 per decade) within [fLo, fHi].
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

export type DeviceStatus = 'loading' | 'ready' | 'error';

export interface SelectedDevice {
  id: string;
  brand: string;
  model: string;
  sourceId: string;
  file: string;
  color: string;
  /** LOG_FREQS-aligned measured curve (0 dB at 1 kHz), or null while loading. */
  curve: number[] | null;
  status: DeviceStatus;
}

interface FrequencyChartProps {
  devices: SelectedDevice[];
  /** Reference/goal curve drawn dashed (target or another device), or null. */
  goalCurve: number[] | null;
  eqLayers: EQLayer[];
  yScale: number;
  /** Vertical pan offset in dB (shifts the visible dB window). */
  yCenter: number;
  hoveredBand: string | null;
  onBandHover: (bandId: string | null) => void;
  /** Visible [fLo, fHi] range on the X axis (per-band zoom). null = 20 Hz to 20 kHz. */
  freqRange?: [number, number] | null;
  /** Horizontal pan: shifts the center by `deltaLog` log decades. */
  onPanLog?: (deltaLog: number) => void;
  /** Vertical pan: shifts the dB window by `deltaDb`. */
  onPanDb?: (deltaDb: number) => void;
  /** Active EQ layer whose bands are drawn as draggable handles. */
  activeLayerId: string | null;
  /** Live update of the active layer's bands (handle drag, wheel-to-Q). */
  onEditActiveBands: (bands: EQBandDef[]) => void;
  /** Snapshots history once at the start of a drag, for a single undo step. */
  onEditBegin?: () => void;
  /** Adds a peak band at a graph position (double-click on empty area). */
  onAddBandAt?: (freq: number, gain: number) => void;
}

export function FrequencyChart({
  devices, goalCurve, eqLayers, yScale, yCenter,
  hoveredBand, onBandHover, freqRange = null, onPanLog, onPanDb,
  activeLayerId, onEditActiveBands, onEditBegin, onAddBandAt,
}: FrequencyChartProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const wrapRef = useRef<HTMLDivElement>(null);
  const [size, setSize] = useState({ w: 0, h: 0 });
  const [cursor, setCursor] = useState<{ cx: number; cy: number } | null>(null);
  const dragRef = useRef({ active: false, lastX: 0, lastY: 0 });
  const [grabbing, setGrabbing] = useState(false);
  const [hoverHandle, setHoverHandle] = useState<string | null>(null);
  const [draggingHandle, setDraggingHandle] = useState(false);
  const dragHandleRef = useRef<{ bandId: string; moved: boolean } | null>(null);

  // The active layer's bands are shown as draggable handles. A ref mirrors them
  // so the pointer and wheel handlers always read the current bands.
  const activeLayer = eqLayers.find(l => l.id === activeLayerId) ?? null;
  const activeBands = activeLayer?.bands ?? [];
  const activeColor = activeLayer?.color ?? C.accent;
  const activeBandsRef = useRef<EQBandDef[]>(activeBands);
  activeBandsRef.current = activeBands;
  // Pan is enabled per axis when that axis is zoomed.
  const canPanX = freqRange != null && !!onPanLog;
  const canPanY = yScale > 1.0001 && !!onPanDb;
  const canPan = canPanX || canPanY;

  // Visible X-axis limits (with zoom) and the derived freq/pixel mappings.
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

  // Dynamic dB range based on yScale, shifted by the vertical pan offset.
  const DB_RANGE = 45 / yScale;
  const DB_MIN = -(DB_RANGE * 0.62) + yCenter;
  const DB_MAX = DB_RANGE * 0.38 + yCenter;
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

    // Background
    ctx.fillStyle = C.bg;
    ctx.fillRect(0, 0, size.w, size.h);

    ctx.save();
    ctx.translate(PAD.l, PAD.t);

    // Clip to chart area
    ctx.save();
    ctx.beginPath();
    ctx.rect(0, 0, cw, ch);
    ctx.clip();

    // Chart background: flat white plot (brutalist, no gradient)
    ctx.fillStyle = C.surface;
    ctx.fillRect(0, 0, cw, ch);

    // Frequency band regions
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
        const rangeText = `${loLabel} to ${hiLabel}`;

        ctx.font = '500 13px ui-sans-serif, system-ui, sans-serif';
        ctx.textAlign = 'center';
        ctx.fillStyle = band.labelColor + 'cc';

        // Background pill: white with hard dark border (brutalist)
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

    // Minor frequency grid
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

    // dB grid
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

    // Precompute curves
    // Devices that have finished loading carry a LOG_FREQS-aligned curve.
    const readyDevices = devices.filter(d => d.curve != null);
    const targetCurve = goalCurve;
    // One curve per enabled EQ layer. For a layer tied to a loaded device the
    // curve drawn is the EQ'd response (device + EQ), so it can be compared
    // directly against the target; a manual layer shows the EQ correction
    // relative to 0 dB. Preamp is an output trim only and does not shift the
    // displayed response.
    const eqLayerCurves = eqLayers
      .filter(l => l.enabled && l.bands.some(b => b.enabled))
      .map(l => {
        const eq = calcEQCurve(l.bands, LOG_FREQS);
        if (l.deviceId) {
          const dev = devices.find(d => d.id === l.deviceId && d.curve);
          if (dev && dev.curve) return { color: l.color, curve: dev.curve.map((v, i) => v + eq[i]) };
        }
        return { color: l.color, curve: eq };
      });

    // Target curve
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

    // Device curves
    readyDevices.forEach(d => {
      const data = d.curve!;
      const color = d.color;
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

      // Main line: flat and crisp (no glow)
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

    // EQ layer curves
    eqLayerCurves.forEach(({ color, curve }) => {
      ctx.save();
      ctx.strokeStyle = color;
      ctx.lineWidth = 3;
      ctx.lineJoin = 'round';
      ctx.beginPath();
      LOG_FREQS.forEach((f, i) => {
        const x = fToX(f, cw), y = dbToY(curve[i], ch, DB_MIN, DB_MAX);
        i === 0 ? ctx.moveTo(x, y) : ctx.lineTo(x, y);
      });
      ctx.stroke();
      ctx.restore();
    });

    // Draggable EQ handles (active layer)
    activeBands.forEach(b => {
      const hx = fToX(b.frequency, cw);
      const hy = dbToY(b.gain, ch, DB_MIN, DB_MAX);
      if (hx < -10 || hx > cw + 10) return;
      const hot = hoverHandle === b.id;
      const r = hot ? 8 : 6;
      if (hot) {
        ctx.beginPath();
        ctx.arc(hx, hy, r + 4, 0, 2 * Math.PI);
        ctx.strokeStyle = activeColor;
        ctx.lineWidth = 1.5;
        ctx.stroke();
      }
      ctx.beginPath();
      ctx.arc(hx, hy, r, 0, 2 * Math.PI);
      ctx.fillStyle = b.enabled ? activeColor : C.surface;
      ctx.fill();
      ctx.lineWidth = hot ? 3 : 2;
      ctx.strokeStyle = C.ink;
      ctx.stroke();
    });

    // Crosshair & hover dots
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

        readyDevices.forEach(d => {
          const db = d.curve![fi];
          const color = d.color;
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

        eqLayerCurves.forEach(({ color, curve }) => {
          const y = dbToY(curve[fi], ch, DB_MIN, DB_MAX);
          if (y < -4 || y > ch + 4) return;
          ctx.beginPath();
          ctx.arc(curX, y, 4.5, 0, 2 * Math.PI);
          ctx.fillStyle = color;
          ctx.fill();
          ctx.strokeStyle = C.ink;
          ctx.lineWidth = 1.5;
          ctx.stroke();
        });
      }
    }

    ctx.restore(); // end clip
    ctx.restore(); // end translate → back to identity for absolute-coord drawing below

    // Band labels strip (below chart)
    const bandLabelY = PAD.t + ch + 44;
    FREQ_BANDS.forEach(band => {
      const x1 = PAD.l + fToX(band.fLow, cw);
      const x2 = PAD.l + fToX(band.fHigh, cw);
      const cx = (x1 + x2) / 2;
      // Skip band labels outside the visible range (when zoomed).
      if (cx < PAD.l - 2 || cx > PAD.l + cw + 2) return;
      const isHovered = hoveredBand === band.id;

      if (isHovered) {
        ctx.fillStyle = band.labelColor + '22';
        ctx.beginPath();
        const tw = Math.min(ctx.measureText ? 90 : 90, x2 - x1 - 6);
        ctx.rect(cx - tw / 2 - 6, bandLabelY - 12, tw + 12, 20);
        ctx.fill();
      }

      ctx.font = `${isHovered ? '700' : '500'} 12px ui-sans-serif, system-ui, sans-serif`;
      ctx.textAlign = 'center';
      ctx.fillStyle = isHovered ? band.labelColor : C.inkSoft;
      ctx.fillText(band.short, cx, bandLabelY);
    });

    // Band separator ticks (only those visible in the current range)
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

    // Freq axis labels
    ctx.fillStyle = C.inkSoft;
    ctx.font = '12px ui-monospace, "Courier New", monospace';
    ctx.textAlign = 'center';
    genFreqTicks(fLo, fHi).forEach(f => {
      const x = PAD.l + fToX(f, cw);
      ctx.fillText(fmtFreq(f), x, PAD.t + ch + 20);
    });

    // dB axis labels
    ctx.font = '12px ui-monospace, "Courier New", monospace';
    ctx.textAlign = 'right';
    DB_TICKS.forEach(db => {
      const y = PAD.t + dbToY(db, ch, DB_MIN, DB_MAX);
      if (y < PAD.t - 2 || y > PAD.t + ch + 2) return;
      ctx.fillStyle = db === 0 ? C.ink : C.inkFaint;
      ctx.fillText(`${db > 0 ? '+' : ''}${db}`, PAD.l - 7, y + 3.5);
    });

    // Chart border: heavy brutalist frame
    ctx.strokeStyle = C.ink;
    ctx.lineWidth = 2;
    ctx.strokeRect(PAD.l, PAD.t, cw, ch);
  }, [devices, goalCurve, eqLayers, activeLayerId, yScale, hoveredBand, hoverHandle, size, cursor, cw, ch, DB_MIN, DB_MAX, DB_TICKS, fLo, fHi]);

  // Nearest active-layer handle to an absolute canvas point, within ~13px.
  const handleAt = (mx: number, my: number): string | null => {
    let best: string | null = null;
    let bestD = 13 * 13;
    for (const b of activeBandsRef.current) {
      const hx = PAD.l + fToX(b.frequency, cw);
      const hy = PAD.t + dbToY(b.gain, ch, DB_MIN, DB_MAX);
      const d = (mx - hx) ** 2 + (my - hy) ** 2;
      if (d <= bestD) { bestD = d; best = b.id; }
    }
    return best;
  };

  const handleMouseMove = (e: React.MouseEvent<HTMLCanvasElement>) => {
    if (draggingHandle || dragRef.current.active) return; // no hover while dragging
    const rect = canvasRef.current!.getBoundingClientRect();
    const mx = e.clientX - rect.left;
    const my = e.clientY - rect.top;
    setHoverHandle(handleAt(mx, my));
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
  };

  // Pointer down on a handle drags it (frequency on X, gain on Y); otherwise,
  // when an axis is zoomed, it pans the graph.
  const handlePointerDown = (e: React.PointerEvent<HTMLCanvasElement>) => {
    const rect = canvasRef.current!.getBoundingClientRect();
    const mx = e.clientX - rect.left;
    const my = e.clientY - rect.top;
    const hit = handleAt(mx, my);
    if (hit) {
      dragHandleRef.current = { bandId: hit, moved: false };
      setDraggingHandle(true);
      setHoverHandle(hit);
      setCursor(null);
      onBandHover(null);
      try { canvasRef.current!.setPointerCapture(e.pointerId); } catch { /* ignore */ }
      return;
    }
    if (!canPan) return;
    const cx = mx - PAD.l;
    const cy = my - PAD.t;
    if (cx < 0 || cx > cw || cy < 0 || cy > ch) return; // only within the graph area
    dragRef.current = { active: true, lastX: e.clientX, lastY: e.clientY };
    setGrabbing(true);
    setCursor(null);
    onBandHover(null);
    try { canvasRef.current!.setPointerCapture(e.pointerId); } catch { /* ignore */ }
  };

  const handlePointerMove = (e: React.PointerEvent<HTMLCanvasElement>) => {
    const drag = dragHandleRef.current;
    if (drag) {
      const rect = canvasRef.current!.getBoundingClientRect();
      const cx = Math.max(0, Math.min(cw, e.clientX - rect.left - PAD.l));
      const cy = Math.max(0, Math.min(ch, e.clientY - rect.top - PAD.t));
      const freq = Math.max(20, Math.min(20000, xToF(cx, cw)));
      const gain = Math.max(-20, Math.min(20, yToDb(cy, ch, DB_MIN, DB_MAX)));
      if (!drag.moved) { drag.moved = true; onEditBegin?.(); }
      onEditActiveBands(
        activeBandsRef.current.map(b =>
          b.id === drag.bandId ? { ...b, frequency: Math.round(freq), gain: Math.round(gain * 10) / 10 } : b
        )
      );
      return;
    }
    if (dragRef.current.active) {
      const dx = e.clientX - dragRef.current.lastX;
      const dy = e.clientY - dragRef.current.lastY;
      dragRef.current.lastX = e.clientX;
      dragRef.current.lastY = e.clientY;
      // Dragging right reveals lower frequencies; dragging down reveals higher dB.
      if (canPanX && dx !== 0 && cw > 0) onPanLog?.(-(dx / cw) * (logMax - logMin));
      if (canPanY && dy !== 0 && ch > 0) onPanDb?.((dy / ch) * (DB_MAX - DB_MIN));
    }
  };

  const handlePointerUp = (e: React.PointerEvent<HTMLCanvasElement>) => {
    if (dragHandleRef.current) {
      dragHandleRef.current = null;
      setDraggingHandle(false);
      try { canvasRef.current?.releasePointerCapture(e.pointerId); } catch { /* ignore */ }
      return;
    }
    if (dragRef.current.active) {
      dragRef.current.active = false;
      setGrabbing(false);
      try { canvasRef.current?.releasePointerCapture(e.pointerId); } catch { /* ignore */ }
    }
  };

  // Double-click on empty graph area adds a peak band there.
  const handleDoubleClick = (e: React.MouseEvent<HTMLCanvasElement>) => {
    if (!onAddBandAt) return;
    const rect = canvasRef.current!.getBoundingClientRect();
    const mx = e.clientX - rect.left;
    const my = e.clientY - rect.top;
    if (handleAt(mx, my)) return; // on a handle: leave it for dragging
    const cx = mx - PAD.l;
    const cy = my - PAD.t;
    if (cx < 0 || cx > cw || cy < 0 || cy > ch) return;
    onAddBandAt(xToF(cx, cw), yToDb(cy, ch, DB_MIN, DB_MAX));
  };

  // Wheel over a handle changes that band's Q. A non-passive listener is used
  // so the page does not scroll while adjusting.
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const onWheel = (e: WheelEvent) => {
      const rect = canvas.getBoundingClientRect();
      const hit = handleAt(e.clientX - rect.left, e.clientY - rect.top);
      if (!hit) return;
      e.preventDefault();
      const step = e.deltaY < 0 ? 0.1 : -0.1;
      onEditActiveBands(
        activeBandsRef.current.map(b =>
          b.id === hit ? { ...b, q: Math.max(0.1, Math.min(10, +(b.q + step).toFixed(2))) } : b
        )
      );
    };
    canvas.addEventListener('wheel', onWheel, { passive: false });
    return () => canvas.removeEventListener('wheel', onWheel);
  }, [cw, ch, DB_MIN, DB_MAX, fLo, fHi, onEditActiveBands]);

  // Exports the graph (the canvas) as a PNG. Clears the crosshair first
  // (setCursor(null) forces a clean redraw) and waits two frames so the canvas
  // has already been repainted.
  const handleExport = useCallback(() => {
    setCursor(null);
    requestAnimationFrame(() => requestAnimationFrame(() => {
      const canvas = canvasRef.current;
      if (!canvas) return;
      const name = devices.length
        ? devices.map(d => `${d.brand} ${d.model}`).join(' vs ')
        : 'graph';
      const a = document.createElement('a');
      a.download = `timbrei-${name}.png`.replace(/[^\w.-]+/g, '-');
      a.href = canvas.toDataURL('image/png');
      a.click();
    }));
  }, [devices]);

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
        style={{
          width: '100%', height: '100%', display: 'block',
          cursor: draggingHandle ? 'grabbing' : hoverHandle ? 'grab' : canPan ? (grabbing ? 'grabbing' : 'grab') : 'crosshair',
          touchAction: canPan || hoverHandle || draggingHandle ? 'none' : 'auto',
        }}
        onMouseMove={handleMouseMove}
        onMouseLeave={() => { if (!draggingHandle) { setCursor(null); setHoverHandle(null); onBandHover(null); } }}
        onDoubleClick={handleDoubleClick}
        onPointerDown={handlePointerDown}
        onPointerMove={handlePointerMove}
        onPointerUp={handlePointerUp}
        onPointerCancel={handlePointerUp}
      />
      <button
        onClick={handleExport}
        title="Capture graph (PNG)"
        aria-label="Capture graph as PNG"
        className="absolute flex items-center justify-center transition-colors hover:bg-black group"
        style={{ top: PAD.t + 6, right: PAD.r + 6, width: 28, height: 28, background: C.surface, border: `2px solid ${C.ink}`, boxShadow: C.shadowSm, cursor: 'pointer' }}
      >
        <Camera size={14} strokeWidth={2.5} className="group-hover:text-white" style={{ color: C.ink }} />
      </button>
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
      {draggingHandle && dragHandleRef.current && (() => {
        const b = activeBands.find(x => x.id === dragHandleRef.current!.bandId);
        if (!b) return null;
        const hx = PAD.l + fToX(b.frequency, cw);
        const hy = PAD.t + dbToY(b.gain, ch, DB_MIN, DB_MAX);
        const fStr = b.frequency >= 1000 ? `${(b.frequency / 1000).toFixed(2)} kHz` : `${Math.round(b.frequency)} Hz`;
        return (
          <div
            className="absolute pointer-events-none px-2.5 py-1.5 text-xs font-mono"
            style={{
              left: Math.min(hx + 14, size.w - 200),
              top: Math.max(hy - 44, 4),
              background: C.surface, border: `2px solid ${activeColor}`, boxShadow: C.shadowSm,
              color: C.ink, whiteSpace: 'nowrap', letterSpacing: '0.02em',
            }}
          >
            <span>{fStr}</span>
            <span style={{ color: C.inkFaint }}> · </span>
            <span style={{ fontWeight: 700, color: b.gain >= 0 ? '#047857' : '#b91c1c' }}>{b.gain >= 0 ? '+' : ''}{b.gain.toFixed(1)} dB</span>
            <span style={{ color: C.inkFaint }}> · </span>
            <span>Q {b.q.toFixed(2)}</span>
          </div>
        );
      })()}
    </div>
  );
}
