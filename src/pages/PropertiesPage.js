import React, { useState, useEffect, useMemo } from 'react';
import { supabase } from '../supabaseClient';
import { useAuth } from '../context/AuthContext';
import { Plus, Search, Edit2, X, Check, Users } from 'lucide-react';

const ENCARGADOS = ['DD', 'FD', 'EA', 'FG', 'AM'];
const ENCARGADO_COLORS = {
  DD: '#1565C0', FD: '#2E7D32', EA: '#6A1B9A', FG: '#E65100', AM: '#37474F'
};

function Badge({ value }) {
  if (!value) return null;
  return (
    <span style={{
      display: 'inline-block',
      background: `${ENCARGADO_COLORS[value] || '#9aa0a6'}22`,
      color: ENCARGADO_COLORS[value] || '#9aa0a6',
      border: `1px solid ${ENCARGADO_COLORS[value] || '#9aa0a6'}44`,
      borderRadius: 20, padding: '2px 10px',
      fontSize: 12, fontWeight: 700,
    }}>{value}</span>
  );
}

function PropertyModal({ property, onClose, onSave }) {
  const [form, setForm] = useState({
    propiedad: property?.propiedad || '',
    propietario: property?.propietario || '',
    e1: property?.e1 || '',
    e2: property?.e2 || '',
  });
  const [saving, setSaving] = useState(false);

  const handleSave = async () => {
    if (!form.propiedad.trim()) return;
    setSaving(true);
    await onSave(form);
    setSaving(false);
    onClose();
  };

  return (
    <div style={styles.modalOverlay} onClick={e => e.target === e.currentTarget && onClose()}>
      <div style={styles.modal}>
        <div style={styles.modalHeader}>
          <h3 style={styles.modalTitle}>{property ? 'Editar propiedad' : 'Nueva propiedad'}</h3>
          <button onClick={onClose} style={styles.modalClose}><X size={18} color="#5f6368" /></button>
        </div>
        <div style={styles.modalBody}>
          <div style={styles.field}>
            <label style={styles.label}>Propiedad *</label>
            <input value={form.propiedad} onChange={e => setForm({...form, propiedad: e.target.value})}
              placeholder="Dirección completa" style={styles.input} autoFocus />
          </div>
          <div style={styles.field}>
            <label style={styles.label}>Propietario</label>
            <input value={form.propietario} onChange={e => setForm({...form, propietario: e.target.value})}
              placeholder="Nombre del propietario" style={styles.input} />
          </div>
          <div style={styles.fieldRow}>
            <div style={styles.fieldHalf}>
              <label style={styles.label}>Encargado 1 (pagos/dueño)</label>
              <select value={form.e1} onChange={e => setForm({...form, e1: e.target.value})} style={styles.select}>
                <option value="">— Sin asignar —</option>
                {ENCARGADOS.map(e => <option key={e} value={e}>{e}</option>)}
              </select>
            </div>
            <div style={styles.fieldHalf}>
              <label style={styles.label}>Encargado 2 (arriendo)</label>
              <select value={form.e2} onChange={e => setForm({...form, e2: e.target.value})} style={styles.select}>
                <option value="">— Sin asignar —</option>
                {ENCARGADOS.map(e => <option key={e} value={e}>{e}</option>)}
              </select>
            </div>
          </div>
        </div>
        <div style={styles.modalFooter}>
          <button onClick={handleSave} disabled={saving || !form.propiedad.trim()} style={{
            ...styles.saveBtn,
            ...(!form.propiedad.trim() ? styles.saveBtnDisabled : {})
          }}>
            <Check size={15} style={{ marginRight: 6 }} />
            {saving ? 'Guardando...' : 'Guardar'}
          </button>
          <button onClick={onClose} style={styles.cancelBtn}>Cancelar</button>
        </div>
      </div>
    </div>
  );
}

export default function PropertiesPage() {
  const { profile } = useAuth();
  const [properties, setProperties] = useState([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [filterE, setFilterE] = useState([]);
  const [showModal, setShowModal] = useState(false);
  const [editingProp, setEditingProp] = useState(null);
  const [showCounters, setShowCounters] = useState(false);
  const isOwner = profile?.isOwner;

  useEffect(() => { fetchProperties(); }, []);

  const fetchProperties = async () => {
    setLoading(true);
    const { data } = await supabase.from('properties').select('*').order('propiedad', { ascending: true });
    setProperties(data || []);
    setLoading(false);
  };

  const filtered = useMemo(() => {
    let result = properties;
    if (search.trim()) {
      const s = search.trim().toLowerCase();
      result = result.filter(p =>
        [p.propiedad, p.propietario, p.e1, p.e2]
          .some(v => v && v.toLowerCase().includes(s))
      );
    }
    if (filterE.length > 0) {
      result = result.filter(p => filterE.includes(p.e1) || filterE.includes(p.e2));
    }
    return result;
  }, [properties, search, filterE]);

  const counters = useMemo(() => {
    const c = {};
    ENCARGADOS.forEach(e => { c[e] = { e1: 0, e2: 0, total: 0 }; });
    properties.forEach(p => {
      if (p.e1 && c[p.e1]) { c[p.e1].e1++; c[p.e1].total++; }
      if (p.e2 && c[p.e2]) { c[p.e2].e2++; c[p.e2].total++; }
    });
    return c;
  }, [properties]);

  const toggleFilter = (e) => {
    setFilterE(prev => prev.includes(e) ? prev.filter(x => x !== e) : [...prev, e]);
  };

  const handleSave = async (form) => {
    if (editingProp) {
      await supabase.from('properties').update(form).eq('id', editingProp.id);
    } else {
      await supabase.from('properties').insert(form);
    }
    await fetchProperties();
    setEditingProp(null);
  };

  const handleEdit = (prop) => { setEditingProp(prop); setShowModal(true); };

  return (
    <div style={styles.container}>
      {/* Header */}
      <div style={styles.header}>
        <div>
          <h1 style={styles.title}>Cartera de Propiedades</h1>
          <p style={styles.subtitle}>{filtered.length} de {properties.length} propiedades</p>
        </div>
        <div style={styles.headerActions}>
          <button onClick={() => setShowCounters(!showCounters)}
            style={{ ...styles.iconBtn, ...(showCounters ? styles.iconBtnActive : {}) }}
            title="Contadores por encargado">
            <Users size={16} color={showCounters ? '#1a73e8' : '#5f6368'} />
          </button>
          {isOwner && (
            <button onClick={() => { setEditingProp(null); setShowModal(true); }} style={styles.addBtn}>
              <Plus size={16} style={{ marginRight: 6 }} /> Nueva propiedad
            </button>
          )}
        </div>
      </div>

      {/* Contadores */}
      {showCounters && (
        <div style={styles.countersRow}>
          {ENCARGADOS.filter(e => counters[e]?.total > 0).map(e => (
            <div key={e} style={{ ...styles.counterCard, borderTop: `3px solid ${ENCARGADO_COLORS[e]}` }}>
              <span style={{ ...styles.counterName, color: ENCARGADO_COLORS[e] }}>{e}</span>
              <span style={styles.counterTotal}>{counters[e].total}</span>
              <div style={styles.counterDetail}>
                <span>E1: {counters[e].e1}</span>
                <span>E2: {counters[e].e2}</span>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Filtros */}
      <div style={styles.filtersRow}>
        <div style={styles.searchWrapper}>
          <Search size={15} color="#9aa0a6" style={styles.searchIcon} />
          <input
            value={search} onChange={e => setSearch(e.target.value)}
            placeholder="Buscar en todas las columnas..."
            style={styles.searchInput}
          />
          {search && (
            <button onClick={() => setSearch('')} style={styles.clearSearch}>
              <X size={13} color="#9aa0a6" />
            </button>
          )}
        </div>
        <div style={styles.encargadoFilters}>
          <span style={styles.filterLabel}>Filtrar por:</span>
          {ENCARGADOS.map(e => (
            <button key={e} onClick={() => toggleFilter(e)} style={{
              ...styles.filterBtn,
              ...(filterE.includes(e) ? {
                background: `${ENCARGADO_COLORS[e]}22`,
                color: ENCARGADO_COLORS[e],
                borderColor: ENCARGADO_COLORS[e],
                fontWeight: 700,
              } : {})
            }}>{e}</button>
          ))}
          {filterE.length > 0 && (
            <button onClick={() => setFilterE([])} style={styles.clearFilter}>Limpiar</button>
          )}
        </div>
      </div>

      {/* Tabla */}
      <div style={styles.tableWrapper}>
        {loading ? (
          <div style={styles.loading}>Cargando propiedades...</div>
        ) : (
          <table style={styles.table}>
            <thead>
              <tr>
                <th style={{ ...styles.th, width: '45%' }}>PROPIEDAD</th>
                <th style={{ ...styles.th, width: '25%' }}>PROPIETARIO</th>
                <th style={{ ...styles.th, width: '8%', textAlign: 'center' }}>E1</th>
                <th style={{ ...styles.th, width: '8%', textAlign: 'center' }}>E2</th>
                {isOwner && <th style={{ ...styles.th, width: '6%', textAlign: 'center' }}>EDITAR</th>}
              </tr>
            </thead>
            <tbody>
              {filtered.length === 0 ? (
                <tr><td colSpan={isOwner ? 5 : 4} style={styles.empty}>
                  No se encontraron propiedades con ese criterio.
                </td></tr>
              ) : (
                filtered.map((prop, i) => (
                  <tr key={prop.id} style={{ background: i % 2 === 0 ? '#fff' : '#f8f9fa' }}
                    onMouseEnter={e => e.currentTarget.style.background = '#e8f0fe'}
                    onMouseLeave={e => e.currentTarget.style.background = i % 2 === 0 ? '#fff' : '#f8f9fa'}>
                    <td style={styles.td}>{prop.propiedad}</td>
                    <td style={{ ...styles.td, color: '#5f6368' }}>{prop.propietario}</td>
                    <td style={{ ...styles.td, textAlign: 'center' }}><Badge value={prop.e1} /></td>
                    <td style={{ ...styles.td, textAlign: 'center' }}><Badge value={prop.e2} /></td>
                    {isOwner && (
                      <td style={{ ...styles.td, textAlign: 'center' }}>
                        <button onClick={() => handleEdit(prop)} style={styles.editBtn} title="Editar">
                          <Edit2 size={14} color="#5f6368" />
                        </button>
                      </td>
                    )}
                  </tr>
                ))
              )}
            </tbody>
          </table>
        )}
      </div>

      {showModal && (
        <PropertyModal
          property={editingProp}
          onClose={() => { setShowModal(false); setEditingProp(null); }}
          onSave={handleSave}
        />
      )}
    </div>
  );
}

const styles = {
  container: { height: '100%', display: 'flex', flexDirection: 'column', overflow: 'hidden', fontFamily: "'Google Sans', 'Segoe UI', sans-serif" },
  header: { display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 16, flexShrink: 0 },
  title: { fontSize: 24, fontWeight: 700, color: '#202124', margin: '0 0 4px' },
  subtitle: { fontSize: 14, color: '#5f6368', margin: 0 },
  headerActions: { display: 'flex', gap: 8, alignItems: 'center' },
  iconBtn: { background: '#fff', border: '1px solid #dadce0', borderRadius: 8, padding: '8px 10px', cursor: 'pointer', display: 'flex', alignItems: 'center' },
  iconBtnActive: { background: '#e8f0fe', borderColor: '#1a73e8' },
  addBtn: { display: 'flex', alignItems: 'center', padding: '9px 16px', background: '#1a73e8', color: '#fff', border: 'none', borderRadius: 8, fontSize: 14, fontWeight: 500, cursor: 'pointer', fontFamily: 'inherit' },
  countersRow: { display: 'flex', gap: 12, marginBottom: 16, flexWrap: 'wrap', flexShrink: 0 },
  counterCard: { background: '#fff', border: '1px solid #e8eaed', borderRadius: 10, padding: '12px 16px', minWidth: 100, boxShadow: '0 1px 4px rgba(0,0,0,0.06)' },
  counterName: { fontSize: 13, fontWeight: 700, display: 'block' },
  counterTotal: { fontSize: 28, fontWeight: 700, color: '#202124', display: 'block', lineHeight: 1.2 },
  counterDetail: { display: 'flex', gap: 8, fontSize: 11, color: '#9aa0a6', marginTop: 2 },
  filtersRow: { display: 'flex', gap: 12, marginBottom: 16, alignItems: 'center', flexWrap: 'wrap', flexShrink: 0 },
  searchWrapper: { position: 'relative', flex: 1, minWidth: 200 },
  searchIcon: { position: 'absolute', left: 12, top: '50%', transform: 'translateY(-50%)', pointerEvents: 'none' },
  searchInput: { width: '100%', padding: '9px 36px', border: '1px solid #dadce0', borderRadius: 8, fontSize: 14, outline: 'none', fontFamily: 'inherit', background: '#fff' },
  clearSearch: { position: 'absolute', right: 10, top: '50%', transform: 'translateY(-50%)', background: 'none', border: 'none', cursor: 'pointer', padding: 2, display: 'flex' },
  encargadoFilters: { display: 'flex', gap: 6, alignItems: 'center', flexWrap: 'wrap' },
  filterLabel: { fontSize: 12, color: '#5f6368', fontWeight: 600 },
  filterBtn: { padding: '5px 12px', borderRadius: 20, border: '1px solid #dadce0', background: '#fff', fontSize: 12, cursor: 'pointer', color: '#5f6368', fontFamily: 'inherit', transition: 'all 0.15s' },
  clearFilter: { padding: '5px 10px', borderRadius: 20, border: 'none', background: 'none', fontSize: 12, cursor: 'pointer', color: '#ea4335', fontFamily: 'inherit' },
  tableWrapper: { flex: 1, overflow: 'auto', border: '1px solid #e8eaed', borderRadius: 12, background: '#fff' },
  table: { width: '100%', borderCollapse: 'collapse' },
  th: { padding: '11px 16px', background: '#f8f9fa', fontSize: 11, fontWeight: 700, color: '#5f6368', letterSpacing: 0.5, borderBottom: '2px solid #e8eaed', textAlign: 'left', position: 'sticky', top: 0, zIndex: 1 },
  td: { padding: '10px 16px', fontSize: 13, color: '#202124', borderBottom: '1px solid #f1f3f4' },
  empty: { padding: 40, textAlign: 'center', color: '#9aa0a6', fontSize: 14 },
  loading: { padding: 40, textAlign: 'center', color: '#9aa0a6', fontSize: 14 },
  editBtn: { background: 'none', border: 'none', cursor: 'pointer', padding: 6, borderRadius: 6, display: 'inline-flex' },
  // Modal
  modalOverlay: { position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.4)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 2000 },
  modal: { background: '#fff', borderRadius: 16, width: 560, boxShadow: '0 8px 32px rgba(0,0,0,0.18)', fontFamily: "'Google Sans', 'Segoe UI', sans-serif", overflow: 'hidden' },
  modalHeader: { display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '20px 24px 16px' },
  modalTitle: { fontSize: 18, fontWeight: 700, color: '#202124', margin: 0 },
  modalClose: { background: 'none', border: 'none', cursor: 'pointer', padding: 4, display: 'flex' },
  modalBody: { padding: '0 24px 20px' },
  field: { marginBottom: 16 },
  fieldRow: { display: 'flex', gap: 12 },
  fieldHalf: { flex: 1 },
  label: { fontSize: 12, fontWeight: 600, color: '#5f6368', display: 'block', marginBottom: 6 },
  input: { width: '100%', border: '1px solid #dadce0', borderRadius: 8, padding: '9px 12px', fontSize: 14, outline: 'none', fontFamily: 'inherit' },
  select: { width: '100%', border: '1px solid #dadce0', borderRadius: 8, padding: '9px 12px', fontSize: 14, outline: 'none', fontFamily: 'inherit', background: '#fff', cursor: 'pointer' },
  modalFooter: { display: 'flex', gap: 8, padding: '16px 24px', borderTop: '1px solid #f1f3f4' },
  saveBtn: { display: 'flex', alignItems: 'center', padding: '9px 20px', background: '#1a73e8', color: '#fff', border: 'none', borderRadius: 8, fontSize: 14, fontWeight: 500, cursor: 'pointer', fontFamily: 'inherit' },
  saveBtnDisabled: { background: '#e8eaed', color: '#9aa0a6', cursor: 'not-allowed' },
  cancelBtn: { padding: '9px 16px', background: 'none', border: '1px solid #dadce0', borderRadius: 8, fontSize: 14, cursor: 'pointer', fontFamily: 'inherit', color: '#5f6368' },
};
