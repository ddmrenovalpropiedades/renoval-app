import React, { useState, useEffect, useMemo, useCallback, useRef } from 'react';
import * as XLSX from 'xlsx';
import { supabase } from '../supabaseClient';
import { useAuth } from '../context/AuthContext';
import { Search, X, Upload, Save, AlertCircle, RefreshCw, Send, Eye, Plus, Trash2, Mail, BarChart2, Download, SlidersHorizontal, MessageSquare } from 'lucide-react';
import { useExcelExport } from '../hooks/useExcelExport';
import PropertyAutocomplete from '../components/PropertyAutocomplete';
import FichaSidebar, { FichaCellWrap } from '../components/FichaSidebar';

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
const normalize = (str) =>
  String(str).toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '');
const isPagada = (val) => !!(val && val.toLowerCase() === 'pagada');

const getLast12Months = () => {
  const months = [];
  const now = new Date();
  for (let i = 0; i < 12; i++) {
    const d = new Date(now.getFullYear(), now.getMonth() - i, 1);
    const y = d.getFullYear();
    const m = String(d.getMonth() + 1).padStart(2, '0');
    months.push(`${y}-${m}`);
  }
  return months;
};
const formatMes = (mes) => {
  const [y, m] = mes.split('-');
  const names = ['Ene','Feb','Mar','Abr','May','Jun','Jul','Ago','Sep','Oct','Nov','Dic'];
  return `${names[parseInt(m)-1]} ${y}`;
};
const currentMes = () => {
  const now = new Date();
  return `${now.getFullYear()}-${String(now.getMonth()+1).padStart(2,'0')}`;
};
const prevMes = () => {
  const now = new Date();
  const d = new Date(now.getFullYear(), now.getMonth() - 1, 1);
  return `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}`;
};

// ── Color logic ───────────────────────────────────────────────
// Umbrales por defecto usados solo cuando la propiedad no tiene un valor de
// "promedio" cargado en Atributos para esa cuenta.
const DEFAULT_THRESHOLDS = { agua: [40000, 60000], luz: [55000, 80000], gas: [45000, 60000], gc: [70000, 180000] };

const getThresholds = (attr, tipo, mult1, mult2) => {
  const promedio = attr?.[`${tipo}_promedio`];
  if (promedio) return [promedio * mult1, promedio * mult2];
  return DEFAULT_THRESHOLDS[tipo] || [Infinity, Infinity];
};

const rowExceedsUmbral = (row, attrsMap, level, mult1 = 1.9, mult2 = 2.8) => {
  const attr = attrsMap?.[row.propiedad];
  const checkField = (val, tipo) => {
    const n = parseAmount(val);
    if (!n || isPagada(val)) return false;
    const [t1, t2] = getThresholds(attr, tipo, mult1, mult2);
    return level === 1 ? n >= t1 : n >= t2;
  };
  return (
    checkField(row.agua_ac,'agua')||checkField(row.agua_an,'agua')||
    checkField(row.luz_ac,'luz')||checkField(row.luz_an,'luz')||
    checkField(row.gas_ac,'gas')||checkField(row.gas_an,'gas')||
    checkField(row.gc_ac,'gc')||checkField(row.gc_an,'gc')
  );
};
const getCellStyle = (val, tipo, attr, emptyWhite=false, mult1=1.9, mult2=2.8) => {
  const base = { padding:0, fontSize:12, textAlign:'center', width:'100%', height:'100%', display:'flex', alignItems:'center', justifyContent:'center', gap:4 };
  const u1 = { background:'#FFE0B2', color:'#202124', borderRadius:6 }; // naranja suave — supera umbral 1
  const u2 = { background:'#FFCDD2', color:'#202124', borderRadius:6 }; // rojo suave  — supera umbral 2
  if (!val||val==='') return { ...base, background: emptyWhite?'#fff':'#fff', border: emptyWhite?'none':'1px solid #bdbdbd', borderRadius:4 };
  if (isPagada(val)) return { ...base, background:'#fff', color:'#bdbdbd' };
  const n = parseAmount(val);
  if (n===null) return { ...base, background:'#fff', color:'#202124' };
  if (tipo==='agua'||tipo==='luz'||tipo==='gas'||tipo==='gc') {
    const [t1, t2] = getThresholds(attr, tipo, mult1, mult2);
    if (n<t1) return { ...base, background:'#fff', color:'#bdbdbd' };
    if (n<t2) return { ...base, ...u1 };
    return { ...base, ...u2 };
  }
  if (tipo==='arriendo') {
    if (n<10000) return { ...base, background:'#fff', color:'#bdbdbd' };
    return { ...base, background:'#fff', color:'#202124' };
  }
  return { ...base, background:'#fff', color:'#202124' };
};

// ── Editable cell ─────────────────────────────────────────────
function EditableCell({ value, tipo, alerta, onChange, attr, emptyWhite, mult1, mult2 }) {
  const [editing, setEditing] = useState(false);
  const [local, setLocal] = useState(value||'');
  const cellStyle = getCellStyle(value, tipo, attr, emptyWhite, mult1, mult2);
  const handleBlur = () => { setEditing(false); if (local!==(value||'')) onChange(local); };
  if (editing) return (
    <input value={local} onChange={e=>setLocal(e.target.value)} onBlur={handleBlur}
      autoFocus style={{ ...getCellStyle('',tipo,attr,true,mult1,mult2), border:'1px solid #1a73e8', outline:'none', width:'100%', textAlign:'center', padding:'4px 6px' }} />
  );
  const display = tipo==='arriendo'&&value&&!isNaN(parseFloat(value))
    ? '$'+Math.round(parseFloat(value)).toLocaleString('es-CL') : value||'';
  return (
    <div onClick={()=>{ setLocal(value||''); setEditing(true); }}
      style={{ ...cellStyle, cursor:'text', minHeight:28, padding:'4px 6px' }}>
      {alerta&&<AlertCircle size={11} color="#ea4335" style={{flexShrink:0}} />}
      {display}
    </div>
  );
}

function UploadBtn({ label, tipo, onUpload, lastUpload }) {
  const ref = useRef();
  return (
    <div style={st.uploadCard}>
      <div style={st.uploadLabel}>{label}</div>
      {lastUpload&&<div style={st.uploadMeta}>Última carga: {new Date(lastUpload.uploaded_at).toLocaleDateString('es-CL')} ({lastUpload.row_count} filas)</div>}
      <button onClick={()=>ref.current.click()} style={st.uploadBtn}><Upload size={13} style={{marginRight:5}}/>Cargar archivo</button>
      <input ref={ref} type="file" accept=".xls,.xlsx" style={{display:'none'}}
        onChange={e=>{ if(e.target.files[0]){onUpload(tipo,e.target.files[0]);e.target.value='';} }} />
    </div>
  );
}

// ── UMBRAL MODAL ───────────────────────────────────────────────
function UmbralModal({ config, onClose, onSave }) {
  const [m1, setM1] = useState(String(config.multiplicador1));
  const [m2, setM2] = useState(String(config.multiplicador2));
  const [saving, setSaving] = useState(false);
  const [errorMsg, setErrorMsg] = useState('');

  const handleSave = async () => {
    const v1 = parseFloat(String(m1).replace(',', '.'));
    const v2 = parseFloat(String(m2).replace(',', '.'));
    if (isNaN(v1) || isNaN(v2) || v1 <= 0 || v2 <= 0) { setErrorMsg('Ingresa valores numéricos válidos.'); return; }
    if (v2 <= v1) { setErrorMsg('El multiplicador U2 debe ser mayor al de U1.'); return; }
    setErrorMsg('');
    setSaving(true);
    await onSave({ multiplicador1: v1, multiplicador2: v2 });
    setSaving(false);
    onClose();
  };

  return (
    <div style={st.overlay} onClick={e => e.target === e.currentTarget && onClose()}>
      <div style={{ ...st.modal, width: 400 }}>
        <div style={st.modalHeader}>
          <span style={st.modalTitle}>Multiplicadores de umbral</span>
          <button onClick={onClose} style={st.closeBtn}><X size={18}/></button>
        </div>
        <div style={{ padding:'16px 20px 8px', fontSize:13, color:'#5f6368', lineHeight:1.6 }}>
          Se aplican sobre el promedio cargado en Atributos (agua, luz, gas y GC) para calcular U1 y U2. Ej: promedio $50.000 con multiplicador U1 = 1.9 → umbral 1 = $95.000.
        </div>
        <div style={{ padding:'8px 20px 4px', display:'flex', gap:12 }}>
          <div style={{ flex:1 }}>
            <label style={{ fontSize:12, fontWeight:600, color:'#5f6368', display:'block', marginBottom:6 }}>Multiplicador U1</label>
            <input value={m1} onChange={e=>setM1(e.target.value)} style={{ width:'100%', border:'1px solid #dadce0', borderRadius:8, padding:'8px 10px', fontSize:14, outline:'none', fontFamily:'inherit', boxSizing:'border-box' }}/>
          </div>
          <div style={{ flex:1 }}>
            <label style={{ fontSize:12, fontWeight:600, color:'#5f6368', display:'block', marginBottom:6 }}>Multiplicador U2</label>
            <input value={m2} onChange={e=>setM2(e.target.value)} style={{ width:'100%', border:'1px solid #dadce0', borderRadius:8, padding:'8px 10px', fontSize:14, outline:'none', fontFamily:'inherit', boxSizing:'border-box' }}/>
          </div>
        </div>
        {errorMsg && <div style={{ padding:'8px 20px 0', fontSize:12, color:'#c62828' }}>{errorMsg}</div>}
        <div style={{ padding:'20px', display:'flex', gap:8, justifyContent:'flex-end' }}>
          <button onClick={onClose} style={st.btnSecondary}>Cancelar</button>
          <button onClick={handleSave} disabled={saving} style={st.btnPrimary}>{saving ? 'Guardando...' : 'Guardar'}</button>
        </div>
      </div>
    </div>
  );
}

// ── CONFIRM MODAL ─────────────────────────────────────────────
function ConfirmModal({ title, message, onConfirm, onCancel }) {
  return (
    <div style={st.overlay} onClick={e => e.target === e.currentTarget && onCancel()}>
      <div style={{ ...st.modal, width: 420 }}>
        <div style={st.modalHeader}>
          <span style={st.modalTitle}>{title}</span>
          <button onClick={onCancel} style={st.closeBtn}><X size={18}/></button>
        </div>
        <div style={{ padding:'16px 20px', fontSize:13, color:'#3c4043', lineHeight:1.6 }}>
          {message}
        </div>
        <div style={{ padding:'0 20px 20px', display:'flex', gap:8, justifyContent:'flex-end' }}>
          <button onClick={onCancel} style={st.btnSecondary}>Cancelar</button>
          <button onClick={onConfirm} style={{ ...st.btnPrimary, display:'flex', alignItems:'center', gap:6 }}>
            <Send size={13}/> Confirmar envío
          </button>
        </div>
      </div>
    </div>
  );
}

// ── TEST MODAL ───────────────────────────────────────────────
const TEST_PROPS = [
  { propiedad: 'Vitacura 9123 C25',             mail: 'ddm@renovalpropiedades.com' },
  { propiedad: 'María Monvel 1078 D9',           mail: 'fdm@renovalpropiedades.com' },
  { propiedad: 'Alonso de Córdova 123 D27',      mail: 'diegoadm9@gmail.com' },
];

function TestModal({ onClose, onSend }) {
  const [mails, setMails] = useState(TEST_PROPS.map(p => ({ ...p })));
  const setMail = (i, v) => setMails(prev => prev.map((r, idx) => idx === i ? { ...r, mail: v } : r));
  return (
    <div style={st.overlay} onClick={e => e.target === e.currentTarget && onClose()}>
      <div style={{ ...st.modal, width: 540 }}>
        <div style={st.modalHeader}>
          <span style={st.modalTitle}>🧪 Envío de prueba</span>
          <button onClick={onClose} style={st.closeBtn}><X size={18}/></button>
        </div>
        <div style={{ padding:'16px 20px', fontSize:13, color:'#5f6368', marginBottom:4 }}>
          Se enviarán 3 correos de prueba. Puedes editar los correos destino antes de enviar.
        </div>
        <div style={{ padding:'0 20px 20px', display:'flex', flexDirection:'column', gap:10 }}>
          {mails.map((row, i) => (
            <div key={i} style={{ display:'grid', gridTemplateColumns:'1fr 1fr', gap:10, alignItems:'center', padding:'10px 12px', background:'#f8f9fa', borderRadius:8 }}>
              <div style={{ fontSize:12, fontWeight:600, color:'#202124' }}>{row.propiedad}</div>
              <input value={row.mail} onChange={e => setMail(i, e.target.value)}
                style={{ border:'1px solid #dadce0', borderRadius:6, padding:'5px 8px', fontSize:12, outline:'none', fontFamily:'inherit' }}/>
            </div>
          ))}
          <div style={{ display:'flex', gap:8, marginTop:8 }}>
            <button onClick={() => onSend(mails)} style={{ ...st.btnPrimary, display:'flex', alignItems:'center', gap:6 }}>
              <Send size={13}/> Enviar prueba
            </button>
            <button onClick={onClose} style={st.btnSecondary}>Cancelar</button>
          </div>
        </div>
      </div>
    </div>
  );
}

// ── EMAIL PREVIEW MODAL ───────────────────────────────────────
function EmailPreviewModal({ propiedad, mailAdmin, onClose }) {
  const mes = new Date().toLocaleDateString('es-CL', { month: 'long', year: 'numeric' });
  return (
    <div style={st.overlay} onClick={e=>e.target===e.currentTarget&&onClose()}>
      <div style={{ ...st.modal, width:520 }}>
        <div style={st.modalHeader}>
          <span style={st.modalTitle}>Vista previa del correo</span>
          <button onClick={onClose} style={st.closeBtn}><X size={18}/></button>
        </div>
        <div style={{ padding:'16px 20px', background:'#f8f9fa', borderRadius:8, margin:'0 20px 20px', fontSize:13 }}>
          <div style={{ marginBottom:8 }}><b>Para:</b> {mailAdmin}</div>
          <div style={{ marginBottom:8 }}><b>CC:</b> edith@renovalpropiedades.com</div>
          <div style={{ marginBottom:8 }}><b>De:</b> gcrenovalpropiedades@gmail.com</div>
          <div style={{ marginBottom:16 }}><b>Asunto:</b> Consulta Gasto Común {mes}</div>
          <div style={{ borderTop:'1px solid #e8eaed', paddingTop:16, lineHeight:1.8, color:'#3c4043' }}>
            Buenos días,<br/><br/>
            Junto con saludar, quería solicitar el saldo de gasto común de la siguiente propiedad:<br/>
            <b>{propiedad}</b><br/><br/>
            Quedo atento a su respuesta,<br/><br/>
            Saludos
          </div>
        </div>
        <div style={{ padding:'0 20px 20px', display:'flex', justifyContent:'flex-end' }}>
          <button onClick={onClose} style={st.btnSecondary}>Cerrar</button>
        </div>
      </div>
    </div>
  );
}

// ── TAB 1: SALDOS ─────────────────────────────────────────────
function SaldosTab({ rows, attrsMap, loading, fetchData, lastUploads, handleUpload, uploading, showUpload, setShowUpload, mult1, mult2, onOpenFicha }) {
  const [edits, setEdits] = useState({});
  const [search, setSearch] = useState('');
  const [filterE, setFilterE] = useState([]);
  const [filterUmbral, setFilterUmbral] = useState(0);
  const [filterGCVacio, setFilterGCVacio] = useState(false);
  const ENCARGADOS = ['DD','FD','EA','FG','AM'];
  const ENCARGADO_COLORS = { DD:'#1565C0', FD:'#2E7D32', EA:'#6A1B9A', FG:'#E65100', AM:'#37474F' };

  const handleCellChange = (rowId, field, value) => setEdits(prev=>({...prev,[rowId]:{...(prev[rowId]||{}),[field]:value}}));
  const handleSaveRow = async (rowId) => {
    const changes = edits[rowId];
    if (!changes||!Object.keys(changes).length) return;
    await supabase.from('saldos').update(changes).eq('id', rowId);
    setEdits(prev=>{ const n={...prev}; delete n[rowId]; return n; });
  };

  // "GC vacío": el campo GC Ac (mes actual) está vacío, excluyendo las
  // propiedades marcadas en Atributos como que NO tienen gasto común
  // (tiene_gc === false) — para esas, el campo vacío es esperado.
  const isGCVacio = useCallback((row) => {
    const attr = attrsMap[row.propiedad];
    if (attr?.tiene_gc === false) return false;
    return !row.gc_ac || !String(row.gc_ac).trim();
  }, [attrsMap]);

  const filtered = useMemo(() => {
    let result = rows.filter(r=>r.last_cuentas_ac||r.last_cuentas_an||r.last_arriendos);
    if (search.trim()) {
      const words = normalize(search.trim()).split(/\s+/).filter(Boolean);
      result = result.filter(r => {
        const h = normalize([r.propiedad,r.propietario,r.e1,r.e2].filter(Boolean).join(' '));
        return words.every(w=>h.includes(w));
      });
    }
    if (filterE.length) result = result.filter(r=>filterE.every(e=>[r.e1,r.e2].includes(e)));
    if (filterUmbral>0) result = result.filter(r=>rowExceedsUmbral(r,attrsMap,filterUmbral,mult1,mult2));
    if (filterGCVacio) result = result.filter(isGCVacio);
    return result;
  }, [rows,search,filterE,filterUmbral,filterGCVacio,attrsMap,mult1,mult2,isGCVacio]);

  // ── Indicadores (respetan los filtros activos: búsqueda, encargado, umbral) ──
  const gcVaciosCount = useMemo(() => filtered.filter(isGCVacio).length, [filtered, isGCVacio]);

  const COL_HEADER_COLORS = {
    agua: { bg: '#E3F2FD', color: '#1565C0' }, // azul DD
    luz:  { bg: '#FFFDE7', color: '#F57F17' }, // amarillo más cargado
    gas:  { bg: '#FFF3E0', color: '#E65100' }, // naranja FG
    gc:   { bg: '#E8F5E9', color: '#2E7D32' }, // verde FD
  };

  const COLS = [
    {key:'agua_ac',label:'AGUA Ac',tipo:'agua',alerta:'alerta_agua',groupStart:true},
    {key:'agua_an',label:'AGUA An',tipo:'agua',alerta:null,groupEnd:true},
    {key:'luz_ac', label:'LUZ Ac', tipo:'luz', alerta:'alerta_luz', groupStart:true},
    {key:'luz_an', label:'LUZ An', tipo:'luz', alerta:null,groupEnd:true},
    {key:'gas_ac', label:'GAS Ac', tipo:'gas', alerta:'alerta_gas',groupStart:true},
    {key:'gas_an', label:'GAS An', tipo:'gas', alerta:null,groupEnd:true},
    {key:'gc_ac',  label:'GC Ac',  tipo:'gc',  alerta:null,groupStart:true},
    {key:'gc_an',  label:'GC An',  tipo:'gc',  alerta:null,groupEnd:true},
    {key:'deuda_arriendo',label:'DEUDA ARR.',tipo:'arriendo',alerta:null,groupStart:true,groupEnd:true},
  ];

  return (
    <>
      {showUpload&&(
        <div style={st.uploadPanel}>
          <UploadBtn label="📄 Cuentas actuales" tipo="cuentas_ac" onUpload={handleUpload} lastUpload={lastUploads['cuentas_ac']}/>
          <UploadBtn label="📄 Cuentas mes anterior" tipo="cuentas_an" onUpload={handleUpload} lastUpload={lastUploads['cuentas_an']}/>
          <UploadBtn label="📄 Deuda de arriendo" tipo="arriendos" onUpload={handleUpload} lastUpload={lastUploads['arriendos']}/>
          {uploading&&<div style={st.uploadingMsg}>⏳ Procesando {uploading}...</div>}
        </div>
      )}
      <div style={st.filtersRow}>
        <div style={st.searchWrapper}>
          <Search size={15} color="#9aa0a6" style={st.searchIcon}/>
          <input value={search} onChange={e=>setSearch(e.target.value)} placeholder="Buscar propiedad, propietario, encargado..." style={st.searchInput}/>
          {search&&<button onClick={()=>setSearch('')} style={st.clearSearch}><X size={13} color="#9aa0a6"/></button>}
        </div>
        <div style={st.encargadoFilters}>
          <span style={st.filterLabel}>Filtrar por:</span>
          {ENCARGADOS.map(e=>(
            <button key={e} onClick={()=>setFilterE(prev=>prev.includes(e)?prev.filter(x=>x!==e):[...prev,e])} style={{
              ...st.filterBtn,
              ...(filterE.includes(e)?{background:ENCARGADO_COLORS[e]+'22',color:ENCARGADO_COLORS[e],borderColor:ENCARGADO_COLORS[e],fontWeight:700}:{})
            }}>{e}</button>
          ))}
          {filterE.length>0&&<button onClick={()=>setFilterE([])} style={st.clearFilter}>Limpiar</button>}
          <div style={{width:1,background:'#dadce0',height:20,margin:'0 4px'}}/>
          <button onClick={()=>setFilterUmbral(filterUmbral===1?0:1)} style={{...st.filterBtn,...(filterUmbral===1?{background:'#fff3e0',color:'#e65100',borderColor:'#e65100',fontWeight:700}:{})}}>≥ U1</button>
          <button onClick={()=>setFilterUmbral(filterUmbral===2?0:2)} style={{...st.filterBtn,...(filterUmbral===2?{background:'#fce8e6',color:'#c5221f',borderColor:'#c5221f',fontWeight:700}:{})}}>≥ U2</button>
          <div style={{width:1,background:'#dadce0',height:20,margin:'0 4px'}}/>
          <button onClick={()=>setFilterGCVacio(v=>!v)} style={{...st.filterBtn,...(filterGCVacio?{background:'#fce8e6',color:'#c5221f',borderColor:'#c5221f',fontWeight:700}:{})}}>GC Vacíos</button>
        </div>
      </div>
      <div style={st.tableWrapper}>
        {loading?<div style={st.loading}>Cargando saldos...</div>:rows.length===0?<div style={st.loading}>No hay datos cargados aún.</div>:(
          <table style={st.table}>
            <thead><tr>
              <th style={{...st.th,minWidth:280,textAlign:'left'}}>PROPIEDAD</th>
              <th style={{...st.th,minWidth:160,textAlign:'center'}}>PROPIETARIO</th>
              {COLS.map(c => {
                const hc = COL_HEADER_COLORS[c.tipo] || {};
                return (
                  <th key={c.key} style={{
                    ...st.th, minWidth:70, textAlign:'center',
                    ...(c.groupStart?{borderLeft:'2px solid #bdbdbd'}:{}),
                    ...(c.groupEnd?{borderRight:'2px solid #bdbdbd'}:{}),
                  }}>
                    {hc.bg ? (
                      <span style={{ display:'inline-block', background:hc.bg, color:hc.color, borderRadius:20, padding:'6px 10px', fontWeight:700, fontSize:10, letterSpacing:0.5, border:`1px solid ${hc.color}44` }}>
                        {c.label}
                      </span>
                    ) : c.label}
                  </th>
                );
              })}
              <th style={{...st.th,minWidth:40}}></th>
              <th style={{...st.th,minWidth:50,textAlign:'center'}}>E1</th>
              <th style={{...st.th,minWidth:50,textAlign:'center'}}>E2</th>
            </tr></thead>
            <tbody>
              {filtered.length===0?<tr><td colSpan={COLS.length+4} style={st.empty}>Sin resultados.</td></tr>
              :filtered.map(row=>{
                const hasEdits=!!(edits[row.id]&&Object.keys(edits[row.id]).length);
                const merged={...row,...(edits[row.id]||{})};
                const EC = ENCARGADO_COLORS;
                const rowAttrExists = !!attrsMap[row.propiedad];
                return (
                  <tr key={row.id} style={{background:'#fff'}}>
                    <td style={{...st.tdFixed,fontSize:12}}>
                      <FichaCellWrap propiedad={rowAttrExists ? row.propiedad : null} onOpenFicha={onOpenFicha}>
                        {row.propiedad}
                      </FichaCellWrap>
                    </td>
                    <td style={{...st.tdFixed,fontSize:11,color:'#5f6368',textAlign:'center'}}>{row.propietario||''}</td>
                    {COLS.map(c=>{
                      const rowAttr=attrsMap[row.propiedad];
                      const emptyWhite=c.tipo==='arriendo'||(c.tipo==='agua'&&rowAttr?.tiene_agua===false)||(c.tipo==='luz'&&rowAttr?.tiene_luz===false)||(c.tipo==='gas'&&rowAttr?.tiene_gas===false)||(c.tipo==='gc'&&rowAttr?.tiene_gc===false);
                      return (
                        <td key={c.key} style={{...st.td,padding:'4px 6px',...(c.groupStart?{borderLeft:'2px solid #bdbdbd'}:{}),...(c.groupEnd?{borderRight:'2px solid #bdbdbd'}:{})}}>
                          <EditableCell value={merged[c.key]||''} tipo={c.tipo} alerta={c.alerta?merged[c.alerta]:false} onChange={val=>handleCellChange(row.id,c.key,val)} attr={rowAttr} emptyWhite={emptyWhite} mult1={mult1} mult2={mult2}/>
                        </td>
                      );
                    })}
                    <td style={{...st.tdFixed,textAlign:'center'}}>
                      {hasEdits&&<button onClick={()=>handleSaveRow(row.id)} style={st.saveRowBtn} title="Guardar"><Save size={13} color="#1a73e8"/></button>}
                    </td>
                    <td style={{...st.tdFixed,textAlign:'center'}}>{row.e1&&<span style={{...st.badge,background:EC[row.e1]+'22'||'#9aa0a622',color:EC[row.e1]||'#9aa0a6',border:'1px solid '+(EC[row.e1]||'#9aa0a6')+'44'}}>{row.e1}</span>}</td>
                    <td style={{...st.tdFixed,textAlign:'center'}}>{row.e2&&<span style={{...st.badge,background:EC[row.e2]+'22'||'#9aa0a622',color:EC[row.e2]||'#9aa0a6',border:'1px solid '+(EC[row.e2]||'#9aa0a6')+'44'}}>{row.e2}</span>}</td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        )}
      </div>

      <div style={st.totalsRow}>
        <span style={st.totalsLabel}>TOTAL</span>
        <span style={st.totalsItem}>Número de propiedades: <strong>{filtered.length}</strong></span>
        <span style={st.totalsItem}>Gastos comunes vacíos: <strong style={{ color: gcVaciosCount > 0 ? '#c62828' : '#202124' }}>{gcVaciosCount}</strong></span>
      </div>
    </>
  );
}

// ── TAB 2: CONSULTAS GC ───────────────────────────────────────
function ConsultasTab({ onOpenFicha }) {
  const [config, setConfig] = useState([]);
  const [log, setLog] = useState([]);
  const [carteraSet, setCarteraSet] = useState(new Set());
  const [loading, setLoading] = useState(true);
  const [sending, setSending] = useState(false);
  const [updating, setUpdating] = useState(false);
  const [previewRow, setPreviewRow] = useState(null);
  const [editingId, setEditingId] = useState(null);
  const [editField, setEditField] = useState(null);
  const [editValue, setEditValue] = useState('');
  const [addingNew, setAddingNew] = useState(false);
  const [newRow, setNewRow] = useState({ propiedad:'', mail_admin:'', cartera:'' });
  const [sendResult, setSendResult] = useState(null);
  const [showTestModal, setShowTestModal] = useState(false);
  const [showConfirm, setShowConfirm] = useState(false);
  const [confirmDeleteId, setConfirmDeleteId] = useState(null);

  const mes = currentMes();

  const fetchAll = useCallback(async () => {
    setLoading(true);
    const [{ data: cfg }, { data: lg }, { data: cartera }] = await Promise.all([
      supabase.from('gc_consultas_config').select('*').order('propiedad'),
      supabase.from('gc_consultas_log').select('*').eq('mes', mes),
      supabase.from('properties').select('propiedad'),
    ]);
    setConfig(cfg || []);
    setLog(lg || []);
    setCarteraSet(new Set((cartera || []).map(c => c.propiedad)));
    setLoading(false);
  }, [mes]);

  useEffect(() => { fetchAll(); }, [fetchAll]);

  const logMap = useMemo(() => {
    const m = {};
    log.forEach(l => { m[l.propiedad] = l; });
    return m;
  }, [log]);

  // Propiedades con correo configurado que aún no tienen una respuesta ni un
  // valor ingresado manualmente para el mes actual. Son las que se deben
  // incluir la próxima vez que se apriete "Enviar consultas".
  const pendientesEnvio = useMemo(() => {
    return config.filter(r => {
      if (!r.mail_admin || !r.mail_admin.trim()) return false;
      const status = logMap[r.propiedad]?.status;
      return status !== 'respondido' && status !== 'manual';
    });
  }, [config, logMap]);

  const startEdit = (id, field, currentValue) => {
    setEditingId(id);
    setEditField(field);
    setEditValue(currentValue || '');
  };

  const saveEdit = async (id) => {
    if (!editField) return;
    await supabase.from('gc_consultas_config').update({ [editField]: editValue || null }).eq('id', id);
    setConfig(prev => prev.map(r => r.id === id ? { ...r, [editField]: editValue || null } : r));
    setEditingId(null);
    setEditField(null);
  };

  const handleDelete = async (id) => {
    await supabase.from('gc_consultas_config').delete().eq('id', id);
    setConfig(prev => prev.filter(r => r.id !== id));
  };

  const handleAddNew = async () => {
    if (!newRow.propiedad.trim()) return;
    const { data } = await supabase.from('gc_consultas_config').insert({
      propiedad: newRow.propiedad.trim(),
      mail_admin: newRow.mail_admin.trim() || null,
      cartera: newRow.cartera.trim() || null,
    }).select().single();
    if (data) { setConfig(prev => [...prev, data]); }
    setNewRow({ propiedad:'', mail_admin:'', cartera:'' });
    setAddingNew(false);
  };

  const doSendAll = async () => {
    setShowConfirm(false);
    const toSend = pendientesEnvio;
    if (!toSend.length) return;
    setSending(true);
    setSendResult(null);
    let sent = 0, errors = 0;
    const mesLabel = new Date().toLocaleDateString('es-CL', { month:'long', year:'numeric' });

    for (const row of toSend) {
      try {
        await fetch('/api/send-gc-email', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${process.env.REACT_APP_CRON_SECRET}`,
          },
          body: JSON.stringify({
            propiedad: row.propiedad,
            mailAdmin: row.mail_admin,
            mesLabel,
            isTest: false,
          }),
        });
        await supabase.from('gc_consultas_log').upsert({
          propiedad: row.propiedad,
          mes,
          mail_admin: row.mail_admin,
          enviado_at: new Date().toISOString(),
          status: 'enviado',
        }, { onConflict: 'propiedad,mes' });
        sent++;
      } catch (e) {
        console.error('Error enviando a', row.mail_admin, e);
        errors++;
      }
    }
    setSendResult({ sent, errors });
    setSending(false);
    fetchAll();
  };

  const handleCheckReplies = async () => {
    setUpdating(true);
    try {
      const enviado_desde = log
        .filter(l => l.mes === mes && l.enviado_at)
        .reduce((min, l) => (!min || l.enviado_at < min ? l.enviado_at : min), null);

      // Propiedades que ya tienen valor GC extraído este mes: no hace falta reprocesarlas
      const ya_resueltas = log
        .filter(l => l.mes === mes && l.gc_valor)
        .map(l => l.propiedad);

      const response = await fetch('/api/check-gc-replies', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${process.env.REACT_APP_CRON_SECRET}`,
        },
        body: JSON.stringify({
          mes,
          propiedades: config.map(r => r.propiedad),
          enviado_desde,
          ya_resueltas,
        }),
      });
      const data = await response.json();
      console.log('check-gc-replies result:', data);

      if (data.gmail_errors?.length) {
        const isAuthError = data.gmail_errors.some(e => /invalid_grant|invalid_token|unauthorized/i.test(e));
        alert(
          (isAuthError
            ? '⚠ El token de acceso a Gmail venció y hay que renovarlo (ver instrucciones del proyecto).\n\n'
            : '⚠ Hubo un problema consultando Gmail.\n\n') +
          'Detalle: ' + data.gmail_errors.join(' | ')
        );
      }

      const replies = data.replies || [];
      for (const r of replies) {
        if (!r.propiedad) continue;
        await supabase.from('gc_consultas_log').upsert({
          propiedad: r.propiedad,
          mes,
          respondido_at: r.respondido_at || new Date().toISOString(),
          status: 'respondido',
          gc_valor: r.gc_valor || null,
          pdf_adjuntos: r.pdf_adjuntos || null,
          // Solo se incluye si vino con texto, para no pisar con null un
          // respuesta_texto que ya se hubiera guardado en una pasada anterior.
          ...(r.respuesta_texto ? { respuesta_texto: r.respuesta_texto } : {}),
        }, { onConflict: 'propiedad,mes' });

        if (r.gc_valor) {
          await supabase.from('saldos').update({ gc_ac: r.gc_valor }).eq('propiedad', r.propiedad);
        }
      }
      fetchAll();
    } catch(e) { console.error(e); }
    setUpdating(false);
  };

  const withMail = config.filter(r => r.mail_admin?.trim()).length;

  return (
    <div style={{ display:'flex', flexDirection:'column', flex:1, overflow:'hidden' }}>
      <div style={{ display:'flex', alignItems:'center', gap:10, marginBottom:14, flexShrink:0, flexWrap:'wrap' }}>
        <div style={{ flex:1, fontSize:13, color:'#5f6368' }}>
          {config.length} propiedades · {withMail} con correo · {pendientesEnvio.length} pendientes · Mes: <b>{formatMes(mes)}</b>
        </div>
        <button onClick={() => setAddingNew(true)} disabled={addingNew}
          style={{ ...st.btnSecondary, display:'flex', alignItems:'center', gap:6 }}>
          <Plus size={14}/> Nueva fila
        </button>
        <button onClick={() => setShowTestModal(true)}
          style={{ ...st.btnSecondary, display:'flex', alignItems:'center', gap:6, color:'#f57c00', borderColor:'#f57c00' }}>
          🧪 Prueba
        </button>
        <button onClick={handleCheckReplies} disabled={updating}
          style={{ ...st.btnSecondary, display:'flex', alignItems:'center', gap:6 }}>
          <RefreshCw size={14} style={{animation:updating?'spin 1s linear infinite':'none'}}/>
          {updating ? 'Revisando...' : 'Actualizar respuestas'}
        </button>
        <button onClick={() => setShowConfirm(true)} disabled={sending || pendientesEnvio.length === 0}
          style={{ ...st.btnPrimary, display:'flex', alignItems:'center', gap:6 }}>
          <Send size={14}/>
          {sending ? 'Enviando...' : `Enviar consultas (${pendientesEnvio.length})`}
        </button>
      </div>

      {sendResult && (
        <div style={{ marginBottom:12, padding:'10px 16px', background: sendResult.errors ? '#fce8e6' : '#e6f4ea', borderRadius:8, fontSize:13, color: sendResult.errors ? '#c62828' : '#2e7d32', flexShrink:0 }}>
          {sendResult.errors === 0
            ? `✓ ${sendResult.sent} correos enviados correctamente`
            : `${sendResult.sent} enviados, ${sendResult.errors} errores`}
        </div>
      )}

      <div style={st.tableWrapper}>
        {loading ? <div style={st.loading}>Cargando...</div> : (
          <table style={st.table}>
            <thead><tr>
              <th style={{...st.th,textAlign:'left',minWidth:200}}>PROPIEDAD</th>
              <th style={{...st.th,textAlign:'left',minWidth:240}}>CARTERA</th>
              <th style={{...st.th,textAlign:'left',minWidth:220}}>CORREO ADMINISTRACIÓN</th>
              <th style={{...st.th,textAlign:'center',minWidth:120}}>ESTADO {formatMes(mes)}</th>
              <th style={{...st.th,minWidth:80}}></th>
            </tr></thead>
            <tbody>
              {addingNew && (
                <tr style={{background:'#f0f7ff'}}>
                  <td style={st.tdFixed}>
                    <input value={newRow.propiedad} onChange={e=>setNewRow(p=>({...p,propiedad:e.target.value}))}
                      placeholder="Nombre propiedad" style={inlineInputStyle}/>
                  </td>
                  <td style={{...st.tdFixed, position:'relative', overflow:'visible'}}>
                    <PropertyAutocomplete
                      value={newRow.cartera}
                      onChange={v => setNewRow(p => ({ ...p, cartera: v }))}
                      placeholder="Buscar en Cartera..."
                      raw
                    />
                  </td>
                  <td style={st.tdFixed}>
                    <input value={newRow.mail_admin} onChange={e=>setNewRow(p=>({...p,mail_admin:e.target.value}))}
                      placeholder="correo@admin.com" style={inlineInputStyle}/>
                  </td>
                  <td style={{...st.tdFixed,textAlign:'center'}}>—</td>
                  <td style={{...st.tdFixed,textAlign:'center'}}>
                    <button onClick={handleAddNew} style={{...st.actionBtn,background:'#e6f4ea',color:'#34a853'}}>✓</button>
                    <button onClick={()=>{setAddingNew(false);setNewRow({propiedad:'',mail_admin:'',cartera:''}); }} style={st.actionBtn}><X size={13}/></button>
                  </td>
                </tr>
              )}
              {config.map(row => {
                const logRow = logMap[row.propiedad];
                const status = logRow?.status;
                const isEditingMail = editingId === row.id && editField === 'mail_admin';
                const isEditingCartera = editingId === row.id && editField === 'cartera';
                const carteraExiste = row.cartera && carteraSet.has(row.cartera);

                return (
                  <tr key={row.id} style={{background:'#fff'}}
                    onMouseEnter={e=>e.currentTarget.style.background='#f8f9fa'}
                    onMouseLeave={e=>e.currentTarget.style.background='#fff'}>

                    {/* PROPIEDAD */}
                    <td style={{...st.tdFixed,fontSize:12}}>{row.propiedad}</td>

                    {/* CARTERA */}
                    <td style={{...st.tdFixed, position:'relative', overflow:'visible'}}>
                      {isEditingCartera ? (
                        <div style={{display:'flex',gap:6,alignItems:'center'}}>
                          <div style={{flex:1, position:'relative'}}>
                            <PropertyAutocomplete
                              value={editValue}
                              onChange={v => setEditValue(v)}
                              placeholder="Buscar en Cartera..."
                              raw
                            />
                          </div>
                          <button onClick={()=>saveEdit(row.id)} style={{...st.actionBtn,background:'#e6f4ea',color:'#34a853',flexShrink:0}}>✓</button>
                          <button onClick={()=>{ setEditingId(null); setEditField(null); }} style={{...st.actionBtn,flexShrink:0}}><X size={12}/></button>
                        </div>
                      ) : (
                        <FichaCellWrap propiedad={carteraExiste ? row.cartera : null} onOpenFicha={onOpenFicha}>
                          <div onClick={() => startEdit(row.id, 'cartera', row.cartera)}
                            style={{cursor:'text',fontSize:12,padding:'2px 4px',borderRadius:4,minHeight:20}}>
                            {row.cartera
                              ? <span style={{color:'#202124'}}>{row.cartera}</span>
                              : <span style={{color:'#9aa0a6',fontSize:11}}>— sin vincular —</span>}
                          </div>
                        </FichaCellWrap>
                      )}
                    </td>

                    {/* CORREO */}
                    <td style={st.tdFixed}>
                      {isEditingMail ? (
                        <div style={{display:'flex',gap:6,alignItems:'center'}}>
                          <input value={editValue} onChange={e=>setEditValue(e.target.value)}
                            autoFocus style={{...inlineInputStyle,flex:1}}/>
                          <button onClick={()=>saveEdit(row.id)} style={{...st.actionBtn,background:'#e6f4ea',color:'#34a853'}}>✓</button>
                          <button onClick={()=>{ setEditingId(null); setEditField(null); }} style={st.actionBtn}><X size={12}/></button>
                        </div>
                      ) : (
                        <div onClick={()=>startEdit(row.id,'mail_admin',row.mail_admin)}
                          style={{cursor:'text',fontSize:12,padding:'2px 4px',borderRadius:4,display:'flex',alignItems:'center',gap:6,minHeight:20}}>
                          {row.mail_admin
                            ? <span style={{color:'#202124'}}>{row.mail_admin}</span>
                            : <span style={{color:'#ea4335',fontSize:11,fontWeight:600}}>⚠ Sin correo</span>}
                        </div>
                      )}
                    </td>

                    {/* ESTADO */}
                    <td style={{...st.tdFixed,textAlign:'center'}}>
                      {!status && <span style={{fontSize:11,color:'#9aa0a6'}}>—</span>}
                      {status==='enviado' && <span style={{fontSize:11,fontWeight:600,color:'#1a73e8',background:'#e8f0fe',padding:'2px 10px',borderRadius:20}}>Enviado</span>}
                      {status==='manual' && (
                        <div>
                          <span style={{fontSize:11,fontWeight:600,color:'#6a1b9a',background:'#f3e5f5',padding:'2px 10px',borderRadius:20}}>Ingresado Manual</span>
                          {logRow?.gc_valor && <div style={{fontSize:11,color:'#5f6368',marginTop:2}}>{logRow.gc_valor}</div>}
                        </div>
                      )}
                      {status==='respondido' && (
                        <div>
                          <span style={{fontSize:11,fontWeight:600,color:'#2e7d32',background:'#e6f4ea',padding:'2px 10px',borderRadius:20}}>Respondido</span>
                          {logRow?.gc_valor && <div style={{fontSize:11,color:'#5f6368',marginTop:2}}>{logRow.gc_valor}</div>}
                          {logRow?.pdf_adjuntos > 1 && (
                            <div style={{fontSize:10,color:'#e65100',marginTop:2,display:'flex',alignItems:'center',gap:3,justifyContent:'center'}} title="El correo traía más de un PDF adjunto; se extrajo del primero. Verifica el valor en Reportabilidad.">
                              <AlertCircle size={10}/> {logRow.pdf_adjuntos} adjuntos — revisar
                            </div>
                          )}
                        </div>
                      )}
                    </td>

                    {/* ACCIONES */}
                    <td style={{...st.tdFixed,textAlign:'center'}}>
                      {row.mail_admin && (
                        <button onClick={()=>setPreviewRow(row)} style={{...st.actionBtn,color:'#1a73e8'}} title="Ver correo"><Eye size={14}/></button>
                      )}
                      {confirmDeleteId === row.id ? (
                        <>
                          <button onClick={async()=>{ await handleDelete(row.id); setConfirmDeleteId(null); }} style={{...st.actionBtn,background:'#fce8e6',color:'#ea4335'}} title="Confirmar eliminar"><Trash2 size={13}/></button>
                          <button onClick={()=>setConfirmDeleteId(null)} style={{...st.actionBtn,color:'#5f6368'}} title="Cancelar"><X size={12}/></button>
                        </>
                      ) : (
                        <button onClick={()=>setConfirmDeleteId(row.id)} style={{...st.actionBtn,color:'#9aa0a6'}} title="Eliminar"><Trash2 size={13}/></button>
                      )}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        )}
      </div>

      {previewRow && <EmailPreviewModal propiedad={previewRow.propiedad} mailAdmin={previewRow.mail_admin} onClose={()=>setPreviewRow(null)}/>}

      {showConfirm && (
        <ConfirmModal
          title="Confirmar envío de correos"
          message={`Se enviarán ${pendientesEnvio.length} correos de consulta de gasto común para ${formatMes(mes)}. Se excluyen las propiedades que ya respondieron o tienen un valor ingresado manualmente este mes. Esta acción no se puede deshacer.`}
          onConfirm={doSendAll}
          onCancel={() => setShowConfirm(false)}
        />
      )}

      {showTestModal && (
        <TestModal
          onClose={() => setShowTestModal(false)}
          onSend={async (testRows) => {
            setShowTestModal(false);
            setSending(true);
            setSendResult(null);
            const mesLabel = new Date().toLocaleDateString('es-CL', { month:'long', year:'numeric' });
            let sent = 0, errors = 0;
            for (const row of testRows) {
              if (!row.mail?.trim()) continue;
              try {
                await fetch('/api/send-gc-email', {
                  method: 'POST',
                  headers: {
                    'Content-Type': 'application/json',
                    'Authorization': `Bearer ${process.env.REACT_APP_CRON_SECRET}`,
                  },
                  body: JSON.stringify({
                    propiedad: row.propiedad,
                    mailAdmin: row.mail,
                    mesLabel,
                    isTest: true,
                  }),
                });
                sent++;
              } catch(e) { errors++; }
            }
            setSendResult({ sent, errors });
            setSending(false);
          }}
        />
      )}
      <style>{`@keyframes spin{from{transform:rotate(0)}to{transform:rotate(360deg)}}`}</style>
    </div>
  );
}

// ── SIDEBAR: respuesta de correo + comentario ─────────────────
function GCDetailSidebar({ propiedad, mes, logEntry, comentarioDraft, setComentarioDraft, onSaveComentario, savingComentario, onClose }) {
  const hasChanges = comentarioDraft.trim() !== (logEntry?.comentario || '');
  return (
    <div style={{ position:'fixed', top:0, right:0, height:'100vh', width:380, maxWidth:'90vw', background:'#fff', boxShadow:'-6px 0 24px rgba(0,0,0,0.18)', zIndex:2500, display:'flex', flexDirection:'column', fontFamily:"'Google Sans','Segoe UI',sans-serif" }}>
      <div style={{ display:'flex', justifyContent:'space-between', alignItems:'flex-start', padding:'18px 20px', borderBottom:'1px solid #e8eaed', flexShrink:0 }}>
        <div>
          <div style={{ fontSize:15, fontWeight:700, color:'#202124' }}>{propiedad}</div>
          <div style={{ fontSize:12, color:'#9aa0a6', marginTop:2 }}>{formatMes(mes)}</div>
        </div>
        <button onClick={onClose} style={{ background:'none', border:'none', cursor:'pointer', padding:4, color:'#5f6368' }}><X size={18}/></button>
      </div>

      <div style={{ flex:1, overflow:'auto', padding:'18px 20px', display:'flex', flexDirection:'column', gap:20 }}>
        {logEntry?.gc_valor && (
          <div>
            <div style={{ fontSize:11, fontWeight:700, color:'#9aa0a6', letterSpacing:0.5, marginBottom:6 }}>VALOR GC</div>
            <div style={{ fontSize:16, fontWeight:700, color:'#1e6e3b' }}>{logEntry.gc_valor}</div>
          </div>
        )}

        <div>
          <div style={{ fontSize:11, fontWeight:700, color:'#9aa0a6', letterSpacing:0.5, marginBottom:6 }}>RESPUESTA DEL CORREO</div>
          {logEntry?.respuesta_texto ? (
            <div style={{ fontSize:13, color:'#3c4043', lineHeight:1.6, whiteSpace:'pre-wrap', background:'#f8f9fa', border:'1px solid #e8eaed', borderRadius:8, padding:'10px 12px', maxHeight:320, overflow:'auto' }}>
              {logEntry.respuesta_texto}
            </div>
          ) : (
            <div style={{ fontSize:12, color:'#9aa0a6', fontStyle:'italic' }}>
              {logEntry?.status === 'respondido' ? 'No se guardó texto de la respuesta para este correo.' : 'Sin respuesta registrada para este mes.'}
            </div>
          )}
        </div>

        <div>
          <div style={{ fontSize:11, fontWeight:700, color:'#9aa0a6', letterSpacing:0.5, marginBottom:6 }}>COMENTARIO</div>
          <textarea
            value={comentarioDraft}
            onChange={e => setComentarioDraft(e.target.value)}
            placeholder="Escribe un comentario para esta propiedad y mes..."
            style={{ width:'100%', minHeight:100, border:'1px solid #dadce0', borderRadius:8, padding:'8px 10px', fontSize:13, outline:'none', fontFamily:'inherit', resize:'vertical', boxSizing:'border-box' }}
          />
          <div style={{ display:'flex', justifyContent:'flex-end', marginTop:8 }}>
            <button onClick={onSaveComentario} disabled={savingComentario || !hasChanges}
              style={{ padding:'7px 16px', background: hasChanges?'#1a73e8':'#e8eaed', color: hasChanges?'#fff':'#9aa0a6', border:'none', borderRadius:8, fontSize:13, fontWeight:500, cursor: hasChanges?'pointer':'not-allowed', fontFamily:'inherit' }}>
              {savingComentario ? 'Guardando...' : 'Guardar comentario'}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

// ── TAB 3: REPORTABILIDAD ─────────────────────────────────────
function ReportabilidadTab() {
  const [config, setConfig] = useState([]);
  const [logs, setLogs] = useState([]);
  const [loading, setLoading] = useState(true);
  const [editingCell, setEditingCell] = useState(null); // { propiedad, mes }
  const [editValue, setEditValue] = useState('');
  const [savingCell, setSavingCell] = useState(null); // "propiedad|mes"
  const [sidebarCell, setSidebarCell] = useState(null); // { propiedad, mes }
  const [comentarioDraft, setComentarioDraft] = useState('');
  const [savingComentario, setSavingComentario] = useState(false);
  const months = getLast12Months();
  const mesCurrent = currentMes();

  const fetchAll = useCallback(async () => {
    setLoading(true);
    const [{ data: cfg }, { data: lg }] = await Promise.all([
      supabase.from('gc_consultas_config').select('propiedad').order('propiedad'),
      supabase.from('gc_consultas_log').select('*'),
    ]);
    setConfig(cfg || []);
    setLogs(lg || []);
    setLoading(false);
  }, []);

  useEffect(() => { fetchAll(); }, [fetchAll]);

  const logMap = useMemo(() => {
    const m = {};
    logs.forEach(l => {
      if (!m[l.propiedad]) m[l.propiedad] = {};
      m[l.propiedad][l.mes] = l;
    });
    return m;
  }, [logs]);

  const getCellContent = (logEntry) => {
    if (!logEntry) return null;
    if (logEntry.gc_valor) return { type:'valor', text:logEntry.gc_valor, bg:'#e6f4ea', color:'#1e6e3b', fontWeight:700 };
    if (logEntry.status === 'manual') return { type:'manual', text:'Manual', bg:'#f3e5f5', color:'#6a1b9a', fontWeight:700 };
    if (logEntry.status === 'respondido') return { type:'respondido', text:'R', bg:'#e6f4ea', color:'#2e7d32', fontWeight:700 };
    if (logEntry.status === 'enviado') return { type:'enviado', text:'E', bg:'#e8f0fe', color:'#1a73e8', fontWeight:700 };
    return null;
  };

  // Entrada / corrección manual de GC — habilitada en cualquier mes. Útil, por
  // ejemplo, para corregir un valor mal extraído (correo con más de un PDF
  // adjunto, donde se tomó el valor del PDF equivocado).
  const startEditManual = (propiedad, mes) => {
    const current = logMap[propiedad]?.[mes];
    setEditingCell({ propiedad, mes });
    setEditValue(current?.gc_valor || '');
  };

  // Formatea un valor de GC ingresado a mano al mismo formato que usan los
  // valores extraídos automáticamente del PDF ($XX.XXX), para que ambos se
  // vean consistentes en Reportabilidad, Consultas GC y Saldos.
  const formatGCValue = (raw) => {
    const digits = raw.replace(/[^0-9]/g, '');
    if (!digits) return raw.trim(); // sin dígitos (caso raro): se deja tal cual
    const n = parseInt(digits, 10);
    if (isNaN(n)) return raw.trim();
    return '$' + n.toLocaleString('es-CL');
  };

  const saveManualValue = async (propiedad, mes) => {
    const rawValue = editValue.trim();
    const value = rawValue ? formatGCValue(rawValue) : '';
    const existing = logMap[propiedad]?.[mes];
    // Si el valor no cambió, no hacemos nada.
    if (value === (existing?.gc_valor || '')) { setEditingCell(null); return; }
    const cellKey = `${propiedad}|${mes}`;
    setSavingCell(cellKey);
    try {
      const wasManual = existing?.status === 'manual';
      const payload = value
        // pdf_adjuntos se limpia: una vez corregido/ingresado a mano, el
        // valor ya no es ambiguo.
        ? { propiedad, mes, gc_valor: value, status: 'manual', pdf_adjuntos: null }
        : { propiedad, mes, gc_valor: null, status: wasManual ? null : (existing?.status || null) };
      await supabase.from('gc_consultas_log').upsert(payload, { onConflict: 'propiedad,mes' });
      setLogs(prev => {
        const idx = prev.findIndex(l => l.propiedad === propiedad && l.mes === mes);
        if (idx === -1) return [...prev, payload];
        const next = [...prev];
        next[idx] = { ...next[idx], ...payload };
        return next;
      });
    } catch (e) {
      console.error('Error guardando valor manual de GC:', e);
      alert('No se pudo guardar el valor: ' + e.message);
    }
    setSavingCell(null);
    setEditingCell(null);
  };

  // Barra lateral: muestra el texto de la respuesta del correo (si existe) y
  // permite ver/editar el comentario de esa propiedad+mes. Se abre con el
  // botoncito de la celda, no con el click normal (que sigue editando el
  // valor de GC como ya funcionaba).
  const openSidebar = (propiedad, mes) => {
    const entry = logMap[propiedad]?.[mes];
    setSidebarCell({ propiedad, mes });
    setComentarioDraft(entry?.comentario || '');
  };

  const closeSidebar = () => {
    setSidebarCell(null);
    setComentarioDraft('');
  };

  const saveComentario = async () => {
    if (!sidebarCell) return;
    const { propiedad, mes } = sidebarCell;
    const value = comentarioDraft.trim();
    setSavingComentario(true);
    try {
      const payload = { propiedad, mes, comentario: value || null };
      await supabase.from('gc_consultas_log').upsert(payload, { onConflict: 'propiedad,mes' });
      setLogs(prev => {
        const idx = prev.findIndex(l => l.propiedad === propiedad && l.mes === mes);
        if (idx === -1) return [...prev, payload];
        const next = [...prev];
        next[idx] = { ...next[idx], ...payload };
        return next;
      });
    } catch (e) {
      console.error('Error guardando comentario:', e);
      alert('No se pudo guardar el comentario: ' + e.message);
    }
    setSavingComentario(false);
  };

  if (loading) return <div style={st.loading}>Cargando...</div>;

  const totalProps = config.length;
  const countEnviado = config.filter(({ propiedad }) => { const l = logMap[propiedad]?.[mesCurrent]; return l && (l.status === 'enviado' || l.status === 'respondido'); }).length;
  const countRespondido = config.filter(({ propiedad }) => logMap[propiedad]?.[mesCurrent]?.status === 'respondido').length;
  const countConValor = config.filter(({ propiedad }) => !!logMap[propiedad]?.[mesCurrent]?.gc_valor).length;

  return (
    <div style={{ display:'flex', flexDirection:'column', flex:1, overflow:'hidden' }}>
      <div style={{ display:'flex', gap:12, marginBottom:16, flexShrink:0 }}>
        {[
          { label:'Propiedades', value:totalProps, color:'#5f6368', bg:'#f8f9fa' },
          { label:'Enviados', value:countEnviado, color:'#1a73e8', bg:'#e8f0fe' },
          { label:'Respondidos', value:countRespondido, color:'#2e7d32', bg:'#e6f4ea' },
          { label:'Con valor GC', value:countConValor, color:'#1e6e3b', bg:'#c8e6c9' },
        ].map(s => (
          <div key={s.label} style={{ padding:'10px 16px', background:s.bg, borderRadius:10, textAlign:'center', minWidth:90 }}>
            <div style={{ fontSize:22, fontWeight:700, color:s.color }}>{s.value}</div>
            <div style={{ fontSize:11, color:'#5f6368', marginTop:2 }}>{s.label}</div>
          </div>
        ))}
        <div style={{ flex:1, display:'flex', alignItems:'center', paddingLeft:8 }}>
          <span style={{ fontSize:12, color:'#9aa0a6' }}>Mes actual: <b style={{color:'#202124'}}>{formatMes(mesCurrent)}</b> · click en la celda para ingresar/corregir el valor de GC · ícono <MessageSquare size={11} style={{verticalAlign:'middle'}}/> (aparece al pasar el mouse) para ver la respuesta del correo o dejar un comentario</span>
        </div>
      </div>

      <div style={{ ...st.tableWrapper, flex:1 }}>
        <table style={st.table}>
          <thead>
            <tr>
              <th style={{ ...st.th, textAlign:'left', minWidth:260, position:'sticky', left:0, zIndex:2, background:'#f8f9fa' }}>PROPIEDAD</th>
              {months.map(m => <th key={m} style={{ ...st.th, minWidth:80, textAlign:'center' }}>{formatMes(m)}</th>)}
            </tr>
          </thead>
          <tbody>
            {config.map(({ propiedad }) => (
              <tr key={propiedad} style={{ background:'#fff' }}
                onMouseEnter={e => e.currentTarget.style.background='#f8f9fa'}
                onMouseLeave={e => e.currentTarget.style.background='#fff'}>
                <td style={{ ...st.tdFixed, fontSize:11, position:'sticky', left:0, background:'inherit', zIndex:1 }}>{propiedad}</td>
                {months.map(m => {
                  const logEntry = logMap[propiedad]?.[m];
                  const cell = getCellContent(logEntry);
                  const isEditing = editingCell?.propiedad === propiedad && editingCell?.mes === m;
                  const cellKey = `${propiedad}|${m}`;
                  const flagAdjuntos = logEntry?.pdf_adjuntos > 1 && logEntry?.status !== 'manual';
                  const hasComentario = !!logEntry?.comentario;
                  return (
                    <td key={m}
                      onClick={!isEditing ? () => startEditManual(propiedad, m) : undefined}
                      title={!isEditing ? (flagAdjuntos ? `${logEntry.pdf_adjuntos} PDFs adjuntos en el correo — se usó el primero, verifica el valor` : 'Click para ingresar o corregir el valor de GC') : undefined}
                      style={{ ...st.tdFixed, textAlign:'center', background:cell?.bg||'#fff', padding:'5px 6px', ...(isEditing?{}:{cursor:'text'}) }}>
                      <div className="gc-cell-wrap" style={{ position:'relative', width:'100%', minHeight:16 }}>
                        {hasComentario && (
                          <span title="Tiene comentario" style={{ position:'absolute', top:-5, right:-6, width:0, height:0, borderStyle:'solid', borderWidth:'0 8px 8px 0', borderColor:'transparent #f9a825 transparent transparent' }}/>
                        )}
                        {isEditing ? (
                          <input
                            autoFocus
                            value={editValue}
                            disabled={savingCell === cellKey}
                            onChange={e => setEditValue(e.target.value)}
                            onBlur={() => saveManualValue(propiedad, m)}
                            onKeyDown={e => {
                              if (e.key === 'Enter') e.currentTarget.blur();
                              if (e.key === 'Escape') setEditingCell(null);
                            }}
                            onClick={e => e.stopPropagation()}
                            style={{ width:'100%', textAlign:'center', border:'1px solid #1a73e8', borderRadius:4, padding:'2px 4px', fontSize:11, outline:'none', fontFamily:'inherit' }}
                          />
                        ) : cell ? (
                          <span style={{ display:'inline-flex', alignItems:'center', justifyContent:'center', gap:3, maxWidth:'100%' }}>
                            {flagAdjuntos && <AlertCircle size={10} color="#e65100" style={{flexShrink:0}}/>}
                            <span style={{ fontSize:cell.type==='valor'?11:12, fontWeight:cell.fontWeight, color:cell.color, overflow:'hidden', textOverflow:'ellipsis', whiteSpace:'nowrap' }} title={cell.type==='valor'?cell.text:undefined}>{cell.text}</span>
                          </span>
                        ) : (
                          <span style={{ color:'#dadce0', fontSize:10 }}>—</span>
                        )}
                        {!isEditing && (
                          <button
                            className="gc-cell-btn"
                            onClick={e => { e.stopPropagation(); openSidebar(propiedad, m); }}
                            title="Ver respuesta del correo / comentario"
                            style={{ position:'absolute', bottom:-6, right:-4, background:'#fff', border:'none', cursor:'pointer', padding:1, display:'flex', color:'#5f6368', borderRadius:4 }}>
                            <MessageSquare size={11}/>
                          </button>
                        )}
                      </div>
                    </td>
                  );
                })}
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <div style={{ display:'flex', gap:16, marginTop:10, flexShrink:0, fontSize:11, color:'#9aa0a6', alignItems:'center', flexWrap:'wrap' }}>
        <span style={{ display:'flex', alignItems:'center', gap:5 }}><span style={{ background:'#e8f0fe', color:'#1a73e8', fontWeight:700, padding:'1px 8px', borderRadius:4, fontSize:11 }}>E</span>Enviado</span>
        <span style={{ display:'flex', alignItems:'center', gap:5 }}><span style={{ background:'#e6f4ea', color:'#2e7d32', fontWeight:700, padding:'1px 8px', borderRadius:4, fontSize:11 }}>R</span>Respondido (sin valor extraído)</span>
        <span style={{ display:'flex', alignItems:'center', gap:5 }}><span style={{ background:'#f3e5f5', color:'#6a1b9a', fontWeight:700, padding:'1px 8px', borderRadius:4, fontSize:11 }}>Manual</span>Ingresado manualmente (sin valor)</span>
        <span style={{ display:'flex', alignItems:'center', gap:5 }}><span style={{ background:'#e6f4ea', color:'#1e6e3b', fontWeight:700, padding:'1px 8px', borderRadius:4, fontSize:11 }}>$85.430</span>GC extraído del PDF o ingresado manualmente</span>
        <span style={{ display:'flex', alignItems:'center', gap:5 }}><AlertCircle size={12} color="#e65100"/>Correo con más de un PDF adjunto — verificar el valor (click para corregir)</span>
        <span style={{ display:'flex', alignItems:'center', gap:5 }}><span style={{ width:0, height:0, borderStyle:'solid', borderWidth:'0 7px 7px 0', borderColor:'transparent #f9a825 transparent transparent' }}/>Celda con comentario</span>
      </div>

      {sidebarCell && (
        <GCDetailSidebar
          propiedad={sidebarCell.propiedad}
          mes={sidebarCell.mes}
          logEntry={logMap[sidebarCell.propiedad]?.[sidebarCell.mes]}
          comentarioDraft={comentarioDraft}
          setComentarioDraft={setComentarioDraft}
          onSaveComentario={saveComentario}
          savingComentario={savingComentario}
          onClose={closeSidebar}
        />
      )}
      <style>{`
        .gc-cell-btn { opacity: 0; transition: opacity 0.15s; }
        .gc-cell-wrap:hover .gc-cell-btn { opacity: 1; }
      `}</style>
    </div>
  );
}

// ── MAIN ──────────────────────────────────────────────────────
export default function SaldosPage() {
  const { profile } = useAuth();
  const isOwner = profile?.isOwner;
  const [tab, setTab] = useState('saldos');
  const [rows, setRows] = useState([]);
  const [attrsMap, setAttrsMap] = useState({});
  const [loading, setLoading] = useState(true);
  const [uploading, setUploading] = useState('');
  const [lastUploads, setLastUploads] = useState({});
  const [showUpload, setShowUpload] = useState(false);
  const [umbralConfig, setUmbralConfig] = useState({ multiplicador1: 1.9, multiplicador2: 2.8 });
  const [showUmbralModal, setShowUmbralModal] = useState(false);
  const [fichaPropiedad, setFichaPropiedad] = useState(null);

  const fetchUmbralConfig = useCallback(async () => {
    const { data } = await supabase.from('saldos_config').select('*').eq('id', 1).maybeSingle();
    if (data) setUmbralConfig({ multiplicador1: Number(data.multiplicador1), multiplicador2: Number(data.multiplicador2) });
  }, []);

  useEffect(() => { fetchUmbralConfig(); }, [fetchUmbralConfig]);

  const handleSaveUmbralConfig = async (newConfig) => {
    await supabase.from('saldos_config').upsert({ id: 1, ...newConfig });
    setUmbralConfig(newConfig);
  };

  const { exportToExcel } = useExcelExport();

  const handleExport = async () => {
    if (tab === 'saldos') {
      exportToExcel(rows.filter(r => r.last_cuentas_ac || r.last_cuentas_an || r.last_arriendos), [
        { key: 'propiedad',      label: 'Propiedad' },
        { key: 'propietario',    label: 'Propietario' },
        { key: 'e1',             label: 'E1' },
        { key: 'e2',             label: 'E2' },
        { key: 'agua_ac',        label: 'Agua Ac' },
        { key: 'agua_an',        label: 'Agua An' },
        { key: 'luz_ac',         label: 'Luz Ac' },
        { key: 'luz_an',         label: 'Luz An' },
        { key: 'gas_ac',         label: 'Gas Ac' },
        { key: 'gas_an',         label: 'Gas An' },
        { key: 'gc_ac',          label: 'GC Ac' },
        { key: 'gc_an',          label: 'GC An' },
        { key: 'deuda_arriendo', label: 'Deuda Arriendo' },
      ], 'Saldos');
    } else if (tab === 'consultas' || tab === 'reportabilidad') {
      // Fetch fresco de config y logs para exportar todo, no solo el mes visible
      const mesActual = currentMes();
      const [{ data: cfg }, { data: allLogs }] = await Promise.all([
        supabase.from('gc_consultas_config').select('*').order('propiedad'),
        supabase.from('gc_consultas_log').select('*').order('mes', { ascending: false }),
      ]);

      if (tab === 'consultas') {
        const logMapActual = {};
        (allLogs || []).filter(l => l.mes === mesActual).forEach(l => { logMapActual[l.propiedad] = l; });
        const consultasRows = (cfg || []).map(r => {
          const logRow = logMapActual[r.propiedad] || {};
          return {
            propiedad:     r.propiedad,
            cartera:       r.cartera || '',
            mail_admin:    r.mail_admin || '',
            status:        logRow.status || '',
            gc_valor:      logRow.gc_valor || '',
            enviado_at:    logRow.enviado_at ? new Date(logRow.enviado_at).toLocaleDateString('es-CL') : '',
            respondido_at: logRow.respondido_at ? new Date(logRow.respondido_at).toLocaleDateString('es-CL') : '',
          };
        });
        exportToExcel(consultasRows, [
          { key: 'propiedad',     label: 'Propiedad' },
          { key: 'cartera',       label: 'Cartera' },
          { key: 'mail_admin',    label: 'Correo Admin' },
          { key: 'status',        label: 'Estado' },
          { key: 'gc_valor',      label: 'Valor GC' },
          { key: 'enviado_at',    label: 'Enviado' },
          { key: 'respondido_at', label: 'Respondido' },
        ], 'ConsultasGC');
      } else {
        // Reportabilidad: historial completo
        exportToExcel(allLogs || [], [
          { key: 'propiedad',     label: 'Propiedad' },
          { key: 'mes',           label: 'Mes' },
          { key: 'status',        label: 'Estado' },
          { key: 'gc_valor',      label: 'Valor GC' },
          { key: 'enviado_at',    label: 'Enviado' },
          { key: 'respondido_at', label: 'Respondido' },
        ], 'Reportabilidad');
      }
    }
  };

  const fetchData = useCallback(async () => {
    setLoading(true);
    const [{ data: saldos }, { data: uploads }, { data: attrData }] = await Promise.all([
      supabase.from('saldos').select('*').order('propiedad'),
      supabase.from('saldos_uploads').select('*').order('uploaded_at',{ascending:false}),
      supabase.from('property_attributes').select('*'),
    ]);
    setRows(saldos||[]);
    const aMap={};
    (attrData||[]).forEach(a=>{ aMap[a.propiedad]=a; });
    setAttrsMap(aMap);
    const latest={};
    (uploads||[]).forEach(u=>{ if(!latest[u.tipo]) latest[u.tipo]=u; });
    setLastUploads(latest);
    setLoading(false);
  }, []);

  useEffect(() => { fetchData(); }, [fetchData]);

  const handleUpload = async (tipo, file) => {
    setUploading(tipo);
    try {
      const buffer = await file.arrayBuffer();
      const wb = XLSX.read(buffer,{type:'array'});
      const ws = wb.Sheets[wb.SheetNames[0]];
      const data = XLSX.utils.sheet_to_json(ws,{defval:''});
      if (tipo==='cuentas_ac'||tipo==='cuentas_an') await processCuentas(data,tipo);
      else await processArriendos(data);
      await supabase.from('saldos_uploads').insert({tipo,filename:file.name,row_count:data.length});
      await fetchData();
    } catch(err) { alert('Error: '+err.message); }
    setUploading('');
  };

  const processCuentas = async (data, tipo) => {
    const isAc=tipo==='cuentas_ac';
    const now=new Date().toISOString();
    const {data:cartera}=await supabase.from('properties').select('propiedad,propietario,e1,e2');
    const cm={};
    (cartera||[]).forEach(c=>{cm[c.propiedad]=c;});
    const batch=[];
    for (const row of data) {
      const p=(row['Propiedad']||'').trim();
      if(!p) continue;
      const match=cm[p];
      batch.push({propiedad:p,...(match?{propietario:match.propietario,e1:match.e1,e2:match.e2}:{}),...(isAc?{agua_ac:String(row['Agua']||'').trim()||null,luz_ac:String(row['Luz']||'').trim()||null,gas_ac:String(row['Gas']||'').trim()||null,gc_ac:String(row['Gastos comunes']||'').trim()||null,alerta_agua:(parseFloat(row['Deuda anterior agua'])||0)>0,alerta_luz:(parseFloat(row['Deuda anterior luz'])||0)>0,alerta_gas:(parseFloat(row['Deuda anterior gas'])||0)>0,last_cuentas_ac:now}:{agua_an:String(row['Agua']||'').trim()||null,luz_an:String(row['Luz']||'').trim()||null,gas_an:String(row['Gas']||'').trim()||null,gc_an:String(row['Gastos comunes']||'').trim()||null,last_cuentas_an:now})});
    }
    for (let i=0;i<batch.length;i+=50) await supabase.from('saldos').upsert(batch.slice(i,i+50),{onConflict:'propiedad'});
  };

  const processArriendos = async (data) => {
    const now=new Date().toISOString();
    const {data:cartera}=await supabase.from('properties').select('propiedad,propietario,e1,e2');
    const cm={};
    (cartera||[]).forEach(c=>{cm[c.propiedad]=c;});
    const batch=[];
    for (const row of data) {
      const p=(row['Propiedad']||'').trim();
      if(!p) continue;
      const n=parseArriendo(row['Deuda al día']);
      const match=cm[p];
      batch.push({propiedad:p,deuda_arriendo:n!==null?String(Math.round(n)):null,last_arriendos:now,...(match?{propietario:match.propietario,e1:match.e1,e2:match.e2}:{})});
    }
    for (let i=0;i<batch.length;i+=50) await supabase.from('saldos').upsert(batch.slice(i,i+50),{onConflict:'propiedad'});
  };

  // Carga los valores de GC extraídos en Consultas GC hacia la tabla Saldos.
  // El cruce se hace por la columna "cartera" de gc_consultas_config, que
  // usa la misma nomenclatura que "propiedad" en la tabla saldos.
  const [loadingGC, setLoadingGC] = useState(false);
  const [loadGCResult, setLoadGCResult] = useState(null);

  const handleLoadGCValues = async () => {
    setLoadingGC(true);
    setLoadGCResult(null);
    try {
      const mesActual = currentMes();
      const mesAnterior = prevMes();

      const [{ data: cfg }, { data: logs }] = await Promise.all([
        supabase.from('gc_consultas_config').select('propiedad, cartera'),
        supabase.from('gc_consultas_log').select('propiedad, mes, gc_valor').in('mes', [mesActual, mesAnterior]),
      ]);

      // Mapa propiedad (Consultas GC) -> cartera (nomenclatura Saldos/Cartera)
      const carteraMap = {};
      (cfg || []).forEach(c => { if (c.cartera) carteraMap[c.propiedad] = c.cartera; });

      // Mapas de valores por mes
      const valoresActual = {};
      const valoresAnterior = {};
      (logs || []).forEach(l => {
        if (!l.gc_valor) return;
        if (l.mes === mesActual) valoresActual[l.propiedad] = l.gc_valor;
        if (l.mes === mesAnterior) valoresAnterior[l.propiedad] = l.gc_valor;
      });

      let updated = 0, skipped = 0, notFound = 0;
      const propiedadesConsulta = Object.keys(carteraMap);

      for (const propConsulta of propiedadesConsulta) {
        const propCartera = carteraMap[propConsulta];
        const gcAc = valoresActual[propConsulta] || null;
        const gcAn = valoresAnterior[propConsulta] || null;

        if (!gcAc && !gcAn) { skipped++; continue; }

        const updates = {};
        if (gcAc) updates.gc_ac = gcAc;
        if (gcAn) updates.gc_an = gcAn;

        const { data: updatedRows, error } = await supabase
          .from('saldos')
          .update(updates)
          .eq('propiedad', propCartera)
          .select('id');

        if (error) { console.error('Error actualizando', propCartera, error); skipped++; }
        else if (!updatedRows || updatedRows.length === 0) { notFound++; }
        else updated++;
      }

      setLoadGCResult({ updated, skipped, notFound, total: propiedadesConsulta.length });
      await fetchData();
    } catch (e) {
      console.error('Error en handleLoadGCValues:', e);
      setLoadGCResult({ error: e.message });
    }
    setLoadingGC(false);
  };

  const TABS = [
    { id:'saldos',         label:'Saldos',         icon:<BarChart2 size={14}/> },
    { id:'consultas',      label:'Consultas GC',    icon:<Mail size={14}/> },
    { id:'reportabilidad', label:'Reportabilidad',  icon:<RefreshCw size={14}/> },
  ];

  return (
    <div style={st.container}>
      <div style={st.header}>
        <div>
          <h1 style={st.title}>Saldos</h1>
          <p style={st.subtitle}>{rows.filter(r=>r.last_cuentas_ac||r.last_cuentas_an||r.last_arriendos).length} propiedades con datos</p>
        </div>
        <div style={{display:'flex',gap:8,alignItems:'center'}}>
          {tab==='saldos'&&loadGCResult&&!loadGCResult.error&&(
            <div style={{fontSize:12,color:'#2e7d32',background:'#e6f4ea',padding:'6px 12px',borderRadius:8}}>
              ✓ {loadGCResult.updated} actualizadas
              {loadGCResult.skipped>0?`, ${loadGCResult.skipped} sin valor`:''}
              {loadGCResult.notFound>0?`, ${loadGCResult.notFound} sin match en Saldos`:''}
            </div>
          )}
          {tab==='saldos'&&loadGCResult?.error&&(
            <div style={{fontSize:12,color:'#c62828',background:'#fce8e6',padding:'6px 12px',borderRadius:8}}>
              Error: {loadGCResult.error}
            </div>
          )}
          {tab==='saldos'&&(
            <button onClick={handleLoadGCValues} disabled={loadingGC} style={{...st.iconBtn,display:'flex',alignItems:'center',gap:6,padding:'8px 14px',width:'auto'}} title="Cargar valores GC desde Consultas">
              <RefreshCw size={15} color="#5f6368" style={{animation:loadingGC?'spin 1s linear infinite':'none'}}/>
              <span style={{fontSize:13,color:'#3c4043'}}>{loadingGC?'Cargando...':'Cargar GC'}</span>
            </button>
          )}
          {tab==='saldos' && isOwner && (
            <button onClick={handleExport} disabled={loading} title="Exportar a Excel"
              style={{ display:'flex', alignItems:'center', padding:'8px 10px', background:'#fff', border:'1px solid #dadce0', borderRadius:8, cursor:loading?'not-allowed':'pointer', opacity:loading?0.5:1 }}>
              <Download size={15} color="#34a853" />
            </button>
          )}
          {(tab==='consultas'||tab==='reportabilidad') && (
            <button onClick={handleExport} title="Exportar a Excel"
              style={{ display:'flex', alignItems:'center', padding:'8px 10px', background:'#fff', border:'1px solid #dadce0', borderRadius:8, cursor:'pointer' }}>
              <Download size={15} color="#34a853" />
            </button>
          )}
          <button onClick={fetchData} style={st.iconBtn} title="Actualizar"><RefreshCw size={16} color="#5f6368"/></button>
          {tab==='saldos'&&<button onClick={()=>setShowUmbralModal(true)} style={st.iconBtn} title="Editar multiplicadores de umbral"><SlidersHorizontal size={16} color="#5f6368"/></button>}
          {tab==='saldos'&&<button onClick={()=>setShowUpload(!showUpload)} style={{...st.iconBtn,...(showUpload?{background:'#e8f0fe',borderColor:'#1a73e8'}:{})}}><Upload size={16} color={showUpload?'#1a73e8':'#5f6368'}/></button>}
        </div>
      </div>

      <div style={{ display:'flex', gap:4, marginBottom:16, borderBottom:'2px solid #e8eaed', flexShrink:0 }}>
        {TABS.map(t=>(
          <button key={t.id} onClick={()=>setTab(t.id)} style={{
            display:'flex',alignItems:'center',gap:6,padding:'8px 16px',
            background:'none',border:'none',cursor:'pointer',fontFamily:'inherit',
            fontSize:13,fontWeight:tab===t.id?700:500,
            color:tab===t.id?'#1a73e8':'#5f6368',
            borderBottom:tab===t.id?'2px solid #1a73e8':'2px solid transparent',
            marginBottom:-2,
          }}>{t.icon}{t.label}</button>
        ))}
      </div>

      {tab==='saldos'&&<SaldosTab rows={rows} attrsMap={attrsMap} loading={loading} fetchData={fetchData} lastUploads={lastUploads} handleUpload={handleUpload} uploading={uploading} showUpload={showUpload} setShowUpload={setShowUpload} mult1={umbralConfig.multiplicador1} mult2={umbralConfig.multiplicador2} onOpenFicha={setFichaPropiedad}/>}
      {tab==='consultas'&&<ConsultasTab onOpenFicha={setFichaPropiedad}/>}
      {tab==='reportabilidad'&&<ReportabilidadTab/>}
      {showUmbralModal && <UmbralModal config={umbralConfig} onClose={()=>setShowUmbralModal(false)} onSave={handleSaveUmbralConfig}/>}
      {fichaPropiedad && <FichaSidebar propiedad={fichaPropiedad} onClose={() => setFichaPropiedad(null)} />}
      <style>{`@keyframes spin{from{transform:rotate(0)}to{transform:rotate(360deg)}}`}</style>
    </div>
  );
}

const inlineInputStyle = {
  border: '1px solid #dadce0', borderRadius: 5, padding: '4px 6px',
  fontSize: 12, outline: 'none', fontFamily: 'inherit', width: '100%',
};

const st = {
  container:{ height:'100%', display:'flex', flexDirection:'column', overflow:'hidden', fontFamily:"'Google Sans','Segoe UI',sans-serif" },
  header:{ display:'flex', justifyContent:'space-between', alignItems:'flex-start', marginBottom:12, flexShrink:0 },
  title:{ fontSize:24, fontWeight:700, color:'#202124', margin:'0 0 4px' },
  subtitle:{ fontSize:14, color:'#5f6368', margin:0 },
  iconBtn:{ background:'#fff', border:'1px solid #dadce0', borderRadius:8, padding:'8px 10px', cursor:'pointer', display:'flex', alignItems:'center' },
  uploadPanel:{ display:'flex', gap:12, marginBottom:14, flexWrap:'wrap', flexShrink:0, padding:'14px 16px', background:'#f8f9fa', borderRadius:10, border:'1px solid #e8eaed', alignItems:'flex-start' },
  uploadCard:{ background:'#fff', border:'1px solid #e8eaed', borderRadius:8, padding:'12px 14px', minWidth:200 },
  uploadLabel:{ fontSize:13, fontWeight:600, color:'#202124', marginBottom:4 },
  uploadMeta:{ fontSize:11, color:'#9aa0a6', marginBottom:8 },
  uploadBtn:{ display:'flex', alignItems:'center', padding:'7px 12px', background:'#1a73e8', color:'#fff', border:'none', borderRadius:6, fontSize:12, cursor:'pointer', fontFamily:'inherit', fontWeight:500 },
  uploadingMsg:{ fontSize:13, color:'#1a73e8', alignSelf:'center', fontStyle:'italic' },
  filtersRow:{ display:'flex', gap:12, marginBottom:12, alignItems:'center', flexWrap:'wrap', flexShrink:0 },
  searchWrapper:{ position:'relative', flex:1, minWidth:200 },
  searchIcon:{ position:'absolute', left:12, top:'50%', transform:'translateY(-50%)', pointerEvents:'none' },
  searchInput:{ width:'100%', padding:'8px 36px', border:'1px solid #dadce0', borderRadius:8, fontSize:13, outline:'none', fontFamily:'inherit', background:'#fff' },
  clearSearch:{ position:'absolute', right:10, top:'50%', transform:'translateY(-50%)', background:'none', border:'none', cursor:'pointer', padding:2, display:'flex' },
  encargadoFilters:{ display:'flex', gap:6, alignItems:'center', flexWrap:'wrap' },
  filterLabel:{ fontSize:12, color:'#5f6368', fontWeight:600 },
  filterBtn:{ padding:'4px 12px', borderRadius:20, border:'1px solid #dadce0', background:'#fff', fontSize:12, cursor:'pointer', color:'#5f6368', fontFamily:'inherit' },
  clearFilter:{ padding:'4px 10px', borderRadius:20, border:'none', background:'none', fontSize:12, cursor:'pointer', color:'#ea4335', fontFamily:'inherit' },
  tableWrapper:{ flex:1, overflow:'auto', border:'1px solid #e8eaed', borderRadius:12, background:'#fff' },
  table:{ width:'100%', borderCollapse:'collapse' },
  th:{ padding:'10px 10px', background:'#f8f9fa', fontSize:10, fontWeight:700, color:'#5f6368', letterSpacing:0.5, borderBottom:'2px solid #e8eaed', borderRight:'1px solid #e8eaed', position:'sticky', top:0, zIndex:1, whiteSpace:'nowrap' },
  td:{ padding:0, fontSize:13, color:'#202124', borderBottom:'1px solid #e8eaed', borderRight:'1px solid #e8eaed', verticalAlign:'middle' },
  tdFixed:{ padding:'6px 10px', fontSize:13, color:'#202124', borderBottom:'1px solid #e8eaed', borderRight:'1px solid #e8eaed', verticalAlign:'middle' },
  empty:{ padding:40, textAlign:'center', color:'#9aa0a6', fontSize:14 },
  loading:{ padding:40, textAlign:'center', color:'#9aa0a6', fontSize:14 },
  saveRowBtn:{ background:'none', border:'none', cursor:'pointer', padding:6, borderRadius:6, display:'inline-flex', alignItems:'center' },
  badge:{ display:'inline-block', borderRadius:20, padding:'2px 9px', fontSize:11, fontWeight:700 },
  actionBtn:{ background:'none', border:'none', cursor:'pointer', padding:'3px 4px', borderRadius:5, display:'inline-flex', alignItems:'center', color:'#5f6368' },
  btnPrimary:{ padding:'8px 16px', background:'#1a73e8', color:'#fff', border:'none', borderRadius:8, fontSize:13, fontWeight:500, cursor:'pointer', fontFamily:'inherit' },
  btnSecondary:{ padding:'8px 14px', background:'#fff', color:'#3c4043', border:'1px solid #dadce0', borderRadius:8, fontSize:13, cursor:'pointer', fontFamily:'inherit' },
  overlay:{ position:'fixed', inset:0, background:'rgba(0,0,0,0.4)', display:'flex', alignItems:'center', justifyContent:'center', zIndex:3000 },
  modal:{ background:'#fff', borderRadius:16, boxShadow:'0 8px 32px rgba(0,0,0,0.18)', fontFamily:"'Google Sans','Segoe UI',sans-serif", overflow:'hidden' },
  modalHeader:{ display:'flex', justifyContent:'space-between', alignItems:'center', padding:'16px 20px', borderBottom:'1px solid #e8eaed' },
  modalTitle:{ fontSize:16, fontWeight:700, color:'#202124' },
  closeBtn:{ background:'none', border:'none', cursor:'pointer', padding:4, color:'#5f6368', borderRadius:6 },
  totalsRow:{ display:'flex', alignItems:'center', gap:24, padding:'10px 16px', marginTop:8, background:'#fff', border:'1px solid #e8eaed', borderRadius:10, flexShrink:0 },
  totalsLabel:{ fontSize:14, fontWeight:700, color:'#5f6368', letterSpacing:0.8 },
  totalsItem:{ fontSize:17, color:'#3c4043' },
};
