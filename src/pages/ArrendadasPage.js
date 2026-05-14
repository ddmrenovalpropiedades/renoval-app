import React, { useState, useEffect, useCallback } from 'react';
import { supabase } from '../supabaseClient';
import { ChevronLeft, ChevronRight, Save } from 'lucide-react';

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
  <select value={value || 'Pendiente'} onChange={e => onChange(e.target.value)}
    style={{
      border: 'none', outline: 'none', fontFamily: 'inherit',
      fontSize: 11, fontWeight: 600, cursor: 'pointer',
      background: 'transparent',
      color: value === 'Listo' ? '#34a853' : '#ea4335',
    }}>
    {ESTADO_OPTIONS.map(o => <option key={o} value={o}>{o}</option>)}
  </select>
);

function ArrendadaRow({ row, onUpdate }) {
  const [edits, setEdits] = useState({});
  const hasEdits = Object.keys(edits).length > 0;
  const merged = { ...row, ...edits };

  const set = (k, v) => setEdits(prev => ({ ...prev, [k]: v }));

  const handleSave = async () => {
    await supabase.from('arrendadas').update(edits).eq('id', row.id);
    onUpdate(row.id, edits);
    setEdits({});
  };

  const handleEstado = async (k, v) => {
    set(k, v);
    await supabase.from('arrendadas').update({ [k]: v }).eq('id', row.id);
    onUpdate(row.id, { [k]: v });
    setEdits(prev => { const n = { ...prev }; delete n[k]; return n; });
  };

  return (
    <tr style={{ background: '#fff', borderBottom: '1px solid #f1f3f4' }}
      onMouseEnter={e => e.currentTarget.style.background = '#f8f9fa'}
      onMouseLeave={e => e.currentTarget.style.background = '#fff'}>
      <td style={styles.td}>{row.propiedad}</td>
      <td style={styles.tdCenter}>{formatCLP(row.arriendo)}</td>
      <td style={styles.tdCenter}>
        <input value={edits.comision ?? (row.comision || '')}
          onChange={e => set('comision', e.target.value)}
          style={styles.inlineInput} placeholder="$" />
      </td>
      <td style={styles.tdCenter}>{row.tipo}</td>
      <td style={styles.tdCenter}>{row.admin}</td>
      <td style={styles.tdCenter}><BadgeE val={row.e1} /></td>
      <td style={styles.tdCenter}><BadgeE val={row.e2} /></td>
      <td style={styles.tdCenter}>
        {row.entrega ? new Date(row.entrega + 'T12:00:00').toLocaleDateString('es-CL') : ''}
      </td>
      <td style={styles.tdCenter}><EstadoCell value={merged.contrato} onChange={v => handleEstado('contrato', v)} /></td>
      <td style={styles.tdCenter}><EstadoCell value={merged.liquidacion} onChange={v => handleEstado('liquidacion', v)} /></td>
      <td style={styles.tdCenter}>
        {row.fecha_gar ? new Date(row.fecha_gar + 'T12:00:00').toLocaleDateString('es-CL') : ''}
      </td>
      <td style={styles.tdCenter}><EstadoCell value={merged.dev_gar} onChange={v => handleEstado('dev_gar', v)} /></td>
      <td style={styles.tdCenter}><EstadoCell value={merged.cuentas} onChange={v => handleEstado('cuentas', v)} /></td>
      <td style={styles.tdCenter}>{row.promocion ? formatCLP(row.promocion) : ''}</td>
      <td style={styles.tdCenter}>{row.meses}</td>
      <td style={styles.tdActions}>
        {hasEdits && (
          <button onClick={handleSave} style={styles.saveBtn} title="Guardar">
            <Save size={13} />
          </button>
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

  const mesIdx = meses.indexOf(currentMes);
  const canPrev = mesIdx < meses.length - 1;
  const canNext = mesIdx > 0;

  // Total comisiones
  const totalComisiones = rows.reduce((sum, r) => {
    const n = parseNumeric(r.comision);
    return sum + (n || 0);
  }, 0);

  const HEADERS = ['PROPIEDAD','ARRIENDO','COMISION','TIPO','ADMIN','E1','E2','ENTREGA','CONTRATO','LIQUIDACION','FECHA GAR','DEV GAR','CUENTAS','PROMOCION','MESES',''];

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
                  <th key={i} style={{ ...styles.th, textAlign: h === 'PROPIEDAD' ? 'left' : 'center' }}>{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {rows.length === 0 ? (
                <tr><td colSpan={16} style={styles.empty}>No hay propiedades arrendadas en {formatMes(currentMes || '2026-05')}.</td></tr>
              ) : (
                rows.map(row => (
                  <ArrendadaRow key={row.id} row={row} onUpdate={handleUpdate} />
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
  th: { padding: '10px 10px', background: '#f8f9fa', fontSize: 10, fontWeight: 700, color: '#5f6368', letterSpacing: 0.5, borderBottom: '2px solid #e8eaed', borderRight: '1px solid #e8eaed', position: 'sticky', top: 0, zIndex: 1, whiteSpace: 'nowrap' },
  td: { padding: '8px 10px', fontSize: 12, color: '#202124', borderBottom: '1px solid #f1f3f4', borderRight: '1px solid #f1f3f4', verticalAlign: 'middle' },
  tdCenter: { padding: '6px 8px', fontSize: 12, color: '#202124', borderBottom: '1px solid #f1f3f4', borderRight: '1px solid #f1f3f4', textAlign: 'center', verticalAlign: 'middle' },
  tdActions: { padding: '4px 6px', borderBottom: '1px solid #f1f3f4', textAlign: 'center', verticalAlign: 'middle' },
  inlineInput: { border: '1px solid #dadce0', borderRadius: 6, padding: '3px 6px', fontSize: 12, outline: 'none', fontFamily: 'inherit', width: 80, textAlign: 'center' },
  saveBtn: { background: '#e8f0fe', border: 'none', borderRadius: 6, padding: '4px 8px', cursor: 'pointer', color: '#1a73e8', display: 'inline-flex', alignItems: 'center' },
  empty: { padding: 40, textAlign: 'center', color: '#9aa0a6', fontSize: 14 },
  loading: { padding: 40, textAlign: 'center', color: '#9aa0a6', fontSize: 14 },
  totalsRow: { display: 'flex', alignItems: 'center', gap: 16, padding: '10px 16px', marginTop: 8, background: '#fff', border: '1px solid #e8eaed', borderRadius: 10, flexShrink: 0 },
  totalsLabel: { fontSize: 14, fontWeight: 700, color: '#5f6368', letterSpacing: 0.8 },
  totalsValue: { fontSize: 17, fontWeight: 700, color: '#202124' },
};
