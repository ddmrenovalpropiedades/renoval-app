import { useState, useMemo } from 'react';
import { RefreshCw, Mail, AlertCircle, Clock } from 'lucide-react';

const DIEGO_EMAIL = 'ddm@renovalpropiedades.com';

export default function PlanningPage({ allTasks, userEmail, userName }) {
  const [emailSummary, setEmailSummary] = useState('');
  const [loadingEmails, setLoadingEmails] = useState(false);
  const [lastUpdated, setLastUpdated] = useState(null);

  const today = new Date().toLocaleDateString('es-CL', { weekday:'long', year:'numeric', month:'long', day:'numeric' });

  const urgentTasks = useMemo(() =>
    allTasks.filter(t => t.urgent && !t.completed && !t._dormant), [allTasks]);
  const importantTasks = useMemo(() =>
    allTasks.filter(t => t.proxima_vencer && !t.urgent && !t.completed && !t._dormant), [allTasks]);

  const fetchEmails = async () => {
    if (userEmail !== DIEGO_EMAIL) return;
    setLoadingEmails(true);
    try {
      const response = await fetch('/api/gmail-proxy', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({}),
      });
      const data = await response.json();
      if (data.error) {
        setEmailSummary('Error: ' + data.error);
      } else {
        setEmailSummary(data.summary);
      }
      setLastUpdated(new Date());
    } catch(e) {
      setEmailSummary('Error al obtener correos: ' + e.message);
    }
    setLoadingEmails(false);
  };

  const TaskItem = ({ task, color }) => (
    <div style={{ display:'flex', alignItems:'flex-start', gap:10, padding:'10px 0', borderBottom:'1px solid #f1f3f4' }}>
      <div style={{ width:8, height:8, borderRadius:'50%', background:color, marginTop:5, flexShrink:0 }} />
      <div style={{ flex:1 }}>
        <div style={{ fontSize:13, fontWeight:600, color:'#202124' }}>{task.title}</div>
        <div style={{ fontSize:11, color:'#9aa0a6', marginTop:2 }}>
          {task.category}
          {task.due_date && ` · Vence: ${new Date(task.due_date+'T12:00:00').toLocaleDateString('es-CL')}`}
        </div>
      </div>
    </div>
  );

  const firstName = userName ? userName.split(' ')[0] : '';

  return (
    <div style={styles.container}>
      <div style={styles.card}>
      {firstName && (
        <div style={styles.greeting}>
          ¡Hola {firstName}!, para el día de hoy tienes:
        </div>
      )}
      <div style={styles.dateHeader}>
        <span style={styles.dateText}>{today.charAt(0).toUpperCase() + today.slice(1)}</span>
      </div>

      <div style={styles.grid}>
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

        {/* Correos */}
        {userEmail === DIEGO_EMAIL && (
          <div style={{ ...styles.card, gridColumn: '1 / -1' }}>
            <div style={styles.cardHeader}>
              <Mail size={16} color="#1a73e8" />
              <span style={{ ...styles.cardTitle, color:'#1a73e8' }}>Correos últimas 24 horas</span>
              {lastUpdated && <span style={styles.lastUpdated}>Actualizado: {lastUpdated.toLocaleTimeString('es-CL', { hour:'2-digit', minute:'2-digit' })}</span>}
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
  card: { background:'#fff', borderRadius:12, border:'1px solid #e8eaed', padding:'20px 20px 16px' },
  greeting: { fontSize:25, fontWeight:700, color:'#202124', marginBottom:25 },
  dateHeader: { marginBottom:20 },
  dateText: { fontSize:14, color:'#5f6368', fontWeight:500 },
  grid: { display:'grid', gridTemplateColumns:'1fr 1fr', gap:16 },
  card: { background:'#fff', border:'1px solid #e8eaed', borderRadius:12, overflow:'hidden' },
  cardHeader: { display:'flex', alignItems:'center', gap:8, padding:'12px 16px', borderBottom:'1px solid #f1f3f4', background:'#fafafa' },
  cardTitle: { fontSize:13, fontWeight:700 },
  badge: { fontSize:11, fontWeight:700, background:'#fce8e6', color:'#ea4335', borderRadius:20, padding:'2px 8px' },
  cardBody: { padding:'4px 16px 12px', maxHeight:320, overflowY:'auto' },
  empty: { fontSize:13, color:'#9aa0a6', padding:'12px 0', margin:0 },
  lastUpdated: { fontSize:11, color:'#9aa0a6', marginLeft:4 },
};
