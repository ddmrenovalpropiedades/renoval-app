import React, { useState, useEffect, useCallback } from 'react';
import { supabase } from '../supabaseClient';
import { ChevronLeft, ChevronRight, Save, Edit2, Trash2, Check, X } from 'lucide-react';

const MESES_ES = ['Enero','Febrero','Marzo','Abril','Mayo','Junio','Julio','Agosto','Septiembre','Octubre','Noviembre','Diciembre'];

const formatMes = (mes) => {
  const [y, m] = mes.split('-');
  return `${MESES_ES[parseInt(m) - 1]} ${y}`;
};

const formatCLP = (val) => {
  if (!val) return '';
  const n = parseFloat(String(val).replace(/[$.]/g, '').replace(',', '.'));
  if (isNaN(n)) return val;
  return '$' + Math.round(n).toLocaleString('es-CL');
};

const parseNumeric = (val) => {
  if (!val) return null;
  const n = parseFloat(String(val).replace(/[$.]/g, '').replace(',', '.'));
  return isNaN(n) ? null : n;
};

const ESTADO_OPTIONS = ['Pendiente', 'Listo'];
const ENCARGADO_COLORS = { DD: '#1565C0', FD: '#2E7D32', EA: '#6A1B9A', FG: '#E65100' };

const BadgeE = ({ val }) => val ? (
  <span style={{ background: `${ENCARGADO_COLORS[val] || '#9aa0a6'}22`, color: ENCARGADO_COLORS[val] || '#9aa0a6', border: `1px solid ${ENCARGADO_COLORS[val] || '#9aa0a6'}44`, borderRadius: 20, padding: '1px 8px', fontSize: 11, fontWeight: 700 }}>{val}</span>
) : null;

const EstadoCell = ({ value, onChange }) => (
  <div style={{ position: 'relative' }}>
    <select value={value || 'Pendiente'} onChange={e => onChange(e.target.value)}
      style={{
        border: 'none', outline: 'none', fontFamily: 'inherit',
        fontSize: 11, fontWeight: 600, cursor: 'pointer',
        background: 'transparent',
        color: value === 'Listo' ? '#34a853' : '#ea4335',
        WebkitAppearance: 'menulist',
      }}>
      {ESTADO_OPTIONS.map(o => <option key={o} value={o} style={{ color: '#202124', fontWeight: 400 }}>{o}</option>)}
    </select>
  </div>
);

const E1_OPTS = ['DD','FD'];
const E2_OPTS = ['EA','FG'];

// Money input: shows $ prefix, cursor after $, live thousands
function MoneyInput({ value, onChange, readOnly = false }) {
  const [editing, setEditing] = useState(false);
  const [raw, setRaw] = useState('');
  const displayVal = value ? formatCLP(value) : '';
  if (readOnly) return <span style={{ fontSize: 12 }}>{displayVal}</span>;

  const handleChange = (e) => {
    const digits = e.target.value.replace(/[^0-9]/g, '');
    setRaw(digits);
  };

  if (editing) {
    return (
      <div style={{ display: 'flex', alignItems: 'center', border: '1px solid #1a73e8', borderRadius: 6, padding: '2px 4px', background: '#fff' }}>
        <span style={{ fontSize: 12, color: '#5f6368', marginRight: 1 }}>$</span>
        <input autoFocus
          value={raw ? parseInt(raw).toLocaleString('es-CL') : ''}
          onChange={handleChange}
          onBlur={() => { setEditing(false); if (raw) onChange(raw); }}
          onKeyDown={e => e.key === 'Enter' && e.target.blur()}
          style={{ border: 'none', outline: 'none', width: 80, fontSize: 12, fontFamily: 'inherit' }} />
      </div>
    );
  }
  return (
    <div onClick={() => { setRaw(value ? String(value).replace(/[^0-9]/g,'') : ''); setEditing(true); }}
      style={{ cursor: 'text', fontSize: 12, minWidth: 60, padding: '2px 4px', borderRadius: 6 }}>
      {displayVal || <span style={{ color: '#dadce0' }}>$</span>}
    </div>
  );
}

const TIPO_OPTS = ['Nuevo','Renovación'];
const ADMIN_OPTS = ['Sí','No'];

function ArrendadaRow({ row, onUpdate, onDelete }) {
  const [editing, setEditing] = useState(false);
  const [form, setForm] = useState({ ...row });
  const [edits, setEdits] = useState({});
  const [confirmDelete, setConfirmDelete] = useState(false);
  const merged = { ...row, ...edits };

  const set = (k, v) => setEdits(prev => ({ ...prev, [k]: v }));

  const handleSave = async () => {
    await supabase.from('arrendadas').update(edits).eq('id', row.id);
    onUpdate(row.id, edits);
    setEdits({});
  };

  const handleEditSave = async () => {
    await supabase.from('arrendadas').update(form).eq('id', row.id);
    onUpdate(row.id, form);
    setEditing(false);
  };

  const handleEstado = async (k, v) => {
    await supabase.from('arrendadas').update({ [k]: v }).eq('id', row.id);
    onUpdate(row.id, { [k]: v });
  };

  const handleDelete = async () => {
    if (!confirmDelete) { setConfirmDelete(true); return; }
    await onDelete(row.id);
  };

  const InlineInput = ({ field, style = {} }) => (
    <input value={form[field] || ''} onChange={e => setForm(p => ({...p, [field]: e.target.value}))}
      style={{ border: '1px solid #dadce0', borderRadius: 6, padding: '3px 6px', fontSize: 12, outline: 'none', fontFamily: 'inherit', width: '100%', ...style }} />
  );
  const InlineSel = ({ field, opts }) => (
    <select value={form[field] || ''} onChange={e => setForm(p => ({...p, [field]: e.target.value}))}
      style={{ border: '1px solid #dadce0', borderRadius: 6, padding: '3px 6px', fontSize: 12, outline: 'none', fontFamily: 'inherit', background: '#fff', width: '100%' }}>
      <option value="">—</option>
      {opts.map(o => <option key={o} value={o}>{o}</option>)}
    </select>
  );

  if (editing) {
    return (
      <tr style={{ background: '#f0f7ff', borderBottom: '1px solid #e8eaed' }}>
        <td style={styles.td}><InlineInput field="propiedad" /></td>
        <td style={styles.tdCenter}><InlineInput field="arriendo" style={{ width: 80 }} /></td>
        <td style={styles.tdCenter}><InlineInput field="comision" style={{ width: 80 }} /></td>
        <td style={styles.tdCenter}><InlineSel field="tipo" opts={TIPO_OPTS} /></td>
        <td style={styles.tdCenter}><InlineSel field="admin" opts={ADMIN_OPTS} /></td>
        <td style={styles.tdCenter}><InlineSel field="e1" opts={E1_OPTS} /></td>
        <td style={styles.tdCenter}><InlineSel field="e2" opts={E2_OPTS} /></td>
        <td style={styles.tdCenter}><input type="date" value={form.entrega || ''} onChange={e => setForm(p => ({...p, entrega: e.target.value}))} style={{ border: '1px solid #dadce0', borderRadius: 6, padding: '3px 4px', fontSize: 11, outline: 'none' }} /></td>
        <td style={styles.tdCenter}><EstadoCell value={form.contrato} onChange={v => setForm(p => ({...p, contrato: v}))} /></td>
        <td style={styles.tdCenter}><EstadoCell value={form.liquidacion} onChange={v => setForm(p => ({...p, liquidacion: v}))} /></td>
        <td style={styles.tdCenter}><input type="date" value={form.fecha_gar || ''} onChange={e => setForm(p => ({...p, fecha_gar: e.target.value}))} style={{ border: '1px solid #dadce0', borderRadius: 6, padding: '3px 4px', fontSize: 11, outline: 'none' }} /></td>
        <td style={styles.tdCenter}><EstadoCell value={form.dev_gar} onChange={v => setForm(p => ({...p, dev_gar: v}))} /></td>
        <td style={styles.tdCenter}><EstadoCell value={form.cuentas} onChange={v => setForm(p => ({...p, cuentas: v}))} /></td>
        <td style={styles.tdCenter}><InlineInput field="promocion" style={{ width: 70 }} /></td>
        <td style={styles.tdCenter}><InlineInput field="meses" /></td>
        <td style={styles.tdActions}>
          <button onClick={handleEditSave} style={styles.actionBtnGreen} title="Guardar"><Check size={13} /></button>
          <button onClick={() => setEditing(false)} style={styles.actionBtnGray} title="Cancelar"><X size={13} /></button>
        </td>
      </tr>
    );
  }

  return (
    <tr style={{ background: '#fff', borderBottom: '1px solid #f1f3f4' }}
      onMouseEnter={e => e.currentTarget.style.background = '#f8f9fa'}
      onMouseLeave={e => e.currentTarget.style.background = '#fff'}>
      <td style={styles.td}>{row.propiedad}</td>
      <td style={styles.tdCenter}><MoneyInput value={row.arriendo || ''} onChange={v => {}} readOnly /></td>
      <td style={styles.tdCenter}>
        <MoneyInput
          value={edits.comision !== undefined ? edits.comision : (row.comision || '')}
          onChange={v => set('comision', v)}
        />
      </td>
      <td style={styles.tdCenter}>{row.tipo}</td>
      <td style={styles.tdCenter}>{row.admin}</td>
      <td style={styles.tdCenter}><BadgeE val={row.e1} /></td>
      <td style={styles.tdCenter}><BadgeE val={row.e2} /></td>
      <td style={styles.tdCenter}>{row.entrega ? new Date(row.entrega + 'T12:00:00').toLocaleDateString('es-CL') : ''}</td>
      <td style={styles.tdCenter}><EstadoCell value={merged.contrato} onChange={v => handleEstado('contrato', v)} /></td>
      <td style={styles.tdCenter}><EstadoCell value={merged.liquidacion} onChange={v => handleEstado('liquidacion', v)} /></td>
      <td style={styles.tdCenter}>{row.fecha_gar ? new Date(row.fecha_gar + 'T12:00:00').toLocaleDateString('es-CL') : ''}</td>
      <td style={styles.tdCenter}><EstadoCell value={merged.dev_gar} onChange={v => handleEstado('dev_gar', v)} /></td>
      <td style={styles.tdCenter}><EstadoCell value={merged.cuentas} onChange={v => handleEstado('cuentas', v)} /></td>
      <td style={styles.tdCenter}>{row.promocion ? formatCLP(row.promocion) : ''}</td>
      <td style={styles.tdCenter}>{row.meses}</td>
      <td style={styles.tdActions}>
        {Object.keys(edits).length > 0 && (
          <button onClick={handleSave} style={styles.saveBtn} title="Guardar comisión"><Save size={13} /></button>
        )}
        <button onClick={() => { setForm({...row}); setEditing(true); }} style={styles.actionBtnGray} title="Editar"><Edit2 size={13} /></button>
        {confirmDelete ? (
          <>
            <button onClick={handleDelete} style={styles.actionBtnRed} title="Confirmar"><Trash2 size={13} /></button>
            <button onClick={() => setConfirmDelete(false)} style={styles.actionBtnGray} title="Cancelar"><X size={12} /></button>
          </>
        ) : (
          <button onClick={() => setConfirmDelete(true)} style={styles.actionBtnGray} title="Eliminar"><Trash2 size={13} /></button>
        )}
      </td>
    </tr>
  );
}

export default function ArrendadasPage() {
  const [meses, setMeses] = useState([]);
  const [currentMes, setCurrentMes] = useState('');
  const [rows, setRows] = useState([]);
  const [loading, setLoading] = useState(true);

  const fetchMeses = useCallback(async () => {
    const { data } = await supabase.from('arrendadas_meses').select('mes').order('mes', { ascending: false });
    const list = (data || []).map(d => d.mes);
    setMeses(list);
    if (list.length > 0 && !currentMes) setCurrentMes(list[0]);
  }, [currentMes]);

  const fetchRows = useCallback(async () => {
    if (!currentMes) return;
    setLoading(true);
    const { data } = await supabase.from('arrendadas').select('*')
      .eq('mes', currentMes).order('position', { ascending: true }).order('created_at', { ascending: false });
    setRows(data || []);
    setLoading(false);
  }, [currentMes]);

  useEffect(() => { fetchMeses(); }, [fetchMeses]);
  useEffect(() => { fetchRows(); }, [fetchRows]);

  const handleUpdate = (id, updates) => {
    setRows(prev => prev.map(r => r.id === id ? { ...r, ...updates } : r));
  };

  const handleDelete = async (id) => {
    await supabase.from('arrendadas').delete().eq('id', id);
    setRows(prev => prev.filter(r => r.id !== id));
  };

  const mesIdx = meses.indexOf(currentMes);
  const canPrev = mesIdx < meses.length - 1;
  const canNext = mesIdx > 0;

  // Total comisiones
  const totalComisiones = rows.reduce((sum, r) => {
    const n = parseNumeric(r.comision);
    return sum + (n || 0);
  }, 0);

  const HEADERS = ['PROPIEDAD','ARRIENDO','COMISION','TIPO','ADMIN','E1','E2','ENTREGA','CONTRATO','LIQUIDACION','FECHA GAR','DEV GAR','CUENTAS','PROMOCION','MESES',''];
  const WIDE_HEADERS = ['CONTRATO','LIQUIDACION','DEV GAR','CUENTAS','ENTREGA','FECHA GAR'];

  return (
    <div style={styles.container}>
      {/* Header */}
      <div style={styles.header}>
        <div>
          <h1 style={styles.title}>Propiedades Arrendadas</h1>
          <p style={styles.subtitle}>{rows.length} propiedades · {formatMes(currentMes || '2026-05')}</p>
        </div>
        {/* Month navigation */}
        <div style={styles.monthNav}>
          <button onClick={() => setCurrentMes(meses[mesIdx + 1])} disabled={!canPrev} style={styles.navBtn}>
            <ChevronLeft size={18} />
          </button>
          <span style={styles.monthLabel}>{currentMes ? formatMes(currentMes) : ''}</span>
          <button onClick={() => setCurrentMes(meses[mesIdx - 1])} disabled={!canNext} style={styles.navBtn}>
            <ChevronRight size={18} />
          </button>
        </div>
      </div>

      {/* Table */}
      <div style={styles.tableWrapper}>
        {loading ? (
          <div style={styles.loading}>Cargando...</div>
        ) : (
          <table style={styles.table}>
            <thead>
              <tr>
                {HEADERS.map((h, i) => (
                  <th key={i} style={{ ...(WIDE_HEADERS.includes(h) ? styles.thWide : styles.th), textAlign: h === 'PROPIEDAD' ? 'left' : 'center' }}>{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {rows.length === 0 ? (
                <tr><td colSpan={16} style={styles.empty}>No hay propiedades arrendadas en {formatMes(currentMes || '2026-05')}.</td></tr>
              ) : (
                rows.map(row => (
                  <ArrendadaRow key={row.id} row={row} onUpdate={handleUpdate} onDelete={handleDelete} />
                ))
              )}
            </tbody>
          </table>
        )}
      </div>

      {/* Totals */}
      <div style={styles.totalsRow}>
        <span style={styles.totalsLabel}>TOTAL COMISIONES</span>
        <span style={styles.totalsValue}>{formatCLP(totalComisiones)}</span>
      </div>
    </div>
  );
}

const styles = {
  container: { height: '100%', display: 'flex', flexDirection: 'column', overflow: 'hidden', fontFamily: "'Google Sans', 'Segoe UI', sans-serif" },
  header: { display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 12, flexShrink: 0 },
  title: { fontSize: 24, fontWeight: 700, color: '#202124', margin: '0 0 4px' },
  subtitle: { fontSize: 14, color: '#5f6368', margin: 0 },
  monthNav: { display: 'flex', alignItems: 'center', gap: 8, background: '#fff', border: '1px solid #e8eaed', borderRadius: 10, padding: '6px 12px' },
  monthLabel: { fontSize: 15, fontWeight: 600, color: '#202124', minWidth: 140, textAlign: 'center' },
  navBtn: { background: 'none', border: 'none', cursor: 'pointer', padding: 4, display: 'flex', alignItems: 'center', color: '#5f6368', borderRadius: 6, ':disabled': { opacity: 0.3 } },
  tableWrapper: { flex: 1, overflow: 'auto', border: '1px solid #e8eaed', borderRadius: 12, background: '#fff' },
  table: { width: '100%', borderCollapse: 'collapse' },
  th: { padding: '10px 10px', background: '#f8f9fa', fontSize: 10, fontWeight: 700, color: '#5f6368', letterSpacing: 0.5, borderBottom: '2px solid #e8eaed', borderRight: '1px solid #d0d5dd', position: 'sticky', top: 0, zIndex: 1, whiteSpace: 'nowrap' },
  thWide: { padding: '10px 16px', minWidth: 75, background: '#f8f9fa', fontSize: 10, fontWeight: 700, color: '#5f6368', letterSpacing: 0.5, borderBottom: '2px solid #e8eaed', borderRight: '1px solid #d0d5dd', position: 'sticky', top: 0, zIndex: 1, whiteSpace: 'nowrap', textAlign: 'center' },
  td: { padding: '8px 10px', fontSize: 12, color: '#202124', borderBottom: '1px solid #d0d5dd', borderRight: '1px solid #d0d5dd', verticalAlign: 'middle' },
  tdCenter: { padding: '6px 8px', fontSize: 12, color: '#202124', borderBottom: '1px solid #d0d5dd', borderRight: '1px solid #d0d5dd', textAlign: 'center', verticalAlign: 'middle' },
  tdActions: { padding: '4px 6px', borderBottom: '1px solid #f1f3f4', textAlign: 'center', verticalAlign: 'middle' },
  inlineInput: { border: '1px solid #dadce0', borderRadius: 6, padding: '3px 6px', fontSize: 12, outline: 'none', fontFamily: 'inherit', width: 80, textAlign: 'center' },
  saveBtn: { background: '#e8f0fe', border: 'none', borderRadius: 6, padding: '4px 8px', cursor: 'pointer', color: '#1a73e8', display: 'inline-flex', alignItems: 'center' },
  actionBtnGray:  { background: 'none', border: 'none', cursor: 'pointer', padding: '3px 4px', borderRadius: 5, display: 'inline-flex', color: '#5f6368' },
  actionBtnGreen: { background: '#e6f4ea', border: 'none', cursor: 'pointer', padding: '3px 4px', borderRadius: 5, display: 'inline-flex', color: '#34a853' },
  actionBtnRed:   { background: '#fce8e6', border: 'none', cursor: 'pointer', padding: '3px 4px', borderRadius: 5, display: 'inline-flex', color: '#ea4335' },
  empty: { padding: 40, textAlign: 'center', color: '#9aa0a6', fontSize: 14 },
  loading: { padding: 40, textAlign: 'center', color: '#9aa0a6', fontSize: 14 },
  totalsRow: { display: 'flex', alignItems: 'center', gap: 16, padding: '10px 16px', marginTop: 8, background: '#fff', border: '1px solid #e8eaed', borderRadius: 10, flexShrink: 0 },
  totalsLabel: { fontSize: 14, fontWeight: 700, color: '#5f6368', letterSpacing: 0.8 },
  totalsValue: { fontSize: 17, fontWeight: 700, color: '#202124' },
};
