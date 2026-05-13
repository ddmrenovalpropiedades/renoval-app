import React, { useState, useEffect, useMemo, useCallback, useRef } from 'react';
import * as XLSX from 'xlsx';
import { supabase } from '../supabaseClient';
import { useAuth } from '../context/AuthContext';
import { Search, X, Upload, Save, AlertCircle, RefreshCw } from 'lucide-react';

// ── Helpers ──────────────────────────────────────────────────
const parseAmount = (val) => {
  if (!val || typeof val !== 'string') return null;
  if (['pagada', 'temporalmente no', 'error desconocido'].includes(val.toLowerCase())) return null;
  const n = parseInt(val.replace(/[^0-9]/g, ''), 10);
  return isNaN(n) ? null : n;
};

const parseArriendo = (val) => {
  if (val === null || val === undefined || val === '') return null;
  const str = String(val).replace(/[^0-9.-]/g, '');
  const n = Math.abs(parseFloat(str));
  return isNaN(n) ? null : n;
};

// ── Color logic ───────────────────────────────────────────────
const getCellStyle = (val, tipo) => {
  const base = { padding: '6px 8px', borderRadius: 4, fontSize: 12, textAlign: 'right', minWidth: 80 };
  if (!val || val === '') return { ...base, background: '#FAF3E0', color: 'transparent' };

  const lower = typeof val === 'string' ? val.toLowerCase() : '';
  if (lower === 'pagada') return { ...base, background: '#fff', color: '#bdbdbd' };
  if (['temporalmente no', 'error desconocido'].includes(lower))
    return { ...base, background: '#fff', color: '#bdbdbd' };

  const n = parseAmount(val);
  if (n === null) return { ...base, background: '#fff', color: '#9aa0a6' };

  if (tipo === 'agua') {
    if (n < 40000) return { ...base, background: '#fff', color: '#bdbdbd' };
    if (n < 60000) return { ...base, background: '#FFCDD2', color: '#202124' };
    return { ...base, background: '#EF9A9A', color: '#202124' };
  }
  if (tipo === 'luz') {
    if (n < 55000) return { ...base, background: '#fff', color: '#bdbdbd' };
    if (n < 80000) return { ...base, background: '#FFCDD2', color: '#202124' };
    return { ...base, background: '#EF9A9A', color: '#202124' };
  }
  if (tipo === 'gas') {
    if (n < 45000) return { ...base, background: '#fff', color: '#bdbdbd' };
    if (n < 60000) return { ...base, background: '#FFCDD2', color: '#202124' };
    return { ...base, background: '#EF9A9A', color: '#202124' };
  }
  if (tipo === 'gc') {
    if (n < 70000) return { ...base, background: '#fff', color: '#bdbdbd' };
    if (n < 180000) return { ...base, background: '#fff', color: '#202124' };
    return { ...base, background: '#EF9A9A', color: '#202124' };
  }
  if (tipo === 'arriendo') {
    if (n < 10000) return { ...base, background: '#fff', color: '#bdbdbd' };
    return { ...base, background: '#fff', color: '#202124' };
  }
  return { ...base, background: '#fff', color: '#202124' };
};

// ── Editable cell ─────────────────────────────────────────────
function EditableCell({ value, tipo, alerta, onChange }) {
  const [editing, setEditing] = useState(false);
  const [local, setLocal] = useState(value || '');
  const cellStyle = getCellStyle(value, tipo);

  const handleBlur = () => {
    setEditing(false);
    if (local !== (value || '')) onChange(local);
  };

  if (editing) {
    return (
      <input value={local} onChange={e => setLocal(e.target.value)} onBlur={handleBlur}
        autoFocus style={{ ...cellStyle, border: '1px solid #1a73e8', outline: 'none', width: '100%' }} />
    );
  }

  return (
    <div onClick={() => { setLocal(value || ''); setEditing(true); }}
      style={{ ...cellStyle, cursor: 'text', display: 'flex', alignItems: 'center', gap: 4, position: 'relative' }}>
      {alerta && <AlertCircle size={11} color="#ea4335" style={{ flexShrink: 0 }} title="Deuda anterior pendiente" />}
      {value || ''}
    </div>
  );
}

// ── Upload button ─────────────────────────────────────────────
function UploadBtn({ label, tipo, onUpload, lastUpload }) {
  const ref = useRef();
  return (
    <div style={styles.uploadCard}>
      <div style={styles.uploadLabel}>{label}</div>
      {lastUpload && (
        <div style={styles.uploadMeta}>
          Última carga: {new Date(lastUpload.uploaded_at).toLocaleDateString('es-CL')} ({lastUpload.row_count} filas)
        </div>
      )}
      <button onClick={() => ref.current.click()} style={styles.uploadBtn}>
        <Upload size={13} style={{ marginRight: 5 }} /> Cargar archivo
      </button>
      <input ref={ref} type="file" accept=".xls,.xlsx" style={{ display: 'none' }}
        onChange={e => { if (e.target.files[0]) { onUpload(tipo, e.target.files[0]); e.target.value = ''; } }} />
    </div>
  );
}

// ── Main page ─────────────────────────────────────────────────
const ENCARGADOS = ['DD', 'FD', 'EA', 'FG', 'AM'];
const ENCARGADO_COLORS = { DD: '#1565C0', FD: '#2E7D32', EA: '#6A1B9A', FG: '#E65100', AM: '#37474F' };

export default function SaldosPage() {
  useAuth();
  const [rows, setRows] = useState([]);
  const [edits, setEdits] = useState({});
  const [loading, setLoading] = useState(true);
  const [uploading, setUploading] = useState('');
  const [lastUploads, setLastUploads] = useState({});
  const [search, setSearch] = useState('');
  const [filterE, setFilterE] = useState([]);
  const [showUpload, setShowUpload] = useState(false);

  const fetchData = useCallback(async () => {
    setLoading(true);
    const [{ data: saldos }, { data: uploads }] = await Promise.all([
      supabase.from('saldos').select('*').order('propiedad', { ascending: true }),
      supabase.from('saldos_uploads').select('*').order('uploaded_at', { ascending: false }),
    ]);
    setRows(saldos || []);
    // Keep only latest per tipo
    const latest = {};
    (uploads || []).forEach(u => { if (!latest[u.tipo]) latest[u.tipo] = u; });
    setLastUploads(latest);
    setLoading(false);
  }, []);

  useEffect(() => { fetchData(); }, [fetchData]);

  // ── File upload & processing ──────────────────────────────
  const handleUpload = async (tipo, file) => {
    setUploading(tipo);
    try {
      const buffer = await file.arrayBuffer();
      const wb = XLSX.read(buffer, { type: 'array' });
      const ws = wb.Sheets[wb.SheetNames[0]];
      const data = XLSX.utils.sheet_to_json(ws, { defval: '' });

      if (tipo === 'cuentas_ac' || tipo === 'cuentas_an') {
        await processCuentas(data, tipo);
      } else {
        await processArriendos(data);
      }

      // Log upload
      await supabase.from('saldos_uploads').insert({ tipo, filename: file.name, row_count: data.length });
      await fetchData();
    } catch (err) {
      console.error('Upload error:', err);
      alert('Error al procesar el archivo: ' + err.message);
    }
    setUploading('');
  };

  const processCuentas = async (data, tipo) => {
    const isAc = tipo === 'cuentas_ac';
    const now = new Date().toISOString();

    for (const row of data) {
      const propiedad = (row['Propiedad'] || '').trim();
      if (!propiedad) continue;

      // Get propietario/e1/e2 from cartera
      const { data: cartera } = await supabase.from('properties')
        .select('propietario,e1,e2').eq('propiedad', propiedad).maybeSingle();

      const update = isAc ? {
        agua_ac: String(row['Agua'] || '').trim() || null,
        luz_ac: String(row['Luz'] || '').trim() || null,
        gas_ac: String(row['Gas'] || '').trim() || null,
        gc_ac: String(row['Gastos comunes'] || '').trim() || null,
        alerta_agua: (parseFloat(row['Deuda anterior agua']) || 0) > 0,
        alerta_luz: (parseFloat(row['Deuda anterior luz']) || 0) > 0,
        alerta_gas: (parseFloat(row['Deuda anterior gas']) || 0) > 0,
        last_cuentas_ac: now,
      } : {
        agua_an: String(row['Agua'] || '').trim() || null,
        luz_an: String(row['Luz'] || '').trim() || null,
        gas_an: String(row['Gas'] || '').trim() || null,
        gc_an: String(row['Gastos comunes'] || '').trim() || null,
        last_cuentas_an: now,
      };

      if (cartera) {
        update.propietario = cartera.propietario;
        update.e1 = cartera.e1;
        update.e2 = cartera.e2;
      }

      await supabase.from('saldos').upsert({ propiedad, ...update }, { onConflict: 'propiedad' });
    }

    // Remove rows not in any of the 3 latest sources
    await reconcileRows();
  };

  const processArriendos = async (data) => {
    const now = new Date().toISOString();
    for (const row of data) {
      const propiedad = (row['Propiedad'] || '').trim();
      if (!propiedad) continue;
      const rawVal = row['Deuda al día'];
      const n = parseArriendo(rawVal);
      const deuda = n !== null ? String(Math.round(n)) : null;

      const { data: cartera } = await supabase.from('properties')
        .select('propietario,e1,e2').eq('propiedad', propiedad).maybeSingle();

      const update = { deuda_arriendo: deuda, last_arriendos: now };
      if (cartera) { update.propietario = cartera.propietario; update.e1 = cartera.e1; update.e2 = cartera.e2; }

      await supabase.from('saldos').upsert({ propiedad, ...update }, { onConflict: 'propiedad' });
    }
    await reconcileRows();
  };

  const reconcileRows = async () => {
    // Get all current saldos rows
    const { data: current } = await supabase.from('saldos').select('id,propiedad,last_cuentas_ac,last_cuentas_an,last_arriendos');
    if (!current) return;
    // Remove rows that have no data from any source
    for (const row of current) {
      if (!row.last_cuentas_ac && !row.last_cuentas_an && !row.last_arriendos) {
        await supabase.from('saldos').delete().eq('id', row.id);
      }
    }
  };

  // ── Manual edits ──────────────────────────────────────────
  const handleCellChange = (rowId, field, value) => {
    setEdits(prev => ({ ...prev, [rowId]: { ...(prev[rowId] || {}), [field]: value } }));
  };

  const handleSaveRow = async (rowId) => {
    const changes = edits[rowId];
    if (!changes || Object.keys(changes).length === 0) return;
    await supabase.from('saldos').update(changes).eq('id', rowId);
    setRows(prev => prev.map(r => r.id === rowId ? { ...r, ...changes } : r));
    setEdits(prev => { const n = { ...prev }; delete n[rowId]; return n; });
  };

  // ── Filters ───────────────────────────────────────────────
  const filtered = useMemo(() => {
    let result = rows;
    if (search.trim()) {
      const s = search.trim().toLowerCase();
      result = result.filter(r =>
        [r.propiedad, r.propietario, r.e1, r.e2].some(v => v && v.toLowerCase().includes(s))
      );
    }
    if (filterE.length > 0) {
      result = result.filter(r => filterE.every(e => [r.e1, r.e2].includes(e)));
    }
    return result;
  }, [rows, search, filterE]);

  const toggleFilter = (e) => setFilterE(prev => prev.includes(e) ? prev.filter(x => x !== e) : [...prev, e]);

  const COLS = [
    { key: 'agua_ac', label: 'AGUA Ac', tipo: 'agua', alerta: 'alerta_agua' },
    { key: 'agua_an', label: 'AGUA An', tipo: 'agua', alerta: null },
    { key: 'luz_ac',  label: 'LUZ Ac',  tipo: 'luz',  alerta: 'alerta_luz' },
    { key: 'luz_an',  label: 'LUZ An',  tipo: 'luz',  alerta: null },
    { key: 'gas_ac',  label: 'GAS Ac',  tipo: 'gas',  alerta: 'alerta_gas' },
    { key: 'gas_an',  label: 'GAS An',  tipo: 'gas',  alerta: null },
    { key: 'deuda_arriendo', label: 'DEUDA ARR.', tipo: 'arriendo', alerta: null },
    { key: 'gc_ac',   label: 'GC Ac',   tipo: 'gc',   alerta: null },
    { key: 'gc_an',   label: 'GC An',   tipo: 'gc',   alerta: null },
  ];

  return (
    <div style={styles.container}>
      {/* Header */}
      <div style={styles.header}>
        <div>
          <h1 style={styles.title}>Saldos</h1>
          <p style={styles.subtitle}>{filtered.length} de {rows.length} propiedades</p>
        </div>
        <div style={styles.headerActions}>
          <button onClick={fetchData} style={styles.iconBtn} title="Actualizar">
            <RefreshCw size={16} color="#5f6368" />
          </button>
          <button onClick={() => setShowUpload(!showUpload)}
            style={{ ...styles.iconBtn, ...(showUpload ? { background: '#e8f0fe', borderColor: '#1a73e8' } : {}) }}
            title="Cargar archivos">
            <Upload size={16} color={showUpload ? '#1a73e8' : '#5f6368'} />
          </button>
        </div>
      </div>

      {/* Upload panel */}
      {showUpload && (
        <div style={styles.uploadPanel}>
          <UploadBtn label="📄 Cuentas actuales" tipo="cuentas_ac" onUpload={handleUpload} lastUpload={lastUploads['cuentas_ac']} />
          <UploadBtn label="📄 Cuentas mes anterior" tipo="cuentas_an" onUpload={handleUpload} lastUpload={lastUploads['cuentas_an']} />
          <UploadBtn label="📄 Deuda de arriendo" tipo="arriendos" onUpload={handleUpload} lastUpload={lastUploads['arriendos']} />
          {uploading && <div style={styles.uploadingMsg}>⏳ Procesando {uploading}...</div>}
        </div>
      )}

      {/* Filters */}
      <div style={styles.filtersRow}>
        <div style={styles.searchWrapper}>
          <Search size={15} color="#9aa0a6" style={styles.searchIcon} />
          <input value={search} onChange={e => setSearch(e.target.value)}
            placeholder="Buscar propiedad, propietario, encargado..."
            style={styles.searchInput} />
          {search && <button onClick={() => setSearch('')} style={styles.clearSearch}><X size={13} color="#9aa0a6" /></button>}
        </div>
        <div style={styles.encargadoFilters}>
          <span style={styles.filterLabel}>Filtrar por:</span>
          {ENCARGADOS.map(e => (
            <button key={e} onClick={() => toggleFilter(e)} style={{
              ...styles.filterBtn,
              ...(filterE.includes(e) ? { background: `${ENCARGADO_COLORS[e]}22`, color: ENCARGADO_COLORS[e], borderColor: ENCARGADO_COLORS[e], fontWeight: 700 } : {})
            }}>{e}</button>
          ))}
          {filterE.length > 0 && <button onClick={() => setFilterE([])} style={styles.clearFilter}>Limpiar</button>}
        </div>
      </div>

      {/* Table */}
      <div style={styles.tableWrapper}>
        {loading ? (
          <div style={styles.loading}>Cargando saldos...</div>
        ) : rows.length === 0 ? (
          <div style={styles.loading}>No hay datos cargados aún. Usa el botón de carga para importar archivos.</div>
        ) : (
          <table style={styles.table}>
            <thead>
              <tr>
                <th style={{ ...styles.th, minWidth: 280, textAlign: 'left' }}>PROPIEDAD</th>
                <th style={{ ...styles.th, minWidth: 160, textAlign: 'left' }}>PROPIETARIO</th>
                {COLS.map(c => <th key={c.key} style={{ ...styles.th, minWidth: 88, textAlign: 'right' }}>{c.label}</th>)}
                <th style={{ ...styles.th, minWidth: 40 }}></th>
                <th style={{ ...styles.th, minWidth: 50, textAlign: 'center' }}>E1</th>
                <th style={{ ...styles.th, minWidth: 50, textAlign: 'center' }}>E2</th>
              </tr>
            </thead>
            <tbody>
              {filtered.length === 0 ? (
                <tr><td colSpan={COLS.length + 4} style={styles.empty}>Sin resultados para este filtro.</td></tr>
              ) : filtered.map((row, i) => {
                const hasEdits = !!(edits[row.id] && Object.keys(edits[row.id]).length > 0);
                const merged = { ...row, ...(edits[row.id] || {}) };
                return (
                  <tr key={row.id} style={{ background: i % 2 === 0 ? '#fff' : '#f8f9fa' }}>
                    <td style={{ ...styles.td, fontSize: 12 }}>{row.propiedad}</td>
                    <td style={{ ...styles.td, fontSize: 12, color: '#5f6368' }}>{row.propietario || ''}</td>
                    {COLS.map(c => (
                      <td key={c.key} style={{ ...styles.td, padding: '4px 6px' }}>
                        <EditableCell
                          value={merged[c.key] || ''}
                          tipo={c.tipo}
                          alerta={c.alerta ? merged[c.alerta] : false}
                          onChange={val => handleCellChange(row.id, c.key, val)}
                        />
                      </td>
                    ))}
                    <td style={{ ...styles.td, textAlign: 'center', padding: '4px 6px' }}>
                      {hasEdits && (
                        <button onClick={() => handleSaveRow(row.id)} style={styles.saveRowBtn} title="Guardar cambios">
                          <Save size={13} color="#1a73e8" />
                        </button>
                      )}
                    </td>
                    <td style={{ ...styles.td, textAlign: 'center' }}>
                      {row.e1 && <span style={{ ...styles.badge, background: `${ENCARGADO_COLORS[row.e1] || '#9aa0a6'}22`, color: ENCARGADO_COLORS[row.e1] || '#9aa0a6', border: `1px solid ${ENCARGADO_COLORS[row.e1] || '#9aa0a6'}44` }}>{row.e1}</span>}
                    </td>
                    <td style={{ ...styles.td, textAlign: 'center' }}>
                      {row.e2 && <span style={{ ...styles.badge, background: `${ENCARGADO_COLORS[row.e2] || '#9aa0a6'}22`, color: ENCARGADO_COLORS[row.e2] || '#9aa0a6', border: `1px solid ${ENCARGADO_COLORS[row.e2] || '#9aa0a6'}44` }}>{row.e2}</span>}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        )}
      </div>
    </div>
  );
}

const styles = {
  container: { height: '100%', display: 'flex', flexDirection: 'column', overflow: 'hidden', fontFamily: "'Google Sans', 'Segoe UI', sans-serif" },
  header: { display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 12, flexShrink: 0 },
  title: { fontSize: 24, fontWeight: 700, color: '#202124', margin: '0 0 4px' },
  subtitle: { fontSize: 14, color: '#5f6368', margin: 0 },
  headerActions: { display: 'flex', gap: 8 },
  iconBtn: { background: '#fff', border: '1px solid #dadce0', borderRadius: 8, padding: '8px 10px', cursor: 'pointer', display: 'flex', alignItems: 'center' },
  uploadPanel: { display: 'flex', gap: 12, marginBottom: 14, flexWrap: 'wrap', flexShrink: 0, padding: '14px 16px', background: '#f8f9fa', borderRadius: 10, border: '1px solid #e8eaed', alignItems: 'flex-start' },
  uploadCard: { background: '#fff', border: '1px solid #e8eaed', borderRadius: 8, padding: '12px 14px', minWidth: 200 },
  uploadLabel: { fontSize: 13, fontWeight: 600, color: '#202124', marginBottom: 4 },
  uploadMeta: { fontSize: 11, color: '#9aa0a6', marginBottom: 8 },
  uploadBtn: { display: 'flex', alignItems: 'center', padding: '7px 12px', background: '#1a73e8', color: '#fff', border: 'none', borderRadius: 6, fontSize: 12, cursor: 'pointer', fontFamily: 'inherit', fontWeight: 500 },
  uploadingMsg: { fontSize: 13, color: '#1a73e8', alignSelf: 'center', fontStyle: 'italic' },
  filtersRow: { display: 'flex', gap: 12, marginBottom: 12, alignItems: 'center', flexWrap: 'wrap', flexShrink: 0 },
  searchWrapper: { position: 'relative', flex: 1, minWidth: 200 },
  searchIcon: { position: 'absolute', left: 12, top: '50%', transform: 'translateY(-50%)', pointerEvents: 'none' },
  searchInput: { width: '100%', padding: '8px 36px', border: '1px solid #dadce0', borderRadius: 8, fontSize: 13, outline: 'none', fontFamily: 'inherit', background: '#fff' },
  clearSearch: { position: 'absolute', right: 10, top: '50%', transform: 'translateY(-50%)', background: 'none', border: 'none', cursor: 'pointer', padding: 2, display: 'flex' },
  encargadoFilters: { display: 'flex', gap: 6, alignItems: 'center', flexWrap: 'wrap' },
  filterLabel: { fontSize: 12, color: '#5f6368', fontWeight: 600 },
  filterBtn: { padding: '4px 12px', borderRadius: 20, border: '1px solid #dadce0', background: '#fff', fontSize: 12, cursor: 'pointer', color: '#5f6368', fontFamily: 'inherit' },
  clearFilter: { padding: '4px 10px', borderRadius: 20, border: 'none', background: 'none', fontSize: 12, cursor: 'pointer', color: '#ea4335', fontFamily: 'inherit' },
  tableWrapper: { flex: 1, overflow: 'auto', border: '1px solid #e8eaed', borderRadius: 12, background: '#fff' },
  table: { width: '100%', borderCollapse: 'collapse' },
  th: { padding: '10px 10px', background: '#f8f9fa', fontSize: 10, fontWeight: 700, color: '#5f6368', letterSpacing: 0.5, borderBottom: '2px solid #e8eaed', position: 'sticky', top: 0, zIndex: 1, whiteSpace: 'nowrap' },
  td: { padding: '6px 10px', fontSize: 13, color: '#202124', borderBottom: '1px solid #f1f3f4', verticalAlign: 'middle' },
  empty: { padding: 40, textAlign: 'center', color: '#9aa0a6', fontSize: 14 },
  loading: { padding: 40, textAlign: 'center', color: '#9aa0a6', fontSize: 14 },
  saveRowBtn: { background: 'none', border: 'none', cursor: 'pointer', padding: 6, borderRadius: 6, display: 'inline-flex', alignItems: 'center' },
  badge: { display: 'inline-block', borderRadius: 20, padding: '2px 9px', fontSize: 11, fontWeight: 700 },
};
