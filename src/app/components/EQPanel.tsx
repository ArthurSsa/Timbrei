import { useState } from 'react';
import { EQBandDef, EQLayer, FilterType, exportEqualizerAPO, suggestPreamp } from '../utils/filters';
import { C } from '../theme';
import {
  Plus, Trash2, Copy, ChevronDown, ChevronUp, Power,
  SlidersHorizontal, Download, BarChart3, Eraser, Check, Zap, X,
} from 'lucide-react';

const MONO = 'ui-monospace, "Courier New", monospace';

// Only the verified filter types are offered.
const FILTER_TYPES: { value: FilterType; label: string }[] = [
  { value: 'peak', label: 'Peak' },
  { value: 'lowShelf', label: 'Low Shelf' },
  { value: 'highShelf', label: 'High Shelf' },
];

// Palette reused to color each band row within the editor.
const BAND_COLORS = [
  '#0070c5', '#ff001f', '#008a6c', '#e48f00',
  '#95009e', '#00ac00', '#003a9d', '#cac100',
  '#c83400', '#6d28d9',
];

function freqToSlider(f: number) {
  return (Math.log10(f) - Math.log10(20)) / (Math.log10(20000) - Math.log10(20)) * 1000;
}
function sliderToFreq(s: number) {
  return 10 ** (Math.log10(20) + (s / 1000) * (Math.log10(20000) - Math.log10(20)));
}

const numInput = {
  background: C.surface, color: C.ink, fontSize: 12, fontFamily: MONO,
  border: `1.5px solid ${C.ink}`,
} as const;

interface BandRowProps {
  band: EQBandDef;
  index: number;
  color: string;
  onChange: (b: EQBandDef) => void;
  onDelete: () => void;
}

function BandRow({ band, index, color, onChange, onDelete }: BandRowProps) {
  const up = (p: Partial<EQBandDef>) => onChange({ ...band, ...p });
  const gainColor = band.gain > 0.5 ? '#047857' : band.gain < -0.5 ? '#b91c1c' : C.inkSoft;

  return (
    <div
      className="flex-shrink-0 flex flex-col gap-1.5 p-2.5"
      style={{ width: 184, background: C.surface, border: `2px solid ${band.enabled ? color : C.ink}`, boxShadow: band.enabled ? `3px 3px 0 ${color}` : C.shadowSm }}
    >
      <div className="flex items-center gap-1.5">
        <button onClick={() => up({ enabled: !band.enabled })} className="w-4 h-4 flex-shrink-0 transition-all" style={{ border: `2px solid ${color}`, background: band.enabled ? color : 'transparent' }} title={band.enabled ? 'Disable band' : 'Enable band'} />
        <span className="font-bold" style={{ color: C.inkSoft, fontSize: 11, fontFamily: MONO }}>B{index + 1}</span>
        <select value={band.type} onChange={e => up({ type: e.target.value as FilterType })} className="flex-1 px-1 py-0.5 outline-none appearance-none cursor-pointer font-bold" style={{ background: C.surface, color: band.enabled ? C.ink : C.inkSoft, border: `1.5px solid ${C.ink}`, fontSize: 12, fontFamily: MONO }}>
          {FILTER_TYPES.map(t => <option key={t.value} value={t.value}>{t.label}</option>)}
        </select>
        <button onClick={onDelete} className="flex-shrink-0 opacity-50 hover:opacity-100 transition-opacity" style={{ color: '#b91c1c' }} title="Delete band"><Trash2 size={13} strokeWidth={2.5} /></button>
      </div>

      <div>
        <div className="flex justify-between items-center mb-1">
          <span className="font-bold" style={{ color: C.inkSoft, fontSize: 11, fontFamily: MONO }}>FREQ</span>
          <div className="flex items-center gap-0.5">
            <input type="number" value={Math.round(band.frequency)} onChange={e => { const v = +e.target.value; if (v >= 20 && v <= 20000) up({ frequency: v }); }} className="w-14 text-right px-1 py-0.5 outline-none" style={numInput} min={20} max={20000} />
            <span style={{ color: C.inkSoft, fontSize: 11, fontFamily: MONO }}>Hz</span>
          </div>
        </div>
        <input type="range" min={0} max={1000} step={1} value={freqToSlider(band.frequency)} onChange={e => up({ frequency: sliderToFreq(+e.target.value) })} className="w-full h-1 cursor-pointer" style={{ accentColor: color }} />
      </div>

      <div>
        <div className="flex justify-between items-center mb-1">
          <span className="font-bold" style={{ color: C.inkSoft, fontSize: 11, fontFamily: MONO }}>GAIN</span>
          <div className="flex items-center gap-0.5">
            <input type="number" value={band.gain.toFixed(1)} onChange={e => { const v = +e.target.value; if (v >= -20 && v <= 20) up({ gain: v }); }} className="w-14 text-right px-1 py-0.5 outline-none" style={{ ...numInput, color: gainColor, fontWeight: 700 }} min={-20} max={20} step={0.5} />
            <span style={{ color: C.inkSoft, fontSize: 11, fontFamily: MONO }}>dB</span>
          </div>
        </div>
        <input type="range" min={-20} max={20} step={0.5} value={band.gain} onChange={e => up({ gain: +e.target.value })} className="w-full h-1 cursor-pointer" style={{ accentColor: color }} />
      </div>

      <div>
        <div className="flex justify-between items-center mb-1">
          <span className="font-bold" style={{ color: C.inkSoft, fontSize: 11, fontFamily: MONO }}>Q</span>
          <input type="number" value={band.q.toFixed(2)} onChange={e => { const v = +e.target.value; if (v >= 0.1 && v <= 12) up({ q: v }); }} className="w-14 text-right px-1 py-0.5 outline-none" style={numInput} min={0.1} max={12} step={0.05} />
        </div>
        <input type="range" min={0.1} max={10} step={0.05} value={band.q} onChange={e => up({ q: +e.target.value })} className="w-full h-1 cursor-pointer" style={{ accentColor: color }} />
      </div>
    </div>
  );
}

type TabId = 'bands' | 'export' | 'analysis';
const TABS: { id: TabId; label: string; icon: typeof SlidersHorizontal }[] = [
  { id: 'bands', label: 'Bands', icon: SlidersHorizontal },
  { id: 'export', label: 'Export', icon: Download },
  { id: 'analysis', label: 'Analysis', icon: BarChart3 },
];

interface EQPanelProps {
  layers: EQLayer[];
  activeLayerId: string | null;
  onSelectLayer: (id: string) => void;
  onToggleLayer: (id: string) => void;
  onRemoveLayer: (id: string) => void;
  onNewLayer: () => void;
  onChangeActiveBands: (bands: EQBandDef[]) => void;
  onAddBand: () => void;
  onClearActive: () => void;
  onAutoEQ: () => void;
  autoEQLabel?: string;
  preamp: number;
}

export function EQPanel({
  layers, activeLayerId, onSelectLayer, onToggleLayer, onRemoveLayer, onNewLayer,
  onChangeActiveBands, onAddBand, onClearActive, onAutoEQ, autoEQLabel, preamp,
}: EQPanelProps) {
  const [tab, setTab] = useState<TabId>('bands');
  const [copied, setCopied] = useState(false);
  const [collapsed, setCollapsed] = useState(false);

  const active = layers.find(l => l.id === activeLayerId) ?? null;
  const bands = active?.bands ?? [];

  const updateBand = (id: string, b: EQBandDef) => onChangeActiveBands(bands.map(x => x.id === id ? b : x));
  const deleteBand = (id: string) => onChangeActiveBands(bands.filter(b => b.id !== id));

  const handleCopy = () => {
    navigator.clipboard.writeText(exportEqualizerAPO(bands, preamp));
    setCopied(true);
    setTimeout(() => setCopied(false), 1800);
  };

  const enabled = bands.filter(b => b.enabled);
  const activeCount = enabled.length;
  const maxBoost = enabled.reduce((m, b) => Math.max(m, b.gain), 0);
  const maxCut = enabled.reduce((m, b) => Math.min(m, b.gain), 0);
  const suggested = suggestPreamp(bands);

  const tinyBtn = 'flex items-center gap-1 px-2.5 py-1 font-bold uppercase transition-colors enabled:hover:opacity-70 disabled:opacity-25';
  const tinyStyle = { border: `2px solid ${C.ink}`, color: C.ink, background: C.surface, fontSize: 12, fontFamily: MONO } as const;

  return (
    <div className="flex-shrink-0" style={{ background: C.panel, borderTop: `2px solid ${C.ink}` }}>
      {/* Tab strip header */}
      <div className="flex items-stretch" style={{ borderBottom: `2px solid ${C.ink}` }}>
        <div className="flex items-stretch overflow-x-auto">
          {TABS.map(t => {
            const Icon = t.icon;
            const isActive = tab === t.id && !collapsed;
            return (
              <button
                key={t.id}
                onClick={() => { setTab(t.id); setCollapsed(false); }}
                className="flex items-center gap-1.5 px-3 sm:px-4 py-2 font-bold uppercase border-r-2 transition-colors flex-shrink-0"
                style={{ background: isActive ? C.ink : 'transparent', color: isActive ? C.surface : C.inkSoft, borderColor: C.ink, fontSize: 13, fontFamily: MONO, letterSpacing: '0.06em' }}
              >
                <Icon size={14} strokeWidth={2.5} /> {t.label}
                {t.id === 'bands' && activeCount > 0 && (
                  <span className="px-1 font-bold" style={{ background: C.accent, color: '#fff', fontSize: 11 }}>{activeCount}</span>
                )}
              </button>
            );
          })}
        </div>

        <div className="flex-1" />

        <button className="px-3 border-l-2 transition-colors hover:opacity-70" style={{ borderColor: C.ink, color: C.ink }} onClick={() => setCollapsed(c => !c)} title={collapsed ? 'Expand' : 'Collapse'}>
          {collapsed ? <ChevronUp size={17} strokeWidth={2.5} /> : <ChevronDown size={17} strokeWidth={2.5} />}
        </button>
      </div>

      {/* EQ layer bar */}
      {!collapsed && (
        <div className="flex items-center gap-2 px-3 sm:px-5 py-2 overflow-x-auto border-b-2" style={{ borderColor: C.ink, background: C.panelAlt }}>
          <span className="uppercase font-bold flex-shrink-0" style={{ color: C.inkSoft, fontSize: 11, fontFamily: MONO, letterSpacing: '0.08em' }}>EQ layers</span>
          {layers.length === 0 && (
            <span style={{ color: C.inkSoft, fontSize: 12, fontFamily: MONO }}>none</span>
          )}
          {layers.map(l => {
            const isActive = l.id === activeLayerId;
            return (
              <div
                key={l.id}
                className="flex items-center gap-1.5 flex-shrink-0 cursor-pointer"
                style={{ background: isActive ? l.color + '22' : C.surface, border: `2px solid ${isActive ? l.color : C.ink}`, padding: '3px 6px 3px 8px' }}
                onClick={() => onSelectLayer(l.id)}
                title={isActive ? 'Active layer' : 'Select layer'}
              >
                <button
                  onClick={e => { e.stopPropagation(); onToggleLayer(l.id); }}
                  className="w-3.5 h-3.5 flex-shrink-0 transition-all"
                  style={{ border: `2px solid ${l.color}`, background: l.enabled ? l.color : 'transparent' }}
                  title={l.enabled ? 'Disable layer' : 'Enable layer'}
                />
                <span className="font-semibold" style={{ color: isActive ? l.color : C.ink, whiteSpace: 'nowrap', fontSize: 12, opacity: l.enabled ? 1 : 0.5 }}>{l.name}</span>
                <button onClick={e => { e.stopPropagation(); onRemoveLayer(l.id); }} className="ml-0.5 opacity-50 hover:opacity-100 transition-opacity" title="Remove layer">
                  <X size={13} strokeWidth={3} style={{ color: l.color }} />
                </button>
              </div>
            );
          })}
          <button onClick={onNewLayer} className="flex items-center gap-1 px-2 py-1 font-bold uppercase transition-colors hover:opacity-70 flex-shrink-0" style={tinyStyle} title="New EQ layer">
            <Plus size={13} strokeWidth={3} /> New EQ
          </button>
          {autoEQLabel && (
            <button onClick={onAutoEQ} className="flex items-center gap-1 px-2 py-1 font-bold uppercase transition-colors hover:opacity-70 flex-shrink-0" style={{ ...tinyStyle, background: '#008a6c', color: '#fff', border: `2px solid ${C.ink}` }} title={`AutoEQ ${autoEQLabel}`}>
              <Zap size={13} strokeWidth={2.5} /> AutoEQ
            </button>
          )}
        </div>
      )}

      {/* Tab content */}
      {!collapsed && (
        <div style={{ minHeight: 158 }}>
          {/* BANDS */}
          {tab === 'bands' && (
            <div>
              <div className="flex items-center gap-2 px-3 sm:px-5 pt-3">
                <button onClick={onAddBand} className={tinyBtn + ' hover:opacity-70'} style={tinyStyle}><Plus size={13} strokeWidth={3} /> Band</button>
                <button onClick={onClearActive} disabled={!bands.length} className={tinyBtn} style={tinyStyle}><Eraser size={13} strokeWidth={2.5} /> Clear</button>
                <span style={{ color: C.inkSoft, fontSize: 12, fontFamily: MONO }}>{bands.length} band(s) · {activeCount} active</span>
                <span className="hidden md:inline ml-auto" style={{ color: C.inkFaint, fontSize: 11, fontFamily: MONO }}>drag points on the graph · double-click to add · scroll over a point for Q</span>
              </div>
              <div className="flex gap-2.5 px-3 sm:px-5 py-3 overflow-x-auto">
                {!active ? (
                  <div className="flex-1 flex flex-col items-center justify-center" style={{ border: `2px dashed ${C.ink}`, minHeight: 110 }}>
                    <span style={{ color: C.inkSoft, fontSize: 13, fontFamily: MONO }}>No EQ layer selected</span>
                    <button onClick={onNewLayer} className="mt-2 flex items-center gap-1 px-2.5 py-1 font-bold uppercase transition-colors hover:opacity-70" style={tinyStyle}><Plus size={13} strokeWidth={3} /> New EQ</button>
                  </div>
                ) : bands.length === 0 ? (
                  <div className="flex-1 flex flex-col items-center justify-center" style={{ border: `2px dashed ${C.ink}`, minHeight: 110 }}>
                    <span style={{ color: C.inkSoft, fontSize: 13, fontFamily: MONO }}>No bands in this layer</span>
                    <button onClick={onAddBand} className="mt-2 flex items-center gap-1 px-2.5 py-1 font-bold uppercase transition-colors hover:opacity-70" style={tinyStyle}><Plus size={13} strokeWidth={3} /> Add band</button>
                  </div>
                ) : (
                  bands.map((band, i) => (
                    <BandRow key={band.id} band={band} index={i} color={BAND_COLORS[i % BAND_COLORS.length]} onChange={updated => updateBand(band.id, updated)} onDelete={() => deleteBand(band.id)} />
                  ))
                )}
              </div>
            </div>
          )}

          {/* EXPORT */}
          {tab === 'export' && (
            <div className="px-3 sm:px-5 py-3">
              <div className="flex items-center justify-between mb-2 flex-wrap gap-2">
                <span className="uppercase font-bold" style={{ color: C.inkSoft, fontSize: 12, fontFamily: MONO, letterSpacing: '0.08em' }}>EqualizerAPO · Peace · Roon · Wavelet</span>
                <button onClick={handleCopy} className="flex items-center gap-1 px-2.5 py-1 font-bold uppercase transition-colors hover:opacity-70" style={{ border: `2px solid ${C.ink}`, color: copied ? '#047857' : C.ink, background: C.surface, fontSize: 12, fontFamily: MONO }}>
                  {copied ? <Check size={12} strokeWidth={3} /> : <Copy size={12} strokeWidth={2.5} />} {copied ? 'Copied!' : 'Copy'}
                </button>
              </div>
              <pre className="whitespace-pre-wrap p-3 overflow-auto" style={{ color: C.ink, fontSize: 13, lineHeight: 1.7, fontFamily: MONO, background: C.surface, border: `2px solid ${C.ink}`, maxHeight: 200 }}>
                {exportEqualizerAPO(bands, preamp) || '# No active bands'}
              </pre>
            </div>
          )}

          {/* ANALYSIS */}
          {tab === 'analysis' && (
            <div className="px-3 sm:px-5 py-3">
              <div className="grid gap-2.5" style={{ gridTemplateColumns: 'repeat(auto-fill, minmax(150px, 1fr))' }}>
                <Stat label="Active bands" value={`${activeCount} / ${bands.length}`} />
                <Stat label="Max boost" value={`${maxBoost > 0 ? '+' : ''}${maxBoost.toFixed(1)} dB`} color={maxBoost > 0 ? '#047857' : C.ink} />
                <Stat label="Max cut" value={`${maxCut.toFixed(1)} dB`} color={maxCut < 0 ? '#b91c1c' : C.ink} />
                <Stat label="Preamp" value={`${preamp > 0 ? '+' : ''}${preamp.toFixed(1)} dB`} color={C.accent} />
              </div>
              <div className="flex items-center gap-2 mt-3 flex-wrap">
                <span style={{ color: C.inkSoft, fontSize: 13, fontFamily: MONO }}>
                  Preamp that avoids clipping: <b style={{ color: C.ink }}>{suggested > 0 ? '+' : ''}{suggested.toFixed(1)} dB</b>. It trims the exported output level only and does not change the displayed response.
                </span>
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
}

function Stat({ label, value, color = C.ink }: { label: string; value: string; color?: string }) {
  return (
    <div className="flex flex-col gap-1 p-2.5" style={{ background: C.surface, border: `2px solid ${C.ink}` }}>
      <span className="uppercase font-bold" style={{ color: C.inkSoft, fontSize: 11, fontFamily: MONO, letterSpacing: '0.08em' }}>{label}</span>
      <span className="font-bold" style={{ color, fontSize: 20, fontFamily: MONO }}>{value}</span>
    </div>
  );
}
