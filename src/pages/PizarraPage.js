import React, { useState, useEffect, useCallback, useMemo } from 'react';
import { supabase } from '../supabaseClient';
import PropertyAutocomplete from '../components/PropertyAutocomplete';
import { Plus, Check, X, Home, Trash2 } from 'lucide-react';

// ─── Date picker dd/mm/yyyy ────────────────────────────────────────────────────
function DatePicker({ value, onChange, style = {}, inputStyle = {} }) {
  const ref = React.useRef(null);
  const fmt = (iso) => {
    if (!iso) return '';
    const [y, m, d] = iso.split('-');
    return `${d}/${m}/${y}`;
  };
  const handleClick = () => {
    if (ref.current) {
      try { ref.current.showPicker(); } catch(e) { ref.current.click(); }
    }
  };
  return (
    <div onClick={handleClick} style={{ display: 'inline-flex', alignItems: 'center', cursor: 'pointer', ...style }}>
      <span style={{ fontSize: 12, fontFamily: 'inherit', color: value ? 'inherit' : '#9aa0a6', userSelect: 'none', whiteSpace: 'nowrap' }}>
        {value ? fmt(value) : 'dd/mm/aaaa'}
      </span>
      <input ref={ref} type="date" value={value || ''} onChange={e => onChange(e.target.value)}
        style={{ position: 'absolute', opacity: 0, pointerEvents: 'none', width: 0, height: 0, border: 'none', padding: 0, margin: 0 }} />
    </div>
  );
}


// ── UF value ──────────────────────────────────────────────────
const useUFValue = () => {
  const [uf, setUf] = useState(null);
  useEffect(() => {
    const today = new Date();
    const y = today.getFullYear();
    const m = String(today.getMonth() + 1).padStart(2, '0');
    const d = String(today.getDate()).padStart(2, '0');
    fetch(`https://mindicador.cl/api/uf/${d}-${m}-${y}`)
      .then(r => r.json())
      .then(data => {
        const val = data?.serie?.[0]?.valor;
        if (val) setUf(val);
      })
      .catch(() => {});
  }, []);
  return uf;
};

// ── Helpers ───────────────────────────────────────────────────
const daysDiff = (dateStr) => {
  if (!dateStr) return null;
  const [y, m, d] = dateStr.split('-').map(Number);
  const date = new Date(y, m - 1, d);
  return Math.floor((new Date() - date) / (1000 * 60 * 60 * 24));
};

const formatCLP = (n) => {
  if (!n && n !== 0) return '';
  return '$' + Math.round(n).toLocaleString('es-CL');
};

const parsePrice = (val) => {
  if (!val) return { amount: null, isUF: false };
  const str = String(val).trim();
  const ufMatch = str.match(/(\d+[.,]?\d*)\s*UF|UF\s*(\d+[.,]?\d*)/i);
  if (ufMatch) {
    const n = parseFloat((ufMatch[1] || ufMatch[2]).replace(',', '.'));
    return { amount: n, isUF: true };
  }
  const n = parseFloat(str.replace(/[$.]/g, '').replace(',', '.'));
  return { amount: isNaN(n) ? null : n, isUF: false };
};

// Mapeo de iniciales a email
const INITIALS_TO_EMAIL = {
  'DD': 'ddm@renovalpropiedades.com',
  'FD': 'fdm@renovalpropiedades.com',
  'EA': 'edith@renovalpropiedades.com',
  'FG': 'fernanda@renovalpropiedades.com',
};

// Crear tarea con subtareas en la tabla tasks (subtareas usan parent_id)
const createAutoTasks = async (propiedad, e1, e2) => {
  const CATEGORY = 'Publicar/Arrendar';

  const createTaskWithSubtasks = async (initials, subtitlesList) => {
    if (!initials) return;
    const email = INITIALS_TO_EMAIL[initials];
    if (!email) return;

    // Insertar tarea principal
    const { data: task, error } = await supabase
      .from('tasks')
      .insert({
        owner_email: email,
        title: `Arriendo ${propiedad}`,
        category: CATEGORY,
        completed: false,
        position: -Date.now(),
        recurrence: 'none',
      })
      .select()
      .single();

    if (error || !task) {
      console.error('Error creando tarea automática:', error);
      return;
    }

    // Insertar subtareas con parent_id apuntando a la tarea principal
    for (let i = 0; i < subtitlesList.length; i++) {
      await supabase.from('tasks').insert({
        owner_email: email,
        title: subtitlesList[i],
        category: CATEGORY,
        parent_id: task.id,
        completed: false,
        position: i,
        recurrence: 'none',
      });
    }
  };

  // Subtareas para E1
  await createTaskWithSubtasks(e1, [
    'Notificar dueño',
    'Carpeta antiguos',
    'Definición precio',
    'Publicar',
    'Baja ControlProp',
    'Respaldar publicación',
  ]);

  // Subtareas para E2
  await createTaskWithSubtasks(e2, [
    'Revisión situación depto',
    'Agendar entrega',
    'Acta de Entrega',
  ]);
};

const ENCARGADO_COLORS = { DD: '#1565C0', FD: '#2E7D32', EA: '#6A1B9A', FG: '#E65100' };
const UrgentDot = () => (
  <span style={{ display: 'inline-flex', alignItems: 'center', justifyContent: 'center', width: 14, height: 14, borderRadius: '50%', background: '#ea4335', color: '#fff', fontSize: 10, fontWeight: 900, flexShrink: 0, marginRight: 4 }}>!</span>
);

const destaqueStyle = (val) => val === 'OP'
  ? { background: '#FF8C00', color: '#fff', fontWeight: 700, borderRadius: 4, padding: '2px 8px', fontSize: 11 }
  : {};

const EMPTY_FORM = {
  propiedad: '', precio: '', promo: '', status: '', destaque: '',
  e1: '', e2: '', db: '', eb: '', comuna: '',
  fecha_salida: '', aviso: 'Aún no', respaldo: 'Aún no', tipo: '', admin: '',
};

// Money input with CLP/UF toggle
function MoneyInput({ value, onChange, uf, placeholder = '', alwaysVisible = false }) {
  const parsed = parsePrice(value || '');
  const [currency, setCurrency] = useState(parsed.isUF ? 'UF' : 'CLP');
  const [editing, setEditing] = useState(false);
  const [raw, setRaw] = useState('');

  // Sync currency when value changes from outside (e.g. initial load)
  React.useEffect(() => {
    const p = parsePrice(value || '');
    setCurrency(p.isUF ? 'UF' : 'CLP');
  }, [value]);

  const { amount, isUF } = parsePrice(value || '');

  const displayVal = value
    ? (isUF ? `${amount} UF` : (amount ? formatCLP(amount) : value))
    : '';

  const clpEquiv = isUF && amount && uf
    ? formatCLP(amount * uf)
    : null;

  const handleCurrencyChange = (newCurrency) => {
    setCurrency(newCurrency);
    // Clear the stored value when switching currency
    onChange('');
  };

  const handleChange = (e) => {
    const digits = e.target.value.replace(/[^0-9]/g, '');
    setRaw(digits);
  };

  const handleUFChange = (e) => {
    // Allow digits and one decimal
    const v = e.target.value.replace(/[^0-9.,]/g, '').replace(',', '.');
    setRaw(v);
  };

  const commitEdit = () => {
    setEditing(false);
    if (!raw) { onChange(''); return; }
    if (currency === 'UF') {
      onChange(`${raw} UF`);
    } else {
      onChange(raw);
    }
  };

  if (editing) {
    return (
      <div style={{ display: 'flex', flexDirection: 'column', gap: 3, minWidth: 110 }}>
        {/* Currency toggle */}
        <div style={{ display: 'flex', borderRadius: 5, overflow: 'hidden', border: '1px solid #dadce0', width: 'fit-content', alignSelf: 'center' }}>
          {['CLP', 'UF'].map(c => (
            <button key={c} type="button"
              onMouseDown={e => { e.preventDefault(); handleCurrencyChange(c); }}
              style={{
                padding: '2px 8px', fontSize: 10, fontWeight: 700, cursor: 'pointer',
                border: 'none', fontFamily: 'inherit',
                background: currency === c ? '#1a73e8' : '#f1f3f4',
                color: currency === c ? '#fff' : '#5f6368',
              }}>{c}</button>
          ))}
        </div>
        {/* Value input */}
        <div style={{ display: 'flex', alignItems: 'center', border: '1px solid #1a73e8', borderRadius: 6, padding: '2px 6px', background: '#fff' }}>
          {currency === 'CLP' && <span style={{ fontSize: 12, color: '#9aa0a6', marginRight: 2, flexShrink: 0 }}>$</span>}
          <input autoFocus
            value={currency === 'CLP' ? (raw ? parseInt(raw || '0').toLocaleString('es-CL') : '') : raw}
            onChange={currency === 'CLP' ? handleChange : handleUFChange}
            onBlur={commitEdit}
            onKeyDown={e => e.key === 'Enter' && e.target.blur()}
            style={{ border: 'none', outline: 'none', width: 80, fontSize: 12, fontFamily: 'inherit' }}
            placeholder={currency === 'UF' ? '0.00' : '0'} />
          {currency === 'UF' && <span style={{ fontSize: 11, color: '#9aa0a6', marginLeft: 2, flexShrink: 0 }}>UF</span>}
        </div>
      </div>
    );
  }

  return (
    <div
      onClick={() => {
        setRaw(amount ? (isUF ? String(amount) : String(Math.round(amount))) : '');
        setEditing(true);
      }}
      style={{ cursor: 'text', fontSize: 12, minWidth: 90, padding: '3px 6px', borderRadius: 6, textAlign: 'center', border: alwaysVisible ? '1px solid #dadce0' : 'none', background: alwaysVisible ? '#fff' : 'transparent' }}>
      {displayVal
        ? (
          <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 2 }}>
            <span>{displayVal}</span>
            {clpEquiv && (
              <span style={{ fontSize: 10, color: '#5f6368', fontStyle: 'italic' }}>{clpEquiv}</span>
            )}
          </div>
        )
        : <span style={{ color: alwaysVisible ? '#9aa0a6' : '#dadce0' }}>{alwaysVisible ? '$—' : '—'}</span>
      }
    </div>
  );
}

// ── Rent Modal ────────────────────────────────────────────────
function RentModal({ row, onConfirm, onCancel }) {
  const [comision, setComision] = useState('');
  const [entrega, setEntrega] = useState('');
  const [meses, setMeses] = useState('');
  const hasPromo = !!(row.promo && String(row.promo).trim());

  return (
    <div style={rentStyles.overlay} onClick={e => e.target === e.currentTarget && onCancel()}>
      <div style={rentStyles.modal}>
        <h3 style={rentStyles.title}>Registrar arriendo</h3>
        <p style={rentStyles.prop}>{row.propiedad}</p>
        <div style={rentStyles.field}>
          <label style={rentStyles.label}>Comisión *</label>
          <div style={{ ...rentStyles.input, display: 'flex', alignItems: 'center', padding: '9px 12px' }}>
            <span style={{ color: '#9aa0a6', marginRight: 4, flexShrink: 0 }}>$</span>
            <input value={comision} onChange={e => setComision(e.target.value.replace(/[^0-9.]/g, ''))}
              autoFocus style={{ border: 'none', outline: 'none', flex: 1, fontSize: 14, fontFamily: 'inherit' }} />
          </div>
        </div>
        <div style={rentStyles.field}>
          <label style={rentStyles.label}>Fecha de entrega *</label>
          <DatePicker value={entrega} onChange={v => setEntrega(v)} style={{ border: '1px solid #dadce0', borderRadius: 6, padding: '6px 10px', background: '#fff' }} />
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
                    const updated = selected ? list.filter(x=>x!==m) : [...list, m];
                    setMeses(updated.join(', '));
                  }} style={{
                    padding: '4px 10px', borderRadius: 20, fontSize: 12, cursor: 'pointer',
                    border: selected ? '1px solid #1a73e8' : '1px solid #dadce0',
                    background: selected ? '#e8f0fe' : '#fff',
                    color: selected ? '#1a73e8' : '#5f6368',
                    fontWeight: selected ? 700 : 400,
                  }}>{m}</button>
                );
              })}
            </div>
            {meses && <div style={{ fontSize: 11, color: '#5f6368', marginTop: 6 }}>Seleccionados: {meses}</div>}
          </div>
        )}
        <div style={rentStyles.actions}>
          <button
            onClick={() => comision && entrega && onConfirm({ comision, entrega, meses: hasPromo ? meses : '' })}
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
  modal: { background: '#fff', borderRadius: 16, padding: 28, width: 400, boxShadow: '0 8px 32px rgba(0,0,0,0.18)', fontFamily: "'Google Sans', 'Segoe UI', sans-serif" },
  title: { fontSize: 18, fontWeight: 700, color: '#202124', margin: '0 0 6px' },
  prop: { fontSize: 13, color: '#5f6368', margin: '0 0 20px', padding: '8px 12px', background: '#f8f9fa', borderRadius: 8 },
  field: { marginBottom: 14 },
  label: { fontSize: 12, fontWeight: 600, color: '#5f6368', display: 'block', marginBottom: 6 },
  input: { width: '100%', border: '1px solid #dadce0', borderRadius: 8, padding: '9px 12px', fontSize: 14, outline: 'none', fontFamily: 'inherit' },
  actions: { display: 'flex', gap: 8, marginTop: 20 },
  confirmBtn: { flex: 1, padding: '10px', background: '#1a73e8', color: '#fff', border: 'none', borderRadius: 8, fontSize: 14, fontWeight: 500, cursor: 'pointer', fontFamily: 'inherit' },
  cancelBtn: { padding: '10px 16px', background: 'none', border: '1px solid #dadce0', borderRadius: 8, fontSize: 14, cursor: 'pointer', fontFamily: 'inherit', color: '#5f6368' },
};

// Inline editable text cell
function InlineEditCell({ value, onChange, placeholder = '' }) {
  const [editing, setEditing] = useState(false);
  const [raw, setRaw] = useState(value || '');
  if (editing) {
    return (
      <input autoFocus value={raw}
        onChange={e => setRaw(e.target.value)}
        onBlur={() => { setEditing(false); if (raw !== value) onChange(raw); }}
        onKeyDown={e => e.key === 'Enter' && e.target.blur()}
        style={{ border: '1px solid #1a73e8', borderRadius: 6, padding: '3px 6px', fontSize: 12, outline: 'none', fontFamily: 'inherit', width: '100%' }} />
    );
  }
  return (
    <div onClick={() => { setRaw(value || ''); setEditing(true); }}
      style={{ cursor: 'text', fontSize: 12, minHeight: 22, padding: '1px 2px', borderRadius: 4 }}>
      {value || <span style={{ color: '#dadce0' }}>{placeholder || '—'}</span>}
    </div>
  );
}

// Inline select cell
function InlineSelectCell({ value, options, onChange }) {
  return (
    <select value={value || ''} onChange={e => onChange(e.target.value)}
      style={{ border: 'none', outline: 'none', background: 'transparent', cursor: 'pointer', fontFamily: 'inherit', fontSize: 12, width: '100%', appearance: 'none', WebkitAppearance: 'none', MozAppearance: 'none', textAlign: 'center' }}>
      <option value="">—</option>
      {options.map(o => <option key={o} value={o} style={{ color: '#202124' }}>{o}</option>)}
    </select>
  );
}

// Encargado cell: badge con color + select nativo
function EncargadoSelectCell({ value, options, onChange, alwaysVisible = false }) {
  const [open, setOpen] = useState(false);
  const EC = ENCARGADO_COLORS;
  const color = EC[value] || '#9aa0a6';

  if (open) {
    return (
      <select autoFocus value={value || ''}
        onChange={e => { onChange(e.target.value); setOpen(false); }}
        onBlur={() => setOpen(false)}
        style={{ border: '1px solid #1a73e8', borderRadius: 6, padding: '2px 4px', fontSize: 12, outline: 'none', fontFamily: 'inherit', cursor: 'pointer' }}>
        <option value="">—</option>
        {options.map(o => <option key={o} value={o}>{o}</option>)}
      </select>
    );
  }

  return (
    <div onClick={() => setOpen(true)} style={{ cursor: 'pointer', display: 'flex', justifyContent: 'center', ...(alwaysVisible && !value ? { border: '1px solid #dadce0', borderRadius: 6, padding: '2px 8px', background: '#fff' } : {}) }}>
      {value
        ? <span style={{ display: 'inline-block', borderRadius: 20, padding: '2px 9px', fontSize: 11, fontWeight: 700, background: `${color}22`, color, border: `1px solid ${color}44` }}>{value}</span>
        : <span style={{ color: alwaysVisible ? '#9aa0a6' : '#dadce0', fontSize: 12 }}>{alwaysVisible ? 'Sel.' : '—'}</span>
      }
    </div>
  );
}

// ── Property Row ──────────────────────────────────────────────
function PropertyRow({ row, onSave, onDelete, onRented, isNew = false, onCancelNew, uf }) {
  const [form, setForm] = useState({ ...EMPTY_FORM, ...row });
  const [errors, setErrors] = useState({});
  const [confirmDelete, setConfirmDelete] = useState(false);

  const set = (k, v) => {
    const updated = { ...form, [k]: v };
    setForm(updated);
    if (!isNew) saveField(k, v);
  };

  const saveField = async (k, v) => {
    await supabase.from('pizarra').update({ [k]: v || null }).eq('id', row.id);
    onSave({ ...row, [k]: v });
  };

  const validate = () => {
    const e = {};
    if (!form.propiedad.trim()) e.propiedad = true;
    if (!form.fecha_salida) e.fecha_salida = true;
    if (!form.e1) e.e1 = true;
    if (!form.e2) e.e2 = true;
    if (!form.tipo) e.tipo = true;
    if (!form.admin) e.admin = true;
    setErrors(e);
    return Object.keys(e).length === 0;
  };

  const handleNewSave = async () => {
    if (!validate()) return;
    await onSave(form);
    if (onCancelNew) onCancelNew();
  };

  const handleDelete = async () => {
    if (!confirmDelete) { setConfirmDelete(true); return; }
    await onDelete(row.id);
  };

  const days = daysDiff(form.fecha_salida);
  const isOverdue = days !== null && days >= 60;
  const needsAviso = form.aviso !== 'Listo';
  const showAlert = isOverdue || needsAviso;

  const AvisoCell = ({ field }) => (
    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
      <select value={form[field] || ''} onChange={e => set(field, e.target.value)}
        style={{
          border: 'none', outline: 'none', fontFamily: 'inherit', fontSize: 11,
          fontWeight: 600, cursor: 'pointer', background: 'transparent',
          color: form[field] === 'Listo' ? '#34a853' : form[field] === 'Aún no' ? '#fff' : '#202124',
          ...(form[field] === 'Aún no' ? { background: '#ea4335', borderRadius: 4, padding: '2px 4px' } : {}),
        }}>
        <option value="" style={{ color: '#202124', background: '#fff' }}>—</option>
        {['Aún no', 'Listo'].map(o => <option key={o} value={o} style={{ color: '#202124', background: '#fff', fontWeight: 400 }}>{o}</option>)}
      </select>
    </div>
  );

  if (isNew) {
    return (
      <tr style={{ background: '#f0f7ff', borderBottom: '1px solid #e8eaed' }}>
        <td style={styles.td}>
          <PropertyAutocomplete
            value={form.propiedad}
            onChange={v => setForm(p => ({...p, propiedad: v}))}
            hasError={!!errors.propiedad}
          />
        </td>
        <td style={styles.tdCenter}><MoneyInput value={form.precio} onChange={v => setForm(p=>({...p,precio:v}))} uf={uf} alwaysVisible /></td>
        <td style={styles.tdCenter}><MoneyInput value={form.promo} onChange={v => setForm(p=>({...p,promo:v}))} uf={uf} alwaysVisible /></td>
        <td style={styles.tdCenter}><input value={form.status||''} onChange={e=>setForm(p=>({...p,status:e.target.value}))} placeholder="Status" style={{border:'1px solid #dadce0',borderRadius:6,padding:'3px 6px',fontSize:12,outline:'none',fontFamily:'inherit',width:80}} /></td>
        <td style={styles.tdCenter}><select value={form.destaque||''} onChange={e=>setForm(p=>({...p,destaque:e.target.value}))} style={{border:'1px solid #dadce0',borderRadius:6,padding:'3px',fontSize:12,outline:'none',appearance:'none',WebkitAppearance:'none'}}><option value="">—</option><option value="OP">OP</option></select></td>
        <td style={{...styles.tdCenter,...(errors.e1?{background:'#fce8e6'}:{})}}><EncargadoSelectCell value={form.e1||''} options={['DD','FD']} onChange={v=>setForm(p=>({...p,e1:v}))} alwaysVisible /></td>
        <td style={{...styles.tdCenter,...(errors.e2?{background:'#fce8e6'}:{})}}><EncargadoSelectCell value={form.e2||''} options={['EA','FG']} onChange={v=>setForm(p=>({...p,e2:v}))} alwaysVisible /></td>
        <td style={styles.tdCenter}><input value={form.db||''} onChange={e=>setForm(p=>({...p,db:e.target.value}))} style={{border:'1px solid #dadce0',borderRadius:6,padding:'3px 4px',fontSize:12,outline:'none',width:50}} /></td>
        <td style={styles.tdCenter}><input value={form.eb||''} onChange={e=>setForm(p=>({...p,eb:e.target.value}))} style={{border:'1px solid #dadce0',borderRadius:6,padding:'3px 4px',fontSize:12,outline:'none',width:50}} /></td>
        <td style={styles.tdCenter}><input value={form.comuna||''} onChange={e=>setForm(p=>({...p,comuna:e.target.value}))} style={{border:'1px solid #dadce0',borderRadius:6,padding:'3px 4px',fontSize:12,outline:'none',width:90}} /></td>
        <td style={{...styles.tdCenter,...(errors.fecha_salida?{background:'#fce8e6'}:{})}}><DatePicker value={form.fecha_salida||''} onChange={v=>setForm(p=>({...p,fecha_salida:v}))} style={{border:errors.fecha_salida?'1px solid #ea4335':'1px solid #dadce0',borderRadius:6,padding:'3px 4px',background:'#fff'}} /></td>
        <td style={styles.tdCenter}><AvisoCell field="aviso" /></td>
        <td style={styles.tdCenter}><AvisoCell field="respaldo" /></td>
        <td style={{...styles.tdCenter,...(errors.tipo?{background:'#fce8e6'}:{})}}><select value={form.tipo||''} onChange={e=>setForm(p=>({...p,tipo:e.target.value}))} style={{border:'1px solid #dadce0',borderRadius:6,padding:'3px',fontSize:12,outline:'none',appearance:'none',WebkitAppearance:'none'}}><option value="">—</option><option>Nuevo</option><option>Renovación</option></select></td>
        <td style={{...styles.tdCenter,...(errors.admin?{background:'#fce8e6'}:{})}}><select value={form.admin||''} onChange={e=>setForm(p=>({...p,admin:e.target.value}))} style={{border:'1px solid #dadce0',borderRadius:6,padding:'3px',fontSize:12,outline:'none',appearance:'none',WebkitAppearance:'none'}}><option value="">—</option><option>Sí</option><option>No</option></select></td>
        <td style={styles.tdActions}>
          <button onClick={handleNewSave} style={styles.actionBtnGreen} title="Guardar"><Check size={14} /></button>
          <button onClick={() => { if(onCancelNew) onCancelNew(); }} style={styles.actionBtnGray} title="Cancelar"><X size={14} /></button>
        </td>
      </tr>
    );
  }

  return (
    <tr style={{ background: '#fff' }}
      onMouseEnter={e => e.currentTarget.style.background = '#f8f9fa'}
      onMouseLeave={e => e.currentTarget.style.background = '#fff'}>
      <td style={{ ...styles.tdProp }}>
        <div style={{ display: 'flex', alignItems: 'flex-start', gap: 4 }}>
          {showAlert && <UrgentDot />}
          <InlineEditCell value={form.propiedad} onChange={v => set('propiedad', v)} />
        </div>
      </td>
      <td style={styles.td}><MoneyInput value={form.precio} onChange={v => set('precio', v)} uf={uf} /></td>
      <td style={styles.td}><MoneyInput value={form.promo} onChange={v => set('promo', v)} uf={uf} /></td>
      <td style={{ ...styles.td, ...(form.status?.toUpperCase() === 'PUBLICAR' ? { background: '#FDD835' } : {}) }}>
        <InlineEditCell value={form.status} onChange={v => set('status', v)} />
      </td>
      <td style={styles.tdCenter}>
        <InlineSelectCell value={form.destaque} options={['OP']} onChange={v => set('destaque', v)}
          renderValue={v => v ? <span style={destaqueStyle(v)}>{v}</span> : null} />
      </td>
      <td style={styles.tdCenter}>
        <EncargadoSelectCell value={form.e1} options={['DD','FD']} onChange={v => set('e1', v)} />
      </td>
      <td style={styles.tdCenter}>
        <EncargadoSelectCell value={form.e2} options={['EA','FG']} onChange={v => set('e2', v)} />
      </td>
      <td style={styles.tdCenter}><InlineEditCell value={form.db} onChange={v => set('db', v)} /></td>
      <td style={styles.tdCenter}><InlineEditCell value={form.eb} onChange={v => set('eb', v)} /></td>
      <td style={styles.td}><InlineEditCell value={form.comuna} onChange={v => set('comuna', v)} /></td>
      <td style={styles.tdCenter}>
        <DatePicker value={form.fecha_salida || ''} onChange={v => set('fecha_salida', v)}
          style={{ ...(isOverdue ? { color: '#ea4335', fontWeight: 600 } : {}) }} />
      </td>
      <td style={styles.tdCenter}><AvisoCell field="aviso" /></td>
      <td style={styles.tdCenter}><AvisoCell field="respaldo" /></td>
      <td style={styles.tdCenter}>
        <InlineSelectCell value={form.tipo} options={['Nuevo','Renovación']} onChange={v => set('tipo', v)} />
      </td>
      <td style={styles.tdCenter}>
        <InlineSelectCell value={form.admin} options={['Sí','No']} onChange={v => set('admin', v)} />
      </td>
      <td style={styles.tdActions}>
        <button onClick={() => onRented(row)} style={styles.actionBtnBlue} title="Arrendar"><Home size={13} /></button>
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

// ── Main page ─────────────────────────────────────────────────
const ENCARGADOS_ALL = ['DD', 'FD', 'EA', 'FG'];

export default function PizarraPage() {
  const [rows, setRows] = useState([]);
  const [loading, setLoading] = useState(true);
  const [addingNew, setAddingNew] = useState(false);
  const [rentingRow, setRentingRow] = useState(null);
  const [filterE, setFilterE] = useState([]);
  const uf = useUFValue();

  const fetchRows = useCallback(async () => {
    setLoading(true);
    const { data } = await supabase.from('pizarra').select('*')
      .order('position', { ascending: true })
      .order('created_at', { ascending: false });
    setRows(data || []);
    setLoading(false);
  }, []);

  useEffect(() => { fetchRows(); }, [fetchRows]);

  const filtered = useMemo(() => {
    if (!filterE.length) return rows;
    return rows.filter(r => filterE.every(e => [r.e1, r.e2].includes(e)));
  }, [rows, filterE]);

  const toggleFilter = (e) => setFilterE(prev => prev.includes(e) ? prev.filter(x => x !== e) : [...prev, e]);

  const totals = useMemo(() => {
    let totalCLP = 0;
    let opCount = 0;
    filtered.forEach(r => {
      if (r.destaque === 'OP') opCount++;
      const { amount, isUF } = parsePrice(r.precio);
      if (amount) {
        totalCLP += isUF && uf ? amount * uf : isUF ? 0 : amount;
      }
    });
    return { totalCLP, opCount };
  }, [filtered, uf]);

  const handleSave = async (form) => {
    if (form.id) {
      setRows(prev => prev.map(r => r.id === form.id ? { ...r, ...form } : r));
    } else {
      const payload = {
        propiedad: form.propiedad.trim(),
        precio: form.precio || null, promo: form.promo || null,
        status: form.status || null, destaque: form.destaque || null,
        e1: form.e1 || null, e2: form.e2 || null,
        db: form.db || null, eb: form.eb || null, comuna: form.comuna || null,
        fecha_salida: form.fecha_salida || null, aviso: form.aviso || null,
        respaldo: form.respaldo || null, tipo: form.tipo || null, admin: form.admin || null,
      };
      const minPos = rows.length > 0 ? Math.min(...rows.map(r => r.position ?? 0)) - 1 : 0;
      const { data } = await supabase.from('pizarra').insert({ ...payload, position: minPos }).select().single();
      if (data) {
        setRows(prev => [data, ...prev]);
        // Crear tareas automáticas para E1 y E2
        await createAutoTasks(form.propiedad.trim(), form.e1, form.e2);
      }
      setAddingNew(false);
    }
  };

  const handleDelete = async (id) => {
    await supabase.from('pizarra').delete().eq('id', id);
    setRows(prev => prev.filter(r => r.id !== id));
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
    const mes = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`;

    await supabase.from('arrendadas_meses').upsert({ mes }, { onConflict: 'mes' });

    await supabase.from('arrendadas').insert({
      mes,
      propiedad: row.propiedad,
      arriendo: row.precio,
      comision,
      tipo: row.tipo,
      admin: row.admin,
      e1: row.e1,
      e2: row.e2,
      entrega: entrega || null,
      contrato: 'Pendiente',
      liquidacion: 'Pendiente',
      fecha_gar: fechaGar,
      dev_gar: 'Pendiente',
      cuentas: 'Pendiente',
      promocion: row.promo || null,
      meses: meses || null,
    });

    await supabase.from('pizarra').delete().eq('id', row.id);
    setRows(prev => prev.filter(r => r.id !== row.id));
  };

  const handleRented = (row) => { setRentingRow(row); };

  const HEADERS = ['PROPIEDAD','PRECIO','PROMO','STATUS','OROS','E1','E2','D/B','E/B','COMUNA','FECHA SALIDA','AVISO','RESPALDO','TIPO','ADMIN',''];

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
              <button key={e} onClick={() => toggleFilter(e)} style={{
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
        {loading ? (
          <div style={styles.loading}>Cargando pizarra...</div>
        ) : (
          <table style={styles.table}>
            <thead>
              <tr>
                {HEADERS.map((h, i) => (
                  <th key={i} style={{
                    ...styles.th,
                    textAlign: h === 'PROPIEDAD' ? 'left' : 'center'
                  }}>{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {addingNew && (
                <PropertyRow row={EMPTY_FORM} onSave={handleSave} onDelete={() => {}} onRented={() => {}}
                  isNew={true} onCancelNew={() => setAddingNew(false)} uf={uf} />
              )}
              {filtered.length === 0 && !addingNew ? (
                <tr><td colSpan={16} style={styles.empty}>No hay propiedades en la pizarra.</td></tr>
              ) : (
                filtered.map(row => (
                  <PropertyRow key={row.id} row={row} onSave={handleSave}
                    onDelete={handleDelete} onRented={handleRented} uf={uf} />
                ))
              )}
            </tbody>
          </table>
        )}
      </div>

      <div style={styles.totalsRow}>
        <span style={styles.totalsLabel}>TOTAL</span>
        <span style={styles.totalsItem}>
          Total por colocar: <strong>{formatCLP(totals.totalCLP)}</strong>
          {!uf && totals.totalCLP === 0 && <span style={styles.ufNote}> (valores en UF excluidos — cargando UF...)</span>}
        </span>
        <span style={styles.totalsItem}>
          OP: <strong style={{ color: '#FF8C00' }}>{totals.opCount}</strong>
        </span>
        <span style={styles.totalsItem}>
          Propiedades: <strong>{filtered.length}</strong>
        </span>
      </div>

      {rentingRow && (
        <RentModal
          row={rentingRow}
          onConfirm={handleRentedConfirm}
          onCancel={() => setRentingRow(null)}
        />
      )}
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
  td: { padding: '7px 10px', fontSize: 12, color: '#202124', borderBottom: '1px solid #d0d5dd', borderRight: '1px solid #d0d5dd', verticalAlign: 'middle', textAlign: 'center' },
  tdProp: { padding: '7px 10px', fontSize: 12, color: '#202124', borderBottom: '1px solid #d0d5dd', borderRight: '1px solid #d0d5dd', verticalAlign: 'middle', maxWidth: 240, textAlign: 'left' },
  tdCenter: { padding: '6px 8px', fontSize: 12, color: '#202124', borderBottom: '1px solid #d0d5dd', borderRight: '1px solid #d0d5dd', textAlign: 'center', verticalAlign: 'middle' },
  tdActions: { padding: '4px 6px', borderBottom: '1px solid #d0d5dd', textAlign: 'center', verticalAlign: 'middle', whiteSpace: 'nowrap' },
  actionBtnGray:  { background: 'none', border: 'none', cursor: 'pointer', padding: '3px 4px', borderRadius: 5, display: 'inline-flex', color: '#5f6368' },
  actionBtnGreen: { background: '#e6f4ea', border: 'none', cursor: 'pointer', padding: '3px 4px', borderRadius: 5, display: 'inline-flex', color: '#34a853' },
  actionBtnBlue:  { background: '#e8f0fe', border: 'none', cursor: 'pointer', padding: '3px 4px', borderRadius: 5, display: 'inline-flex', color: '#1a73e8' },
  actionBtnRed:   { background: '#fce8e6', border: 'none', cursor: 'pointer', padding: '3px 4px', borderRadius: 5, display: 'inline-flex', color: '#ea4335' },
  empty: { padding: 40, textAlign: 'center', color: '#9aa0a6', fontSize: 14 },
  loading: { padding: 40, textAlign: 'center', color: '#9aa0a6', fontSize: 14 },
  totalsRow: { display: 'flex', alignItems: 'center', gap: 24, padding: '10px 16px', marginTop: 8, background: '#fff', border: '1px solid #e8eaed', borderRadius: 10, flexShrink: 0 },
  totalsLabel: { fontSize: 14, fontWeight: 700, color: '#5f6368', letterSpacing: 0.8 },
  totalsItem: { fontSize: 17, color: '#3c4043' },
  ufNote: { fontSize: 11, color: '#9aa0a6', fontStyle: 'italic' },
};
