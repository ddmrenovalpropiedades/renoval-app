import { useState, useMemo, useEffect, useRef, useCallback } from 'react';
import { RefreshCw, Mail, AlertCircle, Clock, DollarSign, ChevronDown } from 'lucide-react';
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
  const { tasksByCategory } = useTasks();
  const allTasks = useMemo(() => Object.values(tasksByCategory).flat(), [tasksByCategory]);

  const [emailSummary, setEmailSummary] = useState(() => {
    if (!EMAILS_WITH_ACCESS.includes(userEmail)) return '';
    return localStorage.getItem(STORAGE_KEY) || '';
  });
  const [loadingEmails, setLoadingEmails] = useState(false);
  const [lastUpdated, setLastUpdated] = useState(() => {
    const saved = localStorage.getItem(STORAGE_DATE_KEY);
    return saved ? new Date(saved) : null;
  });

  // ── Correos de propietarios (últimos 7 días) ──────────────────
  const [ownerEmailsList, setOwnerEmailsList] = useState([]);
  const [ownerEmailSummary, setOwnerEmailSummary] = useState(() => {
    if (!inicialesPagador) return '';
    return localStorage.getItem(STORAGE_KEY_OWNERS) || '';
  });
  const [loadingOwnerEmails, setLoadingOwnerEmails] = useState(false);
  const [lastUpdatedOwners, setLastUpdatedOwners] = useState(() => {
    const saved = localStorage.getItem(STORAGE_DATE_KEY_OWNERS);
    return saved ? new Date(saved) : null;
  });

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
    try {
      const response = await fetch('/api/gmail-proxy', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ userEmail }),
      });
      const data = await response.json();
      const summary = data.error ? 'Error: ' + data.error : data.summary;
      setEmailSummary(summary);
      const now = new Date();
      setLastUpdated(now);
      localStorage.setItem(STORAGE_KEY, summary);
      localStorage.setItem(STORAGE_DATE_KEY, now.toISOString());
    } catch(e) {
      setEmailSummary('Error al obtener correos: ' + e.message);
    }
    setLoadingEmails(false);
  }, [userEmail]);

  // Correos de propietarios: mismo patrón que fetchEmails, pero con
  // mode:'owners' y la lista de correos de Mail Prop. — 7 días en vez de 24h.
  const fetchOwnerEmails = useCallback(async () => {
    if (!inicialesPagador) return;
    setLoadingOwnerEmails(true);
    try {
      const response = await fetch('/api/gmail-proxy', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ userEmail, mode: 'owners', ownerEmails: ownerEmailsList }),
      });
      const data = await response.json();
      const summary = data.error ? 'Error: ' + data.error : data.summary;
      setOwnerEmailSummary(summary);
      const now = new Date();
      setLastUpdatedOwners(now);
      localStorage.setItem(STORAGE_KEY_OWNERS, summary);
      localStorage.setItem(STORAGE_DATE_KEY_OWNERS, now.toISOString());
    } catch(e) {
      setOwnerEmailSummary('Error al obtener correos: ' + e.message);
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

  const firstName = userName ? userName.split(' ')[0] : '';
  const visibleCxC = cxcExpanded ? cxcList : cxcList.slice(0, 9);
  const totalCxC = cxcList.reduce((s, p) => s + (p.cxc || 0), 0);

  // Grid: 1 columna en móvil, 3 en desktop
  const gridStyle = isMobile
    ? { display: 'flex', flexDirection: 'column', gap: 12 }
    : { display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 16, alignItems: 'start' };

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

        <div style={gridStyle}>
          {/* Urgentes */}
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

          {/* Importante/por vencer */}
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

          {/* CxC antiguas — solo DD y FD */}
          {inicialesPagador && (
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
          )}

          {/* Correos de propietarios — últimos 7 días (Mail Prop. en Cartera). Solo DD/FD. */}
          {inicialesPagador && (
            <div style={{ ...styles.card, ...(isMobile ? {} : { gridColumn: '1 / -1' }) }}>
              <div style={styles.cardHeader}>
                <Mail size={16} color="#2e7d32" />
                <span style={{ ...styles.cardTitle, color:'#2e7d32' }}>Correos de propietarios (últimos 7 días)</span>
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
                {!ownerEmailSummary && !loadingOwnerEmails && (
                  <p style={styles.empty}>Presiona "Actualizar" para ver los correos recientes de propietarios.</p>
                )}
                {loadingOwnerEmails && (
                  <div style={{ display:'flex', alignItems:'center', gap:10, color:'#5f6368', fontSize:13 }}>
                    <RefreshCw size={14} style={{ animation:'spin 1s linear infinite' }} />
                    Consultando bandeja de entrada...
                  </div>
                )}
                {ownerEmailSummary && !loadingOwnerEmails && (
                  <div style={{ fontSize:13, lineHeight:1.7, color:'#3c4043', whiteSpace:'pre-wrap' }}>
                    {ownerEmailSummary}
                  </div>
                )}
              </div>
            </div>
          )}

          {/* Correos últimas 24 horas */}
          {EMAILS_WITH_ACCESS.includes(userEmail) && (
            <div style={{ ...styles.card, ...(isMobile ? {} : { gridColumn: '1 / -1' }) }}>
              <div style={styles.cardHeader}>
                <Mail size={16} color="#1a73e8" />
                <span style={{ ...styles.cardTitle, color:'#1a73e8' }}>Correos últimas 24 horas</span>
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
                {!emailSummary && !loadingEmails && (
                  <p style={styles.empty}>Presiona "Actualizar" para ver los correos recientes.</p>
                )}
                {loadingEmails && (
                  <div style={{ display:'flex', alignItems:'center', gap:10, color:'#5f6368', fontSize:13 }}>
                    <RefreshCw size={14} style={{ animation:'spin 1s linear infinite' }} />
                    Consultando bandeja de entrada...
                  </div>
                )}
                {emailSummary && !loadingEmails && (
                  <div style={{ fontSize:13, lineHeight:1.7, color:'#3c4043', whiteSpace:'pre-wrap' }}>
                    {emailSummary}
                  </div>
                )}
              </div>
            </div>
          )}
        </div>

        <style>{`@keyframes spin { from { transform: rotate(0deg); } to { transform: rotate(360deg); } }`}</style>
      </div>
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
