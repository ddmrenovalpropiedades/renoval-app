import React, { useState, useEffect, useMemo, useRef } from 'react';
import { supabase } from '../supabaseClient';
import { Plus, X, FileText, Trash2, Search, Download, Landmark } from 'lucide-react';
import { useExcelExport } from '../hooks/useExcelExport';

// ── Actividades sugeridas (se muestran ordenadas alfabéticamente) ──
const ACTIVIDADES = [
  'Habilitación y reparaciones', 'Gasfitería', 'Aseo general', 'Aseo alfombras',
  'Calefont', 'Termo Eléctrico', 'Pintura', 'Ventanas', 'Eléctrico', 'Jardinero',
  'Mudanza', 'Piscina', 'Visitas', 'Caldera', 'Calefacción', 'Cocina',
].sort((a, b) => a.localeCompare(b, 'es', { sensitivity: 'base' }));

const TIPOS_CUENTA = ['Cuenta corriente', 'Cuenta vista', 'Cuenta RUT', 'Cuenta de ahorro'];

const CAMPOS_CUENTA = [
  { key: 'cta_nombre', label: 'Nombre' },
  { key: 'cta_rut',    label: 'RUT' },
  { key: 'cta_banco',  label: 'Banco' },
  { key: 'cta_tipo',   label: 'Tipo de cuenta', opciones: TIPOS_CUENTA },
  { key: 'cta_numero', label: 'N° de cuenta' },
  { key: 'cta_mail',   label: 'Mail' },
];

const normalize = (str) =>
  String(str || '').toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '');

const ordenarPorNombre = (lista) =>
  [...lista].sort((a, b) => (a.nombre || '').localeCompare(b.nombre || '', 'es', { sensitivity: 'base' }));

// Extracto de la cuenta: nombre, banco, n° de cuenta (lo que alcance a mostrarse)
const extractoCuenta = (p) => [p.cta_nombre, p.cta_banco, p.cta_numero].filter(Boolean).join(', ');

const formatRut = (raw) => {
  const clean = String(raw || '').replace(/[^0-9kK]/g, '').toUpperCase();
  if (clean.length <= 1) return clean;
  const body = clean.slice(0, -1);
  const dv = clean.slice(-1);
  return `${body.replace(/\B(?=(\d{3})+(?!\d))/g, '.')}-${dv}`;
};

// ── Texto editable en línea ─────────────────────────────────────
function InlineText({ value, onChange, placeholder = '—', upper = false }) {
  const [editing, setEditing] = useState(false);
  const [raw, setRaw] = useState(value || '');
  if (editing) {
    return (
      <input
        autoFocus
        value={raw}
        onChange={e => setRaw(upper ? e.target.value.toUpperCase() : e.target.value)}
        onBlur={() => { setEditing(false); if ((raw || '') !== (value || '')) onChange(raw.trim() || null); }}
        onKeyDown={e => { if (e.key === 'Enter') e.target.blur(); if (e.key === 'Escape') { setRaw(value || ''); setEditing(false); } }}
        style={inputStyle}
      />
    );
  }
  return (
    <div onClick={() => { setRaw(value || ''); setEditing(true); }} style={s.cellText} title={value || ''}>
      {value || <span style={{ color: '#dadce0' }}>{placeholder}</span>}
    </div>
  );
}

// ── Actividad: texto libre con lista sugerida filtrada ──────────
function ActividadInput({ value, onCommit, autoFocus = false, bordered = false }) {
  const [texto, setTexto] = useState(value || '');
  const [abierto, setAbierto] = useState(autoFocus);
  const [idx, setIdx] = useState(0);

  useEffect(() => { setTexto(value || ''); }, [value]);

  const opciones = useMemo(() => {
    const q = normalize(texto);
    return q ? ACTIVIDADES.filter(a => normalize(a).includes(q)) : ACTIVIDADES;
  }, [texto]);

  const elegir = (v) => {
    setTexto(v);
    setAbierto(false);
    onCommit(v);
  };

  const commitTexto = () => {
    setAbierto(false);
    const limpio = texto.trim();
    if (limpio !== (value || '')) onCommit(limpio || null);
  };

  const onKeyDown = (e) => {
    if (e.key === 'ArrowDown') { e.preventDefault(); setAbierto(true); setIdx(i => Math.min(i + 1, opciones.length - 1)); }
    else if (e.key === 'ArrowUp') { e.preventDefault(); setIdx(i => Math.max(i - 1, 0)); }
    else if (e.key === 'Enter') {
      e.preventDefault();
      if (abierto && opciones[idx]) elegir(opciones[idx]);
      else e.target.blur();
    } else if (e.key === 'Escape') setAbierto(false);
  };

  return (
    <div style={{ position: 'relative' }}>
      <input
        autoFocus={autoFocus}
        value={texto}
        onChange={e => { setTexto(e.target.value); setAbierto(true); setIdx(0); }}
        onFocus={() => { setAbierto(true); setIdx(0); }}
        onBlur={commitTexto}
        onKeyDown={onKeyDown}
        placeholder="Actividad"
        style={bordered ? inputStyle : { ...inputStyle, border: '1px solid transparent', background: 'transparent' }}
      />
      {abierto && opciones.length > 0 && (
        <div style={s.dropdown}>
          {opciones.map((o, i) => (
            <div
              key={o}
              onMouseDown={e => { e.preventDefault(); elegir(o); }}
              onMouseEnter={() => setIdx(i)}
              style={{ ...s.dropdownItem, background: i === idx ? '#f0f4ff' : '#fff' }}
            >
              {o}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

// ── Panel lateral: datos de cuenta corriente ────────────────────
function CuentaPanel({ proveedor, onClose, onSave }) {
  const [form, setForm] = useState(() => {
    const f = {};
    CAMPOS_CUENTA.forEach(c => { f[c.key] = proveedor[c.key] || ''; });
    return f;
  });
  const set = (k, v) => setForm(p => ({ ...p, [k]: v }));

  const guardar = () => {
    const out = {};
    CAMPOS_CUENTA.forEach(c => { out[c.key] = (form[c.key] || '').trim() || null; });
    onSave(proveedor.id, out);
    onClose();
  };

  const copiarTodo = () => {
    const texto = CAMPOS_CUENTA.map(c => `${c.label}: ${form[c.key] || ''}`).join('\n');
    if (navigator.clipboard) navigator.clipboard.writeText(texto).catch(() => {});
  };

  return (
    <div style={panelStyles.overlay} onClick={e => e.target === e.currentTarget && onClose()}>
      <div style={panelStyles.panel}>
        <div style={panelStyles.header}>
          <div>
            <div style={panelStyles.title}>{proveedor.nombre}</div>
            <div style={panelStyles.subtitle}>Datos de cuenta para transferencias</div>
          </div>
          <button onClick={onClose} style={panelStyles.closeBtn}><X size={18} /></button>
        </div>
        <div style={panelStyles.body}>
          {CAMPOS_CUENTA.map(c => (
            <div key={c.key} style={panelStyles.field}>
              <label style={panelStyles.label}>{c.label}</label>
              {c.opciones ? (
                <>
                  <input
                    list="tipos-cuenta"
                    value={form[c.key]}
                    onChange={e => set(c.key, e.target.value)}
                    placeholder="Ej: Cuenta corriente"
                    style={panelStyles.input}
                  />
                  <datalist id="tipos-cuenta">
                    {c.opciones.map(o => <option key={o} value={o} />)}
                  </datalist>
                </>
              ) : (
                <input
                  value={form[c.key]}
                  onChange={e => set(c.key, c.key === 'cta_rut' ? formatRut(e.target.value) : e.target.value)}
                  style={panelStyles.input}
                  maxLength={c.key === 'cta_rut' ? 12 : undefined}
                />
              )}
            </div>
          ))}
          <button onClick={copiarTodo} style={panelStyles.copyBtn}>Copiar todos los datos</button>
        </div>
        <div style={panelStyles.footer}>
          <button onClick={guardar} style={panelStyles.saveBtn}>Guardar</button>
          <button onClick={onClose} style={panelStyles.cancelBtn}>Cancelar</button>
        </div>
      </div>
    </div>
  );
}

// ── Panel lateral: notas ────────────────────────────────────────
function NotasPanel({ proveedor, onClose, onSave }) {
  const [texto, setTexto] = useState(proveedor.notas || '');
  return (
    <div style={panelStyles.overlay} onClick={e => e.target === e.currentTarget && onClose()}>
      <div style={panelStyles.panel}>
        <div style={panelStyles.header}>
          <div>
            <div style={panelStyles.title}>{proveedor.nombre}</div>
            <div style={panelStyles.subtitle}>Notas</div>
          </div>
          <button onClick={onClose} style={panelStyles.closeBtn}><X size={18} /></button>
        </div>
        <div style={{ ...panelStyles.body, flex: 1 }}>
          <textarea
            autoFocus
            value={texto}
            onChange={e => setTexto(e.target.value)}
            placeholder="Escribe una nota sobre este proveedor..."
            style={panelStyles.textarea}
          />
        </div>
        <div style={panelStyles.footer}>
          <button onClick={() => { onSave(proveedor.id, { notas: texto.trim() || null }); onClose(); }} style={panelStyles.saveBtn}>Guardar</button>
          <button onClick={onClose} style={panelStyles.cancelBtn}>Cancelar</button>
        </div>
      </div>
    </div>
  );
}

// ── Fila de proveedor ───────────────────────────────────────────
function ProveedorRow({ proveedor, onUpdate, onDelete, onOpenCuenta, onOpenNotas }) {
  const [confirmDelete, setConfirmDelete] = useState(false);
  const [hovered, setHovered] = useState(false);
  const extracto = extractoCuenta(proveedor);
  const tieneNotas = !!(proveedor.notas && proveedor.notas.trim());

  return (
    <tr style={{ background: hovered ? '#f8f9fa' : '#fff' }}
      onMouseEnter={() => setHovered(true)} onMouseLeave={() => { setHovered(false); setConfirmDelete(false); }}>
      <td style={{ ...s.td, width: 240, maxWidth: 240 }}>
        <InlineText value={proveedor.nombre} upper onChange={v => v && onUpdate(proveedor.id, { nombre: v })} />
      </td>
      <td style={{ ...s.td, width: 200, maxWidth: 200 }}>
        <ActividadInput value={proveedor.actividad} onCommit={v => onUpdate(proveedor.id, { actividad: v })} />
      </td>
      <td style={{ ...s.td, width: 240, maxWidth: 240, cursor: 'pointer' }} onClick={() => onOpenCuenta(proveedor)} title="Ver o editar datos de cuenta">
        <div style={{ display: 'flex', alignItems: 'center', gap: 6, minWidth: 0 }}>
          <Landmark size={13} color={extracto ? '#1a73e8' : '#dadce0'} style={{ flexShrink: 0 }} />
          <span style={{ ...s.ellipsis, color: extracto ? '#202124' : '#dadce0' }}>{extracto || 'Agregar datos'}</span>
        </div>
      </td>
      <td style={{ ...s.td, width: 140, maxWidth: 140 }}>
        <InlineText value={proveedor.telefono} onChange={v => onUpdate(proveedor.id, { telefono: v })} />
      </td>
      <td style={{ ...s.td, width: 220, maxWidth: 220 }}>
        <InlineText value={proveedor.email} onChange={v => onUpdate(proveedor.id, { email: v ? v.toLowerCase() : v })} />
      </td>
      <td style={s.tdActions}>
        <button onClick={() => onOpenNotas(proveedor)} title={tieneNotas ? proveedor.notas : 'Notas'}
          style={{ ...s.actionBtn, background: tieneNotas ? '#e8f0fe' : 'none', color: tieneNotas ? '#1a73e8' : '#9aa0a6' }}>
          <FileText size={13} />
        </button>
      </td>
      <td style={s.tdActions}>
        {confirmDelete ? (
          <>
            <button onClick={() => onDelete(proveedor.id)} style={{ ...s.actionBtn, background: '#fce8e6', color: '#ea4335' }} title="Confirmar eliminar"><Trash2 size={13} /></button>
            <button onClick={() => setConfirmDelete(false)} style={{ ...s.actionBtn, color: '#5f6368' }} title="Cancelar"><X size={12} /></button>
          </>
        ) : (
          <button onClick={() => setConfirmDelete(true)} style={{ ...s.actionBtn, color: '#9aa0a6' }} title="Eliminar"><Trash2 size={13} /></button>
        )}
      </td>
    </tr>
  );
}

// ── Fila para nuevo proveedor ───────────────────────────────────
function NuevoProveedorRow({ onSave, onCancel }) {
  const [form, setForm] = useState({ nombre: '', actividad: '', telefono: '', email: '' });
  const [error, setError] = useState(false);
  const nombreRef = useRef(null);
  const set = (k, v) => setForm(p => ({ ...p, [k]: v }));

  const guardar = () => {
    if (!form.nombre.trim()) { setError(true); nombreRef.current?.focus(); return; }
    onSave({
      nombre: form.nombre.trim(),
      actividad: form.actividad.trim() || null,
      telefono: form.telefono.trim() || null,
      email: form.email.trim().toLowerCase() || null,
    });
  };
  const onKey = (e) => { if (e.key === 'Enter') guardar(); if (e.key === 'Escape') onCancel(); };

  return (
    <tr style={{ background: '#f0f7ff' }}>
      <td style={s.td}>
        <input ref={nombreRef} autoFocus value={form.nombre} onKeyDown={onKey}
          onChange={e => { set('nombre', e.target.value.toUpperCase()); setError(false); }}
          placeholder="Nombre *" style={{ ...inputStyle, borderColor: error ? '#ea4335' : '#dadce0' }} />
      </td>
      <td style={s.td}><ActividadInput value={form.actividad} onCommit={v => set('actividad', v || '')} bordered /></td>
      <td style={{ ...s.td, fontSize: 11, color: '#9aa0a6' }}>Se completa después de guardar</td>
      <td style={s.td}><input value={form.telefono} onChange={e => set('telefono', e.target.value)} onKeyDown={onKey} placeholder="Teléfono" style={inputStyle} /></td>
      <td style={s.td}><input value={form.email} onChange={e => set('email', e.target.value)} onKeyDown={onKey} placeholder="Mail" style={inputStyle} /></td>
      <td style={s.tdActions} colSpan={2}>
        <button onClick={guardar} style={{ ...s.actionBtn, background: '#e6f4ea', color: '#34a853' }} title="Guardar">✓</button>
        <button onClick={onCancel} style={{ ...s.actionBtn, color: '#5f6368' }} title="Cancelar"><X size={13} /></button>
      </td>
    </tr>
  );
}

// ── Página ──────────────────────────────────────────────────────
export default function ProveedoresPage() {
  const [proveedores, setProveedores] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [search, setSearch] = useState('');
  const [filtroActividad, setFiltroActividad] = useState('');
  const [agregando, setAgregando] = useState(false);
  const [cuentaDe, setCuentaDe] = useState(null);
  const [notasDe, setNotasDe] = useState(null);
  const { exportToExcel } = useExcelExport();

  useEffect(() => {
    const cargar = async () => {
      setLoading(true);
      let todos = [];
      let from = 0;
      while (true) {
        const { data, error: err } = await supabase.from('proveedores').select('*').range(from, from + 999);
        if (err) { setError(`No se pudieron cargar los proveedores: ${err.message}`); break; }
        if (!data || data.length === 0) break;
        todos = [...todos, ...data];
        if (data.length < 1000) break;
        from += 1000;
      }
      setProveedores(ordenarPorNombre(todos));
      setLoading(false);
    };
    cargar();
  }, []);

  // Actividades para el filtro: las sugeridas + las escritas a mano que existan
  const actividadesFiltro = useMemo(() => {
    const set = new Set(ACTIVIDADES);
    proveedores.forEach(p => { if (p.actividad) set.add(p.actividad); });
    return [...set].sort((a, b) => a.localeCompare(b, 'es', { sensitivity: 'base' }));
  }, [proveedores]);

  // Búsqueda libre: todas las palabras deben aparecer en algún campo
  const filtrados = useMemo(() => {
    const palabras = normalize(search.trim()).split(/\s+/).filter(Boolean);
    return proveedores.filter(p => {
      if (filtroActividad && p.actividad !== filtroActividad) return false;
      if (palabras.length === 0) return true;
      const texto = normalize([
        p.nombre, p.actividad, p.telefono, p.email, p.notas,
        p.cta_nombre, p.cta_rut, p.cta_banco, p.cta_tipo, p.cta_numero, p.cta_mail,
      ].filter(Boolean).join(' '));
      return palabras.every(w => texto.includes(w));
    });
  }, [proveedores, search, filtroActividad]);

  const actualizar = async (id, cambios) => {
    const anterior = proveedores;
    setProveedores(prev => ordenarPorNombre(prev.map(p => (p.id === id ? { ...p, ...cambios } : p))));
    const { error: err } = await supabase.from('proveedores').update(cambios).eq('id', id);
    if (err) { setError(`No se pudo guardar: ${err.message}`); setProveedores(anterior); }
  };

  const crear = async (nuevo) => {
    const { data, error: err } = await supabase.from('proveedores').insert(nuevo).select().single();
    if (err) { setError(`No se pudo crear: ${err.message}`); return; }
    setProveedores(prev => ordenarPorNombre([...prev, data]));
    setAgregando(false);
  };

  const eliminar = async (id) => {
    const { error: err } = await supabase.from('proveedores').delete().eq('id', id);
    if (err) { setError(`No se pudo eliminar: ${err.message}`); return; }
    setProveedores(prev => prev.filter(p => p.id !== id));
  };

  const exportar = () => {
    exportToExcel(filtrados, [
      { key: 'nombre',     label: 'Nombre' },
      { key: 'actividad',  label: 'Actividad' },
      { key: 'cta_nombre', label: 'Cuenta - Nombre' },
      { key: 'cta_rut',    label: 'Cuenta - RUT' },
      { key: 'cta_banco',  label: 'Cuenta - Banco' },
      { key: 'cta_tipo',   label: 'Cuenta - Tipo' },
      { key: 'cta_numero', label: 'Cuenta - N°' },
      { key: 'cta_mail',   label: 'Cuenta - Mail' },
      { key: 'telefono',   label: 'Teléfono' },
      { key: 'email',      label: 'Mail' },
      { key: 'notas',      label: 'Notas' },
    ], 'Proveedores');
  };

  const hayFiltros = search.trim() || filtroActividad;
  const HEADERS = ['NOMBRE', 'ACTIVIDAD', 'CUENTA CTE', 'TELÉFONO', 'MAIL', 'NOTAS', ''];

  return (
    <div style={s.container}>
      <div style={s.header}>
        <div>
          <h1 style={s.title}>Proveedores</h1>
          <p style={s.subtitle}>{hayFiltros ? `${filtrados.length} de ${proveedores.length} proveedores` : `${proveedores.length} proveedores`}</p>
        </div>
        <div style={s.headerRight}>
          <div style={s.searchWrapper}>
            <Search size={14} color="#9aa0a6" style={{ position: 'absolute', left: 10, pointerEvents: 'none' }} />
            <input value={search} onChange={e => setSearch(e.target.value)} placeholder="Buscar nombre, actividad, banco..." style={s.searchInput} />
            {search && <button onClick={() => setSearch('')} style={s.clearSearch}><X size={12} /></button>}
          </div>
          <select value={filtroActividad} onChange={e => setFiltroActividad(e.target.value)}
            style={{ ...s.filterSelect, ...(filtroActividad ? s.filterSelectActive : {}) }}>
            <option value="">Todas las actividades</option>
            {actividadesFiltro.map(a => <option key={a} value={a}>{a}</option>)}
          </select>
          {hayFiltros && <button onClick={() => { setSearch(''); setFiltroActividad(''); }} style={s.clearFilter}>Limpiar</button>}
          <button onClick={exportar} title="Exportar a Excel" style={s.iconBtn}><Download size={15} color="#34a853" /></button>
          <button onClick={() => setAgregando(true)} disabled={agregando} style={{ ...s.addBtn, opacity: agregando ? 0.6 : 1 }}>
            <Plus size={14} style={{ marginRight: 5 }} /> Nuevo proveedor
          </button>
        </div>
      </div>

      {error && (
        <div style={s.error}>
          {error}
          <button onClick={() => setError('')} style={s.errorClose}><X size={14} /></button>
        </div>
      )}

      <div style={s.tableWrapper}>
        {loading ? <div style={s.empty}>Cargando proveedores...</div> : (
          <table style={s.table}>
            <thead>
              <tr>{HEADERS.map((h, i) => <th key={i} style={{ ...s.th, textAlign: i >= 5 ? 'center' : 'left' }}>{h}</th>)}</tr>
            </thead>
            <tbody>
              {agregando && <NuevoProveedorRow onSave={crear} onCancel={() => setAgregando(false)} />}
              {filtrados.length === 0 && !agregando ? (
                <tr><td colSpan={HEADERS.length} style={s.empty}>{hayFiltros ? 'Ningún proveedor coincide con la búsqueda.' : 'No hay proveedores registrados.'}</td></tr>
              ) : filtrados.map(p => (
                <ProveedorRow key={p.id} proveedor={p}
                  onUpdate={actualizar} onDelete={eliminar}
                  onOpenCuenta={setCuentaDe} onOpenNotas={setNotasDe} />
              ))}
            </tbody>
          </table>
        )}
      </div>

      {cuentaDe && <CuentaPanel proveedor={cuentaDe} onClose={() => setCuentaDe(null)} onSave={actualizar} />}
      {notasDe && <NotasPanel proveedor={notasDe} onClose={() => setNotasDe(null)} onSave={actualizar} />}
    </div>
  );
}

const inputStyle = { border: '1px solid #dadce0', borderRadius: 5, padding: '4px 6px', fontSize: 12, outline: 'none', fontFamily: 'inherit', width: '100%', boxSizing: 'border-box' };

const s = {
  container: { height: '100%', display: 'flex', flexDirection: 'column', overflow: 'hidden', fontFamily: "'Google Sans','Segoe UI',sans-serif" },
  header: { display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 12, flexShrink: 0, gap: 12, flexWrap: 'wrap' },
  title: { fontSize: 24, fontWeight: 700, color: '#202124', margin: '0 0 4px' },
  subtitle: { fontSize: 13, color: '#5f6368', margin: 0 },
  headerRight: { display: 'flex', alignItems: 'center', gap: 10, flexWrap: 'wrap', justifyContent: 'flex-end' },
  searchWrapper: { position: 'relative', display: 'flex', alignItems: 'center' },
  searchInput: { paddingLeft: 30, paddingRight: 28, paddingTop: 7, paddingBottom: 7, border: '1px solid #dadce0', borderRadius: 8, fontSize: 13, outline: 'none', fontFamily: 'inherit', width: 240 },
  clearSearch: { position: 'absolute', right: 8, background: 'none', border: 'none', cursor: 'pointer', padding: 2, display: 'flex', alignItems: 'center', color: '#9aa0a6' },
  filterSelect: { padding: '7px 10px', border: '1px solid #dadce0', borderRadius: 8, fontSize: 13, fontFamily: 'inherit', background: '#fff', color: '#3c4043', cursor: 'pointer', outline: 'none' },
  filterSelectActive: { borderColor: '#1a73e8', color: '#1a73e8', background: '#e8f0fe', fontWeight: 600 },
  clearFilter: { padding: '5px 10px', borderRadius: 20, border: 'none', background: 'none', fontSize: 12, cursor: 'pointer', color: '#ea4335', fontFamily: 'inherit' },
  iconBtn: { display: 'flex', alignItems: 'center', padding: '8px 10px', background: '#fff', border: '1px solid #dadce0', borderRadius: 8, cursor: 'pointer' },
  addBtn: { display: 'flex', alignItems: 'center', padding: '8px 16px', background: '#1a73e8', color: '#fff', border: 'none', borderRadius: 8, fontSize: 13, fontWeight: 500, cursor: 'pointer', fontFamily: 'inherit' },
  error: { display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 8, padding: '10px 12px', background: '#fce8e6', color: '#c5221f', borderRadius: 8, fontSize: 13, marginBottom: 10, flexShrink: 0 },
  errorClose: { background: 'none', border: 'none', cursor: 'pointer', color: 'inherit', display: 'flex' },
  tableWrapper: { flex: 1, overflow: 'auto', border: '1px solid #e8eaed', borderRadius: 12, background: '#fff' },
  table: { width: '100%', borderCollapse: 'collapse', tableLayout: 'fixed' },
  th: { padding: '10px 10px', background: '#f8f9fa', fontSize: 10, fontWeight: 700, color: '#5f6368', letterSpacing: 0.5, borderBottom: '2px solid #e8eaed', borderRight: '1px solid #e8eaed', position: 'sticky', top: 0, zIndex: 2, whiteSpace: 'nowrap' },
  td: { padding: '6px 10px', fontSize: 12, color: '#202124', borderBottom: '1px solid #e8eaed', borderRight: '1px solid #e8eaed', verticalAlign: 'middle', overflow: 'visible' },
  tdActions: { padding: '4px 6px', borderBottom: '1px solid #e8eaed', borderRight: '1px solid #e8eaed', textAlign: 'center', verticalAlign: 'middle', whiteSpace: 'nowrap', width: 64 },
  cellText: { cursor: 'text', fontSize: 12, padding: '2px 2px', minHeight: 20, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' },
  ellipsis: { overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', minWidth: 0, flex: 1 },
  actionBtn: { background: 'none', border: 'none', cursor: 'pointer', padding: '3px 4px', borderRadius: 5, display: 'inline-flex', alignItems: 'center' },
  empty: { padding: 40, textAlign: 'center', color: '#9aa0a6', fontSize: 14 },
  dropdown: { position: 'absolute', top: '100%', left: 0, minWidth: '100%', width: 'max-content', maxWidth: 280, background: '#fff', border: '1px solid #dadce0', borderRadius: 7, zIndex: 50, maxHeight: 240, overflowY: 'auto', boxShadow: '0 4px 12px rgba(0,0,0,0.12)', marginTop: 2 },
  dropdownItem: { padding: '7px 12px', fontSize: 12, cursor: 'pointer', borderBottom: '1px solid #f1f3f4', color: '#202124' },
};

const panelStyles = {
  overlay: { position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.35)', display: 'flex', justifyContent: 'flex-end', zIndex: 3000 },
  panel: { background: '#fff', width: 380, maxWidth: '100vw', height: '100vh', display: 'flex', flexDirection: 'column', boxShadow: '-4px 0 24px rgba(0,0,0,0.15)', fontFamily: "'Google Sans','Segoe UI',sans-serif" },
  header: { padding: '20px 20px 16px', borderBottom: '1px solid #e8eaed', display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', flexShrink: 0 },
  title: { fontSize: 15, fontWeight: 700, color: '#202124', marginBottom: 4 },
  subtitle: { fontSize: 12, color: '#5f6368' },
  closeBtn: { background: 'none', border: 'none', cursor: 'pointer', padding: 4, color: '#5f6368', borderRadius: 6 },
  body: { padding: 20, display: 'flex', flexDirection: 'column', gap: 14, overflowY: 'auto' },
  field: { display: 'flex', flexDirection: 'column', gap: 5 },
  label: { fontSize: 12, fontWeight: 600, color: '#5f6368' },
  input: { border: '1px solid #dadce0', borderRadius: 8, padding: '9px 11px', fontSize: 13, fontFamily: 'inherit', outline: 'none' },
  textarea: { flex: 1, minHeight: 240, border: '1px solid #dadce0', borderRadius: 8, padding: 12, fontSize: 13, fontFamily: 'inherit', resize: 'vertical', outline: 'none', lineHeight: 1.6, boxSizing: 'border-box' },
  copyBtn: { alignSelf: 'flex-start', background: 'none', border: '1px solid #dadce0', borderRadius: 6, padding: '6px 10px', fontSize: 12, color: '#1a73e8', cursor: 'pointer', fontFamily: 'inherit' },
  footer: { padding: '12px 20px', borderTop: '1px solid #e8eaed', display: 'flex', gap: 8, flexShrink: 0, marginTop: 'auto' },
  saveBtn: { flex: 1, padding: 10, background: '#1a73e8', color: '#fff', border: 'none', borderRadius: 8, fontSize: 13, fontWeight: 500, cursor: 'pointer', fontFamily: 'inherit' },
  cancelBtn: { padding: '10px 16px', background: 'none', border: '1px solid #dadce0', borderRadius: 8, fontSize: 13, cursor: 'pointer', fontFamily: 'inherit', color: '#5f6368' },
};
