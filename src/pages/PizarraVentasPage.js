import React, { useState, useEffect, useCallback, useMemo, useRef } from 'react';
import { supabase } from '../supabaseClient';
import { useAuth } from '../context/AuthContext';
import { Plus, Check, X, DollarSign, Trash2, Link2, Calendar, Download } from 'lucide-react';
import { useExcelExport } from '../hooks/useExcelExport';
import UrlPublicacionModal from '../components/pizarra/UrlPublicacionModal';
import DisponibilidadSidebar from '../components/pizarra/DisponibilidadSidebar';

// ── Helpers (reutilizados de Pizarra) ─────────────────────────
const normalizeStr = (str) =>
  str.toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '');

const transformAddress = (full) => {
  const short = full.split(',')[0].trim();
  return short.replace(/\bDepartamento\s+/gi, 'D').replace(/\bCasa\s+/gi, 'C');
};

function PropertyAutocomplete({ value, onChange, onSelect, placeholder = 'Dirección *', hasError = false, inputStyle = {} }) {
  const [properties, setProperties] = useState([]);
  const [open, setOpen] = useState(false);
  const [focused, setFocused] = useState(false);
  const containerRef = useRef(null);

  useEffect(() => {
    const load = async () => {
      let all = [], from = 0;
      while (true) {
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
    return properties.filter(p => { const n = normalizeStr(p.propiedad); return words.every(w => n.includes(w)); }).slice(0, 8);
  }, [value, properties]);

  useEffect(() => {
    const handleClick = (e) => { if (containerRef.current && !containerRef.current.contains(e.target)) setOpen(false); };
    document.addEventListener('mousedown', handleClick);
    return () => document.removeEventListener('mousedown', handleClick);
  }, []);

  const handleSelect = (item) => {
    onChange(transformAddress(item.propiedad));
    if (onSelect) onSelect({ e1: item.e1 || '', e2: item.e2 || '' });
    setOpen(false);
  };

  return (
    <div ref={containerRef} style={{ position: 'relative', width: '100%' }}>
      <input value={value}
        onChange={e => { onChange(e.target.value.toUpperCase()); setOpen(true); }}
        onFocus={() => { setFocused(true); setOpen(true); }}
        onBlur={() => setTimeout(() => setFocused(false), 150)}
        placeholder={placeholder}
        style={{ border: hasError ? '1px solid #ea4335' : '1px solid #dadce0', borderRadius: 6, padding: '0 6px', fontSize: 12, outline: 'none', fontFamily: 'inherit', width: '100%', height: 28, boxSizing: 'border-box', background: hasError ? '#fce8e6' : '#fff', ...inputStyle }} />
      {open && focused && suggestions.length > 0 && (
        <div style={{ position: 'absolute', top: '100%', left: 0, right: 0, background: '#fff', border: '1px solid #dadce0', borderRadius: 8, boxShadow: '0 4px 16px rgba(0,0,0,0.12)', zIndex: 9999, marginTop: 2, overflow: 'hidden' }}>
          {suggestions.map((item, i) => (
            <div key={i} onMouseDown={() => handleSelect(item)}
              style={{ padding: '8px 12px', fontSize: 12, cursor: 'pointer', borderBottom: i < suggestions.length - 1 ? '1px solid #f1f3f4' : 'none', color: '#202124', lineHeight: 1.4 }}
              onMouseEnter={e => e.currentTarget.style.background = '#f0f7ff'}
              onMouseLeave={e => e.currentTarget.style.background = '#fff'}>
              <div style={{ fontWeight: 600 }}>{transformAddress(item.propiedad)}</div>
              <div style={{ fontSize: 11, color: '#9aa0a6', marginTop: 1 }}>
                {item.propiedad}
                {(item.e1 || item.e2) && <span style={{ marginLeft: 8, color: '#1a73e8' }}>{[item.e1, item.e2].filter(Boolean).join(' / ')}</span>}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

const useUFValue = () => {
  const [uf, setUf] = useState(null);
  useEffect(() => {
    const today = new Date();
    const y = today.getFullYear(), m = String(today.getMonth() + 1).padStart(2, '0'), d = String(today.getDate()).padStart(2, '0');
    fetch(`https://mindicador.cl/api/uf/${d}-${m}-${y}`)
      .then(r => r.json()).then(data => { const val = data?.serie?.[0]?.valor; if (val) setUf(val); }).catch(() => {});
  }, []);
  return uf;
};

const formatCLP = (n) => { if (!n && n !== 0) return ''; return '$' + Math.round(n).toLocaleString('es-CL'); };

const parsePrice = (val) => {
  if (!val) return { amount: null, isUF: false };
  const str = String(val).trim();
  const ufMatch = str.match(/^UF\s*([\d.,]+)$/i);
  if (ufMatch) return { amount: parseFloat(ufMatch[1].replace(',', '.')), isUF: true };
  const n = parseFloat(str.replace(/\$/g, '').replace(/\./g, '').replace(',', '.'));
  return { amount: isNaN(n) ? null : n, isUF: false };
};

const ENCARGADO_COLORS = { DD: '#1565C0', FD: '#2E7D32', EA: '#6A1B9A', FG: '#E65100' };
const ENCARGADOS_ALL = ['DD', 'FD', 'EA', 'FG'];

const EMPTY_FORM_VENTA = {
  propiedad: '', precio: '', status: '', e1: '', e2: '', db: '', eb: '', comuna: '',
  url_publicacion: '', conv_asignar_a: '',
};

const FORM_KEYS_VENTA = Object.keys(EMPTY_FORM_VENTA);
const normalizeForCompare = (obj) => FORM_KEYS_VENTA.reduce((acc, k) => {
  const v = obj[k];
  acc[k] = (v === null || v === undefined) ? '' : String(v);
  return acc;
}, {});

function PriceInput({ value, onChange, uf, isNew }) {
  const [editing, setEditing] = useState(false);
  const [currency, setCurrency] = useState('CLP');
  const [raw, setRaw] = useState('');
  const { amount, isUF } = parsePrice(value || '');
  const displayMain = value ? isUF ? `UF ${amount}` : (amount ? formatCLP(amount) : value) : '';
  const displaySub = isUF && uf && amount ? formatCLP(amount * uf) : '';
  const startEditing = () => { setCurrency(isUF ? 'UF' : 'CLP'); setRaw(amount != null ? String(amount) : ''); setEditing(true); };
  const commitEdit = () => { setEditing(false); onChange(raw === '' ? '' : currency === 'UF' ? `UF ${raw}` : raw); };
  if (editing) return (
    <div style={{ display: 'flex', alignItems: 'center', border: '1px solid #1a73e8', borderRadius: 6, overflow: 'hidden', background: '#fff', height: 28, boxSizing: 'border-box' }}>
      <select value={currency} onMouseDown={e => e.stopPropagation()} onChange={e => setCurrency(e.target.value)} style={{ border: 'none', outline: 'none', background: '#f8f9fa', fontSize: 11, padding: '0 4px', cursor: 'pointer', fontFamily: 'inherit', borderRight: '1px solid #e8eaed', height: '100%' }}>
        <option value="CLP">$</option><option value="UF">UF</option>
      </select>
      <input autoFocus value={raw} onChange={e => setRaw(e.target.value.replace(/[^0-9.]/g, ''))}
        onBlur={e => { if (e.relatedTarget && e.relatedTarget.tagName === 'SELECT') return; commitEdit(); }}
        onKeyDown={e => e.key === 'Enter' && e.target.blur()}
        style={{ border: 'none', outline: 'none', width: 80, fontSize: 12, padding: '0 5px', fontFamily: 'inherit' }} />
    </div>
  );
  if (isNew) return (
    <div onClick={startEditing} style={{ cursor: 'text', fontSize: 12, height: 28, boxSizing: 'border-box', border: '1px solid #dadce0', borderRadius: 6, background: '#fff', padding: '0 6px', display: 'flex', alignItems: 'center', minWidth: 80 }}>
      {displayMain ? <span>{displayMain}</span> : <span style={{ color: '#9aa0a6' }}>—</span>}
    </div>
  );
  return (
    <div onClick={startEditing} style={{ cursor: 'text', fontSize: 12, padding: '2px 4px', borderRadius: 4, minWidth: 60 }}>
      {displayMain ? <div><div>{displayMain}</div>{displaySub && <div style={{ fontSize: 10, color: '#5f6368', marginTop: 1 }}>{displaySub}</div>}</div> : <span style={{ color: '#dadce0' }}>—</span>}
    </div>
  );
}

function InlineEditCell({ value, onChange, uppercase }) {
  const [editing, setEditing] = useState(false);
  const [raw, setRaw] = useState(value || '');
  if (editing) return <input autoFocus value={raw} onChange={e => setRaw(uppercase ? e.target.value.toUpperCase() : e.target.value)} onBlur={() => { setEditing(false); if (raw !== value) onChange(raw); }} onKeyDown={e => e.key === 'Enter' && e.target.blur()} style={{ border: '1px solid #1a73e8', borderRadius: 6, padding: '3px 6px', fontSize: 12, outline: 'none', fontFamily: 'inherit', width: '100%' }} />;
  return <div onClick={() => { setRaw(value || ''); setEditing(true); }} style={{ cursor: 'text', fontSize: 12, display: 'flex', alignItems: 'center', height: '100%', padding: '0 2px' }}>{value || <span style={{ color: '#dadce0' }}>—</span>}</div>;
}

function InlineSelectCell({ value, options, onChange, colors }) {
  if (colors) return (
    <div style={{ position: 'relative', display: 'inline-flex', alignItems: 'center', justifyContent: 'center', width: '100%' }}>
      {value && <span style={{ position: 'absolute', pointerEvents: 'none', fontSize: 11, fontWeight: 700, color: colors[value] || '#5f6368', background: (colors[value] || '#9aa0a6') + '22', border: `1px solid ${(colors[value] || '#9aa0a6')}44`, borderRadius: 20, padding: '1px 8px', zIndex: 1 }}>{value}</span>}
      <select value={value || ''} onChange={e => onChange(e.target.value)} style={{ border: 'none', outline: 'none', background: 'transparent', cursor: 'pointer', fontFamily: 'inherit', fontSize: 12, width: '100%', appearance: 'none', WebkitAppearance: 'none', textAlign: 'center', lineHeight: 1, color: 'transparent', zIndex: 2, position: 'relative' }}>
        <option value="">—</option>{options.map(o => <option key={o} value={o}>{o}</option>)}
      </select>
    </div>
  );
  return <select value={value || ''} onChange={e => onChange(e.target.value)} style={{ border: 'none', outline: 'none', background: 'transparent', cursor: 'pointer', fontFamily: 'inherit', fontSize: 12, width: '100%', appearance: 'none', WebkitAppearance: 'none', textAlign: 'center', lineHeight: 1 }}><option value="">—</option>{options.map(o => <option key={o} value={o}>{o}</option>)}</select>;
}

const slashInputStyle = { width: 22, height: 24, border: '1px solid #dadce0', borderRadius: 4, textAlign: 'center', fontSize: 12, outline: 'none', fontFamily: 'inherit', background: '#fff', boxSizing: 'border-box', padding: 0 };

function SlashInput({ value, onChange }) {
  const [editing, setEditing] = useState(false);
  const leftRef = useRef(null);
  const parts = (value || '').split('/');
  const left = parts[0] || '', right = parts[1] !== undefined ? parts[1] : '';
  const update = (l, r) => onChange(`${l}/${r}`);
  if (editing) return (
    <div style={{ display: 'inline-flex', alignItems: 'center', gap: 3 }} onBlur={e => { if (!e.currentTarget.contains(e.relatedTarget)) setEditing(false); }}>
      <input ref={leftRef} autoFocus value={left} maxLength={1} onChange={e => update(e.target.value.replace(/[^0-9]/g, ''), right)} style={slashInputStyle} />
      <span style={{ fontSize: 12, color: '#5f6368' }}>/</span>
      <input value={right} maxLength={1} onChange={e => update(left, e.target.value.replace(/[^0-9]/g, ''))} style={slashInputStyle} />
    </div>
  );
  return (
    <div onClick={() => setEditing(true)} style={{ cursor: 'text', fontSize: 12, display: 'flex', alignItems: 'center', justifyContent: 'center', height: '100%', padding: '0 2px' }}>
      {(left || right) ? <span>{left || '—'}/{right || '—'}</span> : <span style={{ color: '#dadce0' }}>—</span>}
    </div>
  );
}

function SlashInputNew({ value, onChange }) {
  const parts = (value || '').split('/');
  const left = parts[0] || '', right = parts[1] !== undefined ? parts[1] : '';
  const update = (l, r) => onChange(`${l}/${r}`);
  return (
    <div style={{ display: 'inline-flex', alignItems: 'center', gap: 3 }}>
      <input value={left} maxLength={1} onChange={e => update(e.target.value.replace(/[^0-9]/g, ''), right)} style={slashInputStyle} />
      <span style={{ fontSize: 12, color: '#5f6368' }}>/</span>
      <input value={right} maxLength={1} onChange={e => update(left, e.target.value.replace(/[^0-9]/g, ''))} style={slashInputStyle} />
    </div>
  );
}

// ── SaleRow ───────────────────────────────────────────────────
function SaleRow({ row, onSave, onDelete, onSold, isNew=false, onCancelNew, uf, onOpenUrlModal, onOpenDisponibilidad }) {
  const [form, setForm] = useState({ ...EMPTY_FORM_VENTA, ...row });
  const [attempted, setAttempted] = useState(false);
  const [confirmDelete, setConfirmDelete] = useState(false);

  const hasEdits = !isNew && JSON.stringify(normalizeForCompare(form)) !== JSON.stringify(normalizeForCompare(row));
  const hasEditsRef = useRef(false);
  hasEditsRef.current = hasEdits;

  useEffect(() => {
    if (!hasEditsRef.current) setForm(prev => ({ ...prev, ...row }));
  }, [row]); // eslint-disable-line react-hooks/exhaustive-deps

  const set = (k, v) => setForm(prev => ({ ...prev, [k]: v }));

  const handleSave = async () => {
    await supabase.from('pizarra_ventas').update({
      propiedad: form.propiedad || null, precio: form.precio || null,
      status: form.status || null, e1: form.e1 || null, e2: form.e2 || null,
      db: form.db || null, eb: form.eb || null, comuna: form.comuna || null,
      url_publicacion: form.url_publicacion || null, conv_asignar_a: form.conv_asignar_a || null,
    }).eq('id', row.id);
    onSave({ ...row, ...form });
  };

  const handleNewSave = async () => {
    setAttempted(true);
    if (!form.propiedad.trim() || !form.e1 || !form.e2) return;
    await onSave(form);
    if (onCancelNew) onCancelNew();
  };

  const handlePropSelect = ({ e1, e2 }) => {
    if (isNew) setForm(prev => ({ ...prev, e1: e1 || prev.e1, e2: e2 || prev.e2 }));
  };

  const handleOpenUrlModal = () => {
    onOpenUrlModal({
      ...row,
      url_publicacion: form.url_publicacion,
      conv_asignar_a: form.conv_asignar_a,
      _onSaved: (url, asignarA) => {
        setForm(prev => ({ ...prev, url_publicacion: url || '', conv_asignar_a: asignarA || '' }));
      },
    });
  };

  const errors = attempted ? { propiedad: !form.propiedad.trim(), e1: !form.e1, e2: !form.e2 } : {};

  const newRowSelect = { border: '1px solid #dadce0', borderRadius: 6, fontSize: 12, outline: 'none', fontFamily: 'inherit', background: '#fff', height: 28, boxSizing: 'border-box', padding: '0 4px', cursor: 'pointer' };
  const newRowInput = { border: '1px solid #dadce0', borderRadius: 6, fontSize: 12, outline: 'none', fontFamily: 'inherit', background: '#fff', height: 28, boxSizing: 'border-box', padding: '0 6px' };

  const reqWrapper = (field) => ({ border: errors[field] ? '1px solid #ea4335' : '1px solid #dadce0', background: errors[field] ? '#fce8e6' : '#fff', borderRadius: 6, height: 28, boxSizing: 'border-box', display: 'inline-flex', alignItems: 'center', width: '100%' });
  const selectInsideWrapper = { border: 'none', outline: 'none', background: 'transparent', fontSize: 12, fontFamily: 'inherit', cursor: 'pointer', height: '100%', width: '100%', padding: '0 4px' };

  if (isNew) return (
    <tr style={{ background: '#f0f7ff', borderBottom: '1px solid #e8eaed' }}>
      <td style={st.tdProp}><PropertyAutocomplete value={form.propiedad} onChange={v => setForm(p => ({ ...p, propiedad: v }))} onSelect={handlePropSelect} hasError={!!errors.propiedad} inputStyle={{ height: 28, boxSizing: 'border-box', fontSize: 12 }} /></td>
      <td style={st.tdCenter}><PriceInput value={form.precio} onChange={v=>setForm(p=>({...p,precio:v}))} uf={uf} isNew={true} /></td>
      <td style={st.tdCenter}><select value={form.status||''} onChange={e=>setForm(p=>({...p,status:e.target.value}))} style={newRowSelect}><option value="">—</option><option value="Aún no">Aún no</option><option value="Listo">Listo</option></select></td>
      <td style={st.tdCenter}>
        <div style={{ ...reqWrapper('e1'), position: 'relative' }}>
          {form.e1 && <span style={{ position: 'absolute', left: '50%', transform: 'translateX(-50%)', pointerEvents: 'none', fontSize: 11, fontWeight: 700, color: ENCARGADO_COLORS[form.e1], background: ENCARGADO_COLORS[form.e1] + '22', border: `1px solid ${ENCARGADO_COLORS[form.e1]}44`, borderRadius: 20, padding: '1px 8px', zIndex: 1, whiteSpace: 'nowrap' }}>{form.e1}</span>}
          <select value={form.e1||''} onChange={e=>setForm(p=>({...p,e1:e.target.value}))} style={{ ...selectInsideWrapper, color: 'transparent', zIndex: 2, position: 'relative' }}><option value="">—</option><option>DD</option><option>FD</option></select>
        </div>
      </td>
      <td style={st.tdCenter}>
        <div style={{ ...reqWrapper('e2'), position: 'relative' }}>
          {form.e2 && <span style={{ position: 'absolute', left: '50%', transform: 'translateX(-50%)', pointerEvents: 'none', fontSize: 11, fontWeight: 700, color: ENCARGADO_COLORS[form.e2], background: ENCARGADO_COLORS[form.e2] + '22', border: `1px solid ${ENCARGADO_COLORS[form.e2]}44`, borderRadius: 20, padding: '1px 8px', zIndex: 1, whiteSpace: 'nowrap' }}>{form.e2}</span>}
          <select value={form.e2||''} onChange={e=>setForm(p=>({...p,e2:e.target.value}))} style={{ ...selectInsideWrapper, color: 'transparent', zIndex: 2, position: 'relative' }}><option value="">—</option><option>EA</option><option>FG</option></select>
        </div>
      </td>
      <td style={st.tdCenter}><SlashInputNew value={form.db||''} onChange={v=>setForm(p=>({...p,db:v}))} /></td>
      <td style={st.tdCenter}><SlashInputNew value={form.eb||''} onChange={v=>setForm(p=>({...p,eb:v}))} /></td>
      <td style={st.tdCenter}><input value={form.comuna||''} onChange={e=>setForm(p=>({...p,comuna:e.target.value.toUpperCase()}))} style={{ ...newRowInput, display: 'block', width: 90 }} /></td>
      <td style={st.tdCenter}><span style={{ color: '#dadce0', fontSize: 11 }}>—</span></td>
      <td style={st.tdActions}>
        <button onClick={handleNewSave} style={st.actionBtnGreen}><Check size={14} /></button>
        <button onClick={onCancelNew} style={st.actionBtnGray}><X size={14} /></button>
      </td>
    </tr>
  );

  return (
    <tr style={{ background: '#fff' }} onMouseEnter={e => e.currentTarget.style.background = '#f8f9fa'} onMouseLeave={e => e.currentTarget.style.background = '#fff'}>
      <td style={st.tdProp}><InlineEditCell value={form.propiedad} onChange={v => set('propiedad', v)} uppercase /></td>
      <td style={st.td}><PriceInput value={form.precio} onChange={v => set('precio', v)} uf={uf} /></td>
      <td style={st.td}>
        <select value={form.status || ''} onChange={e => set('status', e.target.value)}
          style={{ border: 'none', outline: 'none', fontFamily: 'inherit', fontSize: 11, fontWeight: 600, cursor: 'pointer', background: 'transparent', lineHeight: 1, color: form.status === 'Listo' ? '#34a853' : '#202124', ...(form.status === 'Aún no' ? { background: '#FFF9C4', borderRadius: 4, padding: '2px 4px' } : {}) }}>
          <option value="">—</option><option value="Aún no">Aún no</option><option value="Listo">Listo</option>
        </select>
      </td>
      <td style={st.tdCenter}><InlineSelectCell value={form.e1} options={['DD','FD']} onChange={v => set('e1', v)} colors={ENCARGADO_COLORS} /></td>
      <td style={st.tdCenter}><InlineSelectCell value={form.e2} options={['EA','FG']} onChange={v => set('e2', v)} colors={ENCARGADO_COLORS} /></td>
      <td style={st.tdCenter}><SlashInput value={form.db} onChange={v => set('db', v)} /></td>
      <td style={st.tdCenter}><SlashInput value={form.eb} onChange={v => set('eb', v)} /></td>
      <td style={st.td}><InlineEditCell value={form.comuna} onChange={v => set('comuna', v)} uppercase /></td>
      <td style={st.tdCenter}>
        <button onClick={handleOpenUrlModal}
          style={{ ...st.urlBtn, ...(form.url_publicacion ? st.urlBtnActive : st.urlBtnInactive) }}
          title={form.url_publicacion ? 'URL cargada' : 'Sin URL'}>
          <Link2 size={13} />
        </button>
      </td>
      <td style={st.tdActions}>
        {hasEdits && <button onClick={handleSave} style={st.actionBtnGreen} title="Guardar cambios"><Check size={14} /></button>}
        <button onClick={() => onOpenDisponibilidad(row)} style={st.actionBtnPurple}><Calendar size={13} /></button>
        <button onClick={() => onSold(row)} style={st.actionBtnBlue} title="Registrar venta"><DollarSign size={13} /></button>
        {confirmDelete ? (
          <><button onClick={async () => { await onDelete(row.id); }} style={st.actionBtnRed}><Trash2 size={13} /></button><button onClick={() => setConfirmDelete(false)} style={st.actionBtnGray}><X size={12} /></button></>
        ) : (
          <button onClick={() => setConfirmDelete(true)} style={st.actionBtnGray}><Trash2 size={13} /></button>
        )}
      </td>
    </tr>
  );
}

// ── SoldModal ─────────────────────────────────────────────────
function SoldModal({ row, onConfirm, onCancel }) {
  const [comision, setComision] = useState('');
  const [fecha, setFecha] = useState('');
  const ref = useRef(null);
  const formatDateCL = (iso) => { if (!iso) return ''; const [y,m,d] = iso.split('-'); return `${d}/${m}/${y}`; };
  return (
    <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.4)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 3000 }}>
      <div style={{ background: '#fff', borderRadius: 16, padding: 28, width: 400, boxShadow: '0 8px 32px rgba(0,0,0,0.18)', fontFamily: "'Google Sans','Segoe UI',sans-serif" }}>
        <h3 style={{ fontSize: 18, fontWeight: 700, color: '#202124', margin: '0 0 6px' }}>Registrar venta</h3>
        <p style={{ fontSize: 13, color: '#5f6368', margin: '0 0 20px', padding: '8px 12px', background: '#f8f9fa', borderRadius: 8 }}>{row.propiedad}</p>
        <div style={{ marginBottom: 14 }}>
          <label style={{ fontSize: 12, fontWeight: 600, color: '#5f6368', display: 'block', marginBottom: 6 }}>Comisión *</label>
          <div style={{ border: '1px solid #dadce0', borderRadius: 8, padding: '9px 12px', display: 'flex', alignItems: 'center' }}>
            <span style={{ color: '#9aa0a6', marginRight: 4 }}>$</span>
            <input value={comision} onChange={e => setComision(e.target.value.replace(/[^0-9.]/g, ''))} autoFocus style={{ border: 'none', outline: 'none', flex: 1, fontSize: 14, fontFamily: 'inherit' }} />
          </div>
        </div>
        <div style={{ marginBottom: 14 }}>
          <label style={{ fontSize: 12, fontWeight: 600, color: '#5f6368', display: 'block', marginBottom: 6 }}>Fecha de escritura *</label>
          <div onClick={() => ref.current && ref.current.showPicker && ref.current.showPicker()} style={{ border: '1px solid #dadce0', borderRadius: 8, padding: '9px 12px', cursor: 'pointer', position: 'relative', color: fecha ? '#202124' : '#9aa0a6', fontSize: 14 }}>
            {fecha ? formatDateCL(fecha) : 'Seleccionar fecha...'}
            <input ref={ref} type="date" value={fecha} onChange={e => setFecha(e.target.value)} style={{ position: 'absolute', opacity: 0, pointerEvents: 'none', width: 0, height: 0 }} />
          </div>
        </div>
        <div style={{ display: 'flex', gap: 8, marginTop: 20 }}>
          <button onClick={() => comision && fecha && onConfirm({ comision, fecha })} disabled={!comision || !fecha}
            style={{ flex: 1, padding: 10, background: !comision || !fecha ? '#e8eaed' : '#1a73e8', color: !comision || !fecha ? '#9aa0a6' : '#fff', border: 'none', borderRadius: 8, fontSize: 14, fontWeight: 500, cursor: !comision || !fecha ? 'not-allowed' : 'pointer', fontFamily: 'inherit' }}>
            Confirmar venta
          </button>
          <button onClick={onCancel} style={{ padding: '10px 16px', background: 'none', border: '1px solid #dadce0', borderRadius: 8, fontSize: 14, cursor: 'pointer', fontFamily: 'inherit', color: '#5f6368' }}>Cancelar</button>
        </div>
      </div>
    </div>
  );
}

export default function PizarraVentasPage() {
  useAuth();
  const [rows, setRows] = useState([]);
  const [loading, setLoading] = useState(true);
  const [addingNew, setAddingNew] = useState(false);
  const [soldRow, setSoldRow] = useState(null);
  const [urlModalRow, setUrlModalRow] = useState(null);
  const [disponibilidadRow, setDisponibilidadRow] = useState(null);
  const [filterE, setFilterE] = useState([]);
  const uf = useUFValue();
  const { exportToExcel } = useExcelExport();

  const handleExport = () => exportToExcel(rows, [
    { key: 'propiedad', label: 'Propiedad' }, { key: 'precio', label: 'Precio' },
    { key: 'status', label: 'Publicación' }, { key: 'e1', label: 'E1' }, { key: 'e2', label: 'E2' },
    { key: 'db', label: 'D/B' }, { key: 'eb', label: 'E/B' }, { key: 'comuna', label: 'Comuna' },
  ], 'Pizarra_Ventas');

  const fetchRows = useCallback(async () => {
    setLoading(true);
    const { data } = await supabase.from('pizarra_ventas').select('*').order('position', { ascending: true }).order('created_at', { ascending: false });
    setRows(data || []);
    setLoading(false);
  }, []);

  useEffect(() => { fetchRows(); }, [fetchRows]);

  useEffect(() => {
    const channel = supabase.channel('pizarra_ventas_realtime')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'pizarra_ventas' }, (payload) => {
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
    let totalCLP = 0;
    filtered.forEach(r => {
      const { amount, isUF } = parsePrice(r.precio);
      if (amount) totalCLP += isUF && uf ? amount * uf : isUF ? 0 : amount;
    });
    return { totalCLP };
  }, [filtered, uf]);

  const handleSave = async (form) => {
    if (form.id) {
      setRows(prev => prev.map(r => r.id === form.id ? { ...r, ...form } : r));
    } else {
      const payload = { propiedad: form.propiedad.trim(), precio: form.precio || null, status: form.status || null, e1: form.e1 || null, e2: form.e2 || null, db: form.db || null, eb: form.eb || null, comuna: form.comuna || null };
      const minPos = rows.length > 0 ? Math.min(...rows.map(r => r.position ?? 0)) - 1 : 0;
      const { data, error } = await supabase.from('pizarra_ventas').insert({ ...payload, position: minPos }).select().single();
      console.log('INSERT result:', { data, error });
      if (data) setRows(prev => [data, ...prev]);
      setAddingNew(false);
    }
  };

  const handleDelete = async (id) => {
    await supabase.from('pizarra_ventas').delete().eq('id', id);
    setRows(prev => prev.filter(r => r.id !== id));
  };

  const handleSaveUrl = async (url, asignarA) => {
    if (!urlModalRow) return;
    const { id, _onSaved } = urlModalRow;
    setUrlModalRow(null);
    await supabase.from('pizarra_ventas').update({ url_publicacion: url, conv_asignar_a: asignarA || 'e2' }).eq('id', id);
    setRows(prev => prev.map(r => r.id === id ? { ...r, url_publicacion: url, conv_asignar_a: asignarA || 'e2' } : r));
    if (_onSaved) _onSaved(url, asignarA);
  };

  const handleSoldConfirm = async ({ comision, fecha }) => {
    const row = soldRow;
    setSoldRow(null);
    // Por ahora solo elimina de pizarra_ventas; integración con módulo de ventas se hará después
    await supabase.from('pizarra_ventas').delete().eq('id', row.id);
    setRows(prev => prev.filter(r => r.id !== row.id));
  };

  const HEADERS = [
    { label: 'PROPIEDAD', minWidth: 200 }, { label: 'PRECIO', minWidth: 110 },
    { label: 'PUBLICACIÓN', minWidth: 90 }, { label: 'E1', minWidth: 70 }, { label: 'E2', minWidth: 70 },
    { label: 'D/B', minWidth: 55 }, { label: 'E/B', minWidth: 55 }, { label: 'COMUNA', minWidth: 90 },
    { label: 'URL', minWidth: 45 }, { label: '', minWidth: 90 },
  ];

  return (
    <div style={st.container}>
      <div style={st.header}>
        <div>
          <h1 style={st.title}>Pizarra Ventas</h1>
          <div style={st.subtitleRow}>
            <p style={st.subtitle}>{filtered.length} propiedades</p>
            {uf && <span style={st.ufBadge}>UF hoy: {formatCLP(uf)}</span>}
          </div>
        </div>
        <div style={st.headerRight}>
          <div style={st.filters}>
            {ENCARGADOS_ALL.map(e => (
              <button key={e} onClick={() => setFilterE(prev => prev.includes(e) ? prev.filter(x=>x!==e) : [...prev,e])}
                style={{ ...st.filterBtn, ...(filterE.includes(e) ? { background: `${ENCARGADO_COLORS[e]}22`, color: ENCARGADO_COLORS[e], borderColor: ENCARGADO_COLORS[e], fontWeight: 700 } : {}) }}>{e}</button>
            ))}
            {filterE.length > 0 && <button onClick={() => setFilterE([])} style={st.clearFilter}>Limpiar</button>}
          </div>
          <button onClick={handleExport} disabled={loading} title="Exportar a Excel" style={{ display:'flex', alignItems:'center', gap:6, padding:'9px 14px', background:'#fff', border:'1px solid #dadce0', borderRadius:8, fontSize:13, cursor:loading?'not-allowed':'pointer', color:'#3c4043', fontFamily:'inherit', opacity:loading?0.5:1 }}>
            <Download size={14} color="#34a853" /> Excel
          </button>
          <button onClick={() => setAddingNew(true)} style={st.addBtn} disabled={addingNew}>
            <Plus size={15} style={{ marginRight: 5 }} /> Nueva propiedad
          </button>
        </div>
      </div>

      <div style={st.tableWrapper}>
        {loading ? <div style={st.loading}>Cargando pizarra de ventas...</div> : (
          <table style={st.table}>
            <thead>
              <tr>{HEADERS.map((h, i) => <th key={i} style={{ ...st.th, textAlign: h.label === 'PROPIEDAD' ? 'left' : 'center', minWidth: h.minWidth }}>{h.label}</th>)}</tr>
            </thead>
            <tbody>
              {addingNew && <SaleRow row={EMPTY_FORM_VENTA} onSave={handleSave} onDelete={() => {}} onSold={() => {}} isNew={true} onCancelNew={() => setAddingNew(false)} uf={uf} onOpenUrlModal={() => {}} onOpenDisponibilidad={() => {}} />}
              {filtered.length === 0 && !addingNew
                ? <tr><td colSpan={10} style={st.empty}>No hay propiedades en venta en la pizarra.</td></tr>
                : filtered.map(row => (
                  <SaleRow key={row.id} row={row} onSave={handleSave} onDelete={handleDelete}
                    onSold={r => setSoldRow(r)} uf={uf}
                    onOpenUrlModal={setUrlModalRow} onOpenDisponibilidad={setDisponibilidadRow} />
                ))
              }
            </tbody>
          </table>
        )}
      </div>

      <div style={st.totalsRow}>
        <span style={st.totalsLabel}>TOTAL</span>
        <span style={st.totalsItem}>Total por vender: <strong>{formatCLP(totals.totalCLP)}</strong></span>
        <span style={st.totalsItem}>Propiedades: <strong>{filtered.length}</strong></span>
      </div>

      {soldRow && <SoldModal row={soldRow} onConfirm={handleSoldConfirm} onCancel={() => setSoldRow(null)} />}
      {urlModalRow && <UrlPublicacionModal row={urlModalRow} onSave={handleSaveUrl} onClose={() => setUrlModalRow(null)} />}
      {disponibilidadRow && <DisponibilidadSidebar row={disponibilidadRow} onClose={() => setDisponibilidadRow(null)} />}
    </div>
  );
}

const st = {
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
  th: { padding: '10px 10px', background: '#f8f9fa', fontSize: 10, fontWeight: 700, color: '#5f6368', letterSpacing: 0.5, borderBottom: '2px solid #e8eaed', borderRight: '1px solid #e8eaed', position: 'sticky', top: 0, zIndex: 10, whiteSpace: 'nowrap' },
  td:        { padding: '0 10px', height: 38, fontSize: 12, color: '#202124', borderBottom: '1px solid #d0d5dd', borderRight: '1px solid #d0d5dd', verticalAlign: 'middle', textAlign: 'center', lineHeight: 1 },
  tdProp:    { padding: '0 10px', height: 38, fontSize: 12, color: '#202124', borderBottom: '1px solid #d0d5dd', borderRight: '1px solid #d0d5dd', verticalAlign: 'middle', maxWidth: 240, textAlign: 'left', lineHeight: 1 },
  tdCenter:  { padding: '0 8px', height: 38, fontSize: 12, color: '#202124', borderBottom: '1px solid #d0d5dd', borderRight: '1px solid #d0d5dd', textAlign: 'center', verticalAlign: 'middle', lineHeight: 1 },
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
