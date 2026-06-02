import React, { useState, useEffect, useCallback, useMemo } from 'react';
import { supabase } from '../supabaseClient';
import { Plus, X, FileText, Trash2, BarChart2 } from 'lucide-react';

// ─── helpers ──────────────────────────────────────────────────────────────────

const PAGADO_POR_OPTIONS = ['DD', 'FD'];
const ESTADO_OPTIONS = ['P', 'D', 'PG'];
const TIPO_OPTIONS = ['T', 'C', 'A'];

const formatCLP = (n) => {
  if (n === null || n === undefined || n === '') return '';
  const num = typeof n === 'string' ? parseFloat(n.replace(/[^0-9.-]/g, '')) : n;
  if (isNaN(num)) return '';
  return '$' + Math.round(num).toLocaleString('es-CL');
};

const parseCLP = (str) => {
  if (!str && str !== 0) return null;
  const n = parseFloat(String(str).replace(/[^0-9.-]/g, ''));
  return isNaN(n) ? null : n;
};

const antiguedad = (fechaStr) => {
  if (!fechaStr) return '';
  const fecha = new Date(fechaStr + 'T12:00:00');
  const diff = (new Date() - fecha) / (1000 * 60 * 60 * 24);
  return diff > 90 ? '+ 3 meses' : '- 3 meses';
};

const today = () => new Date().toISOString().split('T')[0];

const ESTADO_COLORS = {
  P:  { bg: '#fff3e0', color: '#f57c00' },
  D:  { bg: '#e6f4ea', color: '#2e7d32' },
  PG: { bg: '#e8f0fe', color: '#1a73e8' },
};

// ─── Money input ───────────────────────────────────────────────────────────────
function MoneyInput({ value, onChange, style = {} }) {
  const [editing, setEditing] = useState(false);
  const [raw, setRaw] = useState('');

  const start = () => {
    const n = parseCLP(value);
    setRaw(n != null ? String(Math.round(n)) : '');
    setEditing(true);
  };

  const commit = () => {
    setEditing(false);
    const n = parseCLP(raw);
    onChange(n != null ? n : null);
  };

  if (editing) {
    return (
      <div style={{ display: 'flex', alignItems: 'center', border: '1px solid #1a73e8', borderRadius: 6, padding: '2px 6px', background: '#fff', minWidth: 90 }}>
        <span style={{ fontSize: 12, color: '#9aa0a6', marginRight: 2 }}>$</span>
        <input autoFocus value={raw ? parseInt(raw || '0').toLocaleString('es-CL') : ''}
          onChange={e => setRaw(e.target.value.replace(/[^0-9]/g, ''))}
          onBlur={commit}
          onKeyDown={e => e.key === 'Enter' && e.target.blur()}
          style={{ border: 'none', outline: 'none', width: 100, fontSize: 12, fontFamily: 'inherit' }} />
      </div>
    );
  }
  return (
    <div onClick={start} style={{ cursor: 'text', fontSize: 12, padding: '2px 4px', borderRadius: 4, ...style }}>
      {value != null && value !== '' ? formatCLP(value) : <span style={{ color: '#dadce0' }}>—</span>}
    </div>
  );
}

// ─── Inline text cell ──────────────────────────────────────────────────────────
function InlineText({ value, onChange }) {
  const [editing, setEditing] = useState(false);
  const [raw, setRaw] = useState(value || '');
  if (editing) return (
    <input autoFocus value={raw}
      onChange={e => setRaw(e.target.value)}
      onBlur={() => { setEditing(false); if (raw !== value) onChange(raw); }}
      onKeyDown={e => e.key === 'Enter' && e.target.blur()}
      style={{ border: '1px solid #1a73e8', borderRadius: 5, padding: '3px 5px', fontSize: 12, outline: 'none', fontFamily: 'inherit', width: '100%' }} />
  );
  return (
    <div onClick={() => { setRaw(value || ''); setEditing(true); }}
      style={{ cursor: 'text', fontSize: 12, padding: '2px 2px', minHeight: 20 }}>
      {value || <span style={{ color: '#dadce0' }}>—</span>}
    </div>
  );
}

// ─── Inline select ─────────────────────────────────────────────────────────────
function InlineSelect({ value, options, onChange }) {
  return (
    <select value={value || ''} onChange={e => onChange(e.target.value)}
      style={{ border: 'none', outline: 'none', background: 'transparent', cursor: 'pointer', fontFamily: 'inherit', fontSize: 12, appearance: 'none', WebkitAppearance: 'none', textAlign: 'center', width: '100%' }}>
      <option value="">—</option>
      {options.map(o => <option key={o} value={o}>{o}</option>)}
    </select>
  );
}

// ─── Date cell ─────────────────────────────────────────────────────────────────
function DateCell({ value, onChange }) {
  return (
    <input type="date" value={value || ''} onChange={e => onChange(e.target.value)}
      style={{ border: 'none', outline: 'none', background: 'transparent', fontSize: 11, cursor: 'pointer', fontFamily: 'inherit', colorScheme: 'light', WebkitAppearance: 'none', width: 110 }}
      onClick={e => e.target.showPicker && e.target.showPicker()} />
  );
}

// ─── Notes panel ──────────────────────────────────────────────────────────────
function NotesPanel({ pago, onClose, onSave }) {
  const [text, setText] = useState(pago.notas || '');

  const handleSave = () => {
    onSave(pago.id, text);
    onClose();
  };

  return (
    <div style={panelStyles.overlay} onClick={e => e.target === e.currentTarget && onClose()}>
      <div style={panelStyles.panel}>
        <div style={panelStyles.header}>
          <div>
            <div style={panelStyles.prop}>{pago.propiedad}</div>
            <div style={panelStyles.desc}>{pago.descripcion}</div>
          </div>
          <button onClick={onClose} style={panelStyles.closeBtn}><X size={18} /></button>
        </div>
        <div style={panelStyles.body}>
          <label style={panelStyles.label}>Notas</label>
          <textarea value={text} onChange={e => setText(e.target.value)}
            placeholder="Ingresa notas sobre este pago..."
            style={panelStyles.textarea} autoFocus />
        </div>
        <div style={panelStyles.footer}>
          <button onClick={handleSave} style={panelStyles.saveBtn}>Guardar</button>
          <button onClick={onClose} style={panelStyles.cancelBtn}>Cancelar</button>
        </div>
      </div>
    </div>
  );
}

const panelStyles = {
  overlay: { position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.35)', display: 'flex', alignItems: 'center', justifyContent: 'flex-end', zIndex: 3000 },
  panel: { background: '#fff', width: 380, height: '100vh', display: 'flex', flexDirection: 'column', boxShadow: '-4px 0 24px rgba(0,0,0,0.15)', fontFamily: "'Google Sans','Segoe UI',sans-serif" },
  header: { padding: '20px 20px 16px', borderBottom: '1px solid #e8eaed', display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' },
  prop: { fontSize: 15, fontWeight: 700, color: '#202124', marginBottom: 4 },
  desc: { fontSize: 12, color: '#5f6368' },
  closeBtn: { background: 'none', border: 'none', cursor: 'pointer', padding: 4, color: '#5f6368', borderRadius: 6 },
  body: { flex: 1, padding: 20, display: 'flex', flexDirection: 'column', gap: 8 },
  label: { fontSize: 12, fontWeight: 600, color: '#5f6368' },
  textarea: { flex: 1, border: '1px solid #dadce0', borderRadius: 8, padding: 12, fontSize: 13, fontFamily: 'inherit', resize: 'none', outline: 'none', lineHeight: 1.6 },
  footer: { padding: '12px 20px', borderTop: '1px solid #e8eaed', display: 'flex', gap: 8 },
  saveBtn: { flex: 1, padding: '10px', background: '#1a73e8', color: '#fff', border: 'none', borderRadius: 8, fontSize: 13, fontWeight: 500, cursor: 'pointer', fontFamily: 'inherit' },
  cancelBtn: { padding: '10px 16px', background: 'none', border: '1px solid #dadce0', borderRadius: 8, fontSize: 13, cursor: 'pointer', fontFamily: 'inherit', color: '#5f6368' },
};

// ─── Metrics view ─────────────────────────────────────────────────────────────
function MetricsView({ pagos, onClose }) {
  const fmt = formatCLP;

  const total = pagos.reduce((s, p) => s + (p.cxc || 0), 0);
  const soloDescontado = pagos.filter(p => p.estado === 'D').reduce((s, p) => s + (p.cxc || 0), 0);

  const recientes = pagos.filter(p => antiguedad(p.fecha) === '- 3 meses');
  const antiguos  = pagos.filter(p => antiguedad(p.fecha) === '+ 3 meses');

  const cxcRecientes = recientes.reduce((s, p) => s + (p.cxc || 0), 0);
  const cxcAntiguos  = antiguos.reduce((s, p) => s + (p.cxc || 0), 0);
  const cxcAntiguosRecientes = antiguos.filter(p => p.estado !== 'D').reduce((s, p) => s + (p.cxc || 0), 0);

  const dd = pagos.filter(p => p.pagado_por === 'DD');
  const fd = pagos.filter(p => p.pagado_por === 'FD');
  const nn = pagos.filter(p => !p.pagado_por);

  const cxcDDAnt = dd.filter(p => antiguedad(p.fecha) === '+ 3 meses').reduce((s, p) => s + (p.cxc || 0), 0);
  const cxcDDRec = dd.filter(p => antiguedad(p.fecha) === '- 3 meses').reduce((s, p) => s + (p.cxc || 0), 0);
  const cxcFDAnt = fd.filter(p => antiguedad(p.fecha) === '+ 3 meses').reduce((s, p) => s + (p.cxc || 0), 0);
  const cxcFDRec = fd.filter(p => antiguedad(p.fecha) === '- 3 meses').reduce((s, p) => s + (p.cxc || 0), 0);
  const cxcNNAnt = nn.filter(p => antiguedad(p.fecha) === '+ 3 meses').reduce((s, p) => s + (p.cxc || 0), 0);

  const MetricCard = ({ title, rows }) => (
    <div style={{ background: '#fff', border: '1px solid #e8eaed', borderRadius: 12, padding: '16px 20px' }}>
      <div style={{ fontSize: 13, fontWeight: 700, color: '#5f6368', marginBottom: 12, textTransform: 'uppercase', letterSpacing: 0.5 }}>{title}</div>
      {rows.map(([label, value, highlight], i) => (
        <div key={i} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '6px 0', borderBottom: i < rows.length - 1 ? '1px solid #f1f3f4' : 'none' }}>
          <span style={{ fontSize: 13, color: '#3c4043' }}>{label}</span>
          <span style={{ fontSize: 14, fontWeight: 700, color: highlight || '#202124' }}>{value}</span>
        </div>
      ))}
    </div>
  );

  return (
    <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.4)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 3000 }}>
      <div style={{ background: '#f8f9fa', borderRadius: 16, width: 640, maxHeight: '90vh', overflow: 'auto', padding: 28, boxShadow: '0 8px 32px rgba(0,0,0,0.18)', fontFamily: "'Google Sans','Segoe UI',sans-serif" }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 20 }}>
          <h2 style={{ margin: 0, fontSize: 20, fontWeight: 700, color: '#202124' }}>Métricas de Pagos</h2>
          <button onClick={onClose} style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#5f6368' }}><X size={20} /></button>
        </div>
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16 }}>
          <MetricCard title="Totales" rows={[
            ['Total fuera', fmt(total), '#ea4335'],
            ['CxC totales', fmt(total)],
            ['Solo descontado', fmt(soloDescontado)],
          ]} />
          <MetricCard title="Recientes" rows={[
            ['CxC -3 meses', fmt(cxcRecientes)],
          ]} />
          <MetricCard title="Antiguos" rows={[
            ['CxC antiguas', fmt(cxcAntiguos)],
            ['CxC +3 meses reciente', fmt(cxcAntiguosRecientes)],
            ['CxC +3 meses', fmt(cxcAntiguos), '#ea4335'],
          ]} />
          <MetricCard title="DD" rows={[
            ['CxC antiguas', fmt(cxcDDAnt)],
            ['CxC recientes', fmt(cxcDDRec)],
          ]} />
          <MetricCard title="FD" rows={[
            ['CxC antiguas', fmt(cxcFDAnt)],
            ['CxC recientes', fmt(cxcFDRec)],
          ]} />
          {cxcNNAnt > 0 && (
            <MetricCard title="N/N" rows={[
              ['CxC antiguas', fmt(cxcNNAnt)],
            ]} />
          )}
        </div>
      </div>
    </div>
  );
}

// ─── Row ───────────────────────────────────────────────────────────────────────
function PagoRow({ pago, onUpdate, onDelete, onOpenNotes }) {
  const [confirmDelete, setConfirmDelete] = useState(false);
  const [hovered, setHovered] = useState(false);

  const update = async (field, value) => {
    const updates = { [field]: value };
    await supabase.from('pagos').update(updates).eq('id', pago.id);
    onUpdate({ ...pago, ...updates });
  };

  const ant = antiguedad(pago.fecha);
  const estadoStyle = ESTADO_COLORS[pago.estado] || {};
  const hasNotes = !!(pago.notas && pago.notas.trim());

  return (
    <tr style={{ background: hovered ? '#f8f9fa' : '#fff', transition: 'background 0.1s' }}
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}>
      <td style={s.td}><InlineText value={pago.propiedad} onChange={v => update('propiedad', v)} /></td>
      <td style={s.td}><InlineText value={pago.descripcion} onChange={v => update('descripcion', v)} /></td>
      <td style={s.tdCenter}><MoneyInput value={pago.cxc} onChange={v => update('cxc', v)} /></td>
      <td style={s.tdCenter}>
        <div style={{ display: 'inline-flex', alignItems: 'center', justifyContent: 'center', borderRadius: 20, padding: '2px 10px', fontSize: 11, fontWeight: 700, background: estadoStyle.bg, color: estadoStyle.color, minWidth: 32 }}>
          <InlineSelect value={pago.estado} options={ESTADO_OPTIONS} onChange={v => update('estado', v)} />
        </div>
      </td>
      <td style={s.tdCenter}><InlineSelect value={pago.orden} options={[]} onChange={() => {}} /></td>
      <td style={s.tdCenter}><DateCell value={pago.fecha} onChange={v => update('fecha', v)} /></td>
      <td style={s.tdCenter}><InlineSelect value={pago.pagado_por} options={PAGADO_POR_OPTIONS} onChange={v => update('pagado_por', v)} /></td>
      <td style={s.tdCenter}><InlineSelect value={pago.tipo} options={TIPO_OPTIONS} onChange={v => update('tipo', v)} /></td>
      <td style={s.tdCenter}><MoneyInput value={pago.comision} onChange={v => update('comision', v)} /></td>
      <td style={s.tdCenter}><DateCell value={pago.fecha_caja} onChange={v => update('fecha_caja', v)} /></td>
      <td style={{ ...s.tdCenter, fontSize: 11, fontWeight: 600, color: ant === '+ 3 meses' ? '#ea4335' : '#34a853', whiteSpace: 'nowrap' }}>{ant}</td>
      <td style={s.tdCenter}><InlineText value={pago.caja} onChange={v => update('caja', v)} /></td>
      <td style={s.tdActions}>
        <button onClick={() => onOpenNotes(pago)}
          style={{ ...s.actionBtn, background: hasNotes ? '#e8f0fe' : 'none', color: hasNotes ? '#1a73e8' : '#9aa0a6' }}
          title="Notas">
          <FileText size={13} />
        </button>
        {confirmDelete ? (
          <>
            <button onClick={async () => { await supabase.from('pagos').delete().eq('id', pago.id); onDelete(pago.id); }}
              style={{ ...s.actionBtn, background: '#fce8e6', color: '#ea4335' }} title="Confirmar">
              <Trash2 size={13} />
            </button>
            <button onClick={() => setConfirmDelete(false)} style={{ ...s.actionBtn, color: '#5f6368' }} title="Cancelar">
              <X size={12} />
            </button>
          </>
        ) : (
          <button onClick={() => setConfirmDelete(true)} style={{ ...s.actionBtn, color: '#9aa0a6' }} title="Eliminar">
            <Trash2 size={13} />
          </button>
        )}
      </td>
    </tr>
  );
}

// ─── New row ───────────────────────────────────────────────────────────────────
function NewPagoRow({ onSave, onCancel, maxPosition }) {
  const [form, setForm] = useState({
    propiedad: '', descripcion: '', cxc: '', estado: 'P',
    orden: '', fecha: today(), pagado_por: '', tipo: '',
    comision: '', fecha_caja: '', caja: '', notas: '',
  });

  const set = (k, v) => setForm(p => ({ ...p, [k]: v }));

  const handleSave = async () => {
    if (!form.propiedad.trim()) return;
    const { data } = await supabase.from('pagos').insert({
      propiedad: form.propiedad.trim(),
      descripcion: form.descripcion || null,
      cxc: parseCLP(form.cxc),
      estado: form.estado || null,
      orden: form.orden || null,
      fecha: form.fecha || today(),
      pagado_por: form.pagado_por || null,
      tipo: form.tipo || null,
      comision: parseCLP(form.comision),
      fecha_caja: form.fecha_caja || null,
      caja: form.caja || null,
      notas: form.notas || null,
      position: (maxPosition || 0) + 1,
    }).select().single();
    if (data) onSave(data);
  };

  return (
    <tr style={{ background: '#f0f7ff' }}>
      <td style={s.td}><input value={form.propiedad} onChange={e => set('propiedad', e.target.value)} placeholder="Propiedad *" style={inputStyle} /></td>
      <td style={s.td}><input value={form.descripcion} onChange={e => set('descripcion', e.target.value)} placeholder="Descripción" style={inputStyle} /></td>
      <td style={s.tdCenter}><MoneyInput value={form.cxc} onChange={v => set('cxc', v)} /></td>
      <td style={s.tdCenter}><select value={form.estado} onChange={e => set('estado', e.target.value)} style={selectStyle}>{ESTADO_OPTIONS.map(o => <option key={o}>{o}</option>)}</select></td>
      <td style={s.tdCenter}><input value={form.orden} onChange={e => set('orden', e.target.value)} style={{ ...inputStyle, width: 50 }} /></td>
      <td style={s.tdCenter}><input type="date" value={form.fecha} onChange={e => set('fecha', e.target.value)} style={{ ...inputStyle, colorScheme: 'light' }} /></td>
      <td style={s.tdCenter}><select value={form.pagado_por} onChange={e => set('pagado_por', e.target.value)} style={selectStyle}><option value="">—</option>{PAGADO_POR_OPTIONS.map(o => <option key={o}>{o}</option>)}</select></td>
      <td style={s.tdCenter}><select value={form.tipo} onChange={e => set('tipo', e.target.value)} style={selectStyle}><option value="">—</option>{TIPO_OPTIONS.map(o => <option key={o}>{o}</option>)}</select></td>
      <td style={s.tdCenter}><MoneyInput value={form.comision} onChange={v => set('comision', v)} /></td>
      <td style={s.tdCenter}><input type="date" value={form.fecha_caja} onChange={e => set('fecha_caja', e.target.value)} style={{ ...inputStyle, colorScheme: 'light' }} /></td>
      <td style={{ ...s.tdCenter, fontSize: 11, color: '#9aa0a6' }}>{form.fecha ? antiguedad(form.fecha) : '—'}</td>
      <td style={s.tdCenter}><input value={form.caja} onChange={e => set('caja', e.target.value)} style={{ ...inputStyle, width: 60 }} /></td>
      <td style={s.tdActions}>
        <button onClick={handleSave} style={{ ...s.actionBtn, background: '#e6f4ea', color: '#34a853' }} title="Guardar">✓</button>
        <button onClick={onCancel} style={{ ...s.actionBtn, color: '#5f6368' }} title="Cancelar"><X size={13} /></button>
      </td>
    </tr>
  );
}

const inputStyle = { border: '1px solid #dadce0', borderRadius: 5, padding: '3px 6px', fontSize: 12, outline: 'none', fontFamily: 'inherit', width: '100%' };
const selectStyle = { border: '1px solid #dadce0', borderRadius: 5, padding: '3px 4px', fontSize: 12, outline: 'none', fontFamily: 'inherit', background: '#fff' };

// ─── Main ──────────────────────────────────────────────────────────────────────
export default function PagosPage() {
  const [pagos, setPagos] = useState([]);
  const [loading, setLoading] = useState(true);
  const [addingNew, setAddingNew] = useState(false);
  const [notesFor, setNotesFor] = useState(null);
  const [showMetrics, setShowMetrics] = useState(false);
  const [filterPor, setFilterPor] = useState([]);
  const [filterEstado, setFilterEstado] = useState([]);

  const fetchPagos = useCallback(async () => {
    setLoading(true);
    let all = [];
    let from = 0;
    const PAGE = 1000;
    while (true) {
      const { data, error } = await supabase.from('pagos').select('*')
        .order('position', { ascending: false })
        .range(from, from + PAGE - 1);
      if (error || !data || data.length === 0) break;
      all = [...all, ...data];
      if (data.length < PAGE) break;
      from += PAGE;
    }
    setPagos(all);
    setLoading(false);
  }, []);

  useEffect(() => { fetchPagos(); }, [fetchPagos]);

  const filtered = useMemo(() => {
    let list = pagos;
    if (filterPor.length) list = list.filter(p => filterPor.includes(p.pagado_por));
    if (filterEstado.length) list = list.filter(p => filterEstado.includes(p.estado));
    return list;
  }, [pagos, filterPor, filterEstado]);

  const toggleFilter = (arr, setArr, val) => setArr(prev => prev.includes(val) ? prev.filter(x => x !== val) : [...prev, val]);

  const totalCxC = useMemo(() => filtered.reduce((s, p) => s + (p.cxc || 0), 0), [filtered]);

  const handleUpdate = (updated) => setPagos(prev => prev.map(p => p.id === updated.id ? updated : p));
  const handleDelete = (id) => setPagos(prev => prev.filter(p => p.id !== id));
  const handleSaveNew = (newPago) => { setPagos(prev => [newPago, ...prev]); setAddingNew(false); };

  const handleSaveNotes = async (id, notas) => {
    await supabase.from('pagos').update({ notas }).eq('id', id);
    setPagos(prev => prev.map(p => p.id === id ? { ...p, notas } : p));
  };

  const HEADERS = ['PROPIEDAD', 'DESCRIPCIÓN', 'CxC', 'ESTADO', 'ORDEN', 'FECHA', 'PAGADO POR', 'TIPO', 'COMISIÓN', 'FECHA CAJA', 'ANTIGÜEDAD', 'CAJA', ''];

  return (
    <div style={s.container}>
      {/* Header */}
      <div style={s.header}>
        <div>
          <h1 style={s.title}>Pagos</h1>
          <p style={s.subtitle}>{filtered.length} registros · Total CxC: <strong>{formatCLP(totalCxC)}</strong></p>
        </div>
        <div style={s.headerRight}>
          {/* Filtro por Pagado por */}
          <div style={s.filterGroup}>
            {PAGADO_POR_OPTIONS.map(v => (
              <button key={v} onClick={() => toggleFilter(filterPor, setFilterPor, v)}
                style={{ ...s.filterBtn, ...(filterPor.includes(v) ? s.filterBtnActive : {}) }}>{v}</button>
            ))}
          </div>
          {/* Filtro por Estado */}
          <div style={s.filterGroup}>
            {ESTADO_OPTIONS.map(v => (
              <button key={v} onClick={() => toggleFilter(filterEstado, setFilterEstado, v)}
                style={{ ...s.filterBtn, ...(filterEstado.includes(v) ? { ...s.filterBtnActive, background: (ESTADO_COLORS[v]?.bg || '#e8eaed'), color: (ESTADO_COLORS[v]?.color || '#202124'), borderColor: (ESTADO_COLORS[v]?.color || '#dadce0') } : {}) }}>{v}</button>
            ))}
          </div>
          {(filterPor.length > 0 || filterEstado.length > 0) && (
            <button onClick={() => { setFilterPor([]); setFilterEstado([]); }} style={s.clearFilter}>Limpiar</button>
          )}
          <button onClick={() => setShowMetrics(true)} style={s.metricsBtn}>
            <BarChart2 size={14} style={{ marginRight: 5 }} /> Métricas
          </button>
          <button onClick={() => setAddingNew(true)} disabled={addingNew} style={s.addBtn}>
            <Plus size={14} style={{ marginRight: 5 }} /> Nuevo pago
          </button>
        </div>
      </div>

      {/* Table */}
      <div style={s.tableWrapper}>
        {loading ? (
          <div style={s.loading}>Cargando pagos...</div>
        ) : (
          <table style={s.table}>
            <thead>
              <tr>{HEADERS.map((h, i) => <th key={i} style={{ ...s.th, textAlign: i < 2 ? 'left' : 'center' }}>{h}</th>)}</tr>
            </thead>
            <tbody>
              {addingNew && <NewPagoRow onSave={handleSaveNew} onCancel={() => setAddingNew(false)} maxPosition={pagos.length > 0 ? Math.max(...pagos.map(p => p.position || 0)) : 0} />}
              {filtered.length === 0 && !addingNew
                ? <tr><td colSpan={13} style={s.empty}>No hay pagos registrados.</td></tr>
                : filtered.map(p => (
                  <PagoRow key={p.id} pago={p} onUpdate={handleUpdate} onDelete={handleDelete} onOpenNotes={setNotesFor} />
                ))
              }
            </tbody>
          </table>
        )}
      </div>

      {/* Notes panel */}
      {notesFor && (
        <NotesPanel pago={notesFor} onClose={() => setNotesFor(null)} onSave={handleSaveNotes} />
      )}

      {/* Metrics */}
      {showMetrics && <MetricsView pagos={pagos} onClose={() => setShowMetrics(false)} />}
    </div>
  );
}

const s = {
  container: { height: '100%', display: 'flex', flexDirection: 'column', overflow: 'hidden', fontFamily: "'Google Sans','Segoe UI',sans-serif" },
  header: { display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 12, flexShrink: 0 },
  title: { fontSize: 24, fontWeight: 700, color: '#202124', margin: '0 0 4px' },
  subtitle: { fontSize: 13, color: '#5f6368', margin: 0 },
  headerRight: { display: 'flex', alignItems: 'center', gap: 10, flexWrap: 'wrap', justifyContent: 'flex-end' },
  filterGroup: { display: 'flex', gap: 4 },
  filterBtn: { padding: '5px 11px', borderRadius: 20, border: '1px solid #dadce0', background: '#fff', fontSize: 12, cursor: 'pointer', color: '#5f6368', fontFamily: 'inherit' },
  filterBtnActive: { background: '#e8f0fe', color: '#1a73e8', borderColor: '#1a73e8', fontWeight: 700 },
  clearFilter: { padding: '5px 10px', borderRadius: 20, border: 'none', background: 'none', fontSize: 12, cursor: 'pointer', color: '#ea4335', fontFamily: 'inherit' },
  metricsBtn: { display: 'flex', alignItems: 'center', padding: '8px 14px', background: '#fff', border: '1px solid #dadce0', color: '#3c4043', borderRadius: 8, fontSize: 13, cursor: 'pointer', fontFamily: 'inherit' },
  addBtn: { display: 'flex', alignItems: 'center', padding: '8px 16px', background: '#1a73e8', color: '#fff', border: 'none', borderRadius: 8, fontSize: 13, fontWeight: 500, cursor: 'pointer', fontFamily: 'inherit' },
  tableWrapper: { flex: 1, overflow: 'auto', border: '1px solid #e8eaed', borderRadius: 12, background: '#fff' },
  table: { width: 'max-content', minWidth: '100%', borderCollapse: 'collapse' },
  th: { padding: '10px 10px', background: '#f8f9fa', fontSize: 10, fontWeight: 700, color: '#5f6368', letterSpacing: 0.5, borderBottom: '2px solid #e8eaed', borderRight: '1px solid #e8eaed', position: 'sticky', top: 0, zIndex: 1, whiteSpace: 'nowrap' },
  td: { padding: '6px 10px', fontSize: 12, color: '#202124', borderBottom: '1px solid #e8eaed', borderRight: '1px solid #e8eaed', verticalAlign: 'middle', minWidth: 120 },
  tdCenter: { padding: '6px 8px', fontSize: 12, color: '#202124', borderBottom: '1px solid #e8eaed', borderRight: '1px solid #e8eaed', textAlign: 'center', verticalAlign: 'middle', whiteSpace: 'nowrap' },
  tdActions: { padding: '4px 6px', borderBottom: '1px solid #e8eaed', textAlign: 'center', verticalAlign: 'middle', whiteSpace: 'nowrap' },
  actionBtn: { background: 'none', border: 'none', cursor: 'pointer', padding: '3px 4px', borderRadius: 5, display: 'inline-flex', alignItems: 'center' },
  empty: { padding: 40, textAlign: 'center', color: '#9aa0a6', fontSize: 14 },
  loading: { padding: 40, textAlign: 'center', color: '#9aa0a6', fontSize: 14 },
};
