import { useState, useRef, useEffect } from 'react';
import {
  DEVICE_PROFILES, TARGET_CURVES, DEVICE_COLORS, FREQ_BANDS, EQ_PRESETS,
  DeviceProfile, EQBandDef, EQPreset, computeAutoEQ, suggestPreamp,
} from './utils/filters';
import { FrequencyChart, SelectedDevice } from './components/FrequencyChart';
import { EQPanel } from './components/EQPanel';
import { C } from './theme';
import {
  Search, X, Zap, ChevronDown, Minus, Plus, SlidersHorizontal,
  Undo2, Redo2, FlipVertical2, Eraser, Power,
} from 'lucide-react';

const DEFAULT_BANDS: EQBandDef[] = [
  { id: 'd1', enabled: false, type: 'lowShelf', frequency: 100, gain: 3.0, q: 0.7 },
  { id: 'd2', enabled: false, type: 'peak', frequency: 1000, gain: 0.0, q: 1.0 },
  { id: 'd3', enabled: false, type: 'highShelf', frequency: 10000, gain: -2.0, q: 0.8 },
];

let autoEQCounter = 0;
let bandSeq = 300;
const newId = () => `b_${bandSeq++}`;

const MONO = 'ui-monospace, "Courier New", monospace';

export default function App() {
  const [selectedDevices, setSelectedDevices] = useState<SelectedDevice[]>([
    { id: 'moondrop-aria', profile: DEVICE_PROFILES[0], color: DEVICE_COLORS[0] },
  ]);
  const [targetId, setTargetId] = useState<string>('harman-iem-2019');
  const [eqBands, setEqBands] = useState<EQBandDef[]>(DEFAULT_BANDS);
  const [showEQ, setShowEQ] = useState(true);
  const [preamp, setPreamp] = useState(0);
  const [past, setPast] = useState<EQBandDef[][]>([]);
  const [future, setFuture] = useState<EQBandDef[][]>([]);
  const [yScale, setYScale] = useState(1.0);
  const [hoveredBand, setHoveredBand] = useState<string | null>(null);
  const [searchQuery, setSearchQuery] = useState('');
  const [showDropdown, setShowDropdown] = useState(false);
  const [menuOpen, setMenuOpen] = useState(false);
  const [chartHeight, setChartHeight] = useState<number | null>(null);
  const searchRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const chartWrapRef = useRef<HTMLDivElement>(null);
  const dragRef = useRef<{ startY: number; startH: number } | null>(null);

  const target = TARGET_CURVES.find(t => t.id === targetId) ?? null;

  const filtered = DEVICE_PROFILES.filter(p =>
    `${p.name} ${p.brand}`.toLowerCase().includes(searchQuery.toLowerCase())
  );

  // ─── EQ state mutation with undo/redo history ───────────────────────────
  // Discrete actions snapshot history; live slider edits update in place.
  const commit = (next: EQBandDef[]) => {
    setPast(p => [...p.slice(-60), eqBands]);
    setFuture([]);
    setEqBands(next);
  };
  const undo = () => {
    if (!past.length) return;
    setFuture(f => [eqBands, ...f]);
    setEqBands(past[past.length - 1]);
    setPast(p => p.slice(0, -1));
  };
  const redo = () => {
    if (!future.length) return;
    setPast(p => [...p, eqBands]);
    setEqBands(future[0]);
    setFuture(f => f.slice(1));
  };

  const addBand = () => commit([...eqBands, { id: newId(), enabled: true, type: 'peak', frequency: 1000, gain: 0, q: 1.0 }]);
  const clearAll = () => commit([]);
  const flatten = () => commit(eqBands.map(b => ({ ...b, gain: 0 })));
  const invert = () => commit(eqBands.map(b => ({ ...b, gain: -b.gain })));
  const autoEQFirst = () => { if (selectedDevices[0]) handleAutoEQ(selectedDevices[0]); };
  const applyPreset = (preset: EQPreset) => {
    commit(preset.bands.map(b => ({ ...b, id: newId() })));
    setShowEQ(true);
  };

  const addDevice = (profile: DeviceProfile) => {
    if (selectedDevices.find(d => d.id === profile.id)) return;
    const usedColors = new Set(selectedDevices.map(d => d.color));
    const color = DEVICE_COLORS.find(c => !usedColors.has(c)) ?? DEVICE_COLORS[selectedDevices.length % DEVICE_COLORS.length];
    setSelectedDevices(prev => [...prev, { id: profile.id, profile, color }]);
    setSearchQuery('');
    setShowDropdown(false);
  };

  const removeDevice = (id: string) => setSelectedDevices(prev => prev.filter(d => d.id !== id));

  const handleAutoEQ = (device: SelectedDevice) => {
    const tgt = target ?? TARGET_CURVES[0];
    const bands = computeAutoEQ(device.profile.filters, tgt.filters, autoEQCounter);
    autoEQCounter += bands.length;
    commit(bands);
    setPreamp(suggestPreamp(bands));
    setShowEQ(true);
  };

  useEffect(() => {
    const h = (e: MouseEvent) => {
      if (searchRef.current && !searchRef.current.contains(e.target as Node)) setShowDropdown(false);
    };
    document.addEventListener('mousedown', h);
    return () => document.removeEventListener('mousedown', h);
  }, []);

  // ─── Chart vertical resize ──────────────────────────────────────────────
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

  const iems = filtered.filter(p => p.deviceType === 'iem');
  const headphones = filtered.filter(p => p.deviceType === 'headphone');
  const yScalePct = Math.round(yScale * 100);
  const activeBands = eqBands.filter(b => b.enabled).length;

  // ─── Reusable pieces (shared by desktop bar + mobile panel) ────────────

  const deviceChips = selectedDevices.map(d => (
    <div
      key={d.id}
      className="flex items-center gap-1 flex-shrink-0"
      style={{ background: d.color + '18', border: `2px solid ${d.color}`, padding: '3px 6px 3px 8px' }}
    >
      <div className="w-1.5 h-1.5 flex-shrink-0" style={{ background: d.color }} />
      <span className="font-semibold" style={{ color: d.color, whiteSpace: 'nowrap', fontSize: 11 }}>
        {d.profile.brand} {d.profile.name}
      </span>
      <button
        onClick={() => handleAutoEQ(d)}
        className="flex items-center gap-0.5 ml-1 px-1.5 py-0.5 font-bold uppercase transition-colors hover:opacity-70 active:translate-y-px"
        style={{ background: C.surface, border: `1.5px solid ${C.ink}`, color: C.ink, fontSize: 9, fontFamily: MONO, whiteSpace: 'nowrap' }}
        title={`Auto EQ para ${d.profile.name} (vs ${target?.name ?? 'Harman IEM 2019'})`}
      >
        <Zap size={9} /> Auto
      </button>
      <button onClick={() => removeDevice(d.id)} className="ml-0.5 opacity-50 hover:opacity-100 transition-opacity">
        <X size={12} strokeWidth={3} style={{ color: d.color }} />
      </button>
    </div>
  ));

  const searchBox = (
    <div ref={searchRef} className="relative flex-1 min-w-0 lg:flex-initial lg:w-72">
      <div
        className="flex items-center gap-1.5 px-2.5 py-1.5 cursor-text"
        style={{ background: C.surface, border: `2px solid ${showDropdown ? C.accent : C.ink}`, minWidth: 0 }}
        onClick={() => { setShowDropdown(true); inputRef.current?.focus(); }}
      >
        <Search size={12} strokeWidth={2.5} style={{ color: C.ink, flexShrink: 0 }} />
        <input
          ref={inputRef}
          type="text"
          placeholder="Buscar IEM / Headphone…"
          value={searchQuery}
          onChange={e => { setSearchQuery(e.target.value); setShowDropdown(true); }}
          onFocus={() => setShowDropdown(true)}
          className="bg-transparent outline-none flex-1"
          style={{ color: C.ink, minWidth: 0, fontSize: 12, fontFamily: MONO }}
        />
        {searchQuery && (
          <button onClick={() => { setSearchQuery(''); inputRef.current?.focus(); }}>
            <X size={11} strokeWidth={3} style={{ color: C.inkSoft }} />
          </button>
        )}
      </div>

      {showDropdown && (
        <div
          className="absolute top-full left-0 mt-1.5 overflow-hidden z-50 w-full lg:w-[280px]"
          style={{ background: C.surface, border: `2px solid ${C.ink}`, boxShadow: C.shadow, maxHeight: 320, overflowY: 'auto' }}
        >
          {filtered.length === 0 ? (
            <div className="px-4 py-6 text-center" style={{ color: C.inkSoft, fontSize: 12, fontFamily: MONO }}>Nenhum resultado</div>
          ) : (
            [{ label: 'IEMs', items: iems }, { label: 'Headphones', items: headphones }].map(({ label, items }) =>
              items.length > 0 && (
                <div key={label}>
                  <div
                    className="flex items-center gap-2 px-4 py-1.5 border-b-2 uppercase font-bold"
                    style={{ color: C.ink, borderColor: C.ink, background: C.panelAlt, fontSize: 9, letterSpacing: '0.14em', fontFamily: MONO }}
                  >
                    {label}
                  </div>
                  {items.map(p => {
                    const isAdded = !!selectedDevices.find(d => d.id === p.id);
                    return (
                      <button
                        key={p.id}
                        className="w-full flex items-center px-4 py-2 text-left transition-colors hover:bg-[#f1e7cf] border-b"
                        style={{ opacity: isAdded ? 0.4 : 1, borderColor: C.borderSoft }}
                        onClick={() => !isAdded && addDevice(p)}
                        disabled={isAdded}
                      >
                        <div className="flex-1">
                          <div style={{ color: C.ink, fontSize: 12, fontWeight: 600 }}>{p.name}</div>
                          <div style={{ color: C.inkSoft, fontSize: 10, fontFamily: MONO }}>{p.brand}</div>
                        </div>
                        {isAdded && <span style={{ color: C.ink, fontSize: 12, fontWeight: 700 }}>✓</span>}
                      </button>
                    );
                  })}
                </div>
              )
            )
          )}
        </div>
      )}
    </div>
  );

  const zoomControl = (
    <div className="flex items-center gap-2">
      <span className="uppercase font-bold flex-shrink-0" style={{ color: C.inkSoft, fontSize: 10, fontFamily: MONO, letterSpacing: '0.1em' }}>Zoom Y</span>
      <button onClick={() => setYScale(s => Math.max(0.4, parseFloat((s - 0.25).toFixed(2))))} className="w-6 h-6 flex items-center justify-center transition-colors hover:opacity-70" style={{ color: C.ink, border: `2px solid ${C.ink}` }}>
        <Minus size={11} strokeWidth={3} />
      </button>
      <input type="range" min={0.4} max={4} step={0.1} value={yScale} onChange={e => setYScale(+e.target.value)} className="w-24 h-1.5 cursor-pointer" style={{ accentColor: C.accent }} />
      <button onClick={() => setYScale(s => Math.min(4, parseFloat((s + 0.25).toFixed(2))))} className="w-6 h-6 flex items-center justify-center transition-colors hover:opacity-70" style={{ color: C.ink, border: `2px solid ${C.ink}` }}>
        <Plus size={11} strokeWidth={3} />
      </button>
      <button onClick={() => setYScale(1.0)} className="px-1.5 py-0.5 font-bold transition-colors hover:opacity-70" style={{ color: yScale === 1 ? C.accent : C.ink, fontSize: 10, fontFamily: MONO, border: `2px solid ${C.ink}` }}>
        {yScalePct}%
      </button>
    </div>
  );

  const targetSelector = (
    <div className="flex items-center gap-2">
      <span className="uppercase font-bold flex-shrink-0" style={{ color: C.inkSoft, fontSize: 10, fontFamily: MONO, letterSpacing: '0.1em' }}>Target</span>
      <div className="relative flex-1 lg:flex-initial">
        <select value={targetId} onChange={e => setTargetId(e.target.value)} className="w-full font-bold pl-2.5 pr-7 py-1.5 outline-none cursor-pointer appearance-none" style={{ background: C.surface, border: `2px solid ${C.ink}`, color: C.ink, fontSize: 11, fontFamily: MONO }}>
          <option value="">Nenhum</option>
          {TARGET_CURVES.map(t => <option key={t.id} value={t.id}>{t.name}</option>)}
        </select>
        <ChevronDown size={13} strokeWidth={3} className="absolute right-1.5 top-1/2 -translate-y-1/2 pointer-events-none" style={{ color: C.ink }} />
      </div>
    </div>
  );

  const legend = (
    <div className="flex items-center gap-3 flex-wrap">
      {target && (
        <div className="flex items-center gap-1.5">
          <svg width="22" height="10"><line x1="0" y1="5" x2="22" y2="5" stroke={C.ink} strokeWidth="1.75" strokeDasharray="7 5" /></svg>
          <span style={{ color: C.inkSoft, fontSize: 10, fontFamily: MONO, whiteSpace: 'nowrap' }}>{target.name}</span>
        </div>
      )}
      {showEQ && activeBands > 0 && (
        <div className="flex items-center gap-1.5">
          <div className="w-5 h-1" style={{ background: C.accent }} />
          <span style={{ color: C.accent, fontSize: 10, fontFamily: MONO, fontWeight: 700 }}>EQ</span>
        </div>
      )}
    </div>
  );

  // ─── EQ action toolbar (top) ────────────────────────────────────────────
  const iconBtn = 'w-7 h-7 flex items-center justify-center transition-colors enabled:hover:opacity-70 disabled:opacity-25';
  const ibStyle = { border: `2px solid ${C.ink}`, color: C.ink } as const;

  const eqToolbar = (
    <div className="flex items-center gap-2 flex-wrap">
      <span className="uppercase font-bold flex-shrink-0" style={{ color: C.inkSoft, fontSize: 10, fontFamily: MONO, letterSpacing: '0.1em' }}>EQ</span>

      {/* Bypass */}
      <button
        onClick={() => setShowEQ(v => !v)}
        className="flex items-center gap-1 px-2 py-1 font-bold uppercase transition-colors"
        style={{ background: showEQ ? C.accent : C.surface, border: `2px solid ${C.ink}`, color: showEQ ? '#fff' : C.ink, fontSize: 10, fontFamily: MONO }}
        title="Ligar/desligar EQ (bypass)"
      >
        <Power size={11} strokeWidth={3} /> {showEQ ? 'ON' : 'OFF'}
      </button>

      {/* Undo / Redo */}
      <button onClick={undo} disabled={!past.length} className={iconBtn} style={ibStyle} title="Desfazer"><Undo2 size={13} strokeWidth={2.5} /></button>
      <button onClick={redo} disabled={!future.length} className={iconBtn} style={ibStyle} title="Refazer"><Redo2 size={13} strokeWidth={2.5} /></button>

      {/* Add */}
      <button onClick={addBand} className="flex items-center gap-1 px-2 py-1 font-bold uppercase transition-colors hover:opacity-70" style={{ ...ibStyle, fontSize: 10, fontFamily: MONO }} title="Adicionar banda">
        <Plus size={12} strokeWidth={3} /> Banda
      </button>

      {/* Flat (zero gains) */}
      <button onClick={flatten} disabled={!eqBands.length} className="px-2 py-1 font-bold uppercase transition-colors enabled:hover:opacity-70 disabled:opacity-25" style={{ ...ibStyle, fontSize: 10, fontFamily: MONO }} title="Zerar ganhos (achatar)">
        Flat
      </button>

      {/* Invert */}
      <button onClick={invert} disabled={!eqBands.length} className={iconBtn} style={ibStyle} title="Inverter ganhos (espelhar curva)"><FlipVertical2 size={13} strokeWidth={2.5} /></button>

      {/* Clear all */}
      <button onClick={clearAll} disabled={!eqBands.length} className="flex items-center gap-1 px-2 py-1 font-bold uppercase transition-colors enabled:hover:opacity-70 disabled:opacity-25" style={{ ...ibStyle, fontSize: 10, fontFamily: MONO }} title="Remover todas as bandas">
        <Eraser size={12} strokeWidth={2.5} /> Limpar
      </button>

      {/* Preamp */}
      <div className="flex items-center gap-1">
        <span className="uppercase font-bold" style={{ color: C.inkSoft, fontSize: 10, fontFamily: MONO, letterSpacing: '0.08em' }}>Preamp</span>
        <button onClick={() => setPreamp(p => Math.max(-20, parseFloat((p - 0.5).toFixed(1))))} className={iconBtn} style={ibStyle} title="Diminuir preamp"><Minus size={11} strokeWidth={3} /></button>
        <input
          type="number" step={0.5} min={-20} max={20}
          value={preamp.toFixed(1)}
          onChange={e => { const v = +e.target.value; if (v >= -20 && v <= 20) setPreamp(v); }}
          className="w-14 text-right px-1 py-1 outline-none font-bold"
          style={{ background: C.surface, border: `2px solid ${C.ink}`, color: C.ink, fontSize: 10, fontFamily: MONO }}
        />
        <span style={{ color: C.inkSoft, fontSize: 10, fontFamily: MONO }}>dB</span>
        <button onClick={() => setPreamp(p => Math.min(20, parseFloat((p + 0.5).toFixed(1))))} className={iconBtn} style={ibStyle} title="Aumentar preamp"><Plus size={11} strokeWidth={3} /></button>
      </div>
    </div>
  );

  return (
    <div
      className="flex flex-col overflow-hidden"
      style={{ height: '100dvh', background: C.bg, color: C.ink, fontFamily: 'ui-sans-serif, system-ui, -apple-system, sans-serif' }}
    >
      {/* ─── TOP NAVBAR ──────────────────────────────────────────────── */}
      <header className="flex-shrink-0 border-b-2" style={{ borderColor: C.ink, background: C.bg }}>
        {/* Row 1 — brand bar + controls (desktop) / menu toggle (mobile) */}
        <div className="flex items-stretch" style={{ minHeight: 52 }}>
          <div className="flex items-center px-3 sm:px-4 flex-shrink-0" title="Timbrei">
            <img
              src="/timbrei-logo.png"
              alt="Timbrei"
              style={{ height: 34, width: 152, objectFit: 'cover', objectPosition: 'center 49%', display: 'block' }}
            />
          </div>

          <div className="flex-1 min-w-0" />

          <div className="hidden lg:flex items-center flex-shrink-0">
            <div className="flex items-center px-4">{zoomControl}</div>
            <div className="flex items-center px-4">{targetSelector}</div>
            <div className="flex items-center px-4">{legend}</div>
          </div>

          <div className="flex lg:hidden items-center px-3">
            <button
              onClick={() => setMenuOpen(o => !o)}
              className="flex items-center gap-1.5 px-3 py-1.5 font-bold uppercase transition-colors active:translate-y-px"
              style={{ background: menuOpen ? C.ink : C.surface, color: menuOpen ? C.surface : C.ink, border: `2px solid ${C.ink}`, fontSize: 11, fontFamily: MONO, boxShadow: menuOpen ? 'none' : C.shadowSm }}
              aria-expanded={menuOpen}
            >
              <SlidersHorizontal size={13} strokeWidth={2.5} /> Controles
            </button>
          </div>
        </div>

        {/* Row 2 — device chips + search */}
        <div className="flex flex-wrap items-center gap-2 px-3 sm:px-4 pb-2">
          {deviceChips}
          {searchBox}
        </div>

        {/* Row 3 — EQ action toolbar (desktop) */}
        <div className="hidden lg:flex items-center px-3 sm:px-4 pb-2 overflow-x-auto">
          {eqToolbar}
        </div>

        {/* MOBILE collapsible controls */}
        {menuOpen && (
          <div className="flex lg:hidden flex-col gap-3 px-3 py-3 border-t-2" style={{ borderColor: C.ink, background: C.panelAlt }}>
            {zoomControl}
            {targetSelector}
            {legend}
            <div className="border-t-2 pt-3" style={{ borderColor: C.ink }}>{eqToolbar}</div>
          </div>
        )}
      </header>

      {/* ─── FREQUENCY BAND HIGHLIGHT BAR ──────────────────────────── */}
      <div className="flex-shrink-0 flex items-center border-b-2 overflow-x-auto" style={{ borderColor: C.ink, background: C.panelAlt, minHeight: 34 }}>
        <div className="flex items-center px-3 gap-1.5 flex-shrink-0">
          <span className="uppercase font-bold flex-shrink-0" style={{ color: C.inkSoft, fontSize: 9, fontFamily: MONO, marginRight: 2, letterSpacing: '0.1em' }}>Banda</span>
          {FREQ_BANDS.map(band => {
            const isHovered = hoveredBand === band.id;
            return (
              <button
                key={band.id}
                onMouseEnter={() => setHoveredBand(band.id)}
                onMouseLeave={() => setHoveredBand(null)}
                className="px-2.5 py-1 font-semibold transition-colors flex-shrink-0"
                style={{ background: isHovered ? band.labelColor : C.surface, border: `2px solid ${isHovered ? band.labelColor : C.ink}`, color: isHovered ? '#fff' : C.ink, fontSize: 10, whiteSpace: 'nowrap', fontFamily: MONO }}
              >
                {band.name}
              </button>
            );
          })}
        </div>
        <div className="flex-1" />
        <div className="hidden md:flex items-center gap-3 px-4 flex-shrink-0">
          {selectedDevices.map(d => (
            <div key={d.id} className="flex items-center gap-1.5">
              <div className="w-6 h-1" style={{ background: d.color }} />
              <span style={{ color: C.inkSoft, fontSize: 10, fontFamily: MONO, whiteSpace: 'nowrap' }}>{d.profile.brand} {d.profile.name}</span>
            </div>
          ))}
        </div>
      </div>

      {/* ─── CHART + RESIZE HANDLE + BOTTOM PANEL ─────────────────────── */}
      <div className={`flex-1 min-h-0 flex flex-col ${chartHeight != null ? 'overflow-y-auto' : ''}`}>
        <div
          ref={chartWrapRef}
          className={chartHeight == null ? 'flex-1 min-h-0' : 'flex-shrink-0'}
          style={chartHeight == null ? { minHeight: 220 } : { height: chartHeight }}
        >
          <FrequencyChart
            devices={selectedDevices}
            target={target}
            eqBands={eqBands}
            showEQ={showEQ}
            yScale={yScale}
            preamp={preamp}
            hoveredBand={hoveredBand}
            onBandHover={setHoveredBand}
          />
        </div>

        <div
          onPointerDown={startResize}
          onDoubleClick={() => setChartHeight(null)}
          title="Arraste para esticar o gráfico · clique duplo para redefinir"
          className="flex-shrink-0 flex items-center justify-center gap-1 select-none border-t-2 border-b-2 transition-colors hover:bg-black group"
          style={{ height: 16, cursor: 'row-resize', background: C.panelAlt, borderColor: C.ink, touchAction: 'none' }}
        >
          <div className="w-10 h-1 group-hover:bg-white" style={{ background: C.ink }} />
          <div className="w-10 h-1 group-hover:bg-white" style={{ background: C.ink }} />
        </div>

        <EQPanel
          bands={eqBands}
          onChange={setEqBands}
          showEQ={showEQ}
          onToggleEQ={() => setShowEQ(v => !v)}
          preamp={preamp}
          onPreampChange={setPreamp}
          onApplyPreset={applyPreset}
          onAddBand={addBand}
          onClearAll={clearAll}
          onFlatten={flatten}
          onInvert={invert}
          onAutoEQ={autoEQFirst}
          autoEQLabel={selectedDevices[0]?.profile.name}
        />
      </div>
    </div>
  );
}
