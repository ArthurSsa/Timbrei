import { useState, useRef, useEffect, useMemo } from 'react';
import {
  TARGET_CURVES, DEVICE_COLORS, EQ_LAYER_COLORS, FREQ_BANDS,
  EQBandDef, EQLayer, autoEQBands, targetResponse, LOG_FREQS,
} from './utils/filters';
import { SQUIG_SOURCES, fetchPhoneBook, fetchMeasurement, PhoneEntry } from './dsp/squig';
import { FrequencyChart, SelectedDevice } from './components/FrequencyChart';
import { EQPanel } from './components/EQPanel';
import { C } from './theme';
import {
  Search, X, Zap, ChevronDown, Minus, Plus, SlidersHorizontal,
  Undo2, Redo2, Eraser, Power, Loader2, AlertTriangle,
} from 'lucide-react';

let autoEQCounter = 0;
let layerSeq = 1;
let bandSeq = 300;
const newLayerId = () => `layer_${layerSeq++}`;
const newBandId = () => `b_${bandSeq++}`;

const MONO = 'ui-monospace, "Courier New", monospace';

// Horizontal zoom (frequency axis). xZoom=1 shows the full spectrum; larger
// values magnify around xCenter (Hz). GEO is the geometric center.
const X_LO = 20, X_HI = 20000;
const X_LG0 = Math.log10(X_LO), X_LG1 = Math.log10(X_HI);
const X_GEO = Math.sqrt(X_LO * X_HI);
const X_ZOOM_MAX = 8;

export default function App() {
  const [sourceId, setSourceId] = useState<string>(SQUIG_SOURCES[0].id);
  const [phoneBook, setPhoneBook] = useState<PhoneEntry[]>([]);
  const [pbStatus, setPbStatus] = useState<'loading' | 'ready' | 'error'>('loading');
  const [selectedDevices, setSelectedDevices] = useState<SelectedDevice[]>([]);
  const [targetId, setTargetId] = useState<string>('harman-iem-2019');
  const [eqLayers, setEqLayers] = useState<EQLayer[]>([]);
  const [activeLayerId, setActiveLayerId] = useState<string | null>(null);
  const [preamp, setPreamp] = useState(0);
  const [past, setPast] = useState<EQLayer[][]>([]);
  const [future, setFuture] = useState<EQLayer[][]>([]);
  const [yScale, setYScale] = useState(1.0);
  const [yCenter, setYCenter] = useState(0);
  const [hoveredBand, setHoveredBand] = useState<string | null>(null);
  const [xZoom, setXZoom] = useState(1);
  const [xCenter, setXCenter] = useState(X_GEO);
  const [zoomBand, setZoomBand] = useState<string | null>(null);
  const [searchQuery, setSearchQuery] = useState('');
  const [showDropdown, setShowDropdown] = useState(false);
  const [menuOpen, setMenuOpen] = useState(false);
  const [chartHeight, setChartHeight] = useState<number | null>(null);
  const searchRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const chartWrapRef = useRef<HTMLDivElement>(null);
  const dragRef = useRef<{ startY: number; startH: number } | null>(null);

  const source = SQUIG_SOURCES.find(s => s.id === sourceId) ?? SQUIG_SOURCES[0];
  const activeLayer = eqLayers.find(l => l.id === activeLayerId) ?? null;
  const readyDevices = selectedDevices.filter(d => d.status === 'ready');

  // Load the device catalog (phone_book) whenever the source changes.
  useEffect(() => {
    let cancelled = false;
    setPbStatus('loading');
    setPhoneBook([]);
    const src = SQUIG_SOURCES.find(s => s.id === sourceId) ?? SQUIG_SOURCES[0];
    fetchPhoneBook(src)
      .then(list => { if (!cancelled) { setPhoneBook(list); setPbStatus('ready'); } })
      .catch(() => { if (!cancelled) setPbStatus('error'); });
    return () => { cancelled = true; };
  }, [sourceId]);

  // Live-filtered device list (capped so the dropdown stays responsive).
  const filtered = useMemo(() => {
    const q = searchQuery.trim().toLowerCase();
    const out: PhoneEntry[] = [];
    for (const e of phoneBook) {
      if (!q || `${e.brand} ${e.model}`.toLowerCase().includes(q)) {
        out.push(e);
        if (out.length >= 60) break;
      }
    }
    return out;
  }, [phoneBook, searchQuery]);

  // Resolved goal: a target curve or another loaded device, drawn dashed and
  // used as the AutoEQ destination.
  const goal = useMemo<{ curve: number[]; name: string } | null>(() => {
    if (targetId.startsWith('dev:')) {
      const d = selectedDevices.find(x => x.id === targetId.slice(4));
      return d?.curve ? { curve: d.curve, name: `${d.brand} ${d.model}` } : null;
    }
    const t = TARGET_CURVES.find(c => c.id === targetId);
    return t ? { curve: targetResponse(t, LOG_FREQS), name: t.name } : null;
  }, [targetId, selectedDevices]);

  // EQ layer state with undo/redo history
  const commit = (next: EQLayer[]) => {
    setPast(p => [...p.slice(-60), eqLayers]);
    setFuture([]);
    setEqLayers(next);
  };
  const undo = () => {
    if (!past.length) return;
    setFuture(f => [eqLayers, ...f]);
    setEqLayers(past[past.length - 1]);
    setPast(p => p.slice(0, -1));
  };
  const redo = () => {
    if (!future.length) return;
    setPast(p => [...p, eqLayers]);
    setEqLayers(future[0]);
    setFuture(f => f.slice(1));
  };

  // Live band edits on the active layer (no history snapshot per tick).
  const setActiveBands = (bands: EQBandDef[]) => {
    if (!activeLayerId) return;
    setEqLayers(ls => ls.map(l => (l.id === activeLayerId ? { ...l, bands } : l)));
  };

  const pickLayerColor = (layers: EQLayer[]) =>
    EQ_LAYER_COLORS.find(c => !layers.some(l => l.color === c)) ??
    EQ_LAYER_COLORS[layers.length % EQ_LAYER_COLORS.length];

  const nextManualName = () => {
    const n = eqLayers.filter(l => l.deviceId === null).length;
    return n === 0 ? 'Manual EQ' : `Manual EQ ${n + 1}`;
  };

  const newLayer = () => {
    const id = newLayerId();
    const layer: EQLayer = { id, name: nextManualName(), deviceId: null, color: pickLayerColor(eqLayers), enabled: true, bands: [] };
    commit([...eqLayers, layer]);
    setActiveLayerId(id);
  };

  const addBand = () => {
    const band: EQBandDef = { id: newBandId(), enabled: true, type: 'peak', frequency: 1000, gain: 0, q: 1.0 };
    if (!activeLayerId || !activeLayer) {
      const id = newLayerId();
      const layer: EQLayer = { id, name: nextManualName(), deviceId: null, color: pickLayerColor(eqLayers), enabled: true, bands: [band] };
      commit([...eqLayers, layer]);
      setActiveLayerId(id);
      return;
    }
    commit(eqLayers.map(l => (l.id === activeLayerId ? { ...l, bands: [...l.bands, band] } : l)));
  };

  const clearActive = () => {
    if (!activeLayerId) return;
    commit(eqLayers.map(l => (l.id === activeLayerId ? { ...l, bands: [] } : l)));
  };

  // Adds a peak band at a graph position (double-click on the chart).
  const addBandAt = (frequency: number, gain: number) => {
    const band: EQBandDef = {
      id: newBandId(), enabled: true, type: 'peak',
      frequency: Math.round(frequency), gain: Math.round(gain * 10) / 10, q: 1.0,
    };
    if (!activeLayerId || !activeLayer) {
      const id = newLayerId();
      commit([...eqLayers, { id, name: nextManualName(), deviceId: null, color: pickLayerColor(eqLayers), enabled: true, bands: [band] }]);
      setActiveLayerId(id);
      return;
    }
    commit(eqLayers.map(l => (l.id === activeLayerId ? { ...l, bands: [...l.bands, band] } : l)));
  };

  // Snapshots history once at the start of a graph drag, so the whole drag is
  // a single undo step.
  const beginEdit = () => {
    setPast(p => [...p.slice(-60), eqLayers]);
    setFuture([]);
  };

  const toggleLayer = (id: string) => commit(eqLayers.map(l => (l.id === id ? { ...l, enabled: !l.enabled } : l)));

  const removeLayer = (id: string) => {
    const next = eqLayers.filter(l => l.id !== id);
    commit(next);
    if (activeLayerId === id) setActiveLayerId(next.length ? next[next.length - 1].id : null);
  };

  const toggleActiveLayer = () => { if (activeLayerId) toggleLayer(activeLayerId); };

  // Devices (live measurements)
  const addDevice = (entry: PhoneEntry) => {
    if (selectedDevices.find(d => d.id === entry.id)) return;
    const usedColors = new Set(selectedDevices.map(d => d.color));
    const color = DEVICE_COLORS.find(c => !usedColors.has(c)) ?? DEVICE_COLORS[selectedDevices.length % DEVICE_COLORS.length];
    const dev: SelectedDevice = {
      id: entry.id, brand: entry.brand, model: entry.model, sourceId,
      file: entry.file, color, curve: null, status: 'loading',
    };
    setSelectedDevices(prev => [...prev, dev]);
    setSearchQuery('');
    setShowDropdown(false);
    fetchMeasurement(source, entry.file)
      .then(curve => setSelectedDevices(prev => prev.map(d => (d.id === entry.id ? { ...d, curve, status: 'ready' } : d))))
      .catch(() => setSelectedDevices(prev => prev.map(d => (d.id === entry.id ? { ...d, status: 'error' } : d))));
  };

  const removeDevice = (id: string) => {
    setSelectedDevices(prev => prev.filter(d => d.id !== id));
    if (targetId === `dev:${id}`) setTargetId('');
  };

  // AutoEQ a device toward the current goal (a target or another device),
  // producing or updating that device's named EQ layer.
  const handleAutoEQ = (device: SelectedDevice) => {
    if (!device.curve || !goal) return;
    const bands = autoEQBands(device.curve, goal.curve, autoEQCounter);
    autoEQCounter += bands.length;
    const name = `${device.brand} ${device.model} EQ`;
    const existing = eqLayers.find(l => l.deviceId === device.id);
    let id: string;
    let next: EQLayer[];
    if (existing) {
      id = existing.id;
      next = eqLayers.map(l => (l.id === existing.id ? { ...l, bands, enabled: true, name } : l));
    } else {
      id = newLayerId();
      next = [...eqLayers, { id, name, deviceId: device.id, color: pickLayerColor(eqLayers), enabled: true, bands }];
    }
    commit(next);
    setActiveLayerId(id);
  };

  const autoEQActive = () => { if (readyDevices[0]) handleAutoEQ(readyDevices[0]); };

  useEffect(() => {
    const h = (e: MouseEvent) => {
      if (searchRef.current && !searchRef.current.contains(e.target as Node)) setShowDropdown(false);
    };
    document.addEventListener('mousedown', h);
    return () => document.removeEventListener('mousedown', h);
  }, []);

  // Chart vertical resize
  const startResize = (e: React.PointerEvent) => {
    e.preventDefault();
    const startH = chartWrapRef.current?.getBoundingClientRect().height ?? 300;
    dragRef.current = { startY: e.clientY, startH };
    const onMove = (ev: PointerEvent) => {
      if (!dragRef.current) return;
      const dy = ev.clientY - dragRef.current.startY;
      setChartHeight(Math.max(160, Math.min(2400, dragRef.current.startH + dy)));
    };
    const onUp = () => {
      dragRef.current = null;
      window.removeEventListener('pointermove', onMove);
      window.removeEventListener('pointerup', onUp);
      document.body.style.userSelect = '';
    };
    document.body.style.userSelect = 'none';
    window.addEventListener('pointermove', onMove);
    window.addEventListener('pointerup', onUp);
  };

  const yScalePct = Math.round(yScale * 100);
  const enabledLayers = eqLayers.filter(l => l.enabled && l.bands.some(b => b.enabled));

  const xZoomPct = Math.round(xZoom * 100);
  const freqRange: [number, number] | null = xZoom <= 1.0001 ? null : (() => {
    const halfW = (X_LG1 - X_LG0) / xZoom / 2;
    const cLog = Math.min(X_LG1 - halfW, Math.max(X_LG0 + halfW, Math.log10(xCenter)));
    return [10 ** (cLog - halfW), 10 ** (cLog + halfW)];
  })();

  const resetXZoom = () => { setXZoom(1); setXCenter(X_GEO); setZoomBand(null); };
  const applyXZoom = (v: number) => {
    const z = Math.max(1, Math.min(X_ZOOM_MAX, +v.toFixed(2)));
    setXZoom(z);
    if (z <= 1.0001) { setXCenter(X_GEO); setZoomBand(null); }
  };
  const zoomToBand = (band: typeof FREQ_BANDS[number]) => {
    if (zoomBand === band.id) { resetXZoom(); return; }
    const lo = Math.max(X_LO, band.fLow / 1.3);
    const hi = Math.min(X_HI, band.fHigh * 1.3);
    setXZoom(Math.min(X_ZOOM_MAX, (X_LG1 - X_LG0) / (Math.log10(hi) - Math.log10(lo))));
    setXCenter(Math.sqrt(lo * hi));
    setZoomBand(band.id);
  };
  const panX = (deltaLog: number) => {
    if (xZoom <= 1.0001) return;
    const halfW = (X_LG1 - X_LG0) / xZoom / 2;
    const cMin = X_LG0 + halfW, cMax = X_LG1 - halfW;
    setXCenter(prev => 10 ** Math.min(cMax, Math.max(cMin, Math.log10(prev) + deltaLog)));
    if (zoomBand !== null) setZoomBand(null);
  };

  // Applies a vertical zoom factor; returning to 1 (or zooming out) recenters
  // the dB window so it cannot drift off the curves.
  const applyYScale = (v: number) => {
    const z = Math.max(0.4, Math.min(4, +v.toFixed(2)));
    setYScale(z);
    if (z <= 1.0001) setYCenter(0);
  };
  // Drag to pan the dB window (only when zoomed in on the Y axis).
  const panY = (deltaDb: number) => {
    if (yScale <= 1.0001) return;
    setYCenter(prev => Math.max(-30, Math.min(30, prev + deltaDb)));
  };

  // Reusable pieces (shared by desktop bar + mobile panel)

  const deviceChips = selectedDevices.map(d => (
    <div
      key={d.id}
      className="flex items-center gap-1 flex-shrink-0"
      style={{ background: d.color + '18', border: `2px solid ${d.color}`, padding: '3px 6px 3px 8px', opacity: d.status === 'error' ? 0.6 : 1 }}
    >
      <div className="w-1.5 h-1.5 flex-shrink-0" style={{ background: d.color }} />
      <span className="font-semibold" style={{ color: d.color, whiteSpace: 'nowrap', fontSize: 13 }}>
        {d.brand} {d.model}
      </span>
      {d.status === 'loading' && <Loader2 size={12} className="animate-spin" style={{ color: d.color }} />}
      {d.status === 'error' && <AlertTriangle size={12} style={{ color: '#b91c1c' }} aria-label="Failed to load measurement" />}
      {d.status === 'ready' && (
        <button
          onClick={() => handleAutoEQ(d)}
          disabled={!goal}
          className="flex items-center gap-0.5 ml-1 px-1.5 py-0.5 font-bold uppercase transition-colors enabled:hover:opacity-70 disabled:opacity-30 active:translate-y-px"
          style={{ background: C.surface, border: `1.5px solid ${C.ink}`, color: C.ink, fontSize: 11, fontFamily: MONO, whiteSpace: 'nowrap' }}
          title={goal ? `AutoEQ ${d.model} (vs ${goal.name})` : 'Select a target or device first'}
        >
          <Zap size={11} /> AutoEQ
        </button>
      )}
      <button onClick={() => removeDevice(d.id)} className="ml-0.5 opacity-50 hover:opacity-100 transition-opacity">
        <X size={13} strokeWidth={3} style={{ color: d.color }} />
      </button>
    </div>
  ));

  const sourceSelector = (
    <div className="flex items-center gap-1.5 flex-shrink-0">
      <span className="uppercase font-bold" style={{ color: C.inkSoft, fontSize: 12, fontFamily: MONO, letterSpacing: '0.1em' }}>Source</span>
      <div className="relative">
        <select value={sourceId} onChange={e => setSourceId(e.target.value)} className="font-bold pl-2.5 pr-7 py-1.5 outline-none cursor-pointer appearance-none" style={{ background: C.surface, border: `2px solid ${C.ink}`, color: C.ink, fontSize: 13, fontFamily: MONO }}>
          {SQUIG_SOURCES.map(s => <option key={s.id} value={s.id}>{s.label}</option>)}
        </select>
        <ChevronDown size={13} strokeWidth={3} className="absolute right-1.5 top-1/2 -translate-y-1/2 pointer-events-none" style={{ color: C.ink }} />
      </div>
    </div>
  );

  const dropdownStatus =
    pbStatus === 'loading' ? 'Loading devices...' :
    pbStatus === 'error' ? 'Failed to load this source' :
    phoneBook.length === 0 ? 'No devices' : 'No results';

  const searchBox = (
    <div ref={searchRef} className="relative flex-1 min-w-0">
      <div
        className="flex items-center gap-1.5 px-2.5 py-1.5 cursor-text"
        style={{ background: C.surface, border: `2px solid ${showDropdown ? C.accent : C.ink}`, minWidth: 0 }}
        onClick={() => { setShowDropdown(true); inputRef.current?.focus(); }}
      >
        <Search size={13} strokeWidth={2.5} style={{ color: C.ink, flexShrink: 0 }} />
        <input
          ref={inputRef}
          type="text"
          placeholder="Search for device"
          value={searchQuery}
          onChange={e => { setSearchQuery(e.target.value); setShowDropdown(true); }}
          onFocus={() => setShowDropdown(true)}
          className="bg-transparent outline-none flex-1"
          style={{ color: C.ink, minWidth: 0, fontSize: 14, fontFamily: MONO }}
        />
        {searchQuery && (
          <button onClick={() => { setSearchQuery(''); inputRef.current?.focus(); }}>
            <X size={12} strokeWidth={3} style={{ color: C.inkSoft }} />
          </button>
        )}
      </div>

      {showDropdown && (
        <div
          className="absolute top-full left-0 mt-1.5 overflow-hidden z-50 w-full lg:w-[320px]"
          style={{ background: C.surface, border: `2px solid ${C.ink}`, boxShadow: C.shadow, maxHeight: 360, overflowY: 'auto' }}
        >
          {filtered.length === 0 ? (
            <div className="px-4 py-6 text-center flex items-center justify-center gap-2" style={{ color: C.inkSoft, fontSize: 13, fontFamily: MONO }}>
              {pbStatus === 'loading' && <Loader2 size={13} className="animate-spin" />}
              {dropdownStatus}
            </div>
          ) : (
            filtered.map(p => {
              const isAdded = !!selectedDevices.find(d => d.id === p.id);
              return (
                <button
                  key={p.id}
                  className="w-full flex items-center px-4 py-2 text-left transition-colors hover:bg-[#f1e7cf] border-b"
                  style={{ opacity: isAdded ? 0.4 : 1, borderColor: C.borderSoft }}
                  onClick={() => !isAdded && addDevice(p)}
                  disabled={isAdded}
                >
                  <div className="flex-1 min-w-0">
                    <div style={{ color: C.ink, fontSize: 13, fontWeight: 600, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{p.model}</div>
                    <div style={{ color: C.inkSoft, fontSize: 12, fontFamily: MONO }}>{p.brand}</div>
                  </div>
                  {isAdded && <span style={{ color: C.ink, fontSize: 13, fontWeight: 700 }}>✓</span>}
                </button>
              );
            })
          )}
        </div>
      )}
    </div>
  );

  const zoomControl = (
    <div className="flex items-center gap-2">
      <span className="uppercase font-bold flex-shrink-0" style={{ color: C.inkSoft, fontSize: 12, fontFamily: MONO, letterSpacing: '0.1em' }}>Zoom Y</span>
      <button onClick={() => applyYScale(yScale - 0.25)} className="w-6 h-6 flex items-center justify-center transition-colors hover:opacity-70" style={{ color: C.ink, border: `2px solid ${C.ink}` }}>
        <Minus size={11} strokeWidth={3} />
      </button>
      <input type="range" min={0.4} max={4} step={0.1} value={yScale} onChange={e => applyYScale(+e.target.value)} className="w-24 h-1.5 cursor-pointer" style={{ accentColor: C.accent }} />
      <button onClick={() => applyYScale(yScale + 0.25)} className="w-6 h-6 flex items-center justify-center transition-colors hover:opacity-70" style={{ color: C.ink, border: `2px solid ${C.ink}` }}>
        <Plus size={11} strokeWidth={3} />
      </button>
      <button onClick={() => applyYScale(1.0)} className="px-1.5 py-0.5 font-bold transition-colors hover:opacity-70" style={{ color: yScale === 1 ? C.accent : C.ink, fontSize: 12, fontFamily: MONO, border: `2px solid ${C.ink}` }}>
        {yScalePct}%
      </button>
    </div>
  );

  const zoomXControl = (
    <div className="flex items-center gap-2">
      <span className="uppercase font-bold flex-shrink-0" style={{ color: C.inkSoft, fontSize: 12, fontFamily: MONO, letterSpacing: '0.1em' }}>Zoom X</span>
      <button onClick={() => applyXZoom(xZoom - 0.5)} className="w-6 h-6 flex items-center justify-center transition-colors hover:opacity-70" style={{ color: C.ink, border: `2px solid ${C.ink}` }}>
        <Minus size={11} strokeWidth={3} />
      </button>
      <input type="range" min={1} max={X_ZOOM_MAX} step={0.1} value={xZoom} onChange={e => applyXZoom(+e.target.value)} className="w-24 h-1.5 cursor-pointer" style={{ accentColor: C.accent }} />
      <button onClick={() => applyXZoom(xZoom + 0.5)} className="w-6 h-6 flex items-center justify-center transition-colors hover:opacity-70" style={{ color: C.ink, border: `2px solid ${C.ink}` }}>
        <Plus size={11} strokeWidth={3} />
      </button>
      <button onClick={resetXZoom} className="px-1.5 py-0.5 font-bold transition-colors hover:opacity-70" style={{ color: xZoom === 1 ? C.accent : C.ink, fontSize: 12, fontFamily: MONO, border: `2px solid ${C.ink}` }}>
        {xZoomPct}%
      </button>
    </div>
  );

  const targetSelector = (
    <div className="flex items-center gap-2">
      <span className="uppercase font-bold flex-shrink-0" style={{ color: C.inkSoft, fontSize: 12, fontFamily: MONO, letterSpacing: '0.1em' }}>Target</span>
      <div className="relative flex-1 lg:flex-initial">
        <select value={targetId} onChange={e => setTargetId(e.target.value)} className="w-full font-bold pl-2.5 pr-7 py-1.5 outline-none cursor-pointer appearance-none" style={{ background: C.surface, border: `2px solid ${C.ink}`, color: C.ink, fontSize: 13, fontFamily: MONO }}>
          <option value="">None</option>
          <optgroup label="Targets">
            {TARGET_CURVES.map(t => <option key={t.id} value={t.id}>{t.name}</option>)}
          </optgroup>
          {readyDevices.length > 0 && (
            <optgroup label="Devices">
              {readyDevices.map(d => <option key={d.id} value={`dev:${d.id}`}>{d.brand} {d.model}</option>)}
            </optgroup>
          )}
        </select>
        <ChevronDown size={13} strokeWidth={3} className="absolute right-1.5 top-1/2 -translate-y-1/2 pointer-events-none" style={{ color: C.ink }} />
      </div>
    </div>
  );

  const legend = (
    <div className="flex items-center gap-3 flex-wrap">
      {goal && (
        <div className="flex items-center gap-1.5">
          <svg width="22" height="10"><line x1="0" y1="5" x2="22" y2="5" stroke={C.ink} strokeWidth="1.75" strokeDasharray="7 5" /></svg>
          <span style={{ color: C.inkSoft, fontSize: 12, fontFamily: MONO, whiteSpace: 'nowrap' }}>{goal.name}</span>
        </div>
      )}
      {enabledLayers.map(l => (
        <div key={l.id} className="flex items-center gap-1.5">
          <div className="w-5 h-1" style={{ background: l.color }} />
          <span style={{ color: l.color, fontSize: 12, fontFamily: MONO, fontWeight: 700, whiteSpace: 'nowrap' }}>{l.name}</span>
        </div>
      ))}
    </div>
  );

  // EQ action toolbar (top)
  const iconBtn = 'w-7 h-7 flex items-center justify-center transition-colors enabled:hover:opacity-70 disabled:opacity-25';
  const ibStyle = { border: `2px solid ${C.ink}`, color: C.ink } as const;

  const eqToolbar = (
    <div className="flex items-center gap-2 flex-wrap">
      <span className="uppercase font-bold flex-shrink-0" style={{ color: C.inkSoft, fontSize: 12, fontFamily: MONO, letterSpacing: '0.1em' }}>EQ</span>

      <button
        onClick={toggleActiveLayer}
        disabled={!activeLayer}
        className="flex items-center gap-1 px-2 py-1 font-bold uppercase transition-colors disabled:opacity-25"
        style={{ background: activeLayer?.enabled ? C.accent : C.surface, border: `2px solid ${C.ink}`, color: activeLayer?.enabled ? '#fff' : C.ink, fontSize: 12, fontFamily: MONO }}
        title="Enable/disable the active EQ layer"
      >
        <Power size={11} strokeWidth={3} /> {activeLayer?.enabled ? 'ON' : 'OFF'}
      </button>

      <button onClick={undo} disabled={!past.length} className={iconBtn} style={ibStyle} title="Undo"><Undo2 size={13} strokeWidth={2.5} /></button>
      <button onClick={redo} disabled={!future.length} className={iconBtn} style={ibStyle} title="Redo"><Redo2 size={13} strokeWidth={2.5} /></button>

      <button onClick={addBand} className="flex items-center gap-1 px-2 py-1 font-bold uppercase transition-colors hover:opacity-70" style={{ ...ibStyle, fontSize: 12, fontFamily: MONO }} title="Add band">
        <Plus size={12} strokeWidth={3} /> Band
      </button>

      <button onClick={() => activeLayerId && removeLayer(activeLayerId)} disabled={!activeLayer} className="flex items-center gap-1 px-2 py-1 font-bold uppercase transition-colors enabled:hover:opacity-70 disabled:opacity-25" style={{ ...ibStyle, fontSize: 12, fontFamily: MONO }} title="Remove the active EQ layer">
        <Eraser size={12} strokeWidth={2.5} /> Remove
      </button>

      {/* Preamp (output trim for export; does not affect the displayed response) */}
      <div className="flex items-center gap-1">
        <span className="uppercase font-bold" style={{ color: C.inkSoft, fontSize: 12, fontFamily: MONO, letterSpacing: '0.08em' }}>Preamp</span>
        <button onClick={() => setPreamp(p => Math.max(-20, parseFloat((p - 0.5).toFixed(1))))} className={iconBtn} style={ibStyle} title="Decrease preamp"><Minus size={11} strokeWidth={3} /></button>
        <input
          type="number" step={0.5} min={-20} max={20}
          value={preamp.toFixed(1)}
          onChange={e => { const v = +e.target.value; if (v >= -20 && v <= 20) setPreamp(v); }}
          className="w-14 text-right px-1 py-1 outline-none font-bold"
          style={{ background: C.surface, border: `2px solid ${C.ink}`, color: C.ink, fontSize: 12, fontFamily: MONO }}
        />
        <span style={{ color: C.inkSoft, fontSize: 12, fontFamily: MONO }}>dB</span>
        <button onClick={() => setPreamp(p => Math.min(20, parseFloat((p + 0.5).toFixed(1))))} className={iconBtn} style={ibStyle} title="Increase preamp"><Plus size={11} strokeWidth={3} /></button>
      </div>
    </div>
  );

  return (
    <div
      className="flex flex-col overflow-hidden"
      style={{ height: '100dvh', background: C.bg, color: C.ink, fontFamily: 'ui-sans-serif, system-ui, -apple-system, sans-serif' }}
    >
      {/* TOP NAVBAR */}
      <header className="flex-shrink-0 border-b-2" style={{ borderColor: C.ink, background: C.bg }}>
        {/* Row 1: logo + source + search + controls (desktop) / menu (mobile) */}
        <div className="flex items-center gap-2 sm:gap-3 px-3 sm:px-4 pt-2 lg:pt-0" style={{ minHeight: 52 }}>
          <div className="flex items-center flex-shrink-0" title="Timbrei">
            <img
              src="/timbrei-logo.png"
              alt="Timbrei"
              style={{ height: 34, width: 152, objectFit: 'cover', objectPosition: 'center 49%', display: 'block' }}
            />
          </div>

          <div className="hidden lg:flex">{sourceSelector}</div>
          {searchBox}

          <div className="hidden lg:flex items-center flex-shrink-0">
            <div className="flex items-center px-4">{zoomControl}</div>
            <div className="flex items-center px-4">{zoomXControl}</div>
            <div className="flex items-center px-4">{targetSelector}</div>
            <div className="flex items-center px-4">{legend}</div>
          </div>

          <div className="flex lg:hidden items-center flex-shrink-0">
            <button
              onClick={() => setMenuOpen(o => !o)}
              className="flex items-center gap-1.5 px-3 py-1.5 font-bold uppercase transition-colors active:translate-y-px"
              style={{ background: menuOpen ? C.ink : C.surface, color: menuOpen ? C.surface : C.ink, border: `2px solid ${C.ink}`, fontSize: 13, fontFamily: MONO, boxShadow: menuOpen ? 'none' : C.shadowSm }}
              aria-expanded={menuOpen}
            >
              <SlidersHorizontal size={13} strokeWidth={2.5} /> Controls
            </button>
          </div>
        </div>

        {/* Row 2: selected devices + EQ toolbar (pushed by the chips) */}
        <div className="flex flex-wrap items-center gap-x-3 gap-y-2 px-3 sm:px-4 pt-1 pb-2">
          {deviceChips}
          <div className="hidden lg:flex items-center">{eqToolbar}</div>
        </div>

        {/* MOBILE collapsible controls */}
        {menuOpen && (
          <div className="flex lg:hidden flex-col gap-3 px-3 py-3 border-t-2" style={{ borderColor: C.ink, background: C.panelAlt }}>
            {sourceSelector}
            {zoomControl}
            {zoomXControl}
            {targetSelector}
            {legend}
            <div className="border-t-2 pt-3" style={{ borderColor: C.ink }}>{eqToolbar}</div>
          </div>
        )}
      </header>

      {/* FREQUENCY BAND HIGHLIGHT BAR */}
      <div className="flex-shrink-0 flex items-center border-b-2 overflow-x-auto" style={{ borderColor: C.ink, background: C.panelAlt, minHeight: 34 }}>
        <div className="flex items-center px-3 gap-1.5 flex-shrink-0">
          <span className="uppercase font-bold flex-shrink-0" style={{ color: C.inkSoft, fontSize: 11, fontFamily: MONO, marginRight: 2, letterSpacing: '0.1em' }}>Zoom</span>
          {FREQ_BANDS.map(band => {
            const isZoomed = zoomBand === band.id;
            const isHovered = hoveredBand === band.id;
            const lit = isZoomed || isHovered;
            return (
              <button
                key={band.id}
                onClick={() => zoomToBand(band)}
                onMouseEnter={() => setHoveredBand(band.id)}
                onMouseLeave={() => setHoveredBand(null)}
                title={isZoomed ? 'Remove zoom (show all)' : `Zoom ${band.name}`}
                className="px-2.5 py-1 font-semibold transition-colors flex-shrink-0 cursor-pointer"
                style={{ background: lit ? band.labelColor : C.surface, border: `2px solid ${lit ? band.labelColor : C.ink}`, color: lit ? '#fff' : C.ink, fontSize: 12, whiteSpace: 'nowrap', fontFamily: MONO, boxShadow: isZoomed ? `inset 0 0 0 2px ${C.surface}` : 'none' }}
              >
                {band.name}
              </button>
            );
          })}
          {xZoom > 1 && (
            <button
              onClick={resetXZoom}
              title="Show full spectrum (20 Hz to 20 kHz)"
              className="px-2.5 py-1 font-bold uppercase transition-colors flex-shrink-0 cursor-pointer hover:opacity-70"
              style={{ background: C.surface, border: `2px solid ${C.ink}`, color: C.ink, fontSize: 12, whiteSpace: 'nowrap', fontFamily: MONO, letterSpacing: '0.05em' }}
            >
              All
            </button>
          )}
        </div>
        <div className="flex-1" />
        <div className="hidden md:flex items-center gap-3 px-4 flex-shrink-0">
          {readyDevices.map(d => (
            <div key={d.id} className="flex items-center gap-1.5">
              <div className="w-6 h-1" style={{ background: d.color }} />
              <span style={{ color: C.inkSoft, fontSize: 12, fontFamily: MONO, whiteSpace: 'nowrap' }}>{d.brand} {d.model}</span>
            </div>
          ))}
        </div>
      </div>

      {/* CHART + RESIZE HANDLE + BOTTOM PANEL */}
      <div className={`flex-1 min-h-0 flex flex-col ${chartHeight != null ? 'overflow-y-auto' : ''}`}>
        <div
          ref={chartWrapRef}
          className={chartHeight == null ? 'flex-1 min-h-0' : 'flex-shrink-0'}
          style={chartHeight == null ? { minHeight: 220 } : { height: chartHeight }}
        >
          <FrequencyChart
            devices={selectedDevices}
            goalCurve={goal?.curve ?? null}
            eqLayers={eqLayers}
            activeLayerId={activeLayerId}
            onEditActiveBands={setActiveBands}
            onEditBegin={beginEdit}
            onAddBandAt={addBandAt}
            yScale={yScale}
            yCenter={yCenter}
            onPanDb={panY}
            hoveredBand={hoveredBand}
            onBandHover={setHoveredBand}
            freqRange={freqRange}
            onPanLog={panX}
          />
        </div>

        <div
          onPointerDown={startResize}
          onDoubleClick={() => setChartHeight(null)}
          title="Drag to resize the graph, double-click to reset"
          className="flex-shrink-0 flex items-center justify-center gap-1 select-none border-t-2 border-b-2 transition-colors hover:bg-black group"
          style={{ height: 16, cursor: 'row-resize', background: C.panelAlt, borderColor: C.ink, touchAction: 'none' }}
        >
          <div className="w-10 h-1 group-hover:bg-white" style={{ background: C.ink }} />
          <div className="w-10 h-1 group-hover:bg-white" style={{ background: C.ink }} />
        </div>

        <EQPanel
          layers={eqLayers}
          activeLayerId={activeLayerId}
          onSelectLayer={setActiveLayerId}
          onToggleLayer={toggleLayer}
          onRemoveLayer={removeLayer}
          onNewLayer={newLayer}
          onChangeActiveBands={setActiveBands}
          onAddBand={addBand}
          onClearActive={clearActive}
          onAutoEQ={autoEQActive}
          autoEQLabel={readyDevices[0] ? `${readyDevices[0].brand} ${readyDevices[0].model}` : undefined}
          preamp={preamp}
        />
      </div>
    </div>
  );
}
