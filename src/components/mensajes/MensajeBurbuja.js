import React from 'react';

export default function MensajeBurbuja({ mensaje }) {
  const esEntrante = mensaje.direction === 'inbound';
  const hora = new Date(mensaje.created_at).toLocaleTimeString('es-CL', {
    hour: '2-digit', minute: '2-digit'
  });

  return (
    <div style={{
      display:        'flex',
      justifyContent: esEntrante ? 'flex-start' : 'flex-end',
      marginBottom:   '6px',
    }}>
      <div style={{
        maxWidth:     '70%',
        background:   esEntrante ? '#f0f0f0' : '#dcf8c6',
        borderRadius: esEntrante ? '0 12px 12px 12px' : '12px 0 12px 12px',
        padding:      '8px 12px',
        fontSize:     '14px',
        color:        '#111',
        boxShadow:    '0 1px 2px rgba(0,0,0,0.1)',
      }}>
        <div style={{ whiteSpace: 'pre-wrap', wordBreak: 'break-word' }}>
          {mensaje.message_text}
        </div>
        <div style={{ fontSize: '11px', color: '#888', textAlign: 'right', marginTop: '4px' }}>
          {hora}
          {!esEntrante && <span style={{ marginLeft: '4px' }}>✓✓</span>}
        </div>
      </div>
    </div>
  );
}
