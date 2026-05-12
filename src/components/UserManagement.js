import React, { useEffect, useState } from 'react';
import { supabase, getUserRole, getUserInitials } from '../supabaseClient';
import { useAuth } from '../context/AuthContext';
import { Shield, User, Trash2, Ban, CheckCircle, RefreshCw } from 'lucide-react';

export default function UserManagement() {
  const { profile } = useAuth();
  const [users, setUsers] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchUsers();
  }, []);

  const fetchUsers = async () => {
    setLoading(true);
    const { data, error } = await supabase
      .from('app_users')
      .select('*')
      .order('created_at', { ascending: false });
    if (!error) setUsers(data || []);
    setLoading(false);
  };

  const toggleBlock = async (userId, blocked) => {
    await supabase.from('app_users').update({ blocked: !blocked }).eq('id', userId);
    fetchUsers();
  };

  const deleteUser = async (userId) => {
    if (!window.confirm('¿Estás seguro de eliminar este usuario?')) return;
    await supabase.from('app_users').delete().eq('id', userId);
    fetchUsers();
  };

  if (!profile?.isOwner) {
    return <div style={styles.denied}>No tenés acceso a esta sección.</div>;
  }

  return (
    <div style={styles.container}>
      <div style={styles.header}>
        <div>
          <h1 style={styles.title}>Usuarios</h1>
          <p style={styles.subtitle}>Administrá las cuentas con acceso al sistema</p>
        </div>
        <button onClick={fetchUsers} style={styles.refreshBtn}>
          <RefreshCw size={16} />
          Actualizar
        </button>
      </div>

      {loading ? (
        <div style={styles.loading}>Cargando usuarios...</div>
      ) : (
        <div style={styles.table}>
          <div style={styles.tableHeader}>
            <span>Usuario</span>
            <span>Email</span>
            <span>Rol</span>
            <span>Estado</span>
            <span>Último acceso</span>
            <span>Acciones</span>
          </div>
          {users.length === 0 ? (
            <div style={styles.empty}>
              No hay usuarios registrados aún. Los usuarios aparecen aquí cuando inician sesión por primera vez.
            </div>
          ) : (
            users.map(u => {
              const role = getUserRole(u.email);
              const initials = getUserInitials(u.email);
              return (
                <div key={u.id} style={{ ...styles.tableRow, ...(u.blocked ? styles.tableRowBlocked : {}) }}>
                  <div style={styles.userCell}>
                    <div style={{ ...styles.initials, background: role === 'owner' ? '#1a73e8' : '#34a853' }}>
                      {initials}
                    </div>
                    <span style={styles.userName}>{u.full_name || initials}</span>
                  </div>
                  <span style={styles.email}>{u.email}</span>
                  <div style={styles.roleChip}>
                    {role === 'owner'
                      ? <><Shield size={12} /> Propietario</>
                      : <><User size={12} /> Colaborador</>
                    }
                  </div>
                  <div style={{ ...styles.statusChip, ...(u.blocked ? styles.statusBlocked : styles.statusActive) }}>
                    {u.blocked ? <><Ban size={12} /> Bloqueado</> : <><CheckCircle size={12} /> Activo</>}
                  </div>
                  <span style={styles.lastAccess}>
                    {u.last_sign_in ? new Date(u.last_sign_in).toLocaleDateString('es-CL') : '—'}
                  </span>
                  <div style={styles.actions}>
                    {role !== 'owner' && (
                      <>
                        <button
                          onClick={() => toggleBlock(u.id, u.blocked)}
                          style={styles.actionBtn}
                          title={u.blocked ? 'Desbloquear' : 'Bloquear'}
                        >
                          {u.blocked ? <CheckCircle size={16} color="#34a853" /> : <Ban size={16} color="#fbbc04" />}
                        </button>
                        <button
                          onClick={() => deleteUser(u.id)}
                          style={styles.actionBtn}
                          title="Eliminar"
                        >
                          <Trash2 size={16} color="#ea4335" />
                        </button>
                      </>
                    )}
                    {role === 'owner' && (
                      <span style={styles.protectedLabel}>Protegido</span>
                    )}
                  </div>
                </div>
              );
            })
          )}
        </div>
      )}

      <div style={styles.infoBox}>
        <strong>Nota:</strong> Los usuarios se registran automáticamente la primera vez que inician sesión con su cuenta Google de <strong>@renovalpropiedades.com</strong>. No es necesario crearlos manualmente.
      </div>
    </div>
  );
}

const styles = {
  container: { maxWidth: 900 },
  header: {
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    marginBottom: 28,
  },
  title: { fontSize: 24, fontWeight: 700, color: '#202124', margin: '0 0 4px' },
  subtitle: { fontSize: 14, color: '#5f6368', margin: 0 },
  refreshBtn: {
    display: 'flex', alignItems: 'center', gap: 6,
    padding: '8px 16px', background: '#fff', border: '1px solid #dadce0',
    borderRadius: 8, fontSize: 13, cursor: 'pointer', color: '#3c4043',
  },
  loading: { color: '#5f6368', fontSize: 14, padding: 24 },
  table: {
    background: '#fff',
    borderRadius: 12,
    border: '1px solid #e8eaed',
    overflow: 'hidden',
  },
  tableHeader: {
    display: 'grid',
    gridTemplateColumns: '160px 1fr 130px 120px 130px 100px',
    padding: '12px 20px',
    background: '#f8f9fa',
    borderBottom: '1px solid #e8eaed',
    fontSize: 12,
    fontWeight: 600,
    color: '#5f6368',
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  tableRow: {
    display: 'grid',
    gridTemplateColumns: '160px 1fr 130px 120px 130px 100px',
    padding: '14px 20px',
    borderBottom: '1px solid #f1f3f4',
    alignItems: 'center',
    fontSize: 14,
  },
  tableRowBlocked: { opacity: 0.6 },
  userCell: { display: 'flex', alignItems: 'center', gap: 10 },
  initials: {
    width: 32, height: 32, borderRadius: '50%',
    color: '#fff', fontSize: 13, fontWeight: 700,
    display: 'flex', alignItems: 'center', justifyContent: 'center',
  },
  userName: { fontWeight: 500, color: '#202124' },
  email: { color: '#5f6368', fontSize: 13 },
  roleChip: {
    display: 'inline-flex', alignItems: 'center', gap: 4,
    fontSize: 12, fontWeight: 500, color: '#1a73e8',
    background: '#e8f0fe', borderRadius: 20, padding: '3px 10px',
    width: 'fit-content',
  },
  statusChip: {
    display: 'inline-flex', alignItems: 'center', gap: 4,
    fontSize: 12, fontWeight: 500, borderRadius: 20,
    padding: '3px 10px', width: 'fit-content',
  },
  statusActive: { background: '#e6f4ea', color: '#34a853' },
  statusBlocked: { background: '#fce8e6', color: '#ea4335' },
  lastAccess: { color: '#5f6368', fontSize: 13 },
  actions: { display: 'flex', gap: 8, alignItems: 'center' },
  actionBtn: {
    background: 'none', border: 'none', cursor: 'pointer',
    padding: 4, borderRadius: 6, display: 'flex',
  },
  protectedLabel: { fontSize: 12, color: '#9aa0a6', fontStyle: 'italic' },
  empty: { padding: 32, color: '#5f6368', fontSize: 14, textAlign: 'center' },
  infoBox: {
    marginTop: 16, padding: '12px 16px',
    background: '#e8f0fe', borderRadius: 8,
    fontSize: 13, color: '#1a73e8', lineHeight: 1.5,
  },
  denied: { color: '#ea4335', padding: 24, fontSize: 14 },
};
