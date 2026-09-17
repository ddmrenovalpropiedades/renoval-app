import React, { useState, useEffect, useMemo, useRef } from 'react';
import { supabase } from '../supabaseClient';
import {
  Search, X, Mail, Send, Check, AlertTriangle,
  ChevronDown, ChevronUp, Plus, Loader2, History, PenSquare,
} from 'lucide-react';

// ── Config general ────────────────────────────────────────────
// Códigos de encargado que sí tienen cuenta de correo configurada
// para enviar mailings (refresh token OAuth propio con scope
// gmail.send en Vercel). AM todavía no tiene cuenta — cuando la
// tenga, agregar 'AM' acá y su GMAIL_SEND_REFRESH_TOKEN_AM en el
// backend (api/send-gc-email.js).
const CODES_CON_CUENTA = ['DD', 'FD', 'EA', 'FG'];
const BATCH_SIZE = 15;

const DESTINO_OPTIONS = [
  { value: 'administraciones', label: 'Administraciones' },
  { value: 'propietarios',     label: 'Propietarios' },
  { value: 'ambos',            label: 'Ambos' },
];

function renderTemplate(template, vars) {
  return (template || '').replace(/\{\{\s*(propietario|direccion)\s*\}\}/gi, (_, key) => vars[key.toLowerCase()] || '');
}

function containsDireccionToken(text) {
  return /\{\{\s*direccion\s*\}\}/i.test(text || '');
}

// ── Toggle "Incluir / No Incluir" ─────────────────────────────
function IncluirToggle({ checked, onChange }) {
  return (
    <button
      type="button"
      onClick={onChange}
      style={{
        position: 'relative', width: 100, height: 28, borderRadius: 999, padding: 0,
        border: `1px solid ${checked ? '#3b6fe0' : '#dadce0'}`,
        background: checked ? '#3b6fe0' : '#eceff1',
        cursor: 'pointer', display: 'flex', alignItems: 'center',
        transition: 'background 0.15s, border-color 0.15s',
      }}
    >
      <span style={{
        position: 'absolute', top: 2, bottom: 2, width: 22, borderRadius: '50%',
        background: '#fff', boxShadow: '0 1px 3px rgba(0,0,0,0.3)',
        left: checked ? 'calc(100% - 24px)' : 2, transition: 'left 0.15s',
      }} />
      <span style={{ flex: 1, textAlign: 'center', fontSize: 11, fontWeight: 700, color: checked ? '#fff' : '#5f6368' }}>
        {checked ? 'Incluir' : 'No Incluir'}
      </span>
    </button>
  );
}

export default function MailingPage({ profile }) {
  const [activeTab, setActiveTab] = useState('redactar');
  const isOwner = profile?.isOwner;

  if (!isOwner) {
    return (
      <div style={styles.restricted}>
        <AlertTriangle size={32} color="#ea4335" />
        <p style={{ fontSize: 14, color: '#5f6368', marginTop: 8 }}>
          Este módulo es solo para cuentas de administrador.
        </p>
      </div>
    );
  }

  return (
    <div style={styles.container}>
      <style>{'@keyframes mailingSpin { to { transform: rotate(360deg); } }'}</style>
      <div style={styles.header}>
        <div>
          <h1 style={styles.title}><Mail size={22} color="#1a73e8" />Mailing</h1>
          <p style={styles.subtitle}>Comunicados masivos a propietarios y administraciones</p>
        </div>
      </div>

      <div style={styles.tabs}>
        <button onClick={() => setActiveTab('redactar')} style={{ ...styles.tab, ...(activeTab === 'redactar' ? styles.tabActive : {}) }}>
          <PenSquare size={14} style={{ marginRight: 6, verticalAlign: -2 }} /> Redactar
        </button>
        <button onClick={() => setActiveTab('historial')} style={{ ...styles.tab, ...(activeTab === 'historial' ? styles.tabActive : {}) }}>
          <History size={14} style={{ marginRight: 6, verticalAlign: -2 }} /> Historial
        </button>
      </div>

      {activeTab === 'redactar' && <ComponerTab profile={profile} />}
      {activeTab === 'historial' && <HistorialTab />}
    </div>
  );
}

// ══════════════════════════════════════════════════════════════
// Tab: Redactar
// ══════════════════════════════════════════════════════════════
function ComponerTab({ profile }) {
  const [properties, setProperties] = useState([]);
  const [appUsers, setAppUsers] = useState([]);
  const [loading, setLoading] = useState(true);

  // Composer
  const [remitenteModo, setRemitenteModo] = useState('fijo'); // 'fijo' | 'e1' | 'e2'
  const [remitenteFijo, setRemitenteFijo] = useState('DD');
  const [ccSeleccionados, setCcSeleccionados] = useState([]);
  const [ccManualInput, setCcManualInput] = useState('');
  const [destino, setDestino] = useState('administraciones');
  const [asunto, setAsunto] = useState('');
  const [cuerpo, setCuerpo] = useState('');
  const [focusedField, setFocusedField] = useState('cuerpo');
  const asuntoRef = useRef(null);
  const cuerpoRef = useRef(null);

  // Selección
  const [search, setSearch] = useState('');
  const [filterE, setFilterE] = useState([]);
  const [incluidos, setIncluidos] = useState({});

  // Envío
  const [showConfirm, setShowConfirm] = useState(false);
  const [sending, setSending] = useState(false);
  const [sendProgress, setSendProgress] = useState({ done: 0, total: 0 });
  const [sendResult, setSendResult] = useState(null);

  useEffect(() => { fetchData(); }, []);

  const fetchData = async () => {
    setLoading(true);
    const [{ data: props }, { data: users }] = await Promise.all([
      supabase.from('properties').select('*').order('propiedad', { ascending: true }),
      supabase.from('app_users').select('*'),
    ]);
    setProperties(props || []);
    setAppUsers(users || []);
    setLoading(false);
  };

  // Solo propiedades que administramos (excluye ADMIN = 'No')
  const propiedadesAdministradas = useMemo(
    () => properties.filter(p => p.admin !== 'No'),
    [properties]
  );

  const filteredRows = useMemo(() => {
    let result = propiedadesAdministradas;
    if (search.trim()) {
      const s = search.trim().toLowerCase();
      result = result.filter(p => [p.propiedad, p.propietario, p.mail_propietario, p.mail_administracion, p.e1, p.e2].some(v => v && v.toLowerCase().includes(s)));
    }
    if (filterE.length > 0) {
      result = result.filter(p => filterE.every(e => [p.e1, p.e2].filter(Boolean).includes(e)));
    }
    return result;
  }, [propiedadesAdministradas, search, filterE]);

  const toggleFilterE = (e) => setFilterE(prev => prev.includes(e) ? prev.filter(x => x !== e) : [...prev, e]);
  const toggleIncluido = (id) => setIncluidos(prev => ({ ...prev, [id]: !prev[id] }));
  const seleccionarTodoFiltrado = () => {
    setIncluidos(prev => {
      const next = { ...prev };
      filteredRows.forEach(p => { next[p.id] = true; });
      return next;
    });
  };
  const deseleccionarTodoFiltrado = () => {
    setIncluidos(prev => {
      const next = { ...prev };
      filteredRows.forEach(p => { next[p.id] = false; });
      return next;
    });
  };

  const selectedCount = useMemo(
    () => propiedadesAdministradas.filter(p => incluidos[p.id]).length,
    [propiedadesAdministradas, incluidos]
  );

  const senderInfo = useMemo(() => {
    const map = {};
    CODES_CON_CUENTA.forEach(code => {
      const user = appUsers.find(u => u.iniciales === code);
      map[code] = { email: user?.email || null, nombre: user?.full_name || code };
    });
    return map;
  }, [appUsers]);

  // ── Placeholders ──
  const direccionDeshabilitada = destino === 'propietarios';
  const insertPlaceholder = (token) => {
    if (token === '{{direccion}}' && direccionDeshabilitada) return;
    const ref = focusedField === 'asunto' ? asuntoRef : cuerpoRef;
    const current = focusedField === 'asunto' ? asunto : cuerpo;
    const setter = focusedField === 'asunto' ? setAsunto : setCuerpo;
    const el = ref.current;
    if (!el) { setter(current + token); return; }
    const start = el.selectionStart ?? current.length;
    const end = el.selectionEnd ?? current.length;
    const next = current.slice(0, start) + token + current.slice(end);
    setter(next);
    requestAnimationFrame(() => {
      el.focus();
      el.selectionStart = el.selectionEnd = start + token.length;
    });
  };

  // ── CC ──
  const toggleCcUser = (email) => {
    setCcSeleccionados(prev => prev.includes(email) ? prev.filter(e => e !== email) : [...prev, email]);
  };
  const addCcManual = () => {
    const email = ccManualInput.trim();
    if (!email) return;
    const valido = /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);
    if (!valido) { alert('Correo inválido.'); return; }
    if (!ccSeleccionados.includes(email)) setCcSeleccionados(prev => [...prev, email]);
    setCcManualInput('');
  };
  const removeCc = (email) => setCcSeleccionados(prev => prev.filter(e => e !== email));

  // ── Construcción de los envíos a partir de la selección ──
  const preview = useMemo(() => {
    const excluidos = [];
    const jobs = [];
    const seleccionadas = propiedadesAdministradas.filter(p => incluidos[p.id]);

    const resolverRemitente = (p) => {
      if (remitenteModo === 'fijo') return remitenteFijo;
      return remitenteModo === 'e1' ? p.e1 : p.e2;
    };

    if (destino === 'propietarios') {
      const grupos = new Map();
      seleccionadas.forEach(p => {
        const email = (p.mail_propietario || '').trim();
        if (!email) { excluidos.push({ propiedad: p.propiedad, motivo: 'Sin mail de propietario' }); return; }
        const codigo = resolverRemitente(p);
        if (!codigo || !CODES_CON_CUENTA.includes(codigo)) {
          excluidos.push({ propiedad: p.propiedad, motivo: `Remitente ${remitenteModo.toUpperCase()} sin cuenta configurada (${codigo || 'vacío'})` });
          return;
        }
        const key = remitenteModo === 'fijo' ? email.toLowerCase() : `${email.toLowerCase()}|${codigo}`;
        if (!grupos.has(key)) grupos.set(key, { to: email, from: codigo, propietario: p.propietario, propiedades: [] });
        grupos.get(key).propiedades.push(p.propiedad);
      });
      grupos.forEach(g => {
        jobs.push({
          to: [g.to],
          from: g.from,
          propietario: g.propietario,
          propiedad: g.propiedades.join(' / '),
          subject: renderTemplate(asunto, { propietario: g.propietario, direccion: '' }),
          text: renderTemplate(cuerpo, { propietario: g.propietario, direccion: '' }),
        });
      });
    } else {
      seleccionadas.forEach(p => {
        const to = [];
        if (destino === 'administraciones' || destino === 'ambos') {
          const mailAdmin = (p.mail_administracion || '').trim();
          if (mailAdmin) to.push(mailAdmin);
        }
        if (destino === 'ambos') {
          const mailProp = (p.mail_propietario || '').trim();
          if (mailProp) to.push(mailProp);
        }
        if (to.length === 0) { excluidos.push({ propiedad: p.propiedad, motivo: 'Sin mail de destino configurado' }); return; }

        const codigo = resolverRemitente(p);
        if (!codigo || !CODES_CON_CUENTA.includes(codigo)) {
          excluidos.push({ propiedad: p.propiedad, motivo: `Remitente ${remitenteModo.toUpperCase()} sin cuenta configurada (${codigo || 'vacío'})` });
          return;
        }
        jobs.push({
          to,
          from: codigo,
          propietario: p.propietario,
          propiedad: p.propiedad,
          subject: renderTemplate(asunto, { propietario: p.propietario, direccion: p.propiedad }),
          text: renderTemplate(cuerpo, { propietario: p.propietario, direccion: p.propiedad }),
        });
      });
    }

    return { jobs, excluidos };
  }, [propiedadesAdministradas, incluidos, destino, remitenteModo, remitenteFijo, asunto, cuerpo]);

  const direccionEnTemplate = containsDireccionToken(asunto) || containsDireccionToken(cuerpo);
  const puedeRevisar = asunto.trim() && cuerpo.trim() && selectedCount > 0 && !(direccionDeshabilitada && direccionEnTemplate);

  const resetComposer = () => {
    setAsunto('');
    setCuerpo('');
    setIncluidos({});
    setCcSeleccionados([]);
    setSendResult(null);
    setShowConfirm(false);
  };

  const handleConfirmSend = async () => {
    const { jobs } = preview;
    if (jobs.length === 0) return;
    setSending(true);
    setSendResult(null);

    const campaignId = (typeof crypto !== 'undefined' && crypto.randomUUID)
      ? crypto.randomUUID()
      : `${Date.now()}-${Math.random().toString(16).slice(2)}`;

    const batches = [];
    for (let i = 0; i < jobs.length; i += BATCH_SIZE) batches.push(jobs.slice(i, i + BATCH_SIZE));

    let totalEnviados = 0;
    let totalFallidos = 0;
    const fallidos = [];
    setSendProgress({ done: 0, total: jobs.length });

    try {
      for (let i = 0; i < batches.length; i++) {
        const resp = await fetch('/api/send-gc-email', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${process.env.REACT_APP_CRON_SECRET}`,
          },
          body: JSON.stringify({
            mode: 'mailing',
            triggeredBy: profile?.email,
            campaignId,
            isFirstBatch: i === 0,
            destino,
            remitenteModo,
            remitenteFijo: remitenteModo === 'fijo' ? remitenteFijo : null,
            cc: ccSeleccionados,
            asuntoTemplate: asunto,
            cuerpoTemplate: cuerpo,
            jobs: batches[i],
          }),
        });
        const data = await resp.json();
        if (!resp.ok) throw new Error(data.error || 'Error al enviar el lote.');
        totalEnviados += data.totalEnviados || 0;
        totalFallidos += data.totalFallidos || 0;
        (data.results || []).forEach(r => { if (!r.ok) fallidos.push(r); });
        setSendProgress({ done: Math.min((i + 1) * BATCH_SIZE, jobs.length), total: jobs.length });
      }
      setSendResult({ totalEnviados, totalFallidos, fallidos });
    } catch (err) {
      setSendResult({ error: err.message, totalEnviados, totalFallidos, fallidos });
    } finally {
      setSending(false);
    }
  };

  return (
    <div style={styles.composerLayout}>
      {/* ── Bloque de redacción ── */}
      <div style={styles.card}>
        <div style={styles.fieldRow}>
          <div style={styles.fieldHalf}>
            <label style={styles.label}>Remitente</label>
            <div style={styles.pillGroup}>
              <button onClick={() => setRemitenteModo('fijo')} style={{ ...styles.pillBtn, ...(remitenteModo === 'fijo' ? styles.pillBtnActive : {}) }}>Fijo</button>
              <button onClick={() => setRemitenteModo('e1')} style={{ ...styles.pillBtn, ...(remitenteModo === 'e1' ? styles.pillBtnActive : {}) }}>Dinámico: E1</button>
              <button onClick={() => setRemitenteModo('e2')} style={{ ...styles.pillBtn, ...(remitenteModo === 'e2' ? styles.pillBtnActive : {}) }}>Dinámico: E2</button>
            </div>
            {remitenteModo === 'fijo' ? (
              <select value={remitenteFijo} onChange={e => setRemitenteFijo(e.target.value)} style={{ ...styles.select, marginTop: 8 }}>
                {CODES_CON_CUENTA.map(code => (
                  <option key={code} value={code}>{senderInfo[code]?.nombre || code} ({code})</option>
                ))}
              </select>
            ) : (
              <p style={styles.helperText}>
                Se usará el encargado {remitenteModo.toUpperCase()} de cada propiedad. Las propiedades donde ese encargado no tenga cuenta configurada (ej. AM) quedarán excluidas del envío.
              </p>
            )}
          </div>

          <div style={styles.fieldHalf}>
            <label style={styles.label}>Destino</label>
            <div style={styles.pillGroup}>
              {DESTINO_OPTIONS.map(opt => (
                <button key={opt.value} onClick={() => setDestino(opt.value)} style={{ ...styles.pillBtn, ...(destino === opt.value ? styles.pillBtnActive : {}) }}>{opt.label}</button>
              ))}
            </div>
            {destino === 'propietarios' && (
              <p style={styles.helperText}>Se envía una sola vez por propietario, aunque tenga varias propiedades. No se puede insertar la dirección.</p>
            )}
          </div>
        </div>

        <div style={styles.field}>
          <label style={styles.label}>Copia (CC)</label>
          <div style={styles.ccUsersRow}>
            {appUsers.map(u => (
              <button key={u.id || u.email} onClick={() => toggleCcUser(u.email)}
                style={{ ...styles.ccChip, ...(ccSeleccionados.includes(u.email) ? styles.ccChipActive : {}) }}>
                {u.full_name || u.email}
              </button>
            ))}
          </div>
          <div style={styles.ccManualRow}>
            <input value={ccManualInput} onChange={e => setCcManualInput(e.target.value)}
              onKeyDown={e => { if (e.key === 'Enter') addCcManual(); }}
              placeholder="Agregar correo manualmente" style={styles.inputSmall} />
            <button onClick={addCcManual} style={styles.smallAddBtn}><Plus size={14} /></button>
          </div>
          {ccSeleccionados.length > 0 && (
            <div style={styles.ccSelectedRow}>
              {ccSeleccionados.map(email => (
                <span key={email} style={styles.ccSelectedChip}>
                  {email}
                  <button onClick={() => removeCc(email)} style={styles.ccRemoveBtn}><X size={11} /></button>
                </span>
              ))}
            </div>
          )}
        </div>

        <div style={styles.field}>
          <div style={styles.labelWithActions}>
            <label style={styles.label}>Asunto</label>
            <div style={styles.placeholderBtns}>
              <button onClick={() => insertPlaceholder('{{propietario}}')} style={styles.placeholderBtn}>+ Propietario</button>
              <button onClick={() => insertPlaceholder('{{direccion}}')} disabled={direccionDeshabilitada}
                title={direccionDeshabilitada ? 'No disponible cuando el destino es solo Propietarios' : ''}
                style={{ ...styles.placeholderBtn, ...(direccionDeshabilitada ? styles.placeholderBtnDisabled : {}) }}>+ Dirección</button>
            </div>
          </div>
          <input ref={asuntoRef} value={asunto} onChange={e => setAsunto(e.target.value)}
            onFocus={() => setFocusedField('asunto')} placeholder="Asunto del correo" style={styles.input} />
        </div>

        <div style={styles.field}>
          <div style={styles.labelWithActions}>
            <label style={styles.label}>Cuerpo del correo</label>
            <div style={styles.placeholderBtns}>
              <button onClick={() => insertPlaceholder('{{propietario}}')} style={styles.placeholderBtn}>+ Propietario</button>
              <button onClick={() => insertPlaceholder('{{direccion}}')} disabled={direccionDeshabilitada}
                title={direccionDeshabilitada ? 'No disponible cuando el destino es solo Propietarios' : ''}
                style={{ ...styles.placeholderBtn, ...(direccionDeshabilitada ? styles.placeholderBtnDisabled : {}) }}>+ Dirección</button>
            </div>
          </div>
          <textarea ref={cuerpoRef} value={cuerpo} onChange={e => setCuerpo(e.target.value)}
            onFocus={() => setFocusedField('cuerpo')} placeholder="Redacta el comunicado..." rows={8} style={styles.textarea} />
        </div>

        {direccionDeshabilitada && direccionEnTemplate && (
          <div style={styles.warningBanner}>
            <AlertTriangle size={14} color="#c5221f" />
            <span>El asunto o el cuerpo contiene {'{{direccion}}'}, pero el destino es solo Propietarios. Quítalo antes de enviar.</span>
          </div>
        )}

        {preview.jobs.length > 0 && (asunto || cuerpo) && (
          <div style={styles.previewBox}>
            <span style={styles.previewLabel}>Vista previa (primer destinatario)</span>
            <p style={styles.previewSubject}>{preview.jobs[0].subject || <em>(sin asunto)</em>}</p>
            <p style={styles.previewBody}>{preview.jobs[0].text || <em>(sin cuerpo)</em>}</p>
          </div>
        )}
      </div>

      {/* ── Bloque de selección de propiedades ── */}
      <div style={styles.card}>
        <div style={styles.selectionHeader}>
          <div>
            <h3 style={styles.sectionTitle}>Propiedades</h3>
            <p style={styles.subtitleSmall}>{selectedCount} seleccionadas de {propiedadesAdministradas.length} administradas ({filteredRows.length} visibles con el filtro actual)</p>
          </div>
          <div style={styles.bulkBtns}>
            <button onClick={seleccionarTodoFiltrado} style={styles.bulkBtn}>Seleccionar todo</button>
            <button onClick={deseleccionarTodoFiltrado} style={styles.bulkBtn}>Deseleccionar todo</button>
          </div>
        </div>

        <div style={styles.filtersRow}>
          <div style={styles.searchWrapper}>
            <Search size={15} color="#9aa0a6" style={styles.searchIcon} />
            <input value={search} onChange={e => setSearch(e.target.value)} placeholder="Buscar en todas las columnas..." style={styles.searchInput} />
            {search && <button onClick={() => setSearch('')} style={styles.clearSearch}><X size={13} color="#9aa0a6" /></button>}
          </div>
          <div style={styles.encargadoFilters}>
            {CODES_CON_CUENTA.concat(['AM']).map(e => (
              <button key={e} onClick={() => toggleFilterE(e)} style={{ ...styles.filterBtn, ...(filterE.includes(e) ? styles.filterBtnActive : {}) }}>{e}</button>
            ))}
            {filterE.length > 0 && <button onClick={() => setFilterE([])} style={styles.clearFilter}>Limpiar</button>}
          </div>
        </div>

        <div style={styles.tableWrapper}>
          {loading ? <div style={styles.loading}>Cargando propiedades...</div> : (
            <table style={styles.table}>
              <thead>
                <tr>
                  <th style={{ ...styles.th, width: '13%' }}>INCLUIR</th>
                  <th style={{ ...styles.th, width: '22%' }}>PROPIEDAD</th>
                  <th style={{ ...styles.th, width: '14%' }}>PROPIETARIO</th>
                  <th style={{ ...styles.th, width: '17%' }}>MAIL PROP.</th>
                  <th style={{ ...styles.th, width: '17%' }}>MAIL ADMIN.</th>
                  <th style={{ ...styles.th, width: '6%', textAlign: 'center' }}>E1</th>
                  <th style={{ ...styles.th, width: '6%', textAlign: 'center' }}>E2</th>
                </tr>
              </thead>
              <tbody>
                {filteredRows.length === 0 ? (
                  <tr><td colSpan={7} style={styles.empty}>No se encontraron propiedades con ese criterio.</td></tr>
                ) : (
                  filteredRows.map((prop, i) => (
                    <tr key={prop.id} style={{ background: i % 2 === 0 ? '#fff' : '#f8f9fa' }}>
                      <td style={styles.td}><IncluirToggle checked={!!incluidos[prop.id]} onChange={() => toggleIncluido(prop.id)} /></td>
                      <td style={styles.td}>{prop.propiedad}</td>
                      <td style={{ ...styles.td, color: '#5f6368' }}>{prop.propietario}</td>
                      <td style={{ ...styles.td, color: '#5f6368' }}>{prop.mail_propietario}</td>
                      <td style={{ ...styles.td, color: '#5f6368' }}>{prop.mail_administracion}</td>
                      <td style={{ ...styles.td, textAlign: 'center' }}>{prop.e1}</td>
                      <td style={{ ...styles.td, textAlign: 'center' }}>{prop.e2}</td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          )}
        </div>
      </div>

      {/* ── Barra de envío ── */}
      <div style={styles.sendBar}>
        <div style={styles.sendSummary}>
          <span>{preview.jobs.length} correo(s) a enviar</span>
          {preview.excluidos.length > 0 && (
            <span style={styles.excludedTag}><AlertTriangle size={13} style={{ marginRight: 4, verticalAlign: -2 }} />{preview.excluidos.length} excluida(s)</span>
          )}
        </div>
        <button onClick={() => setShowConfirm(true)} disabled={!puedeRevisar} style={{ ...styles.sendBtn, ...(!puedeRevisar ? styles.sendBtnDisabled : {}) }}>
          <Send size={15} style={{ marginRight: 8 }} /> Revisar y enviar
        </button>
      </div>

      {showConfirm && (
        <ConfirmModal
          preview={preview}
          destino={destino}
          remitenteModo={remitenteModo}
          remitenteLabel={remitenteModo === 'fijo' ? (senderInfo[remitenteFijo]?.nombre || remitenteFijo) : `Encargado ${remitenteModo.toUpperCase()} de cada propiedad`}
          cc={ccSeleccionados}
          sending={sending}
          sendProgress={sendProgress}
          sendResult={sendResult}
          onClose={() => { setShowConfirm(false); setSendResult(null); }}
          onConfirm={handleConfirmSend}
          onNuevoEnvio={resetComposer}
        />
      )}
    </div>
  );
}

// ── Modal de confirmación / progreso / resultado ──────────────
function ConfirmModal({ preview, destino, remitenteLabel, cc, sending, sendProgress, sendResult, onClose, onConfirm, onNuevoEnvio }) {
  const [showExcluidos, setShowExcluidos] = useState(false);

  return (
    <div style={styles.modalOverlay} onClick={e => e.target === e.currentTarget && !sending && onClose()}>
      <div style={styles.modal}>
        <div style={styles.modalHeader}>
          <h3 style={styles.modalTitle}>{sendResult ? 'Resultado del envío' : 'Confirmar envío'}</h3>
          {!sending && <button onClick={onClose} style={styles.modalClose}><X size={18} color="#5f6368" /></button>}
        </div>

        <div style={styles.modalBody}>
          {!sendResult && !sending && (
            <>
              <div style={styles.confirmRow}><span style={styles.confirmLabel}>Destino</span><span>{destino}</span></div>
              <div style={styles.confirmRow}><span style={styles.confirmLabel}>Remitente</span><span>{remitenteLabel}</span></div>
              <div style={styles.confirmRow}><span style={styles.confirmLabel}>Copia (CC)</span><span>{cc.length > 0 ? cc.join(', ') : '—'}</span></div>
              <div style={styles.confirmRow}><span style={styles.confirmLabel}>Correos a enviar</span><span style={{ fontWeight: 700 }}>{preview.jobs.length}</span></div>

              {preview.excluidos.length > 0 && (
                <div style={styles.excludedBox}>
                  <button onClick={() => setShowExcluidos(v => !v)} style={styles.excludedToggle}>
                    <AlertTriangle size={14} color="#c5221f" style={{ marginRight: 6 }} />
                    {preview.excluidos.length} propiedad(es) quedarán excluidas
                    {showExcluidos ? <ChevronUp size={14} style={{ marginLeft: 6 }} /> : <ChevronDown size={14} style={{ marginLeft: 6 }} />}
                  </button>
                  {showExcluidos && (
                    <ul style={styles.excludedList}>
                      {preview.excluidos.map((ex, i) => (
                        <li key={i}>{ex.propiedad} — {ex.motivo}</li>
                      ))}
                    </ul>
                  )}
                </div>
              )}
            </>
          )}

          {sending && (
            <div style={styles.progressBox}>
              <Loader2 size={22} style={{ animation: 'mailingSpin 1s linear infinite' }} />
              <p style={{ marginTop: 12 }}>Enviando {sendProgress.done} de {sendProgress.total}...</p>
              <div style={styles.progressBarOuter}>
                <div style={{ ...styles.progressBarInner, width: `${sendProgress.total ? (sendProgress.done / sendProgress.total) * 100 : 0}%` }} />
              </div>
            </div>
          )}

          {sendResult && (
            <div>
              {sendResult.error && <p style={{ color: '#c5221f', marginBottom: 12 }}>Error: {sendResult.error}</p>}
              <div style={styles.confirmRow}><span style={styles.confirmLabel}>Enviados con éxito</span><span style={{ fontWeight: 700, color: '#1e8e3e' }}>{sendResult.totalEnviados}</span></div>
              <div style={styles.confirmRow}><span style={styles.confirmLabel}>Fallidos</span><span style={{ fontWeight: 700, color: sendResult.totalFallidos > 0 ? '#c5221f' : '#202124' }}>{sendResult.totalFallidos}</span></div>
              {sendResult.fallidos && sendResult.fallidos.length > 0 && (
                <ul style={styles.excludedList}>
                  {sendResult.fallidos.map((f, i) => (
                    <li key={i}>{f.propiedad} ({(f.to || []).join(', ')}) — {f.error}</li>
                  ))}
                </ul>
              )}
            </div>
          )}
        </div>

        <div style={styles.modalFooter}>
          {!sendResult && !sending && (
            <>
              <button onClick={onConfirm} style={styles.saveBtn}><Check size={15} style={{ marginRight: 6 }} />Confirmar y enviar</button>
              <button onClick={onClose} style={styles.cancelBtn}>Cancelar</button>
            </>
          )}
          {sendResult && (
            <>
              <button onClick={onNuevoEnvio} style={styles.saveBtn}>Nuevo envío</button>
              <button onClick={onClose} style={styles.cancelBtn}>Cerrar</button>
            </>
          )}
        </div>
      </div>
    </div>
  );
}

// ══════════════════════════════════════════════════════════════
// Tab: Historial
// ══════════════════════════════════════════════════════════════
function HistorialTab() {
  const [logs, setLogs] = useState([]);
  const [loading, setLoading] = useState(true);
  const [expandedId, setExpandedId] = useState(null);

  useEffect(() => { fetchLogs(); }, []);

  const fetchLogs = async () => {
    setLoading(true);
    const { data } = await supabase.from('mailing_log').select('*').order('created_at', { ascending: false }).limit(100);
    setLogs(data || []);
    setLoading(false);
  };

  if (loading) return <div style={styles.loading}>Cargando historial...</div>;
  if (logs.length === 0) return <div style={styles.card}><p style={styles.empty}>Todavía no se ha enviado ningún mailing.</p></div>;

  return (
    <div style={styles.card}>
      {logs.map(log => {
        const expanded = expandedId === log.id;
        const fecha = log.created_at ? new Date(log.created_at).toLocaleString('es-CL') : '';
        return (
          <div key={log.id} style={styles.logRow}>
            <button onClick={() => setExpandedId(expanded ? null : log.id)} style={styles.logHeader}>
              <div style={{ textAlign: 'left' }}>
                <div style={styles.logSubject}>{log.asunto || '(sin asunto)'}</div>
                <div style={styles.logMeta}>{fecha} · {log.destino} · remitente: {log.remitente_modo === 'fijo' ? log.remitente_fijo : `E${log.remitente_modo === 'e1' ? '1' : '2'} dinámico`}</div>
              </div>
              <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                <span style={styles.logCountOk}>{log.total_enviados} ok</span>
                {log.total_fallidos > 0 && <span style={styles.logCountFail}>{log.total_fallidos} fallidos</span>}
                {expanded ? <ChevronUp size={16} color="#5f6368" /> : <ChevronDown size={16} color="#5f6368" />}
              </div>
            </button>
            {expanded && (
              <div style={styles.logDetail}>
                <p style={styles.logBodyPreview}>{log.cuerpo}</p>
                {Array.isArray(log.cc) && log.cc.length > 0 && <p style={styles.logMeta}>CC: {log.cc.join(', ')}</p>}
                <table style={styles.table}>
                  <thead>
                    <tr>
                      <th style={styles.th}>PROPIEDAD</th>
                      <th style={styles.th}>DESTINATARIO</th>
                      <th style={styles.th}>DESDE</th>
                      <th style={styles.th}>ESTADO</th>
                    </tr>
                  </thead>
                  <tbody>
                    {(log.destinatarios || []).map((d, i) => (
                      <tr key={i}>
                        <td style={styles.td}>{d.propiedad}</td>
                        <td style={styles.td}>{Array.isArray(d.to) ? d.to.join(', ') : d.to}</td>
                        <td style={styles.td}>{d.from}</td>
                        <td style={{ ...styles.td, color: d.ok ? '#1e8e3e' : '#c5221f' }}>{d.ok ? 'Enviado' : `Error: ${d.error}`}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        );
      })}
    </div>
  );
}

const styles = {
  container: { height: '100%', display: 'flex', flexDirection: 'column', overflow: 'auto', fontFamily: "'Google Sans', 'Segoe UI', sans-serif" },
  header: { display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 16, flexShrink: 0 },
  title: { fontSize: 24, fontWeight: 700, color: '#202124', margin: '0 0 4px', display: 'flex', alignItems: 'center', gap: 8 },
  subtitle: { fontSize: 14, color: '#5f6368', margin: 0 },
  subtitleSmall: { fontSize: 12, color: '#5f6368', margin: '2px 0 0' },
  tabs: { display: 'flex', gap: 0, marginBottom: 20, borderBottom: '2px solid #e8eaed', flexShrink: 0 },
  tab: { padding: '10px 20px', background: 'none', border: 'none', cursor: 'pointer', fontSize: 14, fontWeight: 500, color: '#5f6368', fontFamily: 'inherit', borderBottom: '2px solid transparent', marginBottom: -2 },
  tabActive: { color: '#1a73e8', borderBottom: '2px solid #1a73e8' },
  restricted: { display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', height: '100%' },
  composerLayout: { display: 'flex', flexDirection: 'column', gap: 16, paddingBottom: 24 },
  card: { background: '#fff', border: '1px solid #e8eaed', borderRadius: 12, padding: 20 },
  field: { marginBottom: 16 },
  fieldRow: { display: 'flex', gap: 20, marginBottom: 16, flexWrap: 'wrap' },
  fieldHalf: { flex: 1, minWidth: 260 },
  label: { fontSize: 12, fontWeight: 600, color: '#5f6368', display: 'block', marginBottom: 6 },
  labelWithActions: { display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 6, flexWrap: 'wrap', gap: 6 },
  helperText: { fontSize: 12, color: '#9aa0a6', margin: '8px 0 0' },
  input: { width: '100%', border: '1px solid #dadce0', borderRadius: 8, padding: '9px 12px', fontSize: 14, outline: 'none', fontFamily: 'inherit', boxSizing: 'border-box' },
  inputSmall: { flex: 1, border: '1px solid #dadce0', borderRadius: 8, padding: '7px 10px', fontSize: 13, outline: 'none', fontFamily: 'inherit' },
  textarea: { width: '100%', border: '1px solid #dadce0', borderRadius: 8, padding: '10px 12px', fontSize: 14, outline: 'none', fontFamily: 'inherit', resize: 'vertical', boxSizing: 'border-box' },
  select: { width: '100%', border: '1px solid #dadce0', borderRadius: 8, padding: '9px 12px', fontSize: 14, outline: 'none', fontFamily: 'inherit', background: '#fff', cursor: 'pointer' },
  pillGroup: { display: 'flex', gap: 6, flexWrap: 'wrap' },
  pillBtn: { padding: '7px 14px', borderRadius: 20, border: '1px solid #dadce0', background: '#fff', fontSize: 12, cursor: 'pointer', color: '#5f6368', fontFamily: 'inherit', fontWeight: 500 },
  pillBtnActive: { background: '#e8f0fe', color: '#1a73e8', borderColor: '#1a73e8', fontWeight: 700 },
  placeholderBtns: { display: 'flex', gap: 6 },
  placeholderBtn: { padding: '4px 10px', borderRadius: 14, border: '1px solid #dadce0', background: '#fff', fontSize: 11, cursor: 'pointer', color: '#1a73e8', fontFamily: 'inherit', fontWeight: 600 },
  placeholderBtnDisabled: { color: '#bdc1c6', cursor: 'not-allowed', borderColor: '#e8eaed' },
  warningBanner: { display: 'flex', alignItems: 'center', gap: 8, background: '#fce8e6', border: '1px solid #c5221f44', borderRadius: 8, padding: '10px 12px', fontSize: 12, color: '#c5221f', marginBottom: 4 },
  previewBox: { background: '#f8f9fa', border: '1px solid #e8eaed', borderRadius: 8, padding: 12, marginTop: 4 },
  previewLabel: { fontSize: 11, fontWeight: 700, color: '#9aa0a6', textTransform: 'uppercase', letterSpacing: 0.5 },
  previewSubject: { fontSize: 13, fontWeight: 700, color: '#202124', margin: '6px 0 4px' },
  previewBody: { fontSize: 13, color: '#3c4043', margin: 0, whiteSpace: 'pre-wrap' },
  ccUsersRow: { display: 'flex', gap: 6, flexWrap: 'wrap', marginBottom: 8 },
  ccChip: { padding: '5px 12px', borderRadius: 20, border: '1px solid #dadce0', background: '#fff', fontSize: 12, cursor: 'pointer', color: '#5f6368', fontFamily: 'inherit' },
  ccChipActive: { background: '#e8f0fe', color: '#1a73e8', borderColor: '#1a73e8', fontWeight: 700 },
  ccManualRow: { display: 'flex', gap: 6 },
  smallAddBtn: { display: 'flex', alignItems: 'center', justifyContent: 'center', width: 32, border: '1px solid #dadce0', borderRadius: 8, background: '#fff', cursor: 'pointer' },
  ccSelectedRow: { display: 'flex', gap: 6, flexWrap: 'wrap', marginTop: 8 },
  ccSelectedChip: { display: 'flex', alignItems: 'center', gap: 6, padding: '4px 10px', borderRadius: 20, background: '#f1f3f4', fontSize: 12, color: '#3c4043' },
  ccRemoveBtn: { display: 'flex', border: 'none', background: 'none', cursor: 'pointer', padding: 0 },
  selectionHeader: { display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 16, flexWrap: 'wrap', gap: 10 },
  sectionTitle: { fontSize: 16, fontWeight: 700, color: '#202124', margin: 0 },
  bulkBtns: { display: 'flex', gap: 8 },
  bulkBtn: { padding: '7px 12px', borderRadius: 8, border: '1px solid #dadce0', background: '#fff', fontSize: 12, cursor: 'pointer', color: '#3c4043', fontFamily: 'inherit', fontWeight: 500 },
  filtersRow: { display: 'flex', gap: 12, marginBottom: 16, alignItems: 'center', flexWrap: 'wrap' },
  searchWrapper: { position: 'relative', flex: 1, minWidth: 200 },
  searchIcon: { position: 'absolute', left: 12, top: '50%', transform: 'translateY(-50%)', pointerEvents: 'none' },
  searchInput: { width: '100%', padding: '9px 36px', border: '1px solid #dadce0', borderRadius: 8, fontSize: 14, outline: 'none', fontFamily: 'inherit', background: '#fff', boxSizing: 'border-box' },
  clearSearch: { position: 'absolute', right: 10, top: '50%', transform: 'translateY(-50%)', background: 'none', border: 'none', cursor: 'pointer', padding: 2, display: 'flex' },
  encargadoFilters: { display: 'flex', gap: 6, alignItems: 'center', flexWrap: 'wrap' },
  filterBtn: { padding: '5px 12px', borderRadius: 20, border: '1px solid #dadce0', background: '#fff', fontSize: 12, cursor: 'pointer', color: '#5f6368', fontFamily: 'inherit' },
  filterBtnActive: { background: '#e8f0fe', color: '#1a73e8', borderColor: '#1a73e8', fontWeight: 700 },
  clearFilter: { padding: '5px 10px', borderRadius: 20, border: 'none', background: 'none', fontSize: 12, cursor: 'pointer', color: '#ea4335', fontFamily: 'inherit' },
  tableWrapper: { maxHeight: 420, overflow: 'auto', border: '1px solid #e8eaed', borderRadius: 12, background: '#fff' },
  table: { width: '100%', borderCollapse: 'collapse' },
  th: { padding: '11px 16px', background: '#f8f9fa', fontSize: 11, fontWeight: 700, color: '#5f6368', letterSpacing: 0.5, borderBottom: '2px solid #e8eaed', textAlign: 'left', position: 'sticky', top: 0, zIndex: 1 },
  td: { padding: '10px 16px', fontSize: 13, color: '#202124', borderBottom: '1px solid #f1f3f4' },
  empty: { padding: 40, textAlign: 'center', color: '#9aa0a6', fontSize: 14 },
  loading: { padding: 40, textAlign: 'center', color: '#9aa0a6', fontSize: 14 },
  sendBar: { position: 'sticky', bottom: 0, display: 'flex', justifyContent: 'space-between', alignItems: 'center', background: '#fff', border: '1px solid #e8eaed', borderRadius: 12, padding: '14px 20px', boxShadow: '0 -2px 8px rgba(0,0,0,0.06)' },
  sendSummary: { display: 'flex', alignItems: 'center', gap: 12, fontSize: 13, color: '#3c4043', fontWeight: 500 },
  excludedTag: { color: '#c5221f', fontSize: 12, fontWeight: 600 },
  sendBtn: { display: 'flex', alignItems: 'center', padding: '10px 20px', background: '#1a73e8', color: '#fff', border: 'none', borderRadius: 8, fontSize: 14, fontWeight: 600, cursor: 'pointer', fontFamily: 'inherit' },
  sendBtnDisabled: { background: '#e8eaed', color: '#9aa0a6', cursor: 'not-allowed' },
  modalOverlay: { position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.4)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 2000 },
  modal: { background: '#fff', borderRadius: 16, width: 560, maxHeight: '85vh', overflow: 'auto', boxShadow: '0 8px 32px rgba(0,0,0,0.18)', fontFamily: "'Google Sans', 'Segoe UI', sans-serif" },
  modalHeader: { display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '20px 24px 16px' },
  modalTitle: { fontSize: 18, fontWeight: 700, color: '#202124', margin: 0 },
  modalClose: { background: 'none', border: 'none', cursor: 'pointer', padding: 4, display: 'flex' },
  modalBody: { padding: '0 24px 8px' },
  modalFooter: { display: 'flex', gap: 8, padding: '16px 24px', borderTop: '1px solid #f1f3f4' },
  confirmRow: { display: 'flex', justifyContent: 'space-between', padding: '8px 0', borderBottom: '1px solid #f1f3f4', fontSize: 13, color: '#202124' },
  confirmLabel: { color: '#5f6368' },
  excludedBox: { marginTop: 12, background: '#fce8e6', borderRadius: 8, padding: 10 },
  excludedToggle: { display: 'flex', alignItems: 'center', border: 'none', background: 'none', cursor: 'pointer', color: '#c5221f', fontSize: 13, fontWeight: 600, fontFamily: 'inherit', padding: 0 },
  excludedList: { margin: '10px 0 0', paddingLeft: 20, fontSize: 12, color: '#3c4043', maxHeight: 160, overflow: 'auto' },
  progressBox: { display: 'flex', flexDirection: 'column', alignItems: 'center', padding: '20px 0', color: '#3c4043', fontSize: 13 },
  progressBarOuter: { width: '100%', height: 8, background: '#e8eaed', borderRadius: 8, marginTop: 12, overflow: 'hidden' },
  progressBarInner: { height: '100%', background: '#1a73e8', transition: 'width 0.2s' },
  saveBtn: { display: 'flex', alignItems: 'center', padding: '9px 20px', background: '#1a73e8', color: '#fff', border: 'none', borderRadius: 8, fontSize: 14, fontWeight: 500, cursor: 'pointer', fontFamily: 'inherit' },
  cancelBtn: { padding: '9px 16px', background: 'none', border: '1px solid #dadce0', borderRadius: 8, fontSize: 14, cursor: 'pointer', fontFamily: 'inherit', color: '#5f6368' },
  logRow: { borderBottom: '1px solid #f1f3f4' },
  logHeader: { width: '100%', display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '14px 8px', background: 'none', border: 'none', cursor: 'pointer', fontFamily: 'inherit' },
  logSubject: { fontSize: 14, fontWeight: 600, color: '#202124' },
  logMeta: { fontSize: 12, color: '#9aa0a6', marginTop: 2 },
  logCountOk: { fontSize: 12, fontWeight: 700, color: '#1e8e3e' },
  logCountFail: { fontSize: 12, fontWeight: 700, color: '#c5221f' },
  logDetail: { padding: '0 8px 16px' },
  logBodyPreview: { fontSize: 13, color: '#5f6368', whiteSpace: 'pre-wrap', background: '#f8f9fa', borderRadius: 8, padding: 10, marginBottom: 8 },
};
