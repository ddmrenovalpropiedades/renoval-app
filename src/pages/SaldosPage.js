import React, { useState, useEffect, useMemo, useCallback, useRef } from 'react';
import * as XLSX from 'xlsx';
import { supabase } from '../supabaseClient';
import { useAuth } from '../context/AuthContext';
import { Search, X, Upload, Save, AlertCircle, RefreshCw, Send, Eye, Plus, Trash2, Mail, BarChart2 } from 'lucide-react';

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

// ── Color logic ───────────────────────────────────────────────
const rowExceedsUmbral = (row, attrsMap, level) => {
  const attr = attrsMap?.[row.propiedad];
  const defaults = { agua: [40000, 60000], luz: [55000, 80000], gas: [45000, 60000] };
  const gcDefaults = [70000, 180000];
  const checkField = (val, tipo) => {
    const n = parseAmount(val);
    if (!n || isPagada(val)) return false;
    if (tipo === 'agua' || tipo === 'luz' || tipo === 'gas') {
      const t1 = attr?.[`umbral1_${tipo}`] || defaults[tipo][0];
      const t2 = attr?.[`umbral2_${tipo}`] || defaults[tipo][1];
      return level === 1 ? n >= t1 : n >= t2;
    }
    if (tipo === 'gc') {
      const gcProm = attr?.gc_promedio;
      const t1 = gcProm ? gcProm * 1.9 : gcDefaults[0];
      const t2 = gcProm ? gcProm * 2.8 : gcDefaults[1];
      return level === 1 ? n >= t1 : n >= t2;
    }
    return false;
  };
  return (
    checkField(row.agua_ac,'agua')||checkField(row.agua_an,'agua')||
    checkField(row.luz_ac,'luz')||checkField(row.luz_an,'luz')||
    checkField(row.gas_ac,'gas')||checkField(row.gas_an,'gas')||
    checkField(row.gc_ac,'gc')||checkField(row.gc_an,'gc')
  );
};
const getCellStyle = (val, tipo, attr, emptyWhite=false) => {
  const base = { padding:0, fontSize:12, textAlign:'center', width:'100%', height:'100%', display:'flex', alignItems:'center', justifyContent:'center', gap:4 };
  if (!val||val==='') return { ...base, background: emptyWhite?'#fff':'#FAF3E0' };
  if (isPagada(val)) return { ...base, background:'#fff', color:'#bdbdbd' };
  const n = parseAmount(val);
  if (n===null) return { ...base, background:'#fff', color:'#202124' };
  const defaults = { agua:[40000,60000], luz:[55000,80000], gas:[45000,60000] };
  if (tipo==='agua'||tipo==='luz'||tipo==='gas') {
    let t1,t2;
    if (attr?.[`umbral1_${tipo}`]&&attr?.[`umbral2_${tipo}`]) { t1=attr[`umbral1_${tipo}`]; t2=attr[`umbral2_${tipo}`]; }
    else { [t1,t2]=defaults[tipo]||[40000,60000]; }
    if (n<t1) return { ...base, background:'#fff', color:'#bdbdbd' };
    if (n<t2) return { ...base, background:'#FFCDD2', color:'#202124' };
    return { ...base, background:'#EF9A9A', color:'#202124' };
  }
  if (tipo==='gc') {
    const gcProm=attr?.gc_promedio;
    if (gcProm) {
      if (n<gcProm*1.9) return { ...base, background:'#fff', color:'#bdbdbd' };
      if (n<gcProm*2.8) return { ...base, background:'#FFCDD2', color:'#202124' };
      return { ...base, background:'#EF9A9A', color:'#202124' };
    }
    if (n<70000) return { ...base, background:'#fff', color:'#bdbdbd' };
    if (n<180000) return { ...base, background:'#fff', color:'#202124' };
    return { ...base, background:'#EF9A9A', color:'#202124' };
  }
  if (tipo==='arriendo') {
    if (n<10000) return { ...base, background:'#fff', color:'#bdbdbd' };
    return { ...base, background:'#fff', color:'#202124' };
  }
  return { ...base, background:'#fff', color:'#202124' };
};

// ── Editable cell ─────────────────────────────────────────────
function EditableCell({ value, tipo, alerta, onChange, attr, emptyWhite }) {
  const [editing, setEditing] = useState(false);
  const [local, setLocal] = useState(value||'');
  const cellStyle = getCellStyle(value, tipo, attr, emptyWhite);
  const handleBlur = () => { setEditing(false); if (local!==(value||'')) onChange(local); };
  if (editing) return (
    <input value={local} onChange={e=>setLocal(e.target.value)} onBlur={handleBlur}
      autoFocus style={{ ...getCellStyle('',tipo,attr,true), border:'1px solid #1a73e8', outline:'none', width:'100%', textAlign:'center', padding:'4px 6px' }} />
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
function SaldosTab({ rows, attrsMap, loading, fetchData, lastUploads, handleUpload, uploading, showUpload, setShowUpload }) {
  const [edits, setEdits] = useState({});
  const [search, setSearch] = useState('');
  const [filterE, setFilterE] = useState([]);
  const [filterUmbral, setFilterUmbral] = useState(0);
  const ENCARGADOS = ['DD','FD','EA','FG','AM'];
  const ENCARGADO_COLORS = { DD:'#1565C0', FD:'#2E7D32', EA:'#6A1B9A', FG:'#E65100', AM:'#37474F' };

  const handleCellChange = (rowId, field, value) => setEdits(prev=>({...prev,[rowId]:{...(prev[rowId]||{}),[field]:value}}));
  const handleSaveRow = async (rowId) => {
    const changes = edits[rowId];
    if (!changes||!Object.keys(changes).length) return;
    await supabase.from('saldos').update(changes).eq('id', rowId);
    setEdits(prev=>{ const n={...prev}; delete n[rowId]; return n; });
  };

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
    if (filterUmbral>0) result = result.filter(r=>rowExceedsUmbral(r,attrsMap,filterUmbral));
    return result;
  }, [rows,search,filterE,filterUmbral,attrsMap]);

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
              ...(filterE.includes(e)?{background:`${ENCARGADO_COLORS[e]}22`,color:ENCARGADO_COLORS[e],borderColor:ENCARGADO_COLORS[e],fontWeight:700}:{})
            }}>{e}</button>
          ))}
          {filterE.length>0&&<button onClick={()=>setFilterE([])} style={st.clearFilter}>Limpiar</button>}
          <div style={{width:1,background:'#dadce0',height:20,margin:'0 4px'}}/>
          <button onClick={()=>setFilterUmbral(filterUmbral===1?0:1)} style={{...st.filterBtn,...(filterUmbral===1?{background:'#fff3e0',color:'#e65100',borderColor:'#e65100',fontWeight:700}:{})}}>≥ U1</button>
          <button onClick={()=>setFilterUmbral(filterUmbral===2?0:2)} style={{...st.filterBtn,...(filterUmbral===2?{background:'#fce8e6',color:'#c5221f',borderColor:'#c5221f',fontWeight:700}:{})}}>≥ U2</button>
        </div>
      </div>
      <div style={st.tableWrapper}>
        {loading?<div style={st.loading}>Cargando saldos...</div>:rows.length===0?<div style={st.loading}>No hay datos cargados aún.</div>:(
          <table style={st.table}>
            <thead><tr>
              <th style={{...st.th,minWidth:280,textAlign:'left'}}>PROPIEDAD</th>
              <th style={{...st.th,minWidth:160,textAlign:'center'}}>PROPIETARIO</th>
              {COLS.map(c=><th key={c.key} style={{...st.th,minWidth:70,textAlign:'center',...(c.groupStart?{borderLeft:'2px solid #bdbdbd'}:{}),...(c.groupEnd?{borderRight:'2px solid #bdbdbd'}:{})}}>{c.label}</th>)}
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
                return (
                  <tr key={row.id} style={{background:'#fff'}}>
                    <td style={{...st.tdFixed,fontSize:12}}>{row.propiedad}</td>
                    <td style={{...st.tdFixed,fontSize:11,color:'#5f6368',textAlign:'center'}}>{row.propietario||''}</td>
                    {COLS.map(c=>{
                      const rowAttr=attrsMap[row.propiedad];
                      const emptyWhite=c.tipo==='arriendo'||(c.tipo==='agua'&&rowAttr?.tiene_agua===false)||(c.tipo==='luz'&&rowAttr?.tiene_luz===false)||(c.tipo==='gas'&&rowAttr?.tiene_gas===false);
                      return (
                        <td key={c.key} style={{...st.td,padding:'4px 6px',...(c.groupStart?{borderLeft:'2px solid #bdbdbd'}:{}),...(c.groupEnd?{borderRight:'2px solid #bdbdbd'}:{})}}>
                          <EditableCell value={merged[c.key]||''} tipo={c.tipo} alerta={c.alerta?merged[c.alerta]:false} onChange={val=>handleCellChange(row.id,c.key,val)} attr={rowAttr} emptyWhite={emptyWhite}/>
                        </td>
                      );
                    })}
                    <td style={{...st.tdFixed,textAlign:'center'}}>
                      {hasEdits&&<button onClick={()=>handleSaveRow(row.id)} style={st.saveRowBtn} title="Guardar"><Save size={13} color="#1a73e8"/></button>}
                    </td>
                    <td style={{...st.tdFixed,textAlign:'center'}}>{row.e1&&<span style={{...st.badge,background:`${EC[row.e1]||'#9aa0a6'}22`,color:EC[row.e1]||'#9aa0a6',border:`1px solid ${EC[row.e1]||'#9aa0a6'}44`}}>{row.e1}</span>}</td>
                    <td style={{...st.tdFixed,textAlign:'center'}}>{row.e2&&<span style={{...st.badge,background:`${EC[row.e2]||'#9aa0a6'}22`,color:EC[row.e2]||'#9aa0a6',border:`1px solid ${EC[row.e2]||'#9aa0a6'}44`}}>{row.e2}</span>}</td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        )}
      </div>
    </>
  );
}

// ── TAB 2: CONSULTAS GC ───────────────────────────────────────
function ConsultasTab() {
  const [config, setConfig] = useState([]);
  const [log, setLog] = useState([]);
  const [loading, setLoading] = useState(true);
  const [sending, setSending] = useState(false);
  const [updating, setUpdating] = useState(false);
  const [previewRow, setPreviewRow] = useState(null);
  const [editingId, setEditingId] = useState(null);
  const [editMail, setEditMail] = useState('');
  const [addingNew, setAddingNew] = useState(false);
  const [newRow, setNewRow] = useState({ propiedad:'', mail_admin:'' });
  const [sendResult, setSendResult] = useState(null);
  const [showTestModal, setShowTestModal] = useState(false);

  const mes = currentMes();

  const fetchAll = useCallback(async () => {
    setLoading(true);
    const [{ data: cfg }, { data: lg }] = await Promise.all([
      supabase.from('gc_consultas_config').select('*').order('propiedad'),
      supabase.from('gc_consultas_log').select('*').eq('mes', mes),
    ]);
    setConfig(cfg || []);
    setLog(lg || []);
    setLoading(false);
  }, [mes]);

  useEffect(() => { fetchAll(); }, [fetchAll]);

  const logMap = useMemo(() => {
    const m = {};
    log.forEach(l => { m[l.propiedad] = l; });
    return m;
  }, [log]);

  const saveMailEdit = async (id) => {
    await supabase.from('gc_consultas_config').update({ mail_admin: editMail || null }).eq('id', id);
    setConfig(prev => prev.map(r => r.id === id ? { ...r, mail_admin: editMail || null } : r));
    setEditingId(null);
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
    }).select().single();
    if (data) { setConfig(prev => [...prev, data]); }
    setNewRow({ propiedad:'', mail_admin:'' });
    setAddingNew(false);
  };

  // Send all emails via Gmail MCP (calls Anthropic API with Gmail MCP)
  const handleSendAll = async () => {
    const toSend = config.filter(r => r.mail_admin && r.mail_admin.trim());
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
        // Log in Supabase
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

  // Check replies via Anthropic API + Gmail MCP
  const handleCheckReplies = async () => {
    setUpdating(true);
    try {
      const response = await fetch('/api/check-gc-replies', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${process.env.REACT_APP_CRON_SECRET}`,
        },
        body: JSON.stringify({ mes }),
      });
      const data = await response.json();
      const text = JSON.stringify(data.replies || []);
      let replies = [];
      try { replies = JSON.parse(text); } catch(e) { replies = []; }

      for (const r of replies) {
        if (!r.propiedad) continue;
        await supabase.from('gc_consultas_log').upsert({
          propiedad: r.propiedad,
          mes,
          respondido_at: r.respondido_at || new Date().toISOString(),
          status: 'respondido',
          gc_valor: r.gc_valor || null,
        }, { onConflict: 'propiedad,mes' });

        // Update saldos gc_ac if value extracted
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
      {/* Actions bar */}
      <div style={{ display:'flex', alignItems:'center', gap:10, marginBottom:14, flexShrink:0, flexWrap:'wrap' }}>
        <div style={{ flex:1, fontSize:13, color:'#5f6368' }}>
          {config.length} propiedades · {withMail} con correo · Mes: <b>{formatMes(mes)}</b>
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
        <button onClick={handleSendAll} disabled={sending || withMail === 0}
          style={{ ...st.btnPrimary, display:'flex', alignItems:'center', gap:6 }}>
          <Send size={14}/>
          {sending ? 'Enviando...' : `Enviar consultas (${withMail})`}
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
              <th style={{...st.th,textAlign:'left',minWidth:280}}>PROPIEDAD</th>
              <th style={{...st.th,textAlign:'left',minWidth:240}}>CORREO ADMINISTRACIÓN</th>
              <th style={{...st.th,textAlign:'center',minWidth:120}}>ESTADO {formatMes(mes)}</th>
              <th style={{...st.th,minWidth:80}}></th>
            </tr></thead>
            <tbody>
              {addingNew && (
                <tr style={{background:'#f0f7ff'}}>
                  <td style={st.tdFixed}>
                    <input value={newRow.propiedad} onChange={e=>setNewRow(p=>({...p,propiedad:e.target.value}))}
                      placeholder="Dirección propiedad" style={{border:'1px solid #dadce0',borderRadius:5,padding:'4px 6px',fontSize:12,outline:'none',fontFamily:'inherit',width:'100%'}}/>
                  </td>
                  <td style={st.tdFixed}>
                    <input value={newRow.mail_admin} onChange={e=>setNewRow(p=>({...p,mail_admin:e.target.value}))}
                      placeholder="correo@admin.com" style={{border:'1px solid #dadce0',borderRadius:5,padding:'4px 6px',fontSize:12,outline:'none',fontFamily:'inherit',width:'100%'}}/>
                  </td>
                  <td style={{...st.tdFixed,textAlign:'center'}}>—</td>
                  <td style={{...st.tdFixed,textAlign:'center'}}>
                    <button onClick={handleAddNew} style={{...st.actionBtn,background:'#e6f4ea',color:'#34a853'}}>✓</button>
                    <button onClick={()=>{setAddingNew(false);setNewRow({propiedad:'',mail_admin:''});}} style={st.actionBtn}><X size={13}/></button>
                  </td>
                </tr>
              )}
              {config.map(row => {
                const logRow = logMap[row.propiedad];
                const status = logRow?.status;
                return (
                  <tr key={row.id} style={{background:'#fff'}}
                    onMouseEnter={e=>e.currentTarget.style.background='#f8f9fa'}
                    onMouseLeave={e=>e.currentTarget.style.background='#fff'}>
                    <td style={{...st.tdFixed,fontSize:12}}>{row.propiedad}</td>
                    <td style={st.tdFixed}>
                      {editingId === row.id ? (
                        <div style={{display:'flex',gap:6,alignItems:'center'}}>
                          <input value={editMail} onChange={e=>setEditMail(e.target.value)}
                            autoFocus style={{border:'1px solid #1a73e8',borderRadius:5,padding:'3px 6px',fontSize:12,outline:'none',fontFamily:'inherit',flex:1}}/>
                          <button onClick={()=>saveMailEdit(row.id)} style={{...st.actionBtn,background:'#e6f4ea',color:'#34a853'}}>✓</button>
                          <button onClick={()=>setEditingId(null)} style={st.actionBtn}><X size={12}/></button>
                        </div>
                      ) : (
                        <div onClick={()=>{setEditingId(row.id);setEditMail(row.mail_admin||'');}}
                          style={{cursor:'text',fontSize:12,padding:'2px 4px',borderRadius:4,display:'flex',alignItems:'center',gap:6}}>
                          {row.mail_admin
                            ? <span style={{color:'#202124'}}>{row.mail_admin}</span>
                            : <span style={{color:'#ea4335',fontSize:11,fontWeight:600}}>⚠ Sin correo</span>}
                        </div>
                      )}
                    </td>
                    <td style={{...st.tdFixed,textAlign:'center'}}>
                      {!status && <span style={{fontSize:11,color:'#9aa0a6'}}>—</span>}
                      {status==='enviado' && <span style={{fontSize:11,fontWeight:600,color:'#1a73e8',background:'#e8f0fe',padding:'2px 10px',borderRadius:20}}>Enviado</span>}
                      {status==='respondido' && (
                        <div>
                          <span style={{fontSize:11,fontWeight:600,color:'#2e7d32',background:'#e6f4ea',padding:'2px 10px',borderRadius:20}}>Respondido</span>
                          {logRow?.gc_valor && <div style={{fontSize:11,color:'#5f6368',marginTop:2}}>{logRow.gc_valor}</div>}
                        </div>
                      )}
                    </td>
                    <td style={{...st.tdFixed,textAlign:'center'}}>
                      {row.mail_admin && (
                        <button onClick={()=>setPreviewRow(row)} style={{...st.actionBtn,color:'#1a73e8'}} title="Ver correo"><Eye size={14}/></button>
                      )}
                      <button onClick={()=>handleDelete(row.id)} style={{...st.actionBtn,color:'#9aa0a6'}} title="Eliminar"><Trash2 size={13}/></button>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        )}
      </div>
      {previewRow && <EmailPreviewModal propiedad={previewRow.propiedad} mailAdmin={previewRow.mail_admin} onClose={()=>setPreviewRow(null)}/>}
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

// ── TAB 3: REPORTABILIDAD ─────────────────────────────────────
function ReportabilidadTab() {
  const [config, setConfig] = useState([]);
  const [logs, setLogs] = useState([]);
  const [loading, setLoading] = useState(true);
  const months = getLast12Months();

  useEffect(() => {
    const fetch = async () => {
      setLoading(true);
      const [{ data: cfg }, { data: lg }] = await Promise.all([
        supabase.from('gc_consultas_config').select('propiedad').order('propiedad'),
        supabase.from('gc_consultas_log').select('*'),
      ]);
      setConfig(cfg || []);
      setLogs(lg || []);
      setLoading(false);
    };
    fetch();
  }, []);

  const logMap = useMemo(() => {
    const m = {};
    logs.forEach(l => {
      if (!m[l.propiedad]) m[l.propiedad] = {};
      m[l.propiedad][l.mes] = l;
    });
    return m;
  }, [logs]);

  const STATUS_STYLE = {
    enviado:    { bg:'#e8f0fe', color:'#1a73e8', label:'E' },
    respondido: { bg:'#e6f4ea', color:'#2e7d32', label:'R' },
  };

  if (loading) return <div style={st.loading}>Cargando...</div>;

  return (
    <div style={{ display:'flex', flexDirection:'column', flex:1, overflow:'auto', gap:20, paddingBottom:24 }}>
      {/* Tabla 1: Status de correos */}
      <div style={{ flexShrink:0 }}>
        <div style={{ fontSize:14, fontWeight:700, color:'#202124', marginBottom:8 }}>Estado de correos</div>
        <div style={{ ...st.tableWrapper, maxHeight:320 }}>
          <table style={st.table}>
            <thead><tr>
              <th style={{...st.th,textAlign:'left',minWidth:260,position:'sticky',left:0,zIndex:2}}>PROPIEDAD</th>
              {months.map(m=><th key={m} style={{...st.th,minWidth:60,textAlign:'center'}}>{formatMes(m)}</th>)}
            </tr></thead>
            <tbody>
              {config.map(({propiedad}) => (
                <tr key={propiedad} style={{background:'#fff'}}>
                  <td style={{...st.tdFixed,fontSize:11,position:'sticky',left:0,background:'#fff',zIndex:1}}>{propiedad}</td>
                  {months.map(m => {
                    const l = logMap[propiedad]?.[m];
                    const s = STATUS_STYLE[l?.status];
                    return (
                      <td key={m} style={{...st.tdFixed,textAlign:'center',background: s?s.bg:'#fff'}}>
                        {s ? <span style={{fontSize:11,fontWeight:700,color:s.color}}>{s.label}</span> : <span style={{color:'#dadce0',fontSize:10}}>—</span>}
                      </td>
                    );
                  })}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        <div style={{fontSize:11,color:'#9aa0a6',marginTop:6}}>E = Enviado · R = Respondido</div>
      </div>

      {/* Tabla 2: Valores GC */}
      <div style={{ flexShrink:0 }}>
        <div style={{ fontSize:14, fontWeight:700, color:'#202124', marginBottom:8 }}>Valores GC registrados</div>
        <div style={{ ...st.tableWrapper, maxHeight:320 }}>
          <table style={st.table}>
            <thead><tr>
              <th style={{...st.th,textAlign:'left',minWidth:260,position:'sticky',left:0,zIndex:2}}>PROPIEDAD</th>
              {months.map(m=><th key={m} style={{...st.th,minWidth:80,textAlign:'center'}}>{formatMes(m)}</th>)}
            </tr></thead>
            <tbody>
              {config.map(({propiedad}) => (
                <tr key={propiedad} style={{background:'#fff'}}>
                  <td style={{...st.tdFixed,fontSize:11,position:'sticky',left:0,background:'#fff',zIndex:1}}>{propiedad}</td>
                  {months.map(m => {
                    const l = logMap[propiedad]?.[m];
                    return (
                      <td key={m} style={{...st.tdFixed,textAlign:'center'}}>
                        {l?.gc_valor
                          ? <span style={{fontSize:11,fontWeight:600,color:'#2e7d32'}}>{l.gc_valor}</span>
                          : <span style={{color:'#dadce0',fontSize:10}}>—</span>}
                      </td>
                    );
                  })}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}

// ── MAIN ──────────────────────────────────────────────────────
export default function SaldosPage() {
  useAuth();
  const [tab, setTab] = useState('saldos');
  const [rows, setRows] = useState([]);
  const [attrsMap, setAttrsMap] = useState({});
  const [loading, setLoading] = useState(true);
  const [uploading, setUploading] = useState('');
  const [lastUploads, setLastUploads] = useState({});
  const [showUpload, setShowUpload] = useState(false);

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

  const TABS = [
    { id:'saldos',       label:'Saldos',      icon:<BarChart2 size={14}/> },
    { id:'consultas',    label:'Consultas GC', icon:<Mail size={14}/> },
    { id:'reportabilidad', label:'Reportabilidad', icon:<RefreshCw size={14}/> },
  ];

  return (
    <div style={st.container}>
      {/* Header */}
      <div style={st.header}>
        <div>
          <h1 style={st.title}>Saldos</h1>
          <p style={st.subtitle}>{rows.filter(r=>r.last_cuentas_ac||r.last_cuentas_an||r.last_arriendos).length} propiedades con datos</p>
        </div>
        <div style={{display:'flex',gap:8}}>
          <button onClick={fetchData} style={st.iconBtn} title="Actualizar"><RefreshCw size={16} color="#5f6368"/></button>
          {tab==='saldos'&&<button onClick={()=>setShowUpload(!showUpload)} style={{...st.iconBtn,...(showUpload?{background:'#e8f0fe',borderColor:'#1a73e8'}:{})}}><Upload size={16} color={showUpload?'#1a73e8':'#5f6368'}/></button>}
        </div>
      </div>

      {/* Tabs */}
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

      {tab==='saldos'&&<SaldosTab rows={rows} attrsMap={attrsMap} loading={loading} fetchData={fetchData} lastUploads={lastUploads} handleUpload={handleUpload} uploading={uploading} showUpload={showUpload} setShowUpload={setShowUpload}/>}
      {tab==='consultas'&&<ConsultasTab/>}
      {tab==='reportabilidad'&&<ReportabilidadTab/>}
    </div>
  );
}

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
};
