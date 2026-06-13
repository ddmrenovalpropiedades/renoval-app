import React, { useState, useEffect, useRef } from 'react';
import MensajeBurbuja from './MensajeBurbuja';

function btnStyle(color, disabled = false) {
  return {
    background:   disabled ? '#e5e7eb' : color,
    color:        disabled ? '#9ca3af' : 'white',
    border:       'none',
    borderRadius: '8px',
    padding:      '8px 16px',
    cursor:       disabled ? 'default' : 'pointer',
    fontWeight:   600,
    fontSize:     '13px',
    whiteSpace:   'nowrap',
  };
}

export default function HiloConversacion({
  conversacion,
  mensajes,
  loading,
  onEnviar,
  onTomar,
  onCerrar,
  currentUser,
}) {
  const [texto, setTexto]     = useState('');
  const [sending, setSending] = useState(false);
  const bottomRef             = useRef(null);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [mensajes]);

  const handleEnviar = async () => {
    if (!texto.trim() || sending) return;
    setSending(true);
    await onEnviar(texto.trim());
    setTexto('');
    setSending(false);
  };

  if (!conversacion) {
    return (
      <div style={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#9ca3af', height: '100%' }}>
        Selecciona una conversación
      </div>
    );
  }

  const puedeResponder = conversacion.estado !== 'cerrada';
  const esBot          = conversacion.estado === 'bot_activo' || conversacion.estado === 'esperando_agente';

  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: '100%' }}>
      {/* Header */}
      <div style={{
        padding:        '12px 20px',
        borderBottom:   '1px solid #e5e7eb',
        background:     '#f9fafb',
        display:        'flex',
        justifyContent: 'space-between',
        alignItems:     'center',
      }}>
        <div>
          <div style={{ fontWeight: 700, fontSize: '15px' }}>
            {conversacion.contact_name || conversacion.phone_number}
          </div>
          <div style={{ fontSize: '12px', color: '#6b7280' }}>
            {conversacion.phone_number}
          </div>
        </div>
        <div style={{ display: 'flex', gap: '8px' }}>
          {esBot && (
            <button onClick={onTomar} style={btnStyle('#3b82f6')}>
              Tomar conversación
            </button>
          )}
          {puedeResponder && conversacion.estado === 'con_agente' && (
            <button onClick={onCerrar} style={btnStyle('#9ca3af')}>
              Cerrar
            </button>
          )}
        </div>
      </div>

      {/* Hilo */}
      <div style={{ flex: 1, overflowY: 'auto', padding: '16px', background: '#e5ddd5' }}>
        {loading ? (
          <div style={{ textAlign: 'center', color: '#9ca3af' }}>Cargando mensajes...</div>
        ) : (
          mensajes.map(m => <MensajeBurbuja key={m.id} mensaje={m} />)
        )}
        <div ref={bottomRef} />
      </div>

      {/* Caja de respuesta */}
      {puedeResponder ? (
        <div style={{
          padding:    '12px 16px',
          background: 'white',
          borderTop:  '1px solid #e5e7eb',
          display:    'flex',
          gap:        '8px',
          alignItems: 'flex-end',
        }}>
          <textarea
            value={texto}
            onChange={e => setTexto(e.target.value)}
            onKeyDown={e => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); handleEnviar(); } }}
            placeholder="Escribir mensaje..."
            rows={2}
            style={{
              flex:         1,
              resize:       'none',
              border:       '1px solid #e5e7eb',
              borderRadius: '8px',
              padding:      '8px 12px',
              fontSize:     '14px',
              outline:      'none',
            }}
          />
          <button
            onClick={handleEnviar}
            disabled={sending || !texto.trim()}
            style={btnStyle('#25D366', sending || !texto.trim())}
          >
            {sending ? '...' : 'Enviar'}
          </button>
        </div>
      ) : (
        <div style={{ padding: '12px', textAlign: 'center', color: '#9ca3af', fontSize: '13px', borderTop: '1px solid #e5e7eb' }}>
          Conversación cerrada
        </div>
      )}
    </div>
  );
}
