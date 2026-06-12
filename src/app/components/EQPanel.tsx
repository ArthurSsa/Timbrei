import { useState } from 'react';
import { EQBandDef, FilterType, EQPreset, EQ_PRESETS, exportEqualizerAPO, suggestPreamp } from '../utils/filters';
import { C } from '../theme';
import {
  Plus, Trash2, Copy, ChevronDown, ChevronUp, Power,
  SlidersHorizontal, ListMusic, Download, BarChart3, Eraser, Wand2, Check,
  LayoutGrid, Zap, FlipVertical2, Activity,
} from 'lucide-react';

const MONO = 'ui-monospace, "Courier New", monospace';

const FILTER_TYPES: { value: FilterType; label: string }[] = [
  { value: 'peak', label: 'Peak' },
  { value: 'lowShelf', label: 'Low Shelf' },
  { value: 'highShelf', label: 'Hi Shelf' },
  { value: 'lowPass', label: 'Lo Pass' },
  { value: 'highPass', label: 'Hi Pass' },
  { value: 'notch', label: 'Notch' },
];

// squig.link curve palette — reused to color each EQ band.
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
  background: C.surface, color: C.ink, fontSize: 10, fontFamily: MONO,
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
  const hasGain = band.type !== 'lowPass' && band.type !== 'highPass' && band.type !== 'notch';
  const up = (p: Partial<EQBandDef>) => onChange({ ...band, ...p });
  const gainColor = band.gain > 0.5 ? '#047857' : band.gain < -0.5 ? '#b91c1c' : C.inkSoft;

  return (
    <div
      className="flex-shrink-0 flex flex-col gap-1.5 p-2.5"
      style={{ width: 176, background: C.surface, border: `2px solid ${band.enabled ? color : C.ink}`, boxShadow: band.enabled ? `3px 3px 0 ${color}` : C.shadowSm }}
    >
      <div className="flex items-center gap-1.5">
        <button onClick={() => up({ enabled: !band.enabled })} className="w-4 h-4 flex-shrink-0 transition-all" style={{ border: `2px solid ${color}`, background: band.enabled ? color : 'transparent' }} title={band.enabled ? 'Desativar banda' : 'Ativar banda'} />
        <span className="font-bold" style={{ color: C.inkSoft, fontSize: 9, fontFamily: MONO }}>B{index + 1}</span>
        <select value={band.type} onChange={e => up({ type: e.target.value as FilterType })} className="flex-1 px-1 py-0.5 outline-none appearance-none cursor-pointer font-bold" style={{ background: C.surface, color: band.enabled ? C.ink : C.inkSoft, border: `1.5px solid ${C.ink}`, fontSize: 10, fontFamily: MONO }}>
          {FILTER_TYPES.map(t => <option key={t.value} value={t.value}>{t.label}</option>)}
        </select>
        <button onClick={onDelete} className="flex-shrink-0 opacity-50 hover:opacity-100 transition-opacity" style={{ color: '#b91c1c' }} title="Excluir banda"><Trash2 size={12} strokeWidth={2.5} /></button>
      </div>

      <div>
        <div className="flex justify-between items-center mb-1">
          <span className="font-bold" style={{ color: C.inkSoft, fontSize: 9, fontFamily: MONO }}>FREQ</span>
          <div className="flex items-center gap-0.5">
            <input type="number" value={Math.round(band.frequency)} onChange={e => { const v = +e.target.value; if (v >= 20 && v <= 20000) up({ frequency: v }); }} className="w-14 text-right px-1 py-0.5 outline-none" style={numInput} min={20} max={20000} />
            <span style={{ color: C.inkSoft, fontSize: 9, fontFamily: MONO }}>Hz</span>
          </div>
        </div>
        <input type="range" min={0} max={1000} step={1} value={freqToSlider(band.frequency)} onChange={e => up({ frequency: sliderToFreq(+e.target.value) })} className="w-full h-1 cursor-pointer" style={{ accentColor: color }} />
      </div>

      {hasGain && (
        <div>
          <div className="flex justify-between items-center mb-1">
            <span className="font-bold" style={{ color: C.inkSoft, fontSize: 9, fontFamily: MONO }}>GAIN</span>
            <div className="flex items-center gap-0.5">
              <input type="number" value={band.gain.toFixed(1)} onChange={e => { const v = +e.target.value; if (v >= -20 && v <= 20) up({ gain: v }); }} className="w-14 text-right px-1 py-0.5 outline-none" style={{ ...numInput, color: gainColor, fontWeight: 700 }} min={-20} max={20} step={0.5} />
              <span style={{ color: C.inkSoft, fontSize: 9, fontFamily: MONO }}>dB</span>
            </div>
          </div>
          <input type="range" min={-20} max={20} step={0.5} value={band.gain} onChange={e => up({ gain: +e.target.value })} className="w-full h-1 cursor-pointer" style={{ accentColor: color }} />
        </div>
      )}

      <div>
        <div className="flex justify-between items-center mb-1">
          <span className="font-bold" style={{ color: C.inkSoft, fontSize: 9, fontFamily: MONO }}>Q</span>
          <input type="number" value={band.q.toFixed(2)} onChange={e => { const v = +e.target.value; if (v >= 0.1 && v <= 12) up({ q: v }); }} className="w-14 text-right px-1 py-0.5 outline-none" style={numInput} min={0.1} max={12} step={0.05} />
        </div>
        <input type="range" min={0.1} max={10} step={0.05} value={band.q} onChange={e => up({ q: +e.target.value })} className="w-full h-1 cursor-pointer" style={{ accentColor: color }} />
      </div>
    </div>
  );
}

type TabId = 'hub' | 'bands' | 'presets' | 'export' | 'analysis';
const TABS: { id: TabId; label: string; icon: typeof SlidersHorizontal }[] = [
  { id: 'hub', label: 'Funções', icon: LayoutGrid },
  { id: 'bands', label: 'Bandas', icon: SlidersHorizontal },
  { id: 'presets', label: 'Presets', icon: ListMusic },
  { id: 'export', label: 'Exportar', icon: Download },
  { id: 'analysis', label: 'Análise', icon: BarChart3 },
];

interface EQPanelProps {
  bands: EQBandDef[];
  onChange: (bands: EQBandDef[]) => void;
  showEQ: boolean;
  onToggleEQ: () => void;
  preamp: number;
  onPreampChange: (v: number) => void;
  onApplyPreset: (preset: EQPreset) => void;
  onAddBand: () => void;
  onClearAll: () => void;
  onFlatten: () => void;
  onInvert: () => void;
  onAutoEQ: () => void;
  autoEQLabel?: string;
}

export function EQPanel({ bands, onChange, showEQ, onToggleEQ, preamp, onPreampChange, onApplyPreset, onAddBand, onClearAll, onFlatten, onInvert, onAutoEQ, autoEQLabel }: EQPanelProps) {
  const [tab, setTab] = useState<TabId>('hub');
  const [copied, setCopied] = useState(false);
  const [collapsed, setCollapsed] = useState(false);

  const updateBand = (id: string, b: EQBandDef) => onChange(bands.map(x => x.id === id ? b : x));
  const deleteBand = (id: string) => onChange(bands.filter(b => b.id !== id));

  const handleCopy = () => {
    navigator.clipboard.writeText(exportEqualizerAPO(bands, preamp));
    setCopied(true);
    setTimeout(() => setCopied(false), 1800);
  };

  const enabled = bands.filter(b => b.enabled);
  const active = enabled.length;
  const maxBoost = enabled.reduce((m, b) => Math.max(m, b.gain), 0);
  const maxCut = enabled.reduce((m, b) => Math.min(m, b.gain), 0);
  const suggested = suggestPreamp(bands);

  const tinyBtn = 'flex items-center gap-1 px-2.5 py-1 font-bold uppercase transition-colors enabled:hover:opacity-70 disabled:opacity-25';
  const tinyStyle = { border: `2px solid ${C.ink}`, color: C.ink, background: C.surface, fontSize: 10, fontFamily: MONO } as const;

  return (
    <div className="flex-shrink-0" style={{ background: C.panel, borderTop: `2px solid ${C.ink}` }}>
      {/* ── Tab strip header (the functionality list) ── */}
      <div className="flex items-stretch" style={{ borderBottom: collapsed ? 'none' : `2px solid ${C.ink}` }}>
        <div className="flex items-stretch overflow-x-auto">
          {TABS.map(t => {
            const Icon = t.icon;
            const isActive = tab === t.id && !collapsed;
            return (
              <button
                key={t.id}
                onClick={() => { setTab(t.id); setCollapsed(false); }}
                className="flex items-center gap-1.5 px-3 sm:px-4 py-2 font-bold uppercase border-r-2 transition-colors flex-shrink-0"
                style={{ background: isActive ? C.ink : 'transparent', color: isActive ? C.surface : C.inkSoft, borderColor: C.ink, fontSize: 11, fontFamily: MONO, letterSpacing: '0.06em' }}
              >
                <Icon size={13} strokeWidth={2.5} /> {t.label}
                {t.id === 'bands' && active > 0 && (
                  <span className="px-1 font-bold" style={{ background: isActive ? C.accent : C.accent, color: '#fff', fontSize: 9 }}>{active}</span>
                )}
              </button>
            );
          })}
        </div>

        <div className="flex-1" />

        {/* EQ bypass + collapse */}
        <button
          className="px-2.5 font-bold uppercase border-l-2 transition-colors flex items-center gap-1"
          style={{ background: showEQ ? C.accent : C.surface, borderColor: C.ink, color: showEQ ? '#fff' : C.ink, fontSize: 10, fontFamily: MONO }}
          onClick={onToggleEQ}
          title="Ligar/desligar EQ"
        >
          <Power size={11} strokeWidth={3} /> {showEQ ? 'ON' : 'OFF'}
        </button>
        <button className="px-3 border-l-2 transition-colors hover:opacity-70" style={{ borderColor: C.ink, color: C.ink }} onClick={() => setCollapsed(c => !c)} title={collapsed ? 'Expandir' : 'Recolher'}>
          {collapsed ? <ChevronUp size={16} strokeWidth={2.5} /> : <ChevronDown size={16} strokeWidth={2.5} />}
        </button>
      </div>

      {/* ── Tab content ── */}
      {!collapsed && (
        <div style={{ minHeight: 158 }}>
          {/* HUB — dense colorful quick-action grid (super-app launcher) */}
          {tab === 'hub' && (
            <div className="px-3 sm:px-5 py-3 flex flex-col gap-3">
              <div>
                <span className="uppercase font-bold" style={{ color: C.inkSoft, fontSize: 10, fontFamily: MONO, letterSpacing: '0.08em' }}>Ações rápidas</span>
                <div className="grid gap-2 mt-2" style={{ gridTemplateColumns: 'repeat(auto-fill, minmax(96px, 1fr))' }}>
                  {[
                    { label: autoEQLabel ? `Auto EQ` : 'Auto EQ', sub: autoEQLabel, icon: Zap, color: '#008a6c', onClick: onAutoEQ },
                    { label: 'Add banda', icon: Plus, color: '#0070c5', onClick: onAddBand },
                    { label: 'Flat', icon: Activity, color: '#00ac00', onClick: onFlatten },
                    { label: 'Inverter', icon: FlipVertical2, color: '#95009e', onClick: onInvert },
                    { label: 'Preamp auto', icon: Wand2, color: '#e48f00', onClick: () => onPreampChange(suggested) },
                    { label: 'Exportar', icon: Download, color: '#003a9d', onClick: () => setTab('export') },
                    { label: 'Análise', icon: BarChart3, color: '#c83400', onClick: () => setTab('analysis') },
                    { label: 'Limpar', icon: Eraser, color: '#ff001f', onClick: onClearAll },
                  ].map(a => (
                    <ActionTile key={a.label} label={a.label} sub={a.sub} icon={a.icon} color={a.color} onClick={a.onClick} />
                  ))}
                </div>
              </div>
              <div>
                <span className="uppercase font-bold" style={{ color: C.inkSoft, fontSize: 10, fontFamily: MONO, letterSpacing: '0.08em' }}>Presets · 1 toque</span>
                <div className="grid gap-2 mt-2" style={{ gridTemplateColumns: 'repeat(auto-fill, minmax(96px, 1fr))' }}>
                  {EQ_PRESETS.map((p, i) => (
                    <ActionTile key={p.id} label={p.name} sub={`${p.bands.length} bd`} icon={ListMusic} color={BAND_COLORS[i % BAND_COLORS.length]} onClick={() => onApplyPreset(p)} />
                  ))}
                </div>
              </div>
            </div>
          )}

          {/* BANDS */}
          {tab === 'bands' && (
            <div>
              <div className="flex items-center gap-2 px-3 sm:px-5 pt-3">
                <button onClick={onAddBand} className={tinyBtn + ' hover:opacity-70'} style={tinyStyle}><Plus size={12} strokeWidth={3} /> Banda</button>
                <button onClick={onClearAll} disabled={!bands.length} className={tinyBtn} style={tinyStyle}><Eraser size={12} strokeWidth={2.5} /> Limpar tudo</button>
                <span style={{ color: C.inkSoft, fontSize: 10, fontFamily: MONO }}>{bands.length} banda(s) · {active} ativa(s)</span>
              </div>
              <div className="flex gap-2.5 px-3 sm:px-5 py-3 overflow-x-auto">
                {bands.length === 0 ? (
                  <div className="flex-1 flex flex-col items-center justify-center" style={{ border: `2px dashed ${C.ink}`, minHeight: 110 }}>
                    <span style={{ color: C.inkSoft, fontSize: 12, fontFamily: MONO }}>Sem bandas de EQ</span>
                    <button onClick={onAddBand} className="mt-2 flex items-center gap-1 px-2.5 py-1 font-bold uppercase transition-colors hover:opacity-70" style={tinyStyle}><Plus size={12} strokeWidth={3} /> Adicionar banda</button>
                  </div>
                ) : (
                  bands.map((band, i) => (
                    <BandRow key={band.id} band={band} index={i} color={BAND_COLORS[i % BAND_COLORS.length]} onChange={updated => updateBand(band.id, updated)} onDelete={() => deleteBand(band.id)} />
                  ))
                )}
              </div>
            </div>
          )}

          {/* PRESETS */}
          {tab === 'presets' && (
            <div className="px-3 sm:px-5 py-3">
              <span className="uppercase font-bold" style={{ color: C.inkSoft, fontSize: 10, fontFamily: MONO, letterSpacing: '0.08em' }}>Curvas prontas · clique para aplicar</span>
              <div className="grid gap-2.5 mt-2.5" style={{ gridTemplateColumns: 'repeat(auto-fill, minmax(150px, 1fr))' }}>
                {EQ_PRESETS.map(p => (
                  <button
                    key={p.id}
                    onClick={() => onApplyPreset(p)}
                    className="flex flex-col items-start gap-0.5 p-2.5 text-left transition-all hover:-translate-y-0.5"
                    style={{ background: C.surface, border: `2px solid ${C.ink}`, boxShadow: C.shadowSm }}
                  >
                    <span className="font-bold uppercase" style={{ color: C.ink, fontSize: 12, fontFamily: MONO }}>{p.name}</span>
                    <span style={{ color: C.inkSoft, fontSize: 10 }}>{p.description}</span>
                    <span style={{ color: C.accent, fontSize: 9, fontFamily: MONO, fontWeight: 700 }}>{p.bands.length} banda(s)</span>
                  </button>
                ))}
              </div>
            </div>
          )}

          {/* EXPORT */}
          {tab === 'export' && (
            <div className="px-3 sm:px-5 py-3">
              <div className="flex items-center justify-between mb-2 flex-wrap gap-2">
                <span className="uppercase font-bold" style={{ color: C.inkSoft, fontSize: 10, fontFamily: MONO, letterSpacing: '0.08em' }}>EqualizerAPO · Peace · Roon · Wavelet</span>
                <button onClick={handleCopy} className="flex items-center gap-1 px-2.5 py-1 font-bold uppercase transition-colors hover:opacity-70" style={{ border: `2px solid ${C.ink}`, color: copied ? '#047857' : C.ink, background: C.surface, fontSize: 10, fontFamily: MONO }}>
                  {copied ? <Check size={11} strokeWidth={3} /> : <Copy size={11} strokeWidth={2.5} />} {copied ? 'Copiado!' : 'Copiar'}
                </button>
              </div>
              <pre className="whitespace-pre-wrap p-3 overflow-auto" style={{ color: C.ink, fontSize: 11, lineHeight: 1.7, fontFamily: MONO, background: C.surface, border: `2px solid ${C.ink}`, maxHeight: 200 }}>
                {exportEqualizerAPO(bands, preamp) || '# Nenhuma banda ativa'}
              </pre>
            </div>
          )}

          {/* ANALYSIS */}
          {tab === 'analysis' && (
            <div className="px-3 sm:px-5 py-3">
              <div className="grid gap-2.5" style={{ gridTemplateColumns: 'repeat(auto-fill, minmax(150px, 1fr))' }}>
                <Stat label="Bandas ativas" value={`${active} / ${bands.length}`} />
                <Stat label="Maior reforço" value={`${maxBoost > 0 ? '+' : ''}${maxBoost.toFixed(1)} dB`} color={maxBoost > 0 ? '#047857' : C.ink} />
                <Stat label="Maior corte" value={`${maxCut.toFixed(1)} dB`} color={maxCut < 0 ? '#b91c1c' : C.ink} />
                <Stat label="Preamp atual" value={`${preamp > 0 ? '+' : ''}${preamp.toFixed(1)} dB`} color={C.accent} />
              </div>
              <div className="flex items-center gap-2 mt-3 flex-wrap">
                <span style={{ color: C.inkSoft, fontSize: 11, fontFamily: MONO }}>
                  Preamp sugerido p/ evitar clipping: <b style={{ color: C.ink }}>{suggested > 0 ? '+' : ''}{suggested.toFixed(1)} dB</b>
                </span>
                <button onClick={() => onPreampChange(suggested)} className="flex items-center gap-1 px-2.5 py-1 font-bold uppercase transition-colors hover:opacity-70" style={{ border: `2px solid ${C.ink}`, color: C.ink, background: C.surface, fontSize: 10, fontFamily: MONO }}>
                  <Wand2 size={12} strokeWidth={2.5} /> Aplicar
                </button>
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
      <span className="uppercase font-bold" style={{ color: C.inkSoft, fontSize: 9, fontFamily: MONO, letterSpacing: '0.08em' }}>{label}</span>
      <span className="font-bold" style={{ color, fontSize: 18, fontFamily: MONO }}>{value}</span>
    </div>
  );
}

function ActionTile({ label, sub, icon: Icon, color, onClick }: { label: string; sub?: string; icon: typeof SlidersHorizontal; color: string; onClick: () => void }) {
  return (
    <button
      onClick={onClick}
      className="flex flex-col items-start justify-between gap-2 p-2.5 transition-all hover:-translate-y-0.5 active:translate-y-0"
      style={{ background: color, border: `2px solid ${C.ink}`, boxShadow: C.shadowSm, minHeight: 72, color: '#fff' }}
    >
      <Icon size={18} strokeWidth={2.5} />
      <div className="text-left leading-tight">
        <div className="font-bold uppercase" style={{ fontSize: 11, fontFamily: MONO }}>{label}</div>
        {sub && <div style={{ fontSize: 9, fontFamily: MONO, opacity: 0.85 }}>{sub}</div>}
      </div>
    </button>
  );
}
