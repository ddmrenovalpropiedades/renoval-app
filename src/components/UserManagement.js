import React, { useEffect, useState, useCallback } from 'react';
import { supabase, getUserRole, getUserInitials } from '../supabaseClient';
import { useAuth } from '../context/AuthContext';
import {
  Shield, User, Ban, CheckCircle, RefreshCw,
  ChevronRight, X, Plus, Trash2, Briefcase,
  Umbrella, AlertCircle
} from 'lucide-react';

// ── Helpers ───────────────────────────────────────────────────
const fmt = (iso) => {
  if (!iso) return '—';
  const [y, m, d] = iso.split('-');
  return `${d}/${m}/${y}`;
};

const ENCARGADO_COLORS = {
  DD: '#1565C0', FD: '#2E7D32', EA: '#6A1B9A', FG: '#E65100',
};

const CONTRATO_OPTIONS = ['Indefinido', 'Plazo fijo', 'Honorarios'];

// Años completos desde fecha_inicio hasta hoy
const aniosCompletos = (fechaInicio) => {
  if (!fechaInicio) return 0;
  const inicio = new Date(fechaInicio + 'T12:00:00');
  const hoy = new Date();
  let years = hoy.getFullYear() - inicio.getFullYear();
  const m = hoy.getMonth() - inicio.getMonth();
  if (m < 0 || (m === 0 && hoy.getDate() < inicio.getDate())) years--;
  return Math.max(0, years);
};

// ── DatePicker (mismo patrón del resto de la app) ─────────────
function DatePicker({ value, onChange, style = {} }) {
  const ref = React.useRef(null);
  const fmt2 = (iso) => {
    if (!iso) return '';
    const [y, m, d] = iso.split('-');
    return `${d}/${m}/${y}`;
  };
  return (
    <div onClick={() => { try { ref.current?.showPicker(); } catch(e) { ref.current?.click(); } }}
      style={{ display: 'inline-flex', alignItems: 'center', cursor: 'pointer', border: '1px solid #dadce0', borderRadius: 6, padding: '5px 10px', background: '#fff', ...style }}>
      <span style={{ fontSize: 13, color: value ? '#202124' : '#9aa0a6', userSelect: 'none', whiteSpace: 'nowrap' }}>
        {value ? fmt2(value) : 'dd/mm/aaaa'}
      </span>
      <input ref={ref} type="date" value={value || ''} onChange={e => onChange(e.target.value)}
        style={{ position: 'absolute', opacity: 0, pointerEvents: 'none', width: 0, height: 0 }} />
    </div>
  );
}

// ── Sección colapsable ────────────────────────────────────────
function Section({ icon: Icon, title, color, children, defaultOpen = false }) {
  const [open, setOpen] = useState(defaultOpen);
  return (
    <div style={{ marginBottom: 12 }}>
      <button onClick={() => setOpen(o => !o)}
        style={{ display: 'flex', alignItems: 'center', gap: 8, width: '100%', background: 'none', border: 'none', cursor: 'pointer', padding: '8px 0', borderBottom: `2px solid ${color}20` }}>
        <Icon size={15} color={color} />
        <span style={{ fontSize: 13, fontWeight: 700, color: '#202124', letterSpacing: 0.3, textTransform: 'uppercase', flex: 1, textAlign: 'left' }}>{title}</span>
        <ChevronRight size={14} color="#9aa0a6" style={{ transform: open ? 'rotate(90deg)' : 'none', transition: 'transform 0.15s' }} />
      </button>
      {open && <div style={{ paddingTop: 12 }}>{children}</div>}
    </div>
  );
}

// ── Panel trabajador ──────────────────────────────────────────
function WorkerPanel({ user, onClose }) {
  const email = user.email;
  const initials = getUserInitials(email);
  const color = ENCARGADO_COLORS[initials] || '#5f6368';

  const [worker, setWorker] = useState(null);
  const [vacaciones, setVacaciones] = useState([]);
  const [licencias, setLicencias] = useState([]);
  const [saving, setSaving] = useState(false);

  // Formularios
  const [wForm, setWForm] = useState({ fecha_inicio: '', tipo_contrato: '', fecha_vencimiento_contrato: '', notas: '' });
  const [newVac, setNewVac] = useState({ fecha_inicio: '', fecha_fin: '', dias_habiles: '', anio: new Date().getFullYear(), notas: '' });
  const [newLic, setNewLic] = useState({ fecha_inicio: '', fecha_fin: '', dias: '', notas: '' });
  const [addingVac, setAddingVac] = useState(false);
  const [addingLic, setAddingLic] = useState(false);

  const load = useCallback(async () => {
    const [{ data: w }, { data: v }, { data: l }] = await Promise.all([
      supabase.from('workers').select('*').eq('user_email', email).maybeSingle(),
      supabase.from('worker_vacaciones').select('*').eq('worker_email', email).order('fecha_inicio', { ascending: false }),
      supabase.from('worker_licencias').select('*').eq('worker_email', email).order('fecha_inicio', { ascending: false }),
    ]);
    setWorker(w);
    setWForm({
      fecha_inicio: w?.fecha_inicio || '',
      tipo_contrato: w?.tipo_contrato || '',
      fecha_vencimiento_contrato: w?.fecha_vencimiento_contrato || '',
      notas: w?.notas || '',
    });
    setVacaciones(v || []);
    setLicencias(l || []);
  }, [email]);

  useEffect(() => { load(); }, [load]);

  const saveWorker = async () => {
    setSaving(true);
    if (worker) {
      await supabase.from('workers').update(wForm).eq('user_email', email);
    } else {
      await supabase.from('workers').insert({ user_email: email, ...wForm });
    }
    await load();
    setSaving(false);
  };

  const saveVac = async () => {
    if (!newVac.fecha_inicio || !newVac.fecha_fin || !newVac.dias_habiles) return;
    await supabase.from('worker_vacaciones').insert({ worker_email: email, ...newVac, dias_habiles: parseInt(newVac.dias_habiles) });
    setNewVac({ fecha_inicio: '', fecha_fin: '', dias_habiles: '', anio: new Date().getFullYear(), notas: '' });
    setAddingVac(false);
    await load();
  };

  const deleteVac = async (id) => {
    await supabase.from('worker_vacaciones').delete().eq('id', id);
    await load();
  };

  const saveLic = async () => {
    if (!newLic.fecha_inicio || !newLic.fecha_fin || !newLic.dias) return;
    await supabase.from('worker_licencias').insert({ worker_email: email, ...newLic, dias: parseInt(newLic.dias) });
    setNewLic({ fecha_inicio: '', fecha_fin: '', dias: '', notas: '' });
    setAddingLic(false);
    await load();
  };

  const deleteLic = async (id) => {
    await supabase.from('worker_licencias').delete().eq('id', id);
    await load();
  };

  // Cálculo vacaciones
  const years = aniosCompletos(wForm.fecha_inicio);
  const diasTotalesGanados = years * 15;
  const diasTomados = vacaciones.reduce((s, v) => s + (v.dias_habiles || 0), 0);
  const diasDisponibles = diasTotalesGanados - diasTomados;

  const inputStyle = { border: '1px solid #dadce0', borderRadius: 6, padding: '6px 10px', fontSize: 13, outline: 'none', fontFamily: 'inherit', width: '100%', boxSizing: 'border-box' };
  const smallInput = { ...inputStyle, padding: '5px 8px', fontSize: 12 };
  const labelStyle = { fontSize: 11, fontWeight: 600, color: '#5f6368', textTransform: 'uppercase', letterSpacing: 0.3, display: 'block', marginBottom: 4 };
  const fieldStyle = { marginBottom: 12 };

  return (
    <div style={{ position: 'fixed', inset: 0, zIndex: 2000, display: 'flex' }} onClick={e => e.target === e.currentTarget && onClose()}>
      {/* Backdrop */}
      <div style={{ flex: 1, background: 'rgba(0,0,0,0.3)' }} onClick={onClose} />
      {/* Panel */}
      <div style={{ width: 440, background: '#f8f9fa', display: 'flex', flexDirection: 'column', boxShadow: '-4px 0 24px rgba(0,0,0,0.15)', overflowY: 'auto', fontFamily: "'Google Sans','Segoe UI',sans-serif" }}>

        {/* Header */}
        <div style={{ background: '#fff', padding: '20px 24px', borderBottom: '1px solid #e8eaed', flexShrink: 0 }}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 12 }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
              <div style={{ width: 44, height: 44, borderRadius: '50%', background: color, color: '#fff', fontSize: 16, fontWeight: 700, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>{initials}</div>
              <div>
                <div style={{ fontSize: 17, fontWeight: 700, color: '#202124' }}>{user.full_name || initials}</div>
                <div style={{ fontSize: 12, color: '#5f6368' }}>{email}</div>
              </div>
            </div>
            <button onClick={onClose} style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#5f6368', padding: 4 }}><X size={18} /></button>
          </div>
          {/* Vacaciones resumen */}
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 8 }}>
            {[
              { label: 'Ganados', value: diasTotalesGanados, color: '#1a73e8' },
              { label: 'Tomados', value: diasTomados, color: '#e65100' },
              { label: 'Disponibles', value: diasDisponibles, color: diasDisponibles < 0 ? '#ea4335' : '#34a853' },
            ].map(({ label, value, color: c }) => (
              <div key={label} style={{ background: '#f8f9fa', borderRadius: 8, padding: '10px 12px', textAlign: 'center', border: '1px solid #e8eaed' }}>
                <div style={{ fontSize: 22, fontWeight: 700, color: c }}>{value}</div>
                <div style={{ fontSize: 11, color: '#5f6368', marginTop: 2 }}>{label}</div>
              </div>
            ))}
          </div>
          {wForm.fecha_inicio && (
            <div style={{ marginTop: 8, fontSize: 12, color: '#9aa0a6', textAlign: 'center' }}>
              {years} año{years !== 1 ? 's' : ''} en la empresa · {years} × 15 = {diasTotalesGanados} días hábiles ganados
            </div>
          )}
        </div>

        {/* Body */}
        <div style={{ padding: '16px 24px', flex: 1 }}>

          {/* Info laboral */}
          <Section icon={Briefcase} title="Información laboral" color="#1a73e8" defaultOpen>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12, marginBottom: 12 }}>
              <div style={fieldStyle}>
                <label style={labelStyle}>Fecha de inicio</label>
                <DatePicker value={wForm.fecha_inicio} onChange={v => setWForm(p => ({ ...p, fecha_inicio: v }))} />
              </div>
              <div style={fieldStyle}>
                <label style={labelStyle}>Tipo de contrato</label>
                <select value={wForm.tipo_contrato} onChange={e => setWForm(p => ({ ...p, tipo_contrato: e.target.value }))}
                  style={{ ...inputStyle, background: '#fff' }}>
                  <option value="">—</option>
                  {CONTRATO_OPTIONS.map(o => <option key={o}>{o}</option>)}
                </select>
              </div>
            </div>
            {wForm.tipo_contrato === 'Plazo fijo' && (
              <div style={{ ...fieldStyle, marginBottom: 12 }}>
                <label style={labelStyle}>Vencimiento contrato</label>
                <DatePicker value={wForm.fecha_vencimiento_contrato} onChange={v => setWForm(p => ({ ...p, fecha_vencimiento_contrato: v }))} />
              </div>
            )}
            <div style={fieldStyle}>
              <label style={labelStyle}>Notas</label>
              <textarea value={wForm.notas} onChange={e => setWForm(p => ({ ...p, notas: e.target.value }))}
                rows={3} style={{ ...inputStyle, resize: 'vertical' }} placeholder="Notas internas..." />
            </div>
            <button onClick={saveWorker} disabled={saving}
              style={{ padding: '7px 18px', background: '#1a73e8', color: '#fff', border: 'none', borderRadius: 7, fontSize: 13, fontWeight: 500, cursor: 'pointer', fontFamily: 'inherit' }}>
              {saving ? 'Guardando...' : 'Guardar'}
            </button>
          </Section>

          {/* Vacaciones */}
          <Section icon={Umbrella} title="Vacaciones" color="#2E7D32">
            <div style={{ marginBottom: 10 }}>
              {vacaciones.length === 0 && !addingVac && (
                <div style={{ fontSize: 13, color: '#9aa0a6', padding: '8px 0' }}>Sin períodos registrados.</div>
              )}
              {vacaciones.map(v => (
                <div key={v.id} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '7px 10px', background: '#fff', borderRadius: 7, border: '1px solid #e8eaed', marginBottom: 6, fontSize: 13 }}>
                  <div>
                    <span style={{ fontWeight: 600, color: '#202124' }}>{fmt(v.fecha_inicio)} → {fmt(v.fecha_fin)}</span>
                    <span style={{ marginLeft: 10, background: '#e6f4ea', color: '#2e7d32', borderRadius: 20, padding: '1px 8px', fontSize: 11, fontWeight: 700 }}>{v.dias_habiles} días</span>
                    {v.anio && <span style={{ marginLeft: 6, fontSize: 11, color: '#9aa0a6' }}>({v.anio})</span>}
                    {v.notas && <div style={{ fontSize: 11, color: '#5f6368', marginTop: 2 }}>{v.notas}</div>}
                  </div>
                  <button onClick={() => deleteVac(v.id)} style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#ea4335', padding: 4 }}><Trash2 size={13} /></button>
                </div>
              ))}
            </div>

            {addingVac ? (
              <div style={{ background: '#fff', border: '1px solid #dadce0', borderRadius: 8, padding: 12 }}>
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8, marginBottom: 8 }}>
                  <div>
                    <label style={labelStyle}>Inicio</label>
                    <DatePicker value={newVac.fecha_inicio} onChange={v => setNewVac(p => ({ ...p, fecha_inicio: v }))} style={{ width: '100%' }} />
                  </div>
                  <div>
                    <label style={labelStyle}>Fin</label>
                    <DatePicker value={newVac.fecha_fin} onChange={v => setNewVac(p => ({ ...p, fecha_fin: v }))} style={{ width: '100%' }} />
                  </div>
                  <div>
                    <label style={labelStyle}>Días hábiles</label>
                    <input type="number" min="1" value={newVac.dias_habiles} onChange={e => setNewVac(p => ({ ...p, dias_habiles: e.target.value }))} style={smallInput} placeholder="0" />
                  </div>
                  <div>
                    <label style={labelStyle}>Año</label>
                    <input type="number" value={newVac.anio} onChange={e => setNewVac(p => ({ ...p, anio: e.target.value }))} style={smallInput} />
                  </div>
                </div>
                <div style={{ marginBottom: 8 }}>
                  <label style={labelStyle}>Notas (opcional)</label>
                  <input value={newVac.notas} onChange={e => setNewVac(p => ({ ...p, notas: e.target.value }))} style={smallInput} placeholder="..." />
                </div>
                <div style={{ display: 'flex', gap: 8 }}>
                  <button onClick={saveVac} style={{ padding: '5px 14px', background: '#2E7D32', color: '#fff', border: 'none', borderRadius: 6, fontSize: 12, cursor: 'pointer', fontFamily: 'inherit', fontWeight: 500 }}>Guardar</button>
                  <button onClick={() => setAddingVac(false)} style={{ padding: '5px 14px', background: 'none', border: '1px solid #dadce0', borderRadius: 6, fontSize: 12, cursor: 'pointer', fontFamily: 'inherit' }}>Cancelar</button>
                </div>
              </div>
            ) : (
              <button onClick={() => setAddingVac(true)}
                style={{ display: 'flex', alignItems: 'center', gap: 6, padding: '6px 12px', background: 'none', border: '1px dashed #dadce0', borderRadius: 7, fontSize: 12, cursor: 'pointer', color: '#5f6368', fontFamily: 'inherit' }}>
                <Plus size={13} /> Agregar período
              </button>
            )}
          </Section>

          {/* Licencias */}
          <Section icon={AlertCircle} title="Licencias médicas" color="#C62828">
            <div style={{ marginBottom: 10 }}>
              {licencias.length === 0 && !addingLic && (
                <div style={{ fontSize: 13, color: '#9aa0a6', padding: '8px 0' }}>Sin licencias registradas.</div>
              )}
              {licencias.map(l => (
                <div key={l.id} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '7px 10px', background: '#fff', borderRadius: 7, border: '1px solid #e8eaed', marginBottom: 6, fontSize: 13 }}>
                  <div>
                    <span style={{ fontWeight: 600, color: '#202124' }}>{fmt(l.fecha_inicio)} → {fmt(l.fecha_fin)}</span>
                    <span style={{ marginLeft: 10, background: '#fce8e6', color: '#c62828', borderRadius: 20, padding: '1px 8px', fontSize: 11, fontWeight: 700 }}>{l.dias} días</span>
                    {l.notas && <div style={{ fontSize: 11, color: '#5f6368', marginTop: 2 }}>{l.notas}</div>}
                  </div>
                  <button onClick={() => deleteLic(l.id)} style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#ea4335', padding: 4 }}><Trash2 size={13} /></button>
                </div>
              ))}
            </div>

            {addingLic ? (
              <div style={{ background: '#fff', border: '1px solid #dadce0', borderRadius: 8, padding: 12 }}>
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8, marginBottom: 8 }}>
                  <div>
                    <label style={labelStyle}>Inicio</label>
                    <DatePicker value={newLic.fecha_inicio} onChange={v => setNewLic(p => ({ ...p, fecha_inicio: v }))} />
                  </div>
                  <div>
                    <label style={labelStyle}>Fin</label>
                    <DatePicker value={newLic.fecha_fin} onChange={v => setNewLic(p => ({ ...p, fecha_fin: v }))} />
                  </div>
                  <div>
                    <label style={labelStyle}>Días</label>
                    <input type="number" min="1" value={newLic.dias} onChange={e => setNewLic(p => ({ ...p, dias: e.target.value }))} style={smallInput} placeholder="0" />
                  </div>
                </div>
                <div style={{ marginBottom: 8 }}>
                  <label style={labelStyle}>Notas (opcional)</label>
                  <input value={newLic.notas} onChange={e => setNewLic(p => ({ ...p, notas: e.target.value }))} style={smallInput} placeholder="..." />
                </div>
                <div style={{ display: 'flex', gap: 8 }}>
                  <button onClick={saveLic} style={{ padding: '5px 14px', background: '#C62828', color: '#fff', border: 'none', borderRadius: 6, fontSize: 12, cursor: 'pointer', fontFamily: 'inherit', fontWeight: 500 }}>Guardar</button>
                  <button onClick={() => setAddingLic(false)} style={{ padding: '5px 14px', background: 'none', border: '1px solid #dadce0', borderRadius: 6, fontSize: 12, cursor: 'pointer', fontFamily: 'inherit' }}>Cancelar</button>
                </div>
              </div>
            ) : (
              <button onClick={() => setAddingLic(true)}
                style={{ display: 'flex', alignItems: 'center', gap: 6, padding: '6px 12px', background: 'none', border: '1px dashed #dadce0', borderRadius: 7, fontSize: 12, cursor: 'pointer', color: '#5f6368', fontFamily: 'inherit' }}>
                <Plus size={13} /> Agregar licencia
              </button>
            )}
          </Section>

        </div>
      </div>
    </div>
  );
}

// ── Main component ────────────────────────────────────────────
export default function UserManagement() {
  const { profile } = useAuth();
  const [users, setUsers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [selectedUser, setSelectedUser] = useState(null);
  const [workerSummaries, setWorkerSummaries] = useState({});

  const fetchUsers = useCallback(async () => {
    setLoading(true);
    const { data } = await supabase.from('app_users').select('*').order('created_at', { ascending: false });
    setUsers(data || []);
    setLoading(false);
  }, []);

  // Cargar resumen de vacaciones para todos los workers
  const fetchSummaries = useCallback(async () => {
    const [{ data: workers }, { data: vacs }] = await Promise.all([
      supabase.from('workers').select('user_email, fecha_inicio'),
      supabase.from('worker_vacaciones').select('worker_email, dias_habiles'),
    ]);
    const summaries = {};
    (workers || []).forEach(w => {
      const tomados = (vacs || []).filter(v => v.worker_email === w.user_email).reduce((s, v) => s + (v.dias_habiles || 0), 0);
      const years = aniosCompletos(w.fecha_inicio);
      summaries[w.user_email] = { disponibles: years * 15 - tomados, years };
    });
    setWorkerSummaries(summaries);
  }, []);

  useEffect(() => { fetchUsers(); fetchSummaries(); }, [fetchUsers, fetchSummaries]);

  const toggleBlock = async (userId, blocked) => {
    await supabase.from('app_users').update({ blocked: !blocked }).eq('id', userId);
    fetchUsers();
  };

  if (!profile?.isOwner) {
    return <div style={{ color: '#ea4335', padding: 24, fontSize: 14 }}>No tienes acceso a esta sección.</div>;
  }

  return (
    <div style={{ maxWidth: 900, fontFamily: "'Google Sans','Segoe UI',sans-serif" }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 28 }}>
        <div>
          <h1 style={{ fontSize: 24, fontWeight: 700, color: '#202124', margin: '0 0 4px' }}>Usuarios</h1>
          <p style={{ fontSize: 14, color: '#5f6368', margin: 0 }}>Gestión de cuentas y trabajadores</p>
        </div>
        <button onClick={() => { fetchUsers(); fetchSummaries(); }}
          style={{ display: 'flex', alignItems: 'center', gap: 6, padding: '8px 16px', background: '#fff', border: '1px solid #dadce0', borderRadius: 8, fontSize: 13, cursor: 'pointer', color: '#3c4043' }}>
          <RefreshCw size={15} /> Actualizar
        </button>
      </div>

      {loading ? (
        <div style={{ color: '#5f6368', fontSize: 14, padding: 24 }}>Cargando usuarios...</div>
      ) : (
        <div style={{ background: '#fff', borderRadius: 12, border: '1px solid #e8eaed', overflow: 'hidden' }}>
          {/* Header */}
          <div style={{ display: 'grid', gridTemplateColumns: '200px 1fr 130px 110px 110px 90px', padding: '11px 20px', background: '#f8f9fa', borderBottom: '1px solid #e8eaed', fontSize: 11, fontWeight: 700, color: '#5f6368', textTransform: 'uppercase', letterSpacing: 0.5 }}>
            <span>Usuario</span><span>Email</span><span>Rol</span><span>Estado</span><span>Vacaciones</span><span>Acceso</span>
          </div>

          {users.map(u => {
            const role = getUserRole(u.email);
            const initials = getUserInitials(u.email);
            const color = ENCARGADO_COLORS[initials] || (role === 'owner' ? '#1a73e8' : '#34a853');
            const summary = workerSummaries[u.email];

            return (
              <div key={u.id}
                onClick={() => setSelectedUser(u)}
                style={{ display: 'grid', gridTemplateColumns: '200px 1fr 130px 110px 110px 90px', padding: '13px 20px', borderBottom: '1px solid #f1f3f4', alignItems: 'center', cursor: 'pointer', opacity: u.blocked ? 0.55 : 1, transition: 'background 0.1s' }}
                onMouseEnter={e => e.currentTarget.style.background = '#f8f9fa'}
                onMouseLeave={e => e.currentTarget.style.background = '#fff'}>

                <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                  <div style={{ width: 32, height: 32, borderRadius: '50%', background: color, color: '#fff', fontSize: 13, fontWeight: 700, display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>{initials}</div>
                  <span style={{ fontWeight: 500, color: '#202124', fontSize: 14 }}>{u.full_name || initials}</span>
                </div>

                <span style={{ color: '#5f6368', fontSize: 13 }}>{u.email}</span>

                <div style={{ display: 'inline-flex', alignItems: 'center', gap: 4, fontSize: 12, fontWeight: 500, color: role === 'owner' ? '#1a73e8' : '#34a853', background: role === 'owner' ? '#e8f0fe' : '#e6f4ea', borderRadius: 20, padding: '3px 10px', width: 'fit-content' }}>
                  {role === 'owner' ? <Shield size={11} /> : <User size={11} />}
                  {role === 'owner' ? 'Propietario' : 'Colaborador'}
                </div>

                <div style={{ display: 'inline-flex', alignItems: 'center', gap: 4, fontSize: 12, fontWeight: 500, borderRadius: 20, padding: '3px 10px', width: 'fit-content', ...(u.blocked ? { background: '#fce8e6', color: '#ea4335' } : { background: '#e6f4ea', color: '#34a853' }) }}>
                  {u.blocked ? <Ban size={11} /> : <CheckCircle size={11} />}
                  {u.blocked ? 'Bloqueado' : 'Activo'}
                </div>

                <div style={{ fontSize: 13 }}>
                  {summary
                    ? <span style={{ fontWeight: 700, color: summary.disponibles < 0 ? '#ea4335' : summary.disponibles <= 3 ? '#f57c00' : '#34a853' }}>{summary.disponibles} días</span>
                    : <span style={{ color: '#dadce0' }}>—</span>}
                </div>

                <div style={{ display: 'flex', alignItems: 'center', gap: 6 }} onClick={e => e.stopPropagation()}>
                  {role !== 'owner' && (
                    <button onClick={() => toggleBlock(u.id, u.blocked)}
                      style={{ background: 'none', border: 'none', cursor: 'pointer', padding: 4, borderRadius: 6, display: 'flex' }}
                      title={u.blocked ? 'Desbloquear' : 'Bloquear'}>
                      {u.blocked ? <CheckCircle size={16} color="#34a853" /> : <Ban size={16} color="#fbbc04" />}
                    </button>
                  )}
                  <ChevronRight size={15} color="#9aa0a6" />
                </div>
              </div>
            );
          })}
        </div>
      )}

      <div style={{ marginTop: 16, padding: '12px 16px', background: '#e8f0fe', borderRadius: 8, fontSize: 13, color: '#1a73e8', lineHeight: 1.5 }}>
        <strong>Nota:</strong> Los usuarios se registran automáticamente la primera vez que inician sesión con su cuenta Google de <strong>@renovalpropiedades.com</strong>.
      </div>

      {selectedUser && (
        <WorkerPanel user={selectedUser} onClose={() => { setSelectedUser(null); fetchSummaries(); }} />
      )}
    </div>
  );
}
