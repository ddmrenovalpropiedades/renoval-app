import React from 'react';

const ESTADO_COLOR = {
  bot_activo:       '#ef4444',
  esperando_agente: '#f59e0b',
  con_agente:       '#3b82f6',
  cerrada:          '#9ca3af',
};

const ESTADO_LABEL = {
  bot_activo:       'Bot',
  esperando_agente: 'Esperando',
  con_agente:       'Con agente',
  cerrada:          'Cerrada',
};

export default function ConversacionItem({ conv, selected, onClick }) {
  const mensajes = conv.wa_mensajes || [];
  const ultimo   = mensajes[mensajes.length - 1];
  const hora     = ultimo
    ? new Date(ultimo.created_at).toLocaleTimeString('es-CL', { hour: '2-digit', minute: '2-digit' })
    : '';

  return (
    <div
      onClick={onClick}
      style={{
        padding:      '12px 16px',
        cursor:       'pointer',
        background:   selected ? '#e8f5e9' : 'white',
        borderBottom: '1px solid #f0f0f0',
        borderLeft:   selected ? '3px solid #25D366' : '3px solid transparent',
      }}
    >
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <span style={{ fontWeight: 600, fontSize: '14px' }}>
          {conv.contact_name || conv.phone_number}
        </span>
        <span style={{ fontSize: '11px', color: '#888' }}>{hora}</span>
      </div>
      <div style={{ display: 'flex', justifyContent: 'space-between', marginTop: '4px' }}>
        <span style={{
          fontSize:      '12px',
          color:         '#666',
          overflow:      'hidden',
          textOverflow:  'ellipsis',
          whiteSpace:    'nowrap',
          maxWidth:      '160px',
        }}>
          {ultimo?.message_text || '—'}
        </span>
        <span style={{
          fontSize:     '10px',
          fontWeight:   600,
          color:        'white',
          background:   ESTADO_COLOR[conv.estado] || '#9ca3af',
          borderRadius: '10px',
          padding:      '1px 7px',
          whiteSpace:   'nowrap',
        }}>
          {ESTADO_LABEL[conv.estado] || conv.estado}
        </span>
      </div>
      <div style={{ fontSize: '11px', color: '#999', marginTop: '2px' }}>
        {conv.phone_number}
      </div>
    </div>
  );
}
