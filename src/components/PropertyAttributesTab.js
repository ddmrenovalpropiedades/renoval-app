import React, { useState, useEffect, useMemo } from 'react';
import { supabase } from '../supabaseClient';
import { Save, Search, X, Download } from 'lucide-react';
import { useExcelExport } from '../hooks/useExcelExport';

const SI_NO = ['', 'Sí', 'No'];

const buildFormState = (attr) => ({
  tiene_agua: attr.tiene_agua === true ? 'Sí' : attr.tiene_agua === false ? 'No' : '',
  tiene_luz:  attr.tiene_luz  === true ? 'Sí' : attr.tiene_luz  === false ? 'No' : '',
  tiene_gas:  attr.tiene_gas  === true ? 'Sí' : attr.tiene_gas  === false ? 'No' : '',
  tiene_gc:   attr.tiene_gc   === true ? 'Sí' : attr.tiene_gc   === false ? 'No' : '',
  agua_promedio: attr.agua_promedio ?? '',
  luz_promedio:  attr.luz_promedio  ?? '',
  gas_promedio:  attr.gas_promedio  ?? '',
  gc_promedio:   attr.gc_promedio   ?? '',
});

function AttributeRow({ attr, onSave }) {
  const [form, setForm] = useState(buildFormState(attr));
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);

  const isDirty = JSON.stringify(form) !== JSON.stringify(buildFormState(attr));

  const handleSave = async () => {
    setSaving(true);
    const toBool = v => v === 'Sí' ? true : v === 'No' ? false : null;
    const toInt  = v => v === '' || v === null ? null : parseInt(String(v).replace(/[^0-9]/g, ''), 10) || null;
    await onSave(attr.propiedad, {
      tiene_agua: toBool(form.tiene_agua),
      tiene_luz:  toBool(form.tiene_luz),
      tiene_gas:  toBool(form.tiene_gas),
      tiene_gc:   toBool(form.tiene_gc),
      agua_promedio: toInt(form.agua_promedio),
      luz_promedio:  toInt(form.luz_promedio),
      gas_promedio:  toInt(form.gas_promedio),
      gc_promedio:   toInt(form.gc_promedio),
    });
    setSaving(false);
    setSaved(true);
    setTimeout(() => setSaved(false), 2000);
  };

  const set = (k, v) => setForm(prev => ({ ...prev, [k]: v }));

  const numInput = (key) => (
    <input
      value={form[key]}
      onChange={e => set(key, e.target.value)}
      style={styles.numInput}
      placeholder="—"
      type="text"
    />
  );

  const selectorSiNo = (key) => (
    <select value={form[key]} onChange={e => set(key, e.target.value)} style={styles.siNoSelect}>
      {SI_NO.map(v => <option key={v} value={v}>{v || '—'}</option>)}
    </select>
  );

  return (
    <tr style={{ background: '#fff', borderBottom: '1px solid #e8eaed' }}>
      <td style={styles.tdProp}>{attr.propiedad}</td>
      <td style={styles.tdCenter}>{selectorSiNo('tiene_agua')}</td>
      <td style={styles.tdCenter}>{selectorSiNo('tiene_luz')}</td>
      <td style={styles.tdCenter}>{selectorSiNo('tiene_gas')}</td>
      <td style={{ ...styles.tdCenter, borderLeft: '2px solid #bdbdbd' }}>{selectorSiNo('tiene_gc')}</td>
      <td style={{ ...styles.tdCenter, borderLeft: '2px solid #bdbdbd' }}>{numInput('agua_promedio')}</td>
      <td style={styles.tdCenter}>{numInput('luz_promedio')}</td>
      <td style={styles.tdCenter}>{numInput('gas_promedio')}</td>
      <td style={{ ...styles.tdCenter, borderLeft: '2px solid #bdbdbd' }}>{numInput('gc_promedio')}</td>
      <td style={styles.tdCenter}>
        {(isDirty || saving) && (
          <button onClick={handleSave} disabled={saving}
            style={{ ...styles.saveBtn, ...(saved ? styles.saveBtnDone : {}) }}
            title="Guardar cambios">
            <Save size={13} />
            {saved ? ' ✓' : ''}
          </button>
        )}
      </td>
    </tr>
  );
}

export default function PropertyAttributesTab() {
  const [attrs, setAttrs] = useState([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const { exportToExcel } = useExcelExport();

  useEffect(() => { fetchAttrs(); }, []);

  const fetchAttrs = async () => {
    setLoading(true);
    const { data } = await supabase
      .from('property_attributes')
      .select('*')
      .order('propiedad', { ascending: true });
    setAttrs(data || []);
    setLoading(false);
  };

  const handleSave = async (propiedad, updates) => {
    await supabase.from('property_attributes')
      .update(updates).eq('propiedad', propiedad);
    setAttrs(prev => prev.map(a => a.propiedad === propiedad ? { ...a, ...updates } : a));
  };

  const filtered = useMemo(() => {
    if (!search.trim()) return attrs;
    const s = search.trim().toLowerCase();
    return attrs.filter(a => a.propiedad?.toLowerCase().includes(s));
  }, [attrs, search]);

  const handleExport = () => {
    const toBool = v => v === true ? 'Sí' : v === false ? 'No' : '';
    const data = filtered.map(a => ({
      ...a,
      tiene_agua: toBool(a.tiene_agua),
      tiene_luz:  toBool(a.tiene_luz),
      tiene_gas:  toBool(a.tiene_gas),
      tiene_gc:   toBool(a.tiene_gc),
    }));
    exportToExcel(data, [
      { key: 'propiedad',      label: 'Propiedad' },
      { key: 'tiene_agua',     label: 'Agua' },
      { key: 'tiene_luz',      label: 'Luz' },
      { key: 'tiene_gas',      label: 'Gas' },
      { key: 'tiene_gc',       label: 'GC' },
      { key: 'agua_promedio',  label: 'Agua Promedio' },
      { key: 'luz_promedio',   label: 'Luz Promedio' },
      { key: 'gas_promedio',   label: 'Gas Promedio' },
      { key: 'gc_promedio',    label: 'GC Promedio' },
    ], 'Atributos');
  };

  return (
    <div style={styles.container}>
      <div style={styles.searchWrapper}>
        <Search size={15} color="#9aa0a6" style={styles.searchIcon} />
        <input value={search} onChange={e => setSearch(e.target.value)}
          placeholder="Buscar propiedad..."
          style={styles.searchInput} />
        {search && <button onClick={() => setSearch('')} style={styles.clearSearch}><X size={13} color="#9aa0a6" /></button>}
        <span style={styles.count}>{filtered.length} de {attrs.length}</span>
        <button onClick={handleExport} disabled={loading} title="Exportar a Excel"
          style={{ marginLeft: 12, display:'flex', alignItems:'center', padding:'6px 8px', background:'#fff', border:'1px solid #dadce0', borderRadius:8, cursor:loading?'not-allowed':'pointer', opacity:loading?0.5:1 }}>
          <Download size={14} color="#34a853" />
        </button>
      </div>

      <div style={styles.hint}>
        Los promedios definen el umbral de cada cuenta: el sistema los multiplica por los multiplicadores configurados en Saldos para determinar cuándo una celda se pinta naranja (U1) o roja (U2). Si una propiedad no tiene promedio cargado, se usa un umbral fijo por defecto.
      </div>

      <div style={styles.tableWrapper}>
        {loading ? (
          <div style={styles.loading}>Cargando atributos...</div>
        ) : (
          <table style={styles.table}>
            <thead>
              <tr>
                <th style={{ ...styles.th, textAlign: 'left', minWidth: 280 }}>PROPIEDAD</th>
                <th style={styles.th}>AGUA</th>
                <th style={styles.th}>LUZ</th>
                <th style={styles.th}>GAS</th>
                <th style={{ ...styles.th, borderLeft: '2px solid #bdbdbd' }}>GC</th>
                <th style={{ ...styles.th, borderLeft: '2px solid #bdbdbd' }}>AGUA PROM.</th>
                <th style={styles.th}>LUZ PROM.</th>
                <th style={styles.th}>GAS PROM.</th>
                <th style={{ ...styles.th, borderLeft: '2px solid #bdbdbd' }}>GC PROM.</th>
                <th style={styles.th}></th>
              </tr>
            </thead>
            <tbody>
              {filtered.length === 0 ? (
                <tr><td colSpan={10} style={styles.empty}>Sin resultados.</td></tr>
              ) : (
                filtered.map(attr => (
                  <AttributeRow key={attr.propiedad} attr={attr} onSave={handleSave} />
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
  container: { display: 'flex', flexDirection: 'column', height: '100%', gap: 12 },
  searchWrapper: { position: 'relative', display: 'flex', alignItems: 'center' },
  searchIcon: { position: 'absolute', left: 12, pointerEvents: 'none' },
  searchInput: { width: 320, padding: '8px 36px', border: '1px solid #dadce0', borderRadius: 8, fontSize: 13, outline: 'none', fontFamily: 'inherit' },
  clearSearch: { position: 'absolute', left: 298, background: 'none', border: 'none', cursor: 'pointer', padding: 2, display: 'flex' },
  count: { marginLeft: 12, fontSize: 13, color: '#9aa0a6' },
  hint: { fontSize: 12, color: '#9aa0a6', background: '#f8f9fa', border: '1px solid #e8eaed', borderRadius: 8, padding: '8px 12px' },
  tableWrapper: { flex: 1, overflow: 'auto', border: '1px solid #e8eaed', borderRadius: 12, background: '#fff' },
  table: { width: '100%', borderCollapse: 'collapse' },
  th: { padding: '10px 10px', background: '#f8f9fa', fontSize: 10, fontWeight: 700, color: '#5f6368', letterSpacing: 0.5, borderBottom: '2px solid #e8eaed', borderRight: '1px solid #e8eaed', position: 'sticky', top: 0, zIndex: 1, whiteSpace: 'nowrap', textAlign: 'center' },
  tdProp: { padding: '6px 12px', fontSize: 12, color: '#202124', borderRight: '1px solid #e8eaed' },
  tdCenter: { padding: '4px 6px', textAlign: 'center', borderRight: '1px solid #e8eaed' },
  siNoSelect: { border: '1px solid #dadce0', borderRadius: 6, padding: '3px 6px', fontSize: 12, outline: 'none', fontFamily: 'inherit', background: '#fff', cursor: 'pointer', width: 52 },
  numInput: { border: '1px solid #dadce0', borderRadius: 6, padding: '3px 6px', fontSize: 12, outline: 'none', fontFamily: 'inherit', width: 80, textAlign: 'right' },
  saveBtn: { background: '#e8f0fe', border: 'none', borderRadius: 6, padding: '5px 8px', cursor: 'pointer', color: '#1a73e8', fontSize: 12, display: 'flex', alignItems: 'center', gap: 3 },
  saveBtnDone: { background: '#e6f4ea', color: '#34a853' },
  empty: { padding: 32, textAlign: 'center', color: '#9aa0a6', fontSize: 14 },
  loading: { padding: 32, textAlign: 'center', color: '#9aa0a6', fontSize: 14 },
};
