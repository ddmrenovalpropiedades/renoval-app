import React, { useState, useEffect, useCallback } from 'react';
import { supabase } from '../supabaseClient';
import { Plus, Edit2, Check, X, Home, Trash2 } from 'lucide-react';

// ── Helpers ──────────────────────────────────────────────────
const daysDiff = (dateStr) => {
  if (!dateStr) return null;
  const d = new Date(dateStr);
  const now = new Date();
  return Math.floor((now - d) / (1000 * 60 * 60 * 24));
};

const formatDate = (dateStr) => {
  if (!dateStr) return '';
  const [y, m, d] = dateStr.split('-');
  return `${d}/${m}/${y}`;
};

const EMPTY_FORM = {
  propiedad: '', precio: '', promo: '', status: '',
  destaque: '', e1: '', e2: '', db: '', eb: '',
  comuna: '', aviso: '', fecha_salida: '', tipo: '', admin: '',
};

// ── Cell styles ───────────────────────────────────────────────
const statusStyle = (val) => {
  if (!val) return {};
  const v = val.toUpperCase();
  if (v === 'PUBLICAR') return { background: '#FDD835', color: '#202124', fontWeight: 700, borderRadius: 4, padding: '2px 8px' };
  return {};
};

const avisoStyle = (val) => {
  if (val === 'Aún no') return { background: '#ea4335', color: '#fff', fontWeight: 600, borderRadius: 4, padding: '2px 8px', fontSize: 11 };
  if (val === 'Listo') return { color: '#34a853', fontWeight: 600, fontSize: 11 };
  return { fontSize: 11 };
};

const fechaSalidaStyle = (dateStr) => {
  const days = daysDiff(dateStr);
  if (days !== null && days >= 60) return { background: '#ea4335', color: '#fff', borderRadius: 4, padding: '2px 8px', fontSize: 11 };
  return { fontSize: 11 };
};

const destaqueStyle = (val) => {
  if (val === 'OP') return { background: '#FF8C00', color: '#fff', fontWeight: 700, borderRadius: 4, padding: '2px 8px', fontSize: 11 };
  return {};
};

const encargadoColors = { DD: '#1565C0', FD: '#2E7D32', EA: '#6A1B9A', FG: '#E65100' };
const BadgeE = ({ val }) => val ? (
  <span style={{ background: `${encargadoColors[val]}22`, color: encargadoColors[val], border: `1px solid ${encargadoColors[val]}44`, borderRadius: 20, padding: '1px 8px', fontSize: 11, fontWeight: 700 }}>{val}</span>
) : null;

// ── Inline Select ─────────────────────────────────────────────
const InlineSelect = ({ value, options, onChange, placeholder = '—' }) => (
  <select value={value || ''} onChange={e => onChange(e.target.value)}
    style={{ border: '1px solid #dadce0', borderRadius: 6, padding: '3px 6px', fontSize: 12, outline: 'none', fontFamily: 'inherit', background: '#fff', minWidth: 60 }}>
    <option value="">{placeholder}</option>
    {options.map(o => <option key={o} value={o}>{o}</option>)}
  </select>
);

const InlineInput = ({ value, onChange, placeholder = '', style = {} }) => (
  <input value={value || ''} onChange={e => onChange(e.target.value)}
    placeholder={placeholder}
    style={{ border: '1px solid #dadce0', borderRadius: 6, padding: '3px 6px', fontSize: 12, outline: 'none', fontFamily: 'inherit', width: '100%', ...style }} />
);

// ── Property Row ──────────────────────────────────────────────
function PropertyRow({ row, onSave, onDelete, onRented, isNew = false, onCancelNew }) {
  const [editing, setEditing] = useState(isNew);
  const [form, setForm] = useState({ ...EMPTY_FORM, ...row });
  const [saving, setSaving] = useState(false);
  const [confirmDelete, setConfirmDelete] = useState(false);

  const set = (k, v) => setForm(prev => ({ ...prev, [k]: v }));

  const handleSave = async () => {
    if (!form.propiedad.trim()) return;
    setSaving(true);
    await onSave(form);
    setSaving(false);
    setEditing(false);
    if (isNew && onCancelNew) onCancelNew();
  };

  const handleDelete = async () => {
    if (!confirmDelete) { setConfirmDelete(true); return; }
    await onDelete(row.id);
  };

  if (editing) {
    return (
      <tr style={styles.editRow}>
        <td style={styles.td}><InlineInput value={form.propiedad} onChange={v => set('propiedad', v)} placeholder="Dirección" /></td>
        <td style={styles.td}><InlineInput value={form.precio} onChange={v => set('precio', v)} placeholder="Precio" style={{ width: 90 }} /></td>
        <td style={styles.td}><InlineInput value={form.promo} onChange={v => set('promo', v)} placeholder="Promo" style={{ width: 80 }} /></td>
        <td style={styles.td}><InlineInput value={form.status} onChange={v => set('status', v)} placeholder="Status" style={{ width: 80 }} /></td>
        <td style={styles.tdCenter}><InlineSelect value={form.destaque} options={['OP']} onChange={v => set('destaque', v)} /></td>
        <td style={styles.tdCenter}><InlineSelect value={form.e1} options={['DD', 'FD']} onChange={v => set('e1', v)} /></td>
        <td style={styles.tdCenter}><InlineSelect value={form.e2} options={['EA', 'FG']} onChange={v => set('e2', v)} /></td>
        <td style={styles.tdCenter}><InlineInput value={form.db} onChange={v => set('db', v)} style={{ width: 55 }} /></td>
        <td style={styles.tdCenter}><InlineInput value={form.eb} onChange={v => set('eb', v)} style={{ width: 55 }} /></td>
        <td style={styles.td}><InlineInput value={form.comuna} onChange={v => set('comuna', v)} placeholder="Comuna" style={{ width: 100 }} /></td>
        <td style={styles.tdCenter}><InlineSelect value={form.aviso} options={['Aún no', 'Listo']} onChange={v => set('aviso', v)} /></td>
        <td style={styles.tdCenter}><input type="date" value={form.fecha_salida || ''} onChange={e => set('fecha_salida', e.target.value)} style={{ border: '1px solid #dadce0', borderRadius: 6, padding: '3px 4px', fontSize: 11, outline: 'none' }} /></td>
        <td style={styles.tdCenter}><InlineSelect value={form.tipo} options={['Nuevo', 'Renovación']} onChange={v => set('tipo', v)} /></td>
        <td style={styles.tdCenter}><InlineSelect value={form.admin} options={['Sí', 'No']} onChange={v => set('admin', v)} /></td>
        <td style={styles.tdActions}>
          <button onClick={handleSave} disabled={saving || !form.propiedad.trim()} style={styles.actionBtnGreen} title="Guardar">
            <Check size={14} />
          </button>
          <button onClick={() => { setEditing(false); if (isNew && onCancelNew) onCancelNew(); }} style={styles.actionBtnGray} title="Cancelar">
            <X size={14} />
          </button>
        </td>
      </tr>
    );
  }

  return (
    <tr style={styles.row}
      onMouseEnter={e => e.currentTarget.style.background = '#f0f4ff'}
      onMouseLeave={e => e.currentTarget.style.background = '#fff'}>
      <td style={styles.td}>{row.propiedad}</td>
      <td style={styles.td}>{row.precio}</td>
      <td style={styles.td}>{row.promo}</td>
      <td style={styles.td}><span style={statusStyle(row.status)}>{row.status}</span></td>
      <td style={styles.tdCenter}><span style={destaqueStyle(row.destaque)}>{row.destaque}</span></td>
      <td style={styles.tdCenter}><BadgeE val={row.e1} /></td>
      <td style={styles.tdCenter}><BadgeE val={row.e2} /></td>
      <td style={styles.tdCenter}>{row.db}</td>
      <td style={styles.tdCenter}>{row.eb}</td>
      <td style={styles.td}>{row.comuna}</td>
      <td style={styles.tdCenter}><span style={avisoStyle(row.aviso)}>{row.aviso}</span></td>
      <td style={styles.tdCenter}><span style={fechaSalidaStyle(row.fecha_salida)}>{formatDate(row.fecha_salida)}</span></td>
      <td style={styles.tdCenter}>{row.tipo}</td>
      <td style={styles.tdCenter}>{row.admin}</td>
      <td style={styles.tdActions}>
        <button onClick={() => setEditing(true)} style={styles.actionBtnGray} title="Editar"><Edit2 size={13} /></button>
        <button onClick={() => onRented(row)} style={styles.actionBtnBlue} title="Arrendar"><Home size={13} /></button>
        {confirmDelete ? (
          <>
            <button onClick={handleDelete} style={styles.actionBtnRed} title="Confirmar eliminar"><Trash2 size={13} /></button>
            <button onClick={() => setConfirmDelete(false)} style={styles.actionBtnGray} title="Cancelar"><X size={12} /></button>
          </>
        ) : (
          <button onClick={() => setConfirmDelete(true)} style={styles.actionBtnGray} title="Eliminar"><Trash2 size={13} /></button>
        )}
      </td>
    </tr>
  );
}

// ── Main page ─────────────────────────────────────────────────
export default function PizarraPage() {
  const [rows, setRows] = useState([]);
  const [loading, setLoading] = useState(true);
  const [addingNew, setAddingNew] = useState(false);

  const fetchRows = useCallback(async () => {
    setLoading(true);
    const { data } = await supabase.from('pizarra').select('*').order('position', { ascending: true }).order('created_at', { ascending: false });
    setRows(data || []);
    setLoading(false);
  }, []);

  useEffect(() => { fetchRows(); }, [fetchRows]);

  const handleSave = async (form) => {
    const payload = {
      propiedad: form.propiedad.trim(),
      precio: form.precio || null,
      promo: form.promo || null,
      status: form.status || null,
      destaque: form.destaque || null,
      e1: form.e1 || null,
      e2: form.e2 || null,
      db: form.db || null,
      eb: form.eb || null,
      comuna: form.comuna || null,
      aviso: form.aviso || null,
      fecha_salida: form.fecha_salida || null,
      tipo: form.tipo || null,
      admin: form.admin || null,
    };
    if (form.id) {
      await supabase.from('pizarra').update(payload).eq('id', form.id);
      setRows(prev => prev.map(r => r.id === form.id ? { ...r, ...payload } : r));
    } else {
      // New row — insert at top with lowest position
      const minPos = rows.length > 0 ? Math.min(...rows.map(r => r.position ?? 0)) - 1 : 0;
      const { data } = await supabase.from('pizarra').insert({ ...payload, position: minPos }).select().single();
      if (data) setRows(prev => [data, ...prev]);
      setAddingNew(false);
    }
  };

  const handleDelete = async (id) => {
    await supabase.from('pizarra').delete().eq('id', id);
    setRows(prev => prev.filter(r => r.id !== id));
  };

  const handleRented = async (row) => {
    // For now: remove from pizarra. Later: trigger tasks + arrendadas module
    await supabase.from('pizarra').delete().eq('id', row.id);
    setRows(prev => prev.filter(r => r.id !== row.id));
  };

  const HEADERS = ['PROPIEDAD','PRECIO','PROMO','STATUS','DESTAQUE','E1','E2','D/B','E/B','COMUNA','AVISO','FECHA SALIDA','TIPO','ADMIN',''];

  return (
    <div style={styles.container}>
      <div style={styles.header}>
        <div>
          <h1 style={styles.title}>Pizarra</h1>
          <p style={styles.subtitle}>{rows.length} propiedades disponibles</p>
        </div>
        <button onClick={() => setAddingNew(true)} style={styles.addBtn} disabled={addingNew}>
          <Plus size={16} style={{ marginRight: 6 }} /> Nueva propiedad
        </button>
      </div>

      <div style={styles.tableWrapper}>
        {loading ? (
          <div style={styles.loading}>Cargando pizarra...</div>
        ) : (
          <table style={styles.table}>
            <thead>
              <tr>
                {HEADERS.map((h, i) => (
                  <th key={i} style={{ ...styles.th, textAlign: ['PROPIEDAD','PRECIO','PROMO','STATUS','COMUNA'].includes(h) ? 'left' : 'center' }}>{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {addingNew && (
                <PropertyRow
                  row={EMPTY_FORM}
                  onSave={handleSave}
                  onDelete={() => {}}
                  onRented={() => {}}
                  isNew={true}
                  onCancelNew={() => setAddingNew(false)}
                />
              )}
              {rows.length === 0 && !addingNew ? (
                <tr><td colSpan={15} style={styles.empty}>No hay propiedades en la pizarra.</td></tr>
              ) : (
                rows.map(row => (
                  <PropertyRow
                    key={row.id}
                    row={row}
                    onSave={handleSave}
                    onDelete={handleDelete}
                    onRented={handleRented}
                  />
                ))
              )}
            </tbody>
          </table>
        )}
      </div>
    </div>
  );
}

const styles = {
  container: { height: '100%', display: 'flex', flexDirection: 'column', overflow: 'hidden', fontFamily: "'Google Sans', 'Segoe UI', sans-serif" },
  header: { display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 16, flexShrink: 0 },
  title: { fontSize: 24, fontWeight: 700, color: '#202124', margin: '0 0 4px' },
  subtitle: { fontSize: 14, color: '#5f6368', margin: 0 },
  addBtn: { display: 'flex', alignItems: 'center', padding: '9px 16px', background: '#1a73e8', color: '#fff', border: 'none', borderRadius: 8, fontSize: 14, fontWeight: 500, cursor: 'pointer', fontFamily: 'inherit' },
  tableWrapper: { flex: 1, overflow: 'auto', border: '1px solid #e8eaed', borderRadius: 12, background: '#fff' },
  table: { width: '100%', borderCollapse: 'collapse' },
  th: { padding: '10px 12px', background: '#f8f9fa', fontSize: 10, fontWeight: 700, color: '#5f6368', letterSpacing: 0.5, borderBottom: '2px solid #e8eaed', borderRight: '1px solid #e8eaed', position: 'sticky', top: 0, zIndex: 1, whiteSpace: 'nowrap' },
  row: { background: '#fff', transition: 'background 0.1s' },
  editRow: { background: '#f0f7ff' },
  td: { padding: '8px 12px', fontSize: 12, color: '#202124', borderBottom: '1px solid #f1f3f4', borderRight: '1px solid #f1f3f4', verticalAlign: 'middle' },
  tdCenter: { padding: '6px 8px', fontSize: 12, color: '#202124', borderBottom: '1px solid #f1f3f4', borderRight: '1px solid #f1f3f4', textAlign: 'center', verticalAlign: 'middle' },
  tdActions: { padding: '4px 8px', borderBottom: '1px solid #f1f3f4', textAlign: 'center', verticalAlign: 'middle', whiteSpace: 'nowrap' },
  actionBtnGray: { background: 'none', border: 'none', cursor: 'pointer', padding: '4px 5px', borderRadius: 6, display: 'inline-flex', color: '#5f6368' },
  actionBtnGreen: { background: '#e6f4ea', border: 'none', cursor: 'pointer', padding: '4px 5px', borderRadius: 6, display: 'inline-flex', color: '#34a853' },
  actionBtnBlue: { background: '#e8f0fe', border: 'none', cursor: 'pointer', padding: '4px 5px', borderRadius: 6, display: 'inline-flex', color: '#1a73e8' },
  actionBtnRed: { background: '#fce8e6', border: 'none', cursor: 'pointer', padding: '4px 5px', borderRadius: 6, display: 'inline-flex', color: '#ea4335' },
  empty: { padding: 40, textAlign: 'center', color: '#9aa0a6', fontSize: 14 },
  loading: { padding: 40, textAlign: 'center', color: '#9aa0a6', fontSize: 14 },
};
