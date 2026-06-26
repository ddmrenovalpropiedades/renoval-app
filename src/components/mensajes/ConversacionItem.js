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

const BADGE_BASE = {
  fontSize:     '10px',
  fontWeight:   600,
  color:        'white',
  borderRadius: '10px',
  padding:      '1px 7px',
  whiteSpace:   'nowrap',
};

export default function ConversacionItem({ conv, selected, onClick, lecturas }) {
  const mensajes = conv.wa_mensajes || [];
  const ultimo   = mensajes[mensajes.length - 1];
  const hora     = ultimo
    ? new Date(ultimo.created_at).toLocaleTimeString('es-CL', { hour: '2-digit', minute: '2-digit' })
    : '';

  // ── Mensajes no leídos ───────────────────────────────────────────────────
  const ultimaLectura   = lecturas?.[conv.id] ? new Date(lecturas[conv.id]) : null;
  const mensajesInbound = mensajes.filter(m => m.direction === 'inbound');
  const noLeidos        = mensajesInbound.filter(m =>
    !ultimaLectura || new Date(m.created_at) > ultimaLectura
  ).length;
  const hayNoLeidos = noLeidos > 0;

  const sinAsignar = conv.agent_id === null;

  return (
    <div
      onClick={onClick}
      style={{
        padding:      '12px 16px',
        cursor:       'pointer',
        background:   selected ? '#e8f5e9' : hayNoLeidos ? '#f0fdf4' : 'white',
        borderBottom: '1px solid #f0f0f0',
        borderLeft:   selected ? '3px solid #25D366' : hayNoLeidos ? '3px solid #25D366' : '3px solid transparent',
      }}
    >
      {/* Fila 1: nombre + hora */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <span style={{
          fontWeight: hayNoLeidos ? 700 : 600,
          fontSize:   '14px',
          color:      hayNoLeidos ? '#111' : '#1f2937',
        }}>
          {conv.contact_name || conv.phone_number}
        </span>
        <span style={{
          fontSize:   '11px',
          color:      hayNoLeidos ? '#25D366' : '#888',
          fontWeight: hayNoLeidos ? 600 : 400,
        }}>
          {hora}
        </span>
      </div>

      {/* Fila 2: preview + badges */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginTop: '4px' }}>
        <span style={{
          fontSize:     '12px',
          color:        hayNoLeidos ? '#111' : '#666',
          fontWeight:   hayNoLeidos ? 600 : 400,
          overflow:     'hidden',
          textOverflow: 'ellipsis',
          whiteSpace:   'nowrap',
          maxWidth:     '150px',
        }}>
          {ultimo?.message_text || '—'}
        </span>

        <div style={{ display: 'flex', alignItems: 'center', gap: 4, flexShrink: 0 }}>
          {/* Badge no leídos */}
          {hayNoLeidos && (
            <span style={{
              background:     '#25D366',
              color:          'white',
              borderRadius:   '50%',
              fontSize:       '11px',
              fontWeight:     700,
              minWidth:       20,
              height:         20,
              display:        'flex',
              alignItems:     'center',
              justifyContent: 'center',
              padding:        '0 5px',
              boxSizing:      'border-box',
            }}>
              {noLeidos > 99 ? '99+' : noLeidos}
            </span>
          )}

          {/* Badge No asignado */}
          {sinAsignar && (
            <span style={{ ...BADGE_BASE, background: '#ef4444' }}>
              Sin asignar
            </span>
          )}

          {/* Badge estado */}
          <span style={{ ...BADGE_BASE, background: ESTADO_COLOR[conv.estado] || '#9ca3af' }}>
            {ESTADO_LABEL[conv.estado] || conv.estado}
          </span>
        </div>
      </div>

      {/* Fila 3: teléfono */}
      <div style={{ fontSize: '11px', color: '#999', marginTop: '2px' }}>
        {conv.phone_number}
      </div>
    </div>
  );
}
