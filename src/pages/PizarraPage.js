import React, { useState, useEffect, useCallback, useMemo, useRef } from 'react';
import { supabase } from '../supabaseClient';
import { useAuth } from '../context/AuthContext';
import { Plus, Check, X, Home, Trash2, Link2, Calendar } from 'lucide-react';
import UrlPublicacionModal from '../components/pizarra/UrlPublicacionModal';
import DisponibilidadSidebar from '../components/pizarra/DisponibilidadSidebar';



// ── PropertyAutocomplete (inline) ─────────────────────────────
const normalizeStr = (str) =>
  str.toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '');

const transformAddress = (full) => {
  const short = full.split(',')[0].trim();
  return short
    .replace(/\bDepartamento\s+/gi, 'D')
    .replace(/\bCasa\s+/gi, 'C');
};

// onSelect recibe el objeto completo { propiedad, e1, e2 } para autocompletar encargados
function PropertyAutocomplete({ value, onChange, onSelect, placeholder = 'Dirección *', hasError = false, inputStyle = {} }) {
  const [properties, setProperties] = useState([]);
  const [open, setOpen] = useState(false);
  const [focused, setFocused] = useState(false);
  const containerRef = useRef(null);

  useEffect(() => {
    const load = async () => {
      let all = [];
      let from = 0;
      while (true) {
        // Cargar también e1 y e2 para autocompletar encargados
        const { data, error } = await supabase.from('properties').select('propiedad, e1, e2').range(from, from + 999);
        if (error || !data || data.length === 0) break;
        all = [...all, ...data];
        if (data.length < 1000) break;
        from += 1000;
      }
      setProperties(all);
    };
    load();
  }, []);

  const suggestions = useMemo(() => {
    if (!value || value.trim().length < 2) return [];
    const words = normalizeStr(value.trim()).split(/\s+/).filter(Boolean);
    return properties
      .filter(p => {
        const norm = normalizeStr(p.propiedad);
        return words.every(w => norm.includes(w));
      })
      .slice(0, 8);
  }, [value, properties]);

  useEffect(() => {
    const handleClick = (e) => {
      if (containerRef.current && !containerRef.current.contains(e.target)) setOpen(false);
    };
    document.addEventListener('mousedown', handleClick);
    return () => document.removeEventListener('mousedown', handleClick);
  }, []);

  const handleSelect = (item) => {
    onChange(transformAddress(item.propiedad));
    // Notificar e1/e2 al padre si se proveyó callback
    if (onSelect) onSelect({ e1: item.e1 || '', e2: item.e2 || '' });
    setOpen(false);
  };

  const showDropdown = open && focused && suggestions.length > 0;

  return (
    <div ref={containerRef} style={{ position: 'relative', width: '100%' }}>
      <input
        value={value}
        onChange={e => { onChange(e.target.value.toUpperCase()); setOpen(true); }}
        onFocus={() => { setFocused(true); setOpen(true); }}
        onBlur={() => setTimeout(() => setFocused(false), 150)}
        placeholder={placeholder}
        style={{
          border: hasError ? '1px solid #ea4335' : '1px solid #dadce0',
          borderRadius: 6,
          padding: '0 6px',
          fontSize: 12,
          outline: 'none',
          fontFamily: 'inherit',
          width: '100%',
          height: 28,
          boxSizing: 'border-box',
          background: hasError ? '#fce8e6' : '#fff',
          ...inputStyle,
        }}
      />
      {showDropdown && (
        <div style={{
          position: 'absolute', top: '100%', left: 0, right: 0,
          background: '#fff', border: '1px solid #dadce0', borderRadius: 8,
          boxShadow: '0 4px 16px rgba(0,0,0,0.12)', zIndex: 9999,
          marginTop: 2, overflow: 'hidden',
        }}>
          {suggestions.map((item, i) => (
            <div key={i} onMouseDown={() => handleSelect(item)}
              style={{
                padding: '8px 12px', fontSize: 12, cursor: 'pointer',
                borderBottom: i < suggestions.length - 1 ? '1px solid #f1f3f4' : 'none',
                color: '#202124', lineHeight: 1.4,
              }}
              onMouseEnter={e => e.currentTarget.style.background = '#f0f7ff'}
              onMouseLeave={e => e.currentTarget.style.background = '#fff'}>
              <div style={{ fontWeight: 600 }}>{transformAddress(item.propiedad)}</div>
              <div style={{ fontSize: 11, color: '#9aa0a6', marginTop: 1 }}>
                {item.propiedad}
                {(item.e1 || item.e2) && (
                  <span style={{ marginLeft: 8, color: '#1a73e8' }}>
                    {[item.e1, item.e2].filter(Boolean).join(' / ')}
                  </span>
                )}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

const ENCARGADO_EMAIL = {
  DD: 'ddm@renovalpropiedades.com',
  FD: 'fdm@renovalpropiedades.com',
  EA: 'edith@renovalpropiedades.com',
  FG: 'fernanda@renovalpropiedades.com',
};

const useUFValue = () => {
  const [uf, setUf] = useState(null);
  useEffect(() => {
    const today = new Date();
    const y = today.getFullYear();
    const m = String(today.getMonth() + 1).padStart(2, '0');
    const d = String(today.getDate()).padStart(2, '0');
    fetch(`https://mindicador.cl/api/uf/${d}-${m}-${y}`)
      .then(r => r.json())
      .then(data => { const val = data?.serie?.[0]?.valor; if (val) setUf(val); })
      .catch(() => {});
  }, []);
  return uf;
};

const daysDiff = (dateStr) => {
  if (!dateStr) return null;
  const [y, m, d] = dateStr.split('-').map(Number);
  return Math.floor((new Date() - new Date(y, m - 1, d)) / (1000 * 60 * 60 * 24));
};

const formatCLP = (n) => {
  if (!n && n !== 0) return '';
  return '$' + Math.round(n).toLocaleString('es-CL');
};

const formatDateCL = (iso) => {
  if (!iso) return '';
  return new Date(iso + 'T12:00:00').toLocaleDateString('es-CL');
};

const parsePrice = (val) => {
  if (!val) return { amount: null, isUF: false };
  const str = String(val).trim();
  const ufMatch = str.match(/^UF\s*([\d.,]+)$/i);
  if (ufMatch) {
    const n = parseFloat(ufMatch[1].replace(',', '.'));
    return { amount: n, isUF: true };
  }
  // Eliminar puntos de miles y símbolo $, luego parsear
  const n = parseFloat(str.replace(/\$/g, '').replace(/\./g, '').replace(',', '.'));
  return { amount: isNaN(n) ? null : n, isUF: false };
};

const ENCARGADO_COLORS = { DD: '#1565C0', FD: '#2E7D32', EA: '#6A1B9A', FG: '#E65100' };

const UrgentDot = () => (
  <span style={{ display: 'inline-flex', alignItems: 'center', justifyContent: 'center', width: 14, height: 14, borderRadius: '50%', background: '#ea4335', color: '#fff', fontSize: 10, fontWeight: 900, flexShrink: 0, marginRight: 4 }}>!</span>
);

const EMPTY_FORM = {
  propiedad: '', precio: '', promo: '', status: '', e1: '', e2: '', db: '', eb: '', comuna: '',
  fecha_salida: '', aviso: 'Aún no', respaldo: 'Aún no', tipo: '', admin: '', url_publicacion: '',
};

// ── Auto task creation ────────────────────────────────────────
async function createAutoTasks(trigger, propiedad, e1, e2, tipo, fechaEntrega) {
  const { data: templates } = await supabase
    .from('task_templates').select('*').eq('trigger', trigger).eq('active', true)
    .order('position', { ascending: true });
  if (!templates || templates.length === 0) return;
  const tipoNorm = (tipo || '').toLowerCase().trim();
  const esNuevo = tipoNorm === 'nuevo';
  for (const tpl of templates) {
    if (trigger === 'pizarra_nueva_propiedad') {
      if (esNuevo && (tpl.condition === 'renovacion' || tpl.condition === 'renovacion_dev_gar')) continue;
      if (!esNuevo && tpl.condition === 'nuevo') continue;
    }
    const assigneeEmail = tpl.assignee_role === 'e1' ? ENCARGADO_EMAIL[e1] : ENCARGADO_EMAIL[e2];
    if (!assigneeEmail) continue;
    const taskTitle = tpl.task_title.replace('{{propiedad}}', propiedad);
    if (tpl.condition === 'renovacion_dev_gar') {
      if (!fechaEntrega) continue;
      const base = new Date(fechaEntrega + 'T12:00:00');
      base.setDate(base.getDate() + 52);
      const nextOcc = base.toISOString().split('T')[0];
      await supabase.from('tasks').insert({
        owner_email: assigneeEmail, title: taskTitle, category: 'Publicar/Arrendar',
        completed: false, recurrence: 'none', next_occurrence: nextOcc, position: -Date.now(),
        notes: `Dev Gar programada para ${nextOcc}`,
      });
      continue;
    }
    const category = trigger === 'pizarra_nueva_propiedad' ? 'Publicar/Arrendar' : 'Llegada arrendatario';
    const { data: parentTask } = await supabase.from('tasks').insert({
      owner_email: assigneeEmail, title: taskTitle, category,
      completed: false, recurrence: 'none', position: -Date.now(),
    }).select().single();
    if (!parentTask) continue;
    const subtasks = tpl.subtasks || [];
    for (let i = 0; i < subtasks.length; i++) {
      await supabase.from('tasks').insert({
        owner_email: assigneeEmail, title: subtasks[i], category,
        parent_id: parentTask.id, completed: false, position: i,
      });
    }
  }
}

// ── SlashInput ────────────────────────────────────────────────
function SlashInput({ value, onChange }) {
  const [editing, setEditing] = useState(false);
  const leftRef = useRef(null);

  const parts = (value || '').split('/');
  const left  = parts[0] || '';
  const right = parts[1] !== undefined ? parts[1] : '';

  const update = (l, r) => onChange(`${l}/${r}`);

  if (editing) {
    return (
      <div style={{ display: 'inline-flex', alignItems: 'center', gap: 3 }}
        onBlur={e => {
          if (!e.currentTarget.contains(e.relatedTarget)) setEditing(false);
        }}>
        <input ref={leftRef} autoFocus value={left} maxLength={1}
          onChange={e => update(e.target.value.replace(/[^0-9]/g, ''), right)}
          style={slashInputStyle} />
        <span style={{ fontSize: 12, color: '#5f6368' }}>/</span>
        <input value={right} maxLength={1}
          onChange={e => update(left, e.target.value.replace(/[^0-9]/g, ''))}
          style={slashInputStyle} />
      </div>
    );
  }

  return (
    <div onClick={() => setEditing(true)}
      style={{ cursor: 'text', fontSize: 12, display: 'flex', alignItems: 'center', justifyContent: 'center', height: '100%', padding: '0 2px' }}>
      {(left || right)
        ? <span>{left || '—'}/{right || '—'}</span>
        : <span style={{ color: '#dadce0' }}>—</span>}
    </div>
  );
}

const slashInputStyle = {
  width: 22, height: 24, border: '1px solid #dadce0', borderRadius: 4,
  textAlign: 'center', fontSize: 12, outline: 'none', fontFamily: 'inherit',
  background: '#fff', boxSizing: 'border-box', padding: 0,
};

// ── PriceInput ────────────────────────────────────────────────
// Fixes:
// 1. displayRaw nunca formatea con toLocaleString para evitar el loop de puntos
// 2. onBlur guarda aunque raw esté vacío (permite dejar la celda vacía)
function PriceInput({ value, onChange, uf, isNew }) {
  const [editing, setEditing] = useState(false);
  const [currency, setCurrency] = useState('CLP');
  const [raw, setRaw] = useState('');
  const { amount, isUF } = parsePrice(value || '');

  const displayMain = value
    ? isUF ? `UF ${amount}` : (amount ? formatCLP(amount) : value)
    : '';
  const displaySub = isUF && uf && amount ? formatCLP(amount * uf) : '';

  const startEditing = () => {
    setCurrency(isUF ? 'UF' : 'CLP');
    // raw siempre como número limpio sin puntos ni $
    setRaw(amount != null ? String(amount) : '');
    setEditing(true);
  };

  const commitEdit = () => {
    setEditing(false);
    if (raw === '') {
      // Permitir dejar vacío
      onChange('');
    } else {
      onChange(currency === 'UF' ? `UF ${raw}` : raw);
    }
  };

  if (editing) {
    return (
      <div style={{ display: 'flex', alignItems: 'center', border: '1px solid #1a73e8', borderRadius: 6, overflow: 'hidden', background: '#fff', height: 28, boxSizing: 'border-box' }}>
        <select value={currency}
          onMouseDown={e => e.stopPropagation()}
          onChange={e => setCurrency(e.target.value)}
          style={{ border: 'none', outline: 'none', background: '#f8f9fa', fontSize: 11, padding: '0 4px', cursor: 'pointer', fontFamily: 'inherit', borderRight: '1px solid #e8eaed', height: '100%' }}>
          <option value="CLP">$</option>
          <option value="UF">UF</option>
        </select>
        <input autoFocus
          value={raw}
          onChange={e => setRaw(e.target.value.replace(/[^0-9.]/g, ''))}
          onBlur={e => {
            if (e.relatedTarget && e.relatedTarget.tagName === 'SELECT') return;
            commitEdit();
          }}
          onKeyDown={e => e.key === 'Enter' && e.target.blur()}
          style={{ border: 'none', outline: 'none', width: 80, fontSize: 12, padding: '0 5px', fontFamily: 'inherit' }} />
      </div>
    );
  }

  if (isNew) {
    return (
      <div onClick={startEditing}
        style={{ cursor: 'text', fontSize: 12, height: 28, boxSizing: 'border-box', border: '1px solid #dadce0', borderRadius: 6, background: '#fff', padding: '0 6px', display: 'flex', alignItems: 'center', minWidth: 80 }}>
        {displayMain ? <span>{displayMain}</span> : <span style={{ color: '#9aa0a6' }}>—</span>}
      </div>
    );
  }

  return (
    <div onClick={startEditing}
      style={{ cursor: 'text', fontSize: 12, padding: '2px 4px', borderRadius: 4, minWidth: 60 }}>
      {displayMain ? (
        <div>
          <div>{displayMain}</div>
          {displaySub && <div style={{ fontSize: 10, color: '#5f6368', marginTop: 1 }}>{displaySub}</div>}
        </div>
      ) : <span style={{ color: '#dadce0' }}>—</span>}
    </div>
  );
}

// ── DateCellInput ─────────────────────────────────────────────
function DateCellInput({ value, onChange }) {
  const ref = useRef(null);
  return (
    <div onClick={() => ref.current && ref.current.showPicker && ref.current.showPicker()}
      style={{ cursor: 'pointer', fontSize: 11, color: value ? 'inherit' : '#9aa0a6', position: 'relative' }}>
      {value ? formatDateCL(value) : <span style={{ color: '#dadce0' }}>—</span>}
      <input ref={ref} type="date" value={value || ''} onChange={e => onChange(e.target.value)}
        style={{ position: 'absolute', opacity: 0, pointerEvents: 'none', width: 0, height: 0 }} />
    </div>
  );
}

// ── DateFieldNew ──────────────────────────────────────────────
function DateFieldNew({ value, onChange, hasError }) {
  const ref = useRef(null);
  const openPicker = () => ref.current && ref.current.showPicker && ref.current.showPicker();
  return (
    <div onClick={openPicker} style={{
      display: 'flex', alignItems: 'center', justifyContent: 'space-between',
      border: hasError ? '1px solid #ea4335' : '1px solid #dadce0',
      borderRadius: 6, background: hasError ? '#fce8e6' : '#fff',
      padding: '0 6px', height: 28, cursor: 'pointer', minWidth: 100, boxSizing: 'border-box',
      position: 'relative',
    }}>
      <span style={{ fontSize: 12, color: value ? '#202124' : '#9aa0a6', userSelect: 'none' }}>
        {value ? formatDateCL(value) : 'dd/mm/aaaa'}
      </span>
      <Calendar size={13} style={{ color: hasError ? '#ea4335' : '#9aa0a6', flexShrink: 0, marginLeft: 4 }} />
      <input ref={ref} type="date" value={value || ''} onChange={e => onChange(e.target.value)}
        style={{ position: 'absolute', opacity: 0, pointerEvents: 'none', width: 0, height: 0 }} />
    </div>
  );
}

// ── RentModal ─────────────────────────────────────────────────
function RentModal({ row, onConfirm, onCancel, uf }) {
  const [comision, setComision] = useState('');
  const [entrega, setEntrega] = useState('');
  const [meses, setMeses] = useState('');
  const hasPromo = !!(row.promo && String(row.promo).trim());
  const ref = useRef(null);

  return (
    <div style={rentStyles.overlay} onClick={e => e.target === e.currentTarget && onCancel()}>
      <div style={rentStyles.modal}>
        <h3 style={rentStyles.title}>Registrar arriendo</h3>
        <p style={rentStyles.prop}>{row.propiedad}</p>
        <div style={rentStyles.field}>
          <label style={rentStyles.label}>Comisión *</label>
          <div style={{ ...rentStyles.input, display: 'flex', alignItems: 'center', padding: '9px 12px' }}>
            <span style={{ color: '#9aa0a6', marginRight: 4 }}>$</span>
            <input value={comision} onChange={e => setComision(e.target.value.replace(/[^0-9.]/g, ''))}
              autoFocus style={{ border: 'none', outline: 'none', flex: 1, fontSize: 14, fontFamily: 'inherit' }} />
          </div>
        </div>
        <div style={rentStyles.field}>
          <label style={rentStyles.label}>Fecha de entrega * <span style={{ fontSize: 11, color: '#9aa0a6' }}>(dd/mm/aaaa)</span></label>
          <div onClick={() => ref.current && ref.current.showPicker && ref.current.showPicker()}
            style={{ ...rentStyles.input, cursor: 'pointer', display: 'flex', alignItems: 'center', position: 'relative', color: entrega ? '#202124' : '#9aa0a6' }}>
            {entrega ? formatDateCL(entrega) : 'Seleccionar fecha...'}
            <input ref={ref} type="date" value={entrega} onChange={e => setEntrega(e.target.value)}
              style={{ position: 'absolute', opacity: 0, pointerEvents: 'none', width: 0, height: 0 }} />
          </div>
        </div>
        {hasPromo && (
          <div style={rentStyles.field}>
            <label style={rentStyles.label}>Meses con promoción</label>
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6, marginTop: 4 }}>
              {['Enero','Febrero','Marzo','Abril','Mayo','Junio','Julio','Agosto','Septiembre','Octubre','Noviembre','Diciembre'].map(m => {
                const selected = meses.split(',').map(s=>s.trim()).filter(Boolean).includes(m);
                return (
                  <button key={m} type="button" onClick={() => {
                    const list = meses.split(',').map(s=>s.trim()).filter(Boolean);
                    setMeses((selected ? list.filter(x=>x!==m) : [...list,m]).join(', '));
                  }} style={{ padding: '4px 10px', borderRadius: 20, fontSize: 12, cursor: 'pointer', border: selected ? '1px solid #1a73e8' : '1px solid #dadce0', background: selected ? '#e8f0fe' : '#fff', color: selected ? '#1a73e8' : '#5f6368', fontWeight: selected ? 700 : 400 }}>{m}</button>
                );
              })}
            </div>
          </div>
        )}
        <div style={rentStyles.actions}>
          <button onClick={() => comision && entrega && onConfirm({ comision, entrega, meses: hasPromo ? meses : '' })}
            disabled={!comision || !entrega}
            style={{ ...rentStyles.confirmBtn, ...(!comision || !entrega ? { background: '#e8eaed', color: '#9aa0a6', cursor: 'not-allowed' } : {}) }}>
            Confirmar arriendo
          </button>
          <button onClick={onCancel} style={rentStyles.cancelBtn}>Cancelar</button>
        </div>
      </div>
    </div>
  );
}

const rentStyles = {
  overlay: { position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.4)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 3000 },
  modal: { background: '#fff', borderRadius: 16, padding: 28, width: 420, boxShadow: '0 8px 32px rgba(0,0,0,0.18)', fontFamily: "'Google Sans', 'Segoe UI', sans-serif" },
  title: { fontSize: 18, fontWeight: 700, color: '#202124', margin: '0 0 6px' },
  prop: { fontSize: 13, color: '#5f6368', margin: '0 0 20px', padding: '8px 12px', background: '#f8f9fa', borderRadius: 8 },
  field: { marginBottom: 14 },
  label: { fontSize: 12, fontWeight: 600, color: '#5f6368', display: 'block', marginBottom: 6 },
  input: { width: '100%', border: '1px solid #dadce0', borderRadius: 8, padding: '9px 12px', fontSize: 14, outline: 'none', fontFamily: 'inherit', boxSizing: 'border-box' },
  actions: { display: 'flex', gap: 8, marginTop: 20 },
  confirmBtn: { flex: 1, padding: '10px', background: '#1a73e8', color: '#fff', border: 'none', borderRadius: 8, fontSize: 14, fontWeight: 500, cursor: 'pointer', fontFamily: 'inherit' },
  cancelBtn: { padding: '10px 16px', background: 'none', border: '1px solid #dadce0', borderRadius: 8, fontSize: 14, cursor: 'pointer', fontFamily: 'inherit', color: '#5f6368' },
};

// ── InlineEditCell ─────────────────────────────────────────────
function InlineEditCell({ value, onChange, uppercase }) {
  const [editing, setEditing] = useState(false);
  const [raw, setRaw] = useState(value || '');
  if (editing) return (
    <input autoFocus value={raw}
      onChange={e => setRaw(uppercase ? e.target.value.toUpperCase() : e.target.value)}
      onBlur={() => { setEditing(false); if (raw !== value) onChange(raw); }}
      onKeyDown={e => e.key === 'Enter' && e.target.blur()}
      style={{ border: '1px solid #1a73e8', borderRadius: 6, padding: '3px 6px', fontSize: 12, outline: 'none', fontFamily: 'inherit', width: '100%' }} />
  );
  return (
    <div onClick={() => { setRaw(value || ''); setEditing(true); }}
      style={{ cursor: 'text', fontSize: 12, display: 'flex', alignItems: 'center', height: '100%', padding: '0 2px' }}>
      {value || <span style={{ color: '#dadce0' }}>—</span>}
    </div>
  );
}

function InlineSelectCell({ value, options, onChange }) {
  return (
    <select value={value || ''} onChange={e => onChange(e.target.value)}
      style={{ border: 'none', outline: 'none', background: 'transparent', cursor: 'pointer', fontFamily: 'inherit', fontSize: 12, width: '100%', appearance: 'none', WebkitAppearance: 'none', textAlign: 'center', lineHeight: 1 }}>
      <option value="">—</option>
      {options.map(o => <option key={o} value={o}>{o}</option>)}
    </select>
  );
}

const newRowInput = {
  border: '1px solid #dadce0', borderRadius: 6, fontSize: 12, outline: 'none',
  fontFamily: 'inherit', background: '#fff', height: 28, boxSizing: 'border-box',
  padding: '0 6px',
};
const newRowSelect = {
  border: '1px solid #dadce0', borderRadius: 6, fontSize: 12, outline: 'none',
  fontFamily: 'inherit', background: '#fff', height: 28, boxSizing: 'border-box',
  padding: '0 4px', cursor: 'pointer',
};

function SlashInputNew({ value, onChange }) {
  const parts = (value || '').split('/');
  const left  = parts[0] || '';
  const right = parts[1] !== undefined ? parts[1] : '';
  const update = (l, r) => onChange(`${l}/${r}`);
  return (
    <div style={{ display: 'inline-flex', alignItems: 'center', gap: 3 }}>
      <input value={left} maxLength={1}
        onChange={e => update(e.target.value.replace(/[^0-9]/g, ''), right)}
        style={slashInputStyle} />
      <span style={{ fontSize: 12, color: '#5f6368' }}>/</span>
      <input value={right} maxLength={1}
        onChange={e => update(left, e.target.value.replace(/[^0-9]/g, ''))}
        style={slashInputStyle} />
    </div>
  );
}

// ── PropertyRow ───────────────────────────────────────────────
function PropertyRow({ row, onSave, onDelete, onRented, isNew=false, onCancelNew, uf, onOpenUrlModal, onOpenDisponibilidad }) {
  const [form, setForm] = useState({ ...EMPTY_FORM, ...row });
  const [attempted, setAttempted] = useState(false);
  const [confirmDelete, setConfirmDelete] = useState(false);

  useEffect(() => { setForm(prev => ({ ...prev, ...row })); }, [row]);

  const errors = attempted ? {
    propiedad:   !form.propiedad.trim(),
    fecha_salida: !form.fecha_salida,
    e1:           !form.e1,
    e2:           !form.e2,
    tipo:         !form.tipo,
    admin:        !form.admin,
  } : {};

  const set = (k, v) => {
    setForm(prev => ({ ...prev, [k]: v }));
    if (!isNew) supabase.from('pizarra').update({ [k]: v || null }).eq('id', row.id).then(() => onSave({ ...row, [k]: v }));
  };

  const handleNewSave = async () => {
    setAttempted(true);
    const hasErrors = !form.propiedad.trim() || !form.fecha_salida || !form.e1 || !form.e2 || !form.tipo || !form.admin;
    if (hasErrors) return;
    await onSave(form);
    if (onCancelNew) onCancelNew();
  };

  // Callback para autocompletar E1/E2 desde Cartera al seleccionar propiedad
  const handlePropSelect = ({ e1, e2 }) => {
    if (isNew) {
      setForm(prev => ({
        ...prev,
        e1: e1 || prev.e1,
        e2: e2 || prev.e2,
      }));
    }
  };

  const days = daysDiff(form.fecha_salida);
  const isOverdue = days !== null && days >= 60;
  const showAlert = isOverdue || form.aviso !== 'Listo';

  const AvisoCell = ({ field }) => (
    <select value={form[field] || ''} onChange={e => set(field, e.target.value)}
      style={{ border: 'none', outline: 'none', fontFamily: 'inherit', fontSize: 11, fontWeight: 600, cursor: 'pointer', background: 'transparent', lineHeight: 1, color: form[field] === 'Listo' ? '#34a853' : form[field] === 'Aún no' ? '#fff' : '#202124', ...(form[field] === 'Aún no' ? { background: '#ea4335', borderRadius: 4, padding: '2px 4px' } : {}) }}>
      <option value="" style={{ color: '#202124', background: '#fff' }}>—</option>
      {['Aún no','Listo'].map(o => <option key={o} value={o} style={{ color: '#202124', background: '#fff' }}>{o}</option>)}
    </select>
  );

  const reqWrapper = (field) => ({
    border: errors[field] ? '1px solid #ea4335' : '1px solid #dadce0',
    background: errors[field] ? '#fce8e6' : '#fff',
    borderRadius: 6, height: 28, boxSizing: 'border-box',
    display: 'inline-flex', alignItems: 'center', width: '100%',
  });
  const selectInsideWrapper = {
    border: 'none', outline: 'none', background: 'transparent',
    fontSize: 12, fontFamily: 'inherit', cursor: 'pointer',
    height: '100%', width: '100%', padding: '0 4px',
  };

  if (isNew) return (
    <tr style={{ background: '#f0f7ff', borderBottom: '1px solid #e8eaed' }}>
      <td style={styles.tdProp}>
        <PropertyAutocomplete
          value={form.propiedad}
          onChange={v => setForm(p => ({ ...p, propiedad: v }))}
          onSelect={handlePropSelect}
          hasError={!!errors.propiedad}
          inputStyle={{ height: 28, boxSizing: 'border-box', fontSize: 12 }}
        />
      </td>
      <td style={styles.tdCenter}>
        <PriceInput value={form.precio} onChange={v=>setForm(p=>({...p,precio:v}))} uf={uf} isNew={true} />
      </td>
      <td style={styles.tdCenter}>
        <PriceInput value={form.promo} onChange={v=>setForm(p=>({...p,promo:v}))} uf={uf} isNew={true} />
      </td>
      <td style={styles.tdCenter}>
        <select value={form.status||'Aún no'} onChange={e=>setForm(p=>({...p,status:e.target.value}))} style={newRowSelect}>
          <option value="Aún no">Aún no</option>
          <option value="Listo">Listo</option>
        </select>
      </td>
      <td style={styles.tdCenter}>
        <div style={reqWrapper('e1')}>
          <select value={form.e1||''} onChange={e=>setForm(p=>({...p,e1:e.target.value}))} style={selectInsideWrapper}>
            <option value="">—</option><option>DD</option><option>FD</option>
          </select>
        </div>
      </td>
      <td style={styles.tdCenter}>
        <div style={reqWrapper('e2')}>
          <select value={form.e2||''} onChange={e=>setForm(p=>({...p,e2:e.target.value}))} style={selectInsideWrapper}>
            <option value="">—</option><option>EA</option><option>FG</option>
          </select>
        </div>
      </td>
      <td style={styles.tdCenter}>
        <SlashInputNew value={form.db||''} onChange={v=>setForm(p=>({...p,db:v}))} />
      </td>
      <td style={styles.tdCenter}>
        <SlashInputNew value={form.eb||''} onChange={v=>setForm(p=>({...p,eb:v}))} />
      </td>
      <td style={styles.tdCenter}>
        <input value={form.comuna||''} onChange={e=>setForm(p=>({...p,comuna:e.target.value.toUpperCase()}))}
          style={{ ...newRowInput, display: 'block', width: 90 }} />
      </td>
      <td style={styles.tdCenter}>
        <DateFieldNew value={form.fecha_salida} onChange={v=>setForm(p=>({...p,fecha_salida:v}))} hasError={!!errors.fecha_salida} />
      </td>
      <td style={styles.tdCenter}>
        <select value={form.aviso||'Aún no'} onChange={e=>setForm(p=>({...p,aviso:e.target.value}))} style={newRowSelect}>
          <option value="Aún no">Aún no</option><option value="Listo">Listo</option>
        </select>
      </td>
      <td style={styles.tdCenter}>
        <select value={form.respaldo||'Aún no'} onChange={e=>setForm(p=>({...p,respaldo:e.target.value}))} style={newRowSelect}>
          <option value="Aún no">Aún no</option><option value="Listo">Listo</option>
        </select>
      </td>
      <td style={styles.tdCenter}>
        <div style={reqWrapper('tipo')}>
          <select value={form.tipo||''} onChange={e=>setForm(p=>({...p,tipo:e.target.value}))} style={selectInsideWrapper}>
            <option value="">—</option><option>Nuevo</option><option>Renovación</option>
          </select>
        </div>
      </td>
      <td style={styles.tdCenter}>
        <div style={reqWrapper('admin')}>
          <select value={form.admin||''} onChange={e=>setForm(p=>({...p,admin:e.target.value}))} style={selectInsideWrapper}>
            <option value="">—</option><option>Sí</option><option>No</option>
          </select>
        </div>
      </td>
      <td style={styles.tdCenter}><span style={{ color: '#dadce0', fontSize: 11 }}>—</span></td>
      <td style={styles.tdActions}>
        <button onClick={handleNewSave} style={styles.actionBtnGreen}><Check size={14} /></button>
        <button onClick={onCancelNew} style={styles.actionBtnGray}><X size={14} /></button>
      </td>
    </tr>
  );

  return (
    <tr style={{ background: '#fff' }}
      onMouseEnter={e => e.currentTarget.style.background = '#f8f9fa'}
      onMouseLeave={e => e.currentTarget.style.background = '#fff'}>
      <td style={styles.tdProp}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
          {showAlert && <UrgentDot />}
          <InlineEditCell value={form.propiedad} onChange={v => set('propiedad', v)} uppercase />
        </div>
      </td>
      <td style={styles.td}>
        <PriceInput value={form.precio} onChange={v => set('precio', v)} uf={uf} />
      </td>
      <td style={styles.td}>
        <PriceInput value={form.promo} onChange={v => set('promo', v)} uf={uf} />
      </td>
      <td style={{ ...styles.td, ...(form.status?.toUpperCase() === 'PUBLICAR' ? { background: '#FDD835' } : {}) }}>
        <select value={form.status || ''} onChange={e => set('status', e.target.value)}
          style={{ border: 'none', outline: 'none', fontFamily: 'inherit', fontSize: 11, fontWeight: 600, cursor: 'pointer', background: 'transparent', lineHeight: 1, color: form.status === 'Listo' ? '#34a853' : '#202124', ...(form.status === 'Aún no' ? { background: '#FFF9C4', borderRadius: 4, padding: '2px 4px' } : {}) }}>
          <option value="">—</option>
          <option value="Aún no">Aún no</option>
          <option value="Listo">Listo</option>
        </select>
      </td>
      <td style={styles.tdCenter}><InlineSelectCell value={form.e1} options={['DD','FD']} onChange={v => set('e1', v)} /></td>
      <td style={styles.tdCenter}><InlineSelectCell value={form.e2} options={['EA','FG']} onChange={v => set('e2', v)} /></td>
      <td style={styles.tdCenter}><SlashInput value={form.db} onChange={v => set('db', v)} /></td>
      <td style={styles.tdCenter}><SlashInput value={form.eb} onChange={v => set('eb', v)} /></td>
      <td style={styles.td}><InlineEditCell value={form.comuna} onChange={v => set('comuna', v)} uppercase /></td>
      <td style={styles.tdCenter}>
        <DateCellInput value={form.fecha_salida} onChange={v => set('fecha_salida', v)} />
      </td>
      <td style={styles.tdCenter}><AvisoCell field="aviso" /></td>
      <td style={styles.tdCenter}><AvisoCell field="respaldo" /></td>
      <td style={styles.tdCenter}><InlineSelectCell value={form.tipo} options={['Nuevo','Renovación']} onChange={v => set('tipo', v)} /></td>
      <td style={styles.tdCenter}><InlineSelectCell value={form.admin} options={['Sí','No']} onChange={v => set('admin', v)} /></td>
      <td style={styles.tdCenter}>
        <button onClick={() => onOpenUrlModal(row)}
          style={{ ...styles.urlBtn, ...(form.url_publicacion ? styles.urlBtnActive : styles.urlBtnInactive) }}
          title={form.url_publicacion ? 'URL cargada' : 'Sin URL'}>
          <Link2 size={13} />
        </button>
      </td>
      <td style={styles.tdActions}>
        <button onClick={() => onOpenDisponibilidad(row)} style={styles.actionBtnPurple}><Calendar size={13} /></button>
        <button onClick={() => onRented(row)} style={styles.actionBtnBlue}><Home size={13} /></button>
        {confirmDelete ? (
          <>
            <button onClick={async () => { await onDelete(row.id); }} style={styles.actionBtnRed}><Trash2 size={13} /></button>
            <button onClick={() => setConfirmDelete(false)} style={styles.actionBtnGray}><X size={12} /></button>
          </>
        ) : (
          <button onClick={() => setConfirmDelete(true)} style={styles.actionBtnGray}><Trash2 size={13} /></button>
        )}
      </td>
    </tr>
  );
}

const ENCARGADOS_ALL = ['DD', 'FD', 'EA', 'FG'];

export default function PizarraPage() {
  useAuth();
  const [rows, setRows] = useState([]);
  const [loading, setLoading] = useState(true);
  const [addingNew, setAddingNew] = useState(false);
  const [rentingRow, setRentingRow] = useState(null);
  const [urlModalRow, setUrlModalRow] = useState(null);
  const [disponibilidadRow, setDisponibilidadRow] = useState(null);
  const [filterE, setFilterE] = useState([]);
  const uf = useUFValue();

  const fetchRows = useCallback(async () => {
    setLoading(true);
    const { data } = await supabase.from('pizarra').select('*')
      .order('position', { ascending: true }).order('created_at', { ascending: false });
    setRows(data || []);
    setLoading(false);
  }, []);

  useEffect(() => { fetchRows(); }, [fetchRows]);

  useEffect(() => {
    const channel = supabase.channel('pizarra_realtime')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'pizarra' }, (payload) => {
        if (payload.eventType === 'INSERT') setRows(prev => [payload.new, ...prev]);
        else if (payload.eventType === 'UPDATE') setRows(prev => prev.map(r => r.id === payload.new.id ? payload.new : r));
        else if (payload.eventType === 'DELETE') setRows(prev => prev.filter(r => r.id !== payload.old.id));
      }).subscribe();
    return () => supabase.removeChannel(channel);
  }, []);

  const filtered = useMemo(() => {
    if (!filterE.length) return rows;
    return rows.filter(r => filterE.every(e => [r.e1, r.e2].includes(e)));
  }, [rows, filterE]);

  const totals = useMemo(() => {
    let totalCLP = 0, opCount = 0;
    filtered.forEach(r => {
      if (r.destaque === 'OP') opCount++;
      const { amount, isUF } = parsePrice(r.precio);
      if (amount) totalCLP += isUF && uf ? amount * uf : isUF ? 0 : amount;
    });
    return { totalCLP, opCount };
  }, [filtered, uf]);

  const handleSave = async (form) => {
    if (form.id) {
      setRows(prev => prev.map(r => r.id === form.id ? { ...r, ...form } : r));
    } else {
      const payload = {
        propiedad: form.propiedad.trim(), precio: form.precio || null, promo: form.promo || null,
        status: form.status || null, e1: form.e1 || null, e2: form.e2 || null,
        db: form.db || null, eb: form.eb || null, comuna: form.comuna || null,
        fecha_salida: form.fecha_salida || null, aviso: form.aviso || null,
        respaldo: form.respaldo || null, tipo: form.tipo || null, admin: form.admin || null,
      };
      const minPos = rows.length > 0 ? Math.min(...rows.map(r => r.position ?? 0)) - 1 : 0;
      const { data } = await supabase.from('pizarra').insert({ ...payload, position: minPos }).select().single();
      if (data) {
        await createAutoTasks('pizarra_nueva_propiedad', data.propiedad, data.e1, data.e2, data.tipo, data.fecha_salida);
      }
      setAddingNew(false);
    }
  };

  const handleDelete = async (id) => {
    await supabase.from('pizarra').delete().eq('id', id);
    setRows(prev => prev.filter(r => r.id !== id));
  };

  const handleSaveUrl = async (url) => {
    if (!urlModalRow) return;
    await supabase.from('pizarra').update({ url_publicacion: url }).eq('id', urlModalRow.id);
    setRows(prev => prev.map(r => r.id === urlModalRow.id ? { ...r, url_publicacion: url } : r));
  };

  const handleRentedConfirm = async ({ comision, entrega, meses }) => {
    const row = rentingRow;
    setRentingRow(null);
    let fechaGar = null;
    if (row.fecha_salida) {
      const parts = String(row.fecha_salida).split('T')[0].split('-');
      const d = new Date(parseInt(parts[0]), parseInt(parts[1])-1, parseInt(parts[2]), 12, 0, 0);
      d.setDate(d.getDate() + 60);
      fechaGar = `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}-${String(d.getDate()).padStart(2,'0')}`;
    }
    const now = new Date();
    const mes = `${now.getFullYear()}-${String(now.getMonth()+1).padStart(2,'0')}`;
    await supabase.from('arrendadas_meses').upsert({ mes }, { onConflict: 'mes' });
    await supabase.from('arrendadas').insert({
      mes, propiedad: row.propiedad, arriendo: row.precio, comision,
      tipo: row.tipo, admin: row.admin, e1: row.e1, e2: row.e2,
      entrega: entrega || null, contrato: 'Pendiente', liquidacion: 'Pendiente',
      fecha_gar: fechaGar, dev_gar: 'Pendiente', cuentas: 'Pendiente',
      promocion: row.promo || null, meses: meses || null,
    });
    await createAutoTasks('pizarra_arrendada', row.propiedad, row.e1, row.e2, row.tipo, entrega);
    await supabase.from('pizarra').delete().eq('id', row.id);
    setRows(prev => prev.filter(r => r.id !== row.id));
  };

  const HEADERS = ['PROPIEDAD','PRECIO','PROMO','PUBLICACION','E1','E2','D/B','E/B','COMUNA','FECHA SALIDA','AVISO','RESPALDO','TIPO','ADMIN','URL',''];

  return (
    <div style={styles.container}>
      <div style={styles.header}>
        <div>
          <h1 style={styles.title}>Pizarra</h1>
          <div style={styles.subtitleRow}>
            <p style={styles.subtitle}>{filtered.length} propiedades</p>
            {uf && <span style={styles.ufBadge}>UF hoy: {formatCLP(uf)}</span>}
          </div>
        </div>
        <div style={styles.headerRight}>
          <div style={styles.filters}>
            {ENCARGADOS_ALL.map(e => (
              <button key={e} onClick={() => setFilterE(prev => prev.includes(e) ? prev.filter(x=>x!==e) : [...prev,e])} style={{
                ...styles.filterBtn,
                ...(filterE.includes(e) ? { background: `${ENCARGADO_COLORS[e]}22`, color: ENCARGADO_COLORS[e], borderColor: ENCARGADO_COLORS[e], fontWeight: 700 } : {})
              }}>{e}</button>
            ))}
            {filterE.length > 0 && <button onClick={() => setFilterE([])} style={styles.clearFilter}>Limpiar</button>}
          </div>
          <button onClick={() => setAddingNew(true)} style={styles.addBtn} disabled={addingNew}>
            <Plus size={15} style={{ marginRight: 5 }} /> Nueva propiedad
          </button>
        </div>
      </div>

      <div style={styles.tableWrapper}>
        {loading ? <div style={styles.loading}>Cargando pizarra...</div> : (
          <table style={styles.table}>
            <thead>
              <tr>
                {HEADERS.map((h, i) => (
                  <th key={i} style={{ ...styles.th, textAlign: h === 'PROPIEDAD' ? 'left' : 'center' }}>{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {addingNew && (
                <PropertyRow row={EMPTY_FORM} onSave={handleSave} onDelete={() => {}} onRented={() => {}}
                  isNew={true} onCancelNew={() => setAddingNew(false)} uf={uf}
                  onOpenUrlModal={() => {}} onOpenDisponibilidad={() => {}} />
              )}
              {filtered.length === 0 && !addingNew
                ? <tr><td colSpan={16} style={styles.empty}>No hay propiedades en la pizarra.</td></tr>
                : filtered.map(row => (
                  <PropertyRow key={row.id} row={row} onSave={handleSave} onDelete={handleDelete}
                    onRented={r => setRentingRow(r)} uf={uf}
                    onOpenUrlModal={setUrlModalRow} onOpenDisponibilidad={setDisponibilidadRow} />
                ))
              }
            </tbody>
          </table>
        )}
      </div>

      <div style={styles.totalsRow}>
        <span style={styles.totalsLabel}>TOTAL</span>
        <span style={styles.totalsItem}>Total por colocar: <strong>{formatCLP(totals.totalCLP)}</strong></span>
        <span style={styles.totalsItem}>Propiedades: <strong>{filtered.length}</strong></span>
      </div>

      {rentingRow && <RentModal row={rentingRow} onConfirm={handleRentedConfirm} onCancel={() => setRentingRow(null)} uf={uf} />}
      {urlModalRow && <UrlPublicacionModal row={urlModalRow} onSave={handleSaveUrl} onClose={() => setUrlModalRow(null)} />}
      {disponibilidadRow && <DisponibilidadSidebar row={disponibilidadRow} onClose={() => setDisponibilidadRow(null)} />}
    </div>
  );
}

const styles = {
  container: { height: '100%', display: 'flex', flexDirection: 'column', overflow: 'hidden', fontFamily: "'Google Sans', 'Segoe UI', sans-serif" },
  header: { display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 12, flexShrink: 0 },
  title: { fontSize: 24, fontWeight: 700, color: '#202124', margin: '0 0 4px' },
  subtitleRow: { display: 'flex', alignItems: 'center', gap: 12 },
  subtitle: { fontSize: 14, color: '#5f6368', margin: 0 },
  ufBadge: { fontSize: 12, background: '#e8f0fe', color: '#1a73e8', borderRadius: 20, padding: '2px 10px', fontWeight: 600 },
  headerRight: { display: 'flex', alignItems: 'center', gap: 12, flexWrap: 'wrap', justifyContent: 'flex-end' },
  filters: { display: 'flex', gap: 6, alignItems: 'center' },
  filterBtn: { padding: '5px 12px', borderRadius: 20, border: '1px solid #dadce0', background: '#fff', fontSize: 12, cursor: 'pointer', color: '#5f6368', fontFamily: 'inherit' },
  clearFilter: { padding: '5px 10px', borderRadius: 20, border: 'none', background: 'none', fontSize: 12, cursor: 'pointer', color: '#ea4335', fontFamily: 'inherit' },
  addBtn: { display: 'flex', alignItems: 'center', padding: '9px 16px', background: '#1a73e8', color: '#fff', border: 'none', borderRadius: 8, fontSize: 13, fontWeight: 500, cursor: 'pointer', fontFamily: 'inherit' },
  tableWrapper: { flex: 1, overflow: 'auto', border: '1px solid #e8eaed', borderRadius: 12, background: '#fff' },
  table: { width: 'max-content', minWidth: '100%', borderCollapse: 'collapse' },
  th: { padding: '10px 10px', background: '#f8f9fa', fontSize: 10, fontWeight: 700, color: '#5f6368', letterSpacing: 0.5, borderBottom: '2px solid #e8eaed', borderRight: '1px solid #e8eaed', position: 'sticky', top: 0, zIndex: 1, whiteSpace: 'nowrap' },
  td:        { padding: '0 10px', height: 38, fontSize: 12, color: '#202124', borderBottom: '1px solid #d0d5dd', borderRight: '1px solid #d0d5dd', verticalAlign: 'middle', textAlign: 'center', lineHeight: 1 },
  tdProp:    { padding: '0 10px', height: 38, fontSize: 12, color: '#202124', borderBottom: '1px solid #d0d5dd', borderRight: '1px solid #d0d5dd', verticalAlign: 'middle', maxWidth: 240, textAlign: 'left', lineHeight: 1 },
  tdCenter:  { padding: '0 8px',  height: 38, fontSize: 12, color: '#202124', borderBottom: '1px solid #d0d5dd', borderRight: '1px solid #d0d5dd', textAlign: 'center', verticalAlign: 'middle', lineHeight: 1 },
  tdActions: { padding: '0 6px', height: 38, borderBottom: '1px solid #d0d5dd', textAlign: 'center', verticalAlign: 'middle', whiteSpace: 'nowrap', lineHeight: 1 },
  actionBtnGray:   { background: 'none', border: 'none', cursor: 'pointer', padding: '3px 4px', borderRadius: 5, display: 'inline-flex', alignItems: 'center', color: '#5f6368' },
  actionBtnGreen:  { background: '#e6f4ea', border: 'none', cursor: 'pointer', padding: '3px 4px', borderRadius: 5, display: 'inline-flex', alignItems: 'center', color: '#34a853' },
  actionBtnBlue:   { background: '#e8f0fe', border: 'none', cursor: 'pointer', padding: '3px 4px', borderRadius: 5, display: 'inline-flex', alignItems: 'center', color: '#1a73e8' },
  actionBtnPurple: { background: '#f3e8fd', border: 'none', cursor: 'pointer', padding: '3px 4px', borderRadius: 5, display: 'inline-flex', alignItems: 'center', color: '#9334e6' },
  actionBtnRed:    { background: '#fce8e6', border: 'none', cursor: 'pointer', padding: '3px 4px', borderRadius: 5, display: 'inline-flex', alignItems: 'center', color: '#ea4335' },
  urlBtn:         { border: 'none', cursor: 'pointer', padding: '4px 6px', borderRadius: 5, display: 'inline-flex', alignItems: 'center' },
  urlBtnActive:   { background: '#e6f4ea', color: '#34a853' },
  urlBtnInactive: { background: '#f1f3f4', color: '#9aa0a6' },
  empty:   { padding: 40, textAlign: 'center', color: '#9aa0a6', fontSize: 14 },
  loading: { padding: 40, textAlign: 'center', color: '#9aa0a6', fontSize: 14 },
  totalsRow:   { display: 'flex', alignItems: 'center', gap: 24, padding: '10px 16px', marginTop: 8, background: '#fff', border: '1px solid #e8eaed', borderRadius: 10, flexShrink: 0 },
  totalsLabel: { fontSize: 14, fontWeight: 700, color: '#5f6368', letterSpacing: 0.8 },
  totalsItem:  { fontSize: 17, color: '#3c4043' },
};
