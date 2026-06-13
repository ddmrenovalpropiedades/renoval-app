import React from 'react';
import ConversacionItem from './ConversacionItem';

const FILTROS = [
  { value: 'todas',            label: 'Todas'     },
  { value: 'esperando_agente', label: 'Esperando' },
  { value: 'con_agente',       label: 'Activas'   },
  { value: 'bot_activo',       label: 'Bot'       },
  { value: 'cerrada',          label: 'Cerradas'  },
];

export default function ConversacionesList({ conversaciones, selectedId, onSelect, filtro, onFiltroChange, loading }) {
  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: '100%', borderRight: '1px solid #e5e7eb' }}>
      {/* Header */}
      <div style={{ padding: '16px', borderBottom: '1px solid #e5e7eb', background: '#f9fafb' }}>
        <div style={{ fontWeight: 700, fontSize: '16px', marginBottom: '10px' }}>Mensajes</div>
        <div style={{ display: 'flex', gap: '6px', flexWrap: 'wrap' }}>
          {FILTROS.map(f => (
            <button
              key={f.value}
              onClick={() => onFiltroChange(f.value)}
              style={{
                padding:      '3px 10px',
                borderRadius: '12px',
                border:       'none',
                cursor:       'pointer',
                fontSize:     '12px',
                background:   filtro === f.value ? '#25D366' : '#e5e7eb',
                color:        filtro === f.value ? 'white' : '#374151',
                fontWeight:   filtro === f.value ? 600 : 400,
              }}
            >
              {f.label}
            </button>
          ))}
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
            />
          ))
        )}
      </div>
    </div>
  );
}
