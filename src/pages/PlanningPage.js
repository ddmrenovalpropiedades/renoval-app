import { useState, useMemo, useEffect, useRef, useCallback } from 'react';
import { RefreshCw, Mail, AlertCircle, Clock, DollarSign, ChevronDown, Check, ListPlus, X } from 'lucide-react';
import { supabase } from '../supabaseClient';
import { useAuth } from '../context/AuthContext';
import { useTasks } from '../hooks/useTasks';

const EMAILS_WITH_ACCESS = [
  'ddm@renovalpropiedades.com',
  'fdm@renovalpropiedades.com',
  'edith@renovalpropiedades.com',
  'fernanda@renovalpropiedades.com',
];
const STORAGE_KEY = 'planningEmailSummary';
const STORAGE_DATE_KEY = 'planningEmailDate';
// Correos de propietarios (Mail Prop. en Cartera) — últimos 7 días
const STORAGE_KEY_OWNERS = 'planningOwnerEmailSummary';
const STORAGE_DATE_KEY_OWNERS = 'planningOwnerEmailDate';

const PAGADO_POR = {
  'ddm@renovalpropiedades.com': 'DD',
  'fdm@renovalpropiedades.com': 'FD',
};

// Fallback si el usuario todavía no tiene filas en task_categories — mismo
// set que usa TasksPage.js (DEFAULT_CATEGORIES) para mantener consistencia.
const DEFAULT_TASK_CATEGORIES = ['Llegada arrendatario', 'Publicar/Arrendar', 'Equipo', 'Solicitudes', 'Misceláneo', 'PAGOS'];

const antiguedad = (fechaStr) => {
  if (!fechaStr) return '+ 3 meses';
  const fecha = new Date(fechaStr + 'T12:00:00');
  const diff = (new Date() - fecha) / (1000 * 60 * 60 * 24);
  return diff > 90 ? '+ 3 meses' : '- 3 meses';
};

const formatCLP = (n) => {
  if (!n && n !== 0) return '';
  return '$' + Math.round(n).toLocaleString('es-CL');
};

// isMobile se puede seguir pasando explícito, pero si no se pasa, se
// detecta solo mirando el ancho de ventana — necesario ahora que la página
// se monta directo desde el sidebar en vez de recibir el valor ya
// calculado por TasksPage.
function useIsMobileFallback(explicit) {
  const [isMobile, setIsMobile] = useState(() => explicit ?? window.innerWidth < 768);
  useEffect(() => {
    if (explicit !== undefined) { setIsMobile(explicit); return; }
    const handler = () => setIsMobile(window.innerWidth < 768);
    window.addEventListener('resize', handler);
    return () => window.removeEventListener('resize', handler);
  }, [explicit]);
  return isMobile;
}

// ── Modal: crear tarea a partir de un correo ──────────────────────────────
// Análogo a PublicarFechaModal (TaskColumn.js / TaskPanel.js): overlay +
// caja centrada. La lista de "categories" ya viene resuelta (default +
// propias del usuario) desde el componente padre.
function CreateTaskModal({ email, categories, onConfirm, onCancel }) {
  const [category, setCategory] = useState(categories[0]?.name || '');
  const [title, setTitle] = useState(email?.subject || '');
  const [notes, setNotes] = useState('');
  const [saving, setSaving] = useState(false);

  const handleConfirm = async () => {
    if (!title.trim() || !category || saving) return;
    setSaving(true);
    await onConfirm({ category, title: title.trim(), notes: notes.trim() });
    setSaving(false);
  };

  const disabled = !title.trim() || !category || saving;

  return (
    <div style={taskModalStyles.overlay} onClick={e => e.target === e.currentTarget && onCancel()}>
      <div style={taskModalStyles.modal}>
        <div style={taskModalStyles.header}>
          <span style={taskModalStyles.title}>Nueva tarea desde correo</span>
          <button onClick={onCancel} style={taskModalStyles.closeBtn}><X size={18} /></button>
        </div>

        {email && (
          <p style={taskModalStyles.emailRef}>
            {email.from}{email.subject ? ` · ${email.subject}` : ''}
          </p>
        )}

        <div style={{ padding: '0 20px 4px' }}>
          <label style={taskModalStyles.label}>Lista</label>
          <select value={category} onChange={e => setCategory(e.target.value)} style={taskModalStyles.select}>
            {categories.map(c => (
              <option key={c.name} value={c.name}>{c.name}</option>
            ))}
          </select>
        </div>

        <div style={{ padding: '14px 20px 4px' }}>
          <label style={taskModalStyles.label}>Nombre de la tarea</label>
          <input autoFocus value={title} onChange={e => setTitle(e.target.value)}
            placeholder="Título de la tarea..." style={taskModalStyles.input}
            onKeyDown={e => e.key === 'Escape' && onCancel()} />
        </div>

        <div style={{ padding: '14px 20px 4px' }}>
          <label style={taskModalStyles.label}>Notas</label>
          <textarea value={notes} onChange={e => setNotes(e.target.value)}
            placeholder="Notas de la tarea (opcional)..." rows={3} style={taskModalStyles.textarea} />
        </div>

        <div style={taskModalStyles.actions}>
          <button onClick={handleConfirm} disabled={disabled}
            style={{ ...taskModalStyles.confirmBtn, ...(disabled ? { background: '#e8eaed', color: '#9aa0a6', cursor: 'not-allowed' } : {}) }}>
            {saving ? 'Creando...' : 'Crear tarea'}
          </button>
          <button onClick={onCancel} style={taskModalStyles.cancelBtn}>Cancelar</button>
        </div>
      </div>
    </div>
  );
}

const taskModalStyles = {
  overlay: { position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.4)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 3000 },
  modal: { background: '#fff', borderRadius: 16, width: 400, boxShadow: '0 8px 32px rgba(0,0,0,0.18)', fontFamily: "'Google Sans', 'Segoe UI', sans-serif", overflow: 'hidden' },
  header: { display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '20px 20px 6px' },
  title: { fontSize: 18, fontWeight: 700, color: '#202124' },
  closeBtn: { background: 'none', border: 'none', cursor: 'pointer', padding: 4, color: '#5f6368', borderRadius: 6 },
  emailRef: { fontSize: 12, color: '#5f6368', margin: '0 20px 12px', padding: '8px 12px', background: '#f8f9fa', borderRadius: 8, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' },
  label: { fontSize: 12, fontWeight: 600, color: '#5f6368', display: 'block', marginBottom: 6 },
  select: { width: '100%', border: '1px solid #dadce0', borderRadius: 8, padding: '9px 12px', fontSize: 14, outline: 'none', fontFamily: 'inherit', background: '#fff' },
  input: { width: '100%', border: '1px solid #dadce0', borderRadius: 8, padding: '9px 12px', fontSize: 14, outline: 'none', fontFamily: 'inherit' },
  textarea: { width: '100%', border: '1px solid #dadce0', borderRadius: 8, padding: '9px 12px', fontSize: 14, outline: 'none', fontFamily: 'inherit', resize: 'vertical' },
  actions: { display: 'flex', gap: 8, padding: '20px' },
  confirmBtn: { flex: 1, padding: '10px', background: '#1a73e8', color: '#fff', border: 'none', borderRadius: 8, fontSize: 14, fontWeight: 500, cursor: 'pointer', fontFamily: 'inherit' },
  cancelBtn: { padding: '10px 16px', background: 'none', border: '1px solid #dadce0', borderRadius: 8, fontSize: 14, cursor: 'pointer', fontFamily: 'inherit', color: '#5f6368' },
};

export default function PlanningPage({ isMobile: isMobileProp }) {
  const { profile } = useAuth();
  const userEmail = profile?.email;
  const userName = profile?.name;
  const isMobile = useIsMobileFallback(isMobileProp);
  // DD y FD son los únicos administradores; el módulo de correos de
  // propietarios se restringe a ellos. Se calcula acá arriba porque se usa
  // en los estados iniciales de ese módulo, más abajo.
  const inicialesPagador = PAGADO_POR[userEmail];

  // La planificación siempre muestra las tareas propias del usuario logueado
  // (no sigue el "ver como" de otros usuarios que sí tiene la página de Tareas).
  const { tasksByCategory, createTask } = useTasks();
  const allTasks = useMemo(() => Object.values(tasksByCategory).flat(), [tasksByCategory]);

  // Listas de correos en bruto (ya no un resumen en texto de Claude — cada
  // correo se muestra como un item individual con su propio botón de
  // "gestionar", análogo a las tareas).
  const [emailList, setEmailList] = useState(() => {
    if (!EMAILS_WITH_ACCESS.includes(userEmail)) return [];
    try { return JSON.parse(localStorage.getItem(STORAGE_KEY) || '[]'); } catch (e) { return []; }
  });
  const [loadingEmails, setLoadingEmails] = useState(false);
  // Mensaje de error crudo devuelto por /api/gmail-proxy (o de red), para
  // mostrarlo en la card en vez de dejarla en blanco sin explicación —
  // ej. token de Gmail vencido/no configurado para ese usuario.
  const [emailFetchError, setEmailFetchError] = useState(null);
  const [lastUpdated, setLastUpdated] = useState(() => {
    const saved = localStorage.getItem(STORAGE_DATE_KEY);
    return saved ? new Date(saved) : null;
  });

  // ── Correos de propietarios (últimos 7 días) ──────────────────
  const [ownerEmailsList, setOwnerEmailsList] = useState([]);
  const [ownerEmailList, setOwnerEmailList] = useState(() => {
    if (!inicialesPagador) return [];
    try { return JSON.parse(localStorage.getItem(STORAGE_KEY_OWNERS) || '[]'); } catch (e) { return []; }
  });
  const [loadingOwnerEmails, setLoadingOwnerEmails] = useState(false);
  // Mismo propósito que emailFetchError, para la card de correos de propietarios.
  const [ownerEmailFetchError, setOwnerEmailFetchError] = useState(null);
  const [lastUpdatedOwners, setLastUpdatedOwners] = useState(() => {
    const saved = localStorage.getItem(STORAGE_DATE_KEY_OWNERS);
    return saved ? new Date(saved) : null;
  });

  // Correos ya "gestionados" por este usuario (por ID de mensaje de Gmail,
  // no de la cadena — así un correo nuevo en la misma cadena reaparece).
  // Persistido en Supabase para que se mantenga entre sesiones/dispositivos.
  const [managedIds, setManagedIds] = useState(new Set());
  useEffect(() => {
    if (!EMAILS_WITH_ACCESS.includes(userEmail)) return;
    const loadManaged = async () => {
      const { data } = await supabase.from('planning_email_managed').select('message_id').eq('user_email', userEmail);
      setManagedIds(new Set((data || []).map(r => r.message_id)));
    };
    loadManaged();
  }, [userEmail]);

  const handleManageEmail = useCallback(async (messageId) => {
    if (!userEmail) return;
    setManagedIds(prev => new Set(prev).add(messageId)); // optimista
    const { error } = await supabase.from('planning_email_managed')
      .upsert({ user_email: userEmail, message_id: messageId }, { onConflict: 'user_email,message_id' });
    if (error) {
      console.error('Error marcando correo como gestionado:', error);
      setManagedIds(prev => { const next = new Set(prev); next.delete(messageId); return next; }); // revertir
    }
  }, [userEmail]);

  // ── Listas de tareas del usuario, para el dropdown del modal "Generar tarea" ──
  // Mismo criterio de carga/migración de nombres que TasksPage.js: se
  // combinan las categorías por defecto (is_default) con las propias del
  // usuario (user_email), y se migran los nombres viejos Entrada/Salida.
  const [taskCategories, setTaskCategories] = useState([]);
  useEffect(() => {
    if (!userEmail) return;
    const loadTaskCategories = async () => {
      const { data, error } = await supabase.from('task_categories').select('*').order('position', { ascending: true });
      if (error) { console.error('Error cargando listas de tareas:', error); return; }
      if (data && data.length > 0) {
        const filtered = data.filter(c => c.is_default || c.user_email === userEmail);
        const migrated = filtered.map(c => {
          if (c.name === 'Entrada') return { ...c, name: 'Llegada arrendatario' };
          if (c.name === 'Salida') return { ...c, name: 'Publicar/Arrendar' };
          return c;
        });
        setTaskCategories(migrated);
      } else {
        setTaskCategories(DEFAULT_TASK_CATEGORIES.map((name, i) => ({ name, position: i })));
      }
    };
    loadTaskCategories();
  }, [userEmail]);

  // Correo sobre el cual está abierto el modal de "Generar tarea" (null = cerrado)
  const [taskModalEmail, setTaskModalEmail] = useState(null);

  const handleConfirmCreateTask = useCallback(async ({ category, title, notes }) => {
    const { error } = await createTask({ title, category, notes });
    if (error) {
      console.error('Error creando tarea desde correo:', error);
      alert('No se pudo crear la tarea: ' + error.message);
      return;
    }
    setTaskModalEmail(null);
  }, [createTask]);

  // Listas visibles: se recalculan solas cada vez que cambia managedIds o
  // llega una lista nueva del servidor — así un refresh nunca vuelve a
  // mostrar un correo ya gestionado, y un mensaje nuevo en la misma cadena
  // (ID distinto) aparece sin ninguna lógica adicional.
  const visibleEmailList = useMemo(() => emailList.filter(e => !managedIds.has(e.id)), [emailList, managedIds]);
  const visibleOwnerEmailList = useMemo(() => ownerEmailList.filter(e => !managedIds.has(e.id)), [ownerEmailList, managedIds]);

  const [cxcList, setCxcList] = useState([]);
  const [cxcExpanded, setCxcExpanded] = useState(false);

  const today = new Date().toLocaleDateString('es-CL', { weekday:'long', year:'numeric', month:'long', day:'numeric' });

  const urgentTasks = useMemo(() =>
    allTasks.filter(t => t.urgent && !t.completed && !t._dormant), [allTasks]);
  const importantTasks = useMemo(() =>
    allTasks.filter(t => t.proxima_vencer && !t.urgent && !t.completed && !t._dormant), [allTasks]);

  useEffect(() => {
    if (!inicialesPagador) return;
    const fetchCxC = async () => {
      let all = [];
      let from = 0;
      while (true) {
        const { data, error } = await supabase.from('pagos').select('propiedad,descripcion,cxc,estado,fecha,pagado_por')
          .eq('pagado_por', inicialesPagador)
          .in('estado', ['P', 'PG'])
          .range(from, from + 999);
        if (error || !data || data.length === 0) break;
        all = [...all, ...data];
        if (data.length < 1000) break;
        from += 1000;
      }
      const filtered = all.filter(p => antiguedad(p.fecha) === '+ 3 meses');
      setCxcList(filtered);
    };
    fetchCxC();
  }, [inicialesPagador]);

  // Lista de correos de propietarios, tomada de la columna "Mail Prop." en
  // Cartera. Se recarga cada vez que se entra a la página, así refleja
  // altas/bajas recientes de esa columna sin necesidad de recargar la app.
  // Solo para DD/FD, y cada uno ve solo las propiedades donde él es el
  // encargado en E1 (las que no tienen E1 asignado se muestran a ambos).
  useEffect(() => {
    if (!inicialesPagador) { setOwnerEmailsList([]); return; }
    const loadOwnerEmails = async () => {
      const { data } = await supabase.from('properties').select('mail_propietario, e1').not('mail_propietario', 'is', null);
      const emails = Array.from(new Set(
        (data || [])
          .filter(p => !p.e1 || p.e1 === inicialesPagador)
          .map(p => (p.mail_propietario || '').trim())
          .filter(Boolean)
      ));
      setOwnerEmailsList(emails);
    };
    loadOwnerEmails();
  }, [inicialesPagador]);

  const fetchEmails = useCallback(async () => {
    if (!EMAILS_WITH_ACCESS.includes(userEmail)) return;
    setLoadingEmails(true);
    setEmailFetchError(null);
    try {
      const response = await fetch('/api/gmail-proxy', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ userEmail }),
      });
      const data = await response.json();
      // gmail-proxy responde 200 con emails:[] tanto cuando no hay correos
      // nuevos como cuando falla (token no configurado/vencido, etc.) — sin
      // esto, ambos casos se veían igual de "en blanco" en la UI.
      if (data.error) {
        console.error('Error de gmail-proxy (recientes) para', userEmail, ':', data.error, data.detail || '');
        setEmailFetchError(data.error);
      }
      const emails = data.emails || [];
      setEmailList(emails);
      const now = new Date();
      setLastUpdated(now);
      localStorage.setItem(STORAGE_KEY, JSON.stringify(emails));
      localStorage.setItem(STORAGE_DATE_KEY, now.toISOString());
    } catch(e) {
      console.error('Error al obtener correos:', e);
      setEmailFetchError(e.message);
    }
    setLoadingEmails(false);
  }, [userEmail]);

  // Correos de propietarios: mismo patrón que fetchEmails, pero con
  // mode:'owners' y la lista de correos de Mail Prop. — 7 días en vez de 24h.
  const fetchOwnerEmails = useCallback(async () => {
    if (!inicialesPagador) return;
    setLoadingOwnerEmails(true);
    setOwnerEmailFetchError(null);
    try {
      const response = await fetch('/api/gmail-proxy', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ userEmail, mode: 'owners', ownerEmails: ownerEmailsList }),
      });
      const data = await response.json();
      if (data.error) {
        console.error('Error de gmail-proxy (propietarios) para', userEmail, ':', data.error, data.detail || '');
        setOwnerEmailFetchError(data.error);
      }
      const emails = data.emails || [];
      setOwnerEmailList(emails);
      const now = new Date();
      setLastUpdatedOwners(now);
      localStorage.setItem(STORAGE_KEY_OWNERS, JSON.stringify(emails));
      localStorage.setItem(STORAGE_DATE_KEY_OWNERS, now.toISOString());
    } catch(e) {
      console.error('Error al obtener correos de propietarios:', e);
      setOwnerEmailFetchError(e.message);
    }
    setLoadingOwnerEmails(false);
  }, [userEmail, inicialesPagador, ownerEmailsList]);

  // Auto-actualización a las 08:00 y 11:59 — ambos módulos de correos se
  // refrescan en el mismo momento.
  const lastAutoFetch = useRef({ '08:00': null, '11:59': null });
  useEffect(() => {
    if (!EMAILS_WITH_ACCESS.includes(userEmail)) return;
    const checkAutoFetch = () => {
      const now = new Date();
      const hhmm = `${String(now.getHours()).padStart(2,'0')}:${String(now.getMinutes()).padStart(2,'0')}`;
      const todayStr = now.toDateString();
      if ((hhmm === '08:00' || hhmm === '11:59') && lastAutoFetch.current[hhmm] !== todayStr) {
        lastAutoFetch.current[hhmm] = todayStr;
        fetchEmails();
        fetchOwnerEmails();
      }
    };
    const interval = setInterval(checkAutoFetch, 30000);
    return () => clearInterval(interval);
  }, [userEmail, fetchEmails, fetchOwnerEmails]);

  const TaskItem = ({ task, color }) => (
    <div style={{ display:'flex', alignItems:'center', gap:10, padding:'10px 0', borderBottom:'1px solid #f1f3f4' }}>
      <div style={{ width:8, height:8, borderRadius:'50%', background:color, flexShrink:0 }} />
      <div style={{ flex:1, display:'flex', justifyContent:'space-between', alignItems:'center', gap:8 }}>
        <div style={{ fontSize:13, fontWeight:600, color:'#202124' }}>{task.title}</div>
        <div style={{ fontSize:11, color:'#9aa0a6', whiteSpace:'nowrap', flexShrink:0 }}>
          {task.category}
          {task.due_date && ` · ${new Date(task.due_date+'T12:00:00').toLocaleDateString('es-CL')}`}
        </div>
      </div>
    </div>
  );

  // Fila de correo individual — análoga a TaskItem, con botón para marcar
  // como "gestionado" (desaparece de la lista al tocarlo) y otro para
  // generar una tarea a partir del correo (abre CreateTaskModal).
  const EmailRow = ({ email, color, onManage, onCreateTask }) => {
    const [managing, setManaging] = useState(false);
    const handleClick = async () => {
      setManaging(true);
      await onManage(email.id);
    };
    const dateLabel = email.date ? new Date(email.date).toLocaleDateString('es-CL', { day:'2-digit', month:'2-digit' }) : '';
    return (
      <div style={{ display:'flex', alignItems:'flex-start', gap:10, padding:'10px 0', borderBottom:'1px solid #f1f3f4', opacity: managing ? 0.4 : 1, transition:'opacity 0.15s' }}>
        <button onClick={handleClick} disabled={managing} title="Marcar como gestionado"
          style={{ width:18, height:18, borderRadius:'50%', border:`2px solid ${color}`, background:'none', cursor: managing ? 'default' : 'pointer', flexShrink:0, marginTop:2, padding:0, display:'flex', alignItems:'center', justifyContent:'center' }}>
          {managing && <Check size={11} color={color} />}
        </button>
        <div style={{ flex:1, minWidth:0 }}>
          <div style={{ display:'flex', justifyContent:'space-between', alignItems:'baseline', gap:8 }}>
            <span style={{ fontSize:13, fontWeight:600, color:'#202124', overflow:'hidden', textOverflow:'ellipsis', whiteSpace:'nowrap' }}>{email.from}</span>
            {dateLabel && <span style={{ fontSize:11, color:'#9aa0a6', flexShrink:0 }}>{dateLabel}</span>}
          </div>
          <a href={`https://mail.google.com/mail/u/0/#all/${email.threadId || email.id}`}
            target="_blank" rel="noopener noreferrer" className="email-subject-link"
            style={{ display:'block', fontSize:12, fontWeight:500, color:'#1a73e8', marginTop:2, overflow:'hidden', textOverflow:'ellipsis', whiteSpace:'nowrap', textDecoration:'none' }}>
            {email.subject}
          </a>
          <div style={{ fontSize:12, color:'#5f6368', marginTop:2, overflow:'hidden', textOverflow:'ellipsis', display:'-webkit-box', WebkitLineClamp:2, WebkitBoxOrient:'vertical' }}>{email.summary || email.snippet}</div>
        </div>
        <button onClick={() => onCreateTask(email)} disabled={managing} title="Generar tarea"
          style={{ background:'none', border:'none', cursor: managing ? 'default' : 'pointer', padding:3, borderRadius:6, flexShrink:0, marginTop:1, display:'flex', alignItems:'center', color, opacity: managing ? 0.4 : 1 }}>
          <ListPlus size={16} />
        </button>
      </div>
    );
  };

  const firstName = userName ? userName.split(' ')[0] : '';
  const visibleCxC = cxcExpanded ? cxcList : cxcList.slice(0, 9);
  const totalCxC = cxcList.reduce((s, p) => s + (p.cxc || 0), 0);

  // Layout especial de 2 columnas (33% / 67%), solo para DD/FD en desktop:
  // izquierda = Urgentes → Importante → CxC, derecha (más ancha) =
  // Propietarios (7d) → Últimas 72h. Para todos los demás casos (EA/FG, o
  // cualquiera en móvil) se mantiene el grid/columna simple de siempre.
  const useSplitLayout = !!inicialesPagador && !isMobile;

  // Grid: 1 columna en móvil, 3 en desktop (para EA/FG o layout no-split)
  const gridStyle = isMobile
    ? { display: 'flex', flexDirection: 'column', gap: 12 }
    : { display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 16, alignItems: 'start' };

  // ── Cards individuales (se arman una sola vez y se ubican distinto según el layout) ──
  const urgentesCard = (
    <div style={styles.card}>
      <div style={styles.cardHeader}>
        <AlertCircle size={16} color="#ea4335" />
        <span style={{ ...styles.cardTitle, color:'#ea4335' }}>Urgentes</span>
        <span style={styles.badge}>{urgentTasks.length}</span>
      </div>
      <div style={styles.cardBody}>
        {urgentTasks.length === 0
          ? <p style={styles.empty}>Sin tareas urgentes ✓</p>
          : urgentTasks.map(t => <TaskItem key={t.id} task={t} color="#ea4335" />)
        }
      </div>
    </div>
  );

  const importanteCard = (
    <div style={styles.card}>
      <div style={styles.cardHeader}>
        <Clock size={16} color="#f57c00" />
        <span style={{ ...styles.cardTitle, color:'#f57c00' }}>Importante / Por vencer</span>
        <span style={{ ...styles.badge, background:'#fff3e0', color:'#f57c00' }}>{importantTasks.length}</span>
      </div>
      <div style={styles.cardBody}>
        {importantTasks.length === 0
          ? <p style={styles.empty}>Sin tareas importantes por vencer ✓</p>
          : importantTasks.map(t => <TaskItem key={t.id} task={t} color="#f57c00" />)
        }
      </div>
    </div>
  );

  const cxcCard = inicialesPagador && (
    <div style={styles.card}>
      <div style={styles.cardHeader}>
        <DollarSign size={16} color="#ea4335" />
        <span style={{ ...styles.cardTitle, color:'#ea4335' }}>CxC +3 meses</span>
        <span style={{ ...styles.badge, background:'#fce8e6', color:'#ea4335' }}>{cxcList.length}</span>
        {totalCxC > 0 && (
          <span style={{ marginLeft:'auto', fontSize:12, fontWeight:700, color:'#ea4335' }}>{formatCLP(totalCxC)}</span>
        )}
      </div>
      <div style={styles.cardBody}>
        {cxcList.length === 0
          ? <p style={styles.empty}>Sin CxC antiguas ✓</p>
          : <>
              <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr auto', gap:'4px 8px', marginBottom:4 }}>
                <span style={{ fontSize:10, fontWeight:700, color:'#9aa0a6', textTransform:'uppercase' }}>Propiedad</span>
                <span style={{ fontSize:10, fontWeight:700, color:'#9aa0a6', textTransform:'uppercase' }}>Descripción</span>
                <span style={{ fontSize:10, fontWeight:700, color:'#9aa0a6', textTransform:'uppercase', textAlign:'right' }}>CxC</span>
              </div>
              {visibleCxC.map((p, i) => (
                <div key={i} style={{ display:'grid', gridTemplateColumns:'1fr 1fr auto', gap:'4px 8px', padding:'7px 0', borderBottom:'1px solid #f1f3f4', alignItems:'center' }}>
                  <span style={{ fontSize:12, fontWeight:600, color:'#202124', overflow:'hidden', textOverflow:'ellipsis', whiteSpace:'nowrap' }}>{p.propiedad}</span>
                  <span style={{ fontSize:12, color:'#5f6368', overflow:'hidden', textOverflow:'ellipsis', whiteSpace:'nowrap' }}>{p.descripcion}</span>
                  <span style={{ fontSize:12, fontWeight:600, color:'#ea4335', whiteSpace:'nowrap', textAlign:'right' }}>{formatCLP(p.cxc)}</span>
                </div>
              ))}
              {cxcList.length > 9 && (
                <button onClick={() => setCxcExpanded(e => !e)}
                  style={{ display:'flex', alignItems:'center', gap:4, marginTop:8, marginBottom:4, background:'none', border:'none', cursor:'pointer', fontSize:12, color:'#1a73e8', fontFamily:'inherit', padding:'4px 0' }}>
                  <ChevronDown size={14} style={{ transform: cxcExpanded ? 'rotate(180deg)' : 'none', transition:'transform 0.2s' }} />
                  {cxcExpanded ? 'Ver menos' : `Ver ${cxcList.length - 9} más`}
                </button>
              )}
            </>
        }
      </div>
    </div>
  );

  // gridColumn:'1 / -1' solo tiene sentido dentro del grid de 3 columnas
  // (gridStyle); en el layout de 2 columnas cada card ya es un hijo directo
  // de su propia columna en flex, así que ese estilo se omite ahí.
  const ownerEmailsCard = inicialesPagador && (
    <div style={{ ...styles.card, ...(useSplitLayout || isMobile ? {} : { gridColumn: '1 / -1' }) }}>
      <div style={styles.cardHeader}>
        <Mail size={16} color="#2e7d32" />
        <span style={{ ...styles.cardTitle, color:'#2e7d32' }}>Correos de propietarios (últimos 7 días)</span>
        <span style={{ ...styles.badge, background:'#e6f4ea', color:'#2e7d32' }}>{visibleOwnerEmailList.length}</span>
        {lastUpdatedOwners && (
          <span style={styles.lastUpdated}>
            Actualizado: {lastUpdatedOwners.toLocaleTimeString('es-CL', { hour:'2-digit', minute:'2-digit' })}
          </span>
        )}
        <button onClick={fetchOwnerEmails} disabled={loadingOwnerEmails}
          style={{ marginLeft:'auto', display:'flex', alignItems:'center', gap:5, padding:'5px 12px', background:'#e6f4ea', color:'#2e7d32', border:'none', borderRadius:6, fontSize:12, cursor:'pointer', fontFamily:'inherit', fontWeight:500 }}>
          <RefreshCw size={12} style={{ animation: loadingOwnerEmails ? 'spin 1s linear infinite' : 'none' }} />
          {loadingOwnerEmails ? 'Cargando...' : 'Actualizar'}
        </button>
      </div>
      <div style={styles.cardBody}>
        {ownerEmailFetchError && !loadingOwnerEmails && (
          <p style={{ ...styles.empty, color: '#ea4335' }}>⚠ Error al consultar el correo: {ownerEmailFetchError}</p>
        )}
        {visibleOwnerEmailList.length === 0 && !loadingOwnerEmails && !ownerEmailFetchError && (
          <p style={styles.empty}>
            {ownerEmailList.length === 0
              ? 'Presiona "Actualizar" para ver los correos recientes de propietarios.'
              : 'Sin correos de propietarios pendientes ✓'}
          </p>
        )}
        {loadingOwnerEmails && (
          <div style={{ display:'flex', alignItems:'center', gap:10, color:'#5f6368', fontSize:13 }}>
            <RefreshCw size={14} style={{ animation:'spin 1s linear infinite' }} />
            Consultando bandeja de entrada...
          </div>
        )}
        {!loadingOwnerEmails && visibleOwnerEmailList.map(email => (
          <EmailRow key={email.id} email={email} color="#2e7d32" onManage={handleManageEmail} onCreateTask={setTaskModalEmail} />
        ))}
      </div>
    </div>
  );

  const recentEmailsCard = EMAILS_WITH_ACCESS.includes(userEmail) && (
    <div style={{ ...styles.card, ...(useSplitLayout || isMobile ? {} : { gridColumn: '1 / -1' }) }}>
      <div style={styles.cardHeader}>
        <Mail size={16} color="#1a73e8" />
        <span style={{ ...styles.cardTitle, color:'#1a73e8' }}>Correos últimas 72 horas</span>
        <span style={{ ...styles.badge, background:'#e8f0fe', color:'#1a73e8' }}>{visibleEmailList.length}</span>
        {lastUpdated && (
          <span style={styles.lastUpdated}>
            Actualizado: {lastUpdated.toLocaleTimeString('es-CL', { hour:'2-digit', minute:'2-digit' })}
          </span>
        )}
        <button onClick={fetchEmails} disabled={loadingEmails}
          style={{ marginLeft:'auto', display:'flex', alignItems:'center', gap:5, padding:'5px 12px', background:'#e8f0fe', color:'#1a73e8', border:'none', borderRadius:6, fontSize:12, cursor:'pointer', fontFamily:'inherit', fontWeight:500 }}>
          <RefreshCw size={12} style={{ animation: loadingEmails ? 'spin 1s linear infinite' : 'none' }} />
          {loadingEmails ? 'Cargando...' : 'Actualizar'}
        </button>
      </div>
      <div style={styles.cardBody}>
        {emailFetchError && !loadingEmails && (
          <p style={{ ...styles.empty, color: '#ea4335' }}>⚠ Error al consultar el correo: {emailFetchError}</p>
        )}
        {visibleEmailList.length === 0 && !loadingEmails && !emailFetchError && (
          <p style={styles.empty}>
            {emailList.length === 0
              ? 'Presiona "Actualizar" para ver los correos recientes.'
              : 'Sin correos pendientes ✓'}
          </p>
        )}
        {loadingEmails && (
          <div style={{ display:'flex', alignItems:'center', gap:10, color:'#5f6368', fontSize:13 }}>
            <RefreshCw size={14} style={{ animation:'spin 1s linear infinite' }} />
            Consultando bandeja de entrada...
          </div>
        )}
        {!loadingEmails && visibleEmailList.map(email => (
          <EmailRow key={email.id} email={email} color="#1a73e8" onManage={handleManageEmail} onCreateTask={setTaskModalEmail} />
        ))}
      </div>
    </div>
  );

  return (
    <div style={styles.container}>
      <div style={{ ...styles.pageCard, padding: isMobile ? '14px 12px' : '20px 20px 16px' }}>
        {firstName && (
          <div style={{ ...styles.greeting, fontSize: isMobile ? 20 : 25 }}>
            ¡Hola {firstName}! Para el día de hoy tienes:
          </div>
        )}
        <div style={styles.dateHeader}>
          <span style={styles.dateText}>{today.charAt(0).toUpperCase() + today.slice(1)}</span>
        </div>

        {useSplitLayout ? (
          // 33% tareas / 67% correos (antes 50/50)
          <div style={{ display:'grid', gridTemplateColumns:'1fr 2fr', gap:16, alignItems:'start' }}>
            <div style={{ display:'flex', flexDirection:'column', gap:16 }}>
              {urgentesCard}
              {importanteCard}
              {cxcCard}
            </div>
            <div style={{ display:'flex', flexDirection:'column', gap:16 }}>
              {ownerEmailsCard}
              {recentEmailsCard}
            </div>
          </div>
        ) : (
          <div style={gridStyle}>
            {urgentesCard}
            {importanteCard}
            {cxcCard}
            {ownerEmailsCard}
            {recentEmailsCard}
          </div>
        )}

        <style>{`
          @keyframes spin { from { transform: rotate(0deg); } to { transform: rotate(360deg); } }
          .email-subject-link:hover { text-decoration: underline; }
        `}</style>
      </div>

      {taskModalEmail && (
        <CreateTaskModal
          email={taskModalEmail}
          categories={taskCategories}
          onCancel={() => setTaskModalEmail(null)}
          onConfirm={handleConfirmCreateTask}
        />
      )}
    </div>
  );
}

const styles = {
  container: { height:'100%', overflow:'auto', fontFamily:"'Google Sans','Segoe UI',sans-serif", padding:'4px 0' },
  pageCard: { background:'#f8f9fa', borderRadius:12 },
  greeting: { fontWeight:700, color:'#202124', marginBottom:25 },
  dateHeader: { marginBottom:20 },
  dateText: { fontSize:14, color:'#5f6368', fontWeight:500 },
  card: { background:'#fff', border:'1px solid #e8eaed', borderRadius:12, overflow:'hidden' },
  cardHeader: { display:'flex', alignItems:'center', gap:8, padding:'12px 16px', borderBottom:'1px solid #f1f3f4', background:'#fff' },
  cardTitle: { fontSize:13, fontWeight:700 },
  badge: { fontSize:11, fontWeight:700, background:'#fce8e6', color:'#ea4335', borderRadius:20, padding:'2px 8px' },
  cardBody: { padding:'4px 16px 16px', overflowY:'auto', maxHeight:360 },
  empty: { fontSize:13, color:'#9aa0a6', padding:'12px 0', margin:0 },
  lastUpdated: { fontSize:11, color:'#9aa0a6', marginLeft:4 },
};
