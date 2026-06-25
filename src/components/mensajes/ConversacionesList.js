import React, { useEffect, useState } from 'react';
import ConversacionItem from './ConversacionItem';
import { supabase } from '../../supabaseClient';

const FILTROS_ESTADO = [
  { value: 'todas',            label: 'Todas'     },
  { value: 'esperando_agente', label: 'Esperando' },
  { value: 'con_agente',       label: 'Activas'   },
  { value: 'bot_activo',       label: 'Bot'       },
  { value: 'cerrada',          label: 'Cerradas'  },
];

const ENCARGADO_COLORS = {
  DD: '#1565C0', FD: '#2E7D32', EA: '#6A1B9A', FG: '#E65100',
};

export default function ConversacionesList({
  conversaciones, selectedId, onSelect,
  filtroEstado, onFiltroEstadoChange,
  filtroUsuario, onFiltroUsuarioChange,
  isAdmin, currentUser,
  loading, lecturas,
}) {
  const [appUsers, setAppUsers] = useState([]);

  useEffect(() => {
    if (!isAdmin) return;
    supabase.from('app_users').select('id, full_name, iniciales').then(({ data }) => {
      setAppUsers(data || []);
    });
  }, [isAdmin]);

  const FILTROS_USUARIO = isAdmin ? [
    { value: 'todas',       label: 'Todas',       color: null },
    { value: 'mis_conv',    label: 'Mis conv.',   color: null },
    { value: 'sin_asignar', label: 'Sin asignar', color: null },
    ...appUsers.map(u => ({
      value: u.id,
      label: u.iniciales || u.full_name,
      color: ENCARGADO_COLORS[u.iniciales] || null,
    })),
  ] : [];

  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: '100%', borderRight: '1px solid #e5e7eb' }}>
      {/* Header */}
      <div style={{ padding: '12px 14px', borderBottom: '1px solid #e5e7eb', background: '#f9fafb' }}>
        <div style={{ fontWeight: 700, fontSize: '15px', marginBottom: 10 }}>Mensajes</div>

        {/* Filtro de usuario (solo admins) */}
        {isAdmin && (
          <div style={{ marginBottom: 8 }}>
            <div style={{ fontSize: 10, fontWeight: 600, color: '#9ca3af', marginBottom: 4, letterSpacing: 0.5 }}>USUARIO</div>
            <div style={{ display: 'flex', gap: 5, flexWrap: 'wrap' }}>
              {FILTROS_USUARIO.map(f => (
                <button
                  key={f.value}
                  onClick={() => onFiltroUsuarioChange(f.value)}
                  style={{
                    padding:      '3px 9px',
                    borderRadius: '12px',
                    border:       filtroUsuario === f.value
                      ? `1px solid ${f.color || '#1a73e8'}`
                      : '1px solid #e5e7eb',
                    cursor:       'pointer',
                    fontSize:     '11px',
                    background:   filtroUsuario === f.value
                      ? (f.color ? f.color + '22' : '#e8f0fe')
                      : '#fff',
                    color:        filtroUsuario === f.value
                      ? (f.color || '#1a73e8')
                      : '#6b7280',
                    fontWeight:   filtroUsuario === f.value ? 700 : 400,
                  }}
                >
                  {f.label}
                </button>
              ))}
            </div>
          </div>
        )}

        {/* Filtro de estado */}
        <div>
          <div style={{ fontSize: 10, fontWeight: 600, color: '#9ca3af', marginBottom: 4, letterSpacing: 0.5 }}>ESTADO</div>
          <div style={{ display: 'flex', gap: 5, flexWrap: 'wrap' }}>
            {FILTROS_ESTADO.map(f => (
              <button
                key={f.value}
                onClick={() => onFiltroEstadoChange(f.value)}
                style={{
                  padding:      '3px 9px',
                  borderRadius: '12px',
                  border:       'none',
                  cursor:       'pointer',
                  fontSize:     '11px',
                  background:   filtroEstado === f.value ? '#25D366' : '#e5e7eb',
                  color:        filtroEstado === f.value ? 'white' : '#374151',
                  fontWeight:   filtroEstado === f.value ? 600 : 400,
                }}
              >
                {f.label}
              </button>
            ))}
          </div>
        </div>
      </div>

      {/* Lista */}
      <div style={{ overflowY: 'auto', flex: 1 }}>
        {loading ? (
          <div style={{ padding: '20px', textAlign: 'center', color: '#9ca3af' }}>Cargando...</div>
        ) : conversaciones.length === 0 ? (
          <div style={{ padding: '20px', textAlign: 'center', color: '#9ca3af' }}>Sin conversaciones</div>
        ) : (
          conversaciones.map(conv => (
            <ConversacionItem
              key={conv.id}
              conv={conv}
              selected={conv.id === selectedId}
              onClick={() => onSelect(conv.id)}
              lecturas={lecturas}
              currentUserId={currentUser?.id}
            />
          ))
        )}
      </div>
    </div>
  );
}
