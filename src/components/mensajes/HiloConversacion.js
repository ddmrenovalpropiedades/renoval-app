import React, { useState, useEffect, useRef } from 'react';
import MensajeBurbuja from './MensajeBurbuja';
import { supabase } from '../../supabaseClient';

const BG_PATTERN = "data:image/svg+xml;base64,PHN2ZyB4bWxucz0iaHR0cDovL3d3dy53My5vcmcvMjAwMC9zdmciIHdpZHRoPSIyMjAiIGhlaWdodD0iMjIwIiB2aWV3Qm94PSIwIDAgMjIwIDIyMCI+CiAgPGcgZmlsbD0ibm9uZSIgc3Ryb2tlPSIjZDZjZmMyIiBzdHJva2Utd2lkdGg9IjEuMyIgc3Ryb2tlLWxpbmVjYXA9InJvdW5kIiBzdHJva2UtbGluZWpvaW49InJvdW5kIiBvcGFjaXR5PSIwLjY1Ij4KICAgIDwhLS0gY2hhdCBidWJibGUgLS0+CiAgICA8cGF0aCBkPSJNMjIgMjQgaDI4IGE3IDcgMCAwIDEgNyA3IHYxNiBhNyA3IDAgMCAxIC03IDcgaC0xNiBsLTcgNyB2LTcgaC01IGE3IDcgMCAwIDEgLTcgLTcgdi0xNiBhNyA3IDAgMCAxIDcgLTcgeiIvPgogICAgPGNpcmNsZSBjeD0iMzMiIGN5PSIzOCIgcj0iMS42IiBmaWxsPSIjZDZjZmMyIi8+CiAgICA8Y2lyY2xlIGN4PSI0MCIgY3k9IjM4IiByPSIxLjYiIGZpbGw9IiNkNmNmYzIiLz4KICAgIDxjaXJjbGUgY3g9IjQ3IiBjeT0iMzgiIHI9IjEuNiIgZmlsbD0iI2Q2Y2ZjMiIvPgoKICAgIDwhLS0gbGVhZiAtLT4KICAgIDxwYXRoIGQ9Ik0xNTAgMjggYzE2IC0xMiAzMiAwIDMyIDE2IGMtMTYgNCAtMzIgLTQgLTMyIC0xNiB6Ii8+CiAgICA8cGF0aCBkPSJNMTUwIDI4IGM1IDcgMTAgMTIgMTcgMTYiLz4KCiAgICA8IS0tIG11c2ljIG5vdGUgLS0+CiAgICA8Y2lyY2xlIGN4PSI2MCIgY3k9IjEzMCIgcj0iNiIvPgogICAgPHBhdGggZD0iTTY2IDEzMCB2LTI2IGwxNyAtNSB2MjYiLz4KICAgIDxjaXJjbGUgY3g9IjgzIiBjeT0iMTI1IiByPSI2Ii8+CgogICAgPCEtLSBwYXBlciBwbGFuZSAtLT4KICAgIDxwYXRoIGQ9Ik0xNzAgMTIwIGwzNCAtMTYgLTExIDM0IC03IC0xNCAtMTYgLTQgeiIvPgoKICAgIDwhLS0gY2FtZXJhIC0tPgogICAgPHJlY3QgeD0iMzAiIHk9IjE2NSIgd2lkdGg9IjMwIiBoZWlnaHQ9IjIyIiByeD0iMyIvPgogICAgPGNpcmNsZSBjeD0iNDUiIGN5PSIxNzYiIHI9IjciLz4KICAgIDxwYXRoIGQ9Ik0zOSAxNjUgbDMuNSAtNiBoNSBsMy41IDYiLz4KCiAgICA8IS0tIHNtYWxsIGZsb3dlciAvIGNsdXN0ZXIgLS0+CiAgICA8Y2lyY2xlIGN4PSIxODAiIGN5PSIxOTAiIHI9IjMuNSIvPgogICAgPGNpcmNsZSBjeD0iMTg4IiBjeT0iMTkwIiByPSIzLjUiLz4KICAgIDxjaXJjbGUgY3g9IjE4NCIgY3k9IjE4MyIgcj0iMy41Ii8+CiAgICA8Y2lyY2xlIGN4PSIxODQiIGN5PSIxOTciIHI9IjMuNSIvPgogICAgPGNpcmNsZSBjeD0iMTg0IiBjeT0iMTkwIiByPSIyLjUiIGZpbGw9IiNkNmNmYzIiLz4KCiAgICA8IS0tIGVudmVsb3BlIC0tPgogICAgPHJlY3QgeD0iMTEwIiB5PSIxNjAiIHdpZHRoPSIzMiIgaGVpZ2h0PSIyMiIgcng9IjIiLz4KICAgIDxwYXRoIGQ9Ik0xMTAgMTYyIGwxNiAxMyAxNiAtMTMiLz4KCiAgICA8IS0tIGxvY2F0aW9uIHBpbiAtLT4KICAgIDxwYXRoIGQ9Ik0xMDUgNjAgYzggMCAxNCA2IDE0IDE0IGMwIDggLTE0IDIyIC0xNCAyMiBzLTE0IC0xNCAtMTQgLTIyIGMwIC04IDYgLTE0IDE0IC0xNCB6Ii8+CiAgICA8Y2lyY2xlIGN4PSIxMDUiIGN5PSI3NCIgcj0iNCIvPgogIDwvZz4KPC9zdmc+Cg==";

const ENCARGADO_COLORS = {
  DD: '#1565C0', FD: '#2E7D32', EA: '#6A1B9A', FG: '#E65100',
};

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

const ESTADO_LABEL = {
  bot_activo:       'Bot activo',
  esperando_agente: 'Esperando agente',
  con_agente:       'Con agente',
  cerrada:          'Cerrada',
};

export default function HiloConversacion({
  conversacion,
  mensajes,
  loading,
  sendError,
  onEnviar,
  onTomar,
  onCerrar,
  onAsignar,
  currentUser,
  isMobile = false,
}) {
  const [texto, setTexto]         = useState('');
  const [sending, setSending]     = useState(false);
  const [appUsers, setAppUsers]   = useState([]);
  const [asignando, setAsignando] = useState(false);
  const bottomRef                 = useRef(null);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [mensajes]);

  useEffect(() => {
    supabase.from('app_users').select('id, full_name, iniciales').then(({ data }) => {
      setAppUsers(data || []);
    });
  }, []);

  const handleEnviar = async () => {
    if (!texto.trim() || sending) return;
    setSending(true);
    const ok = await onEnviar(texto.trim());
    if (ok) setTexto('');
    setSending(false);
  };

  const handleAsignar = async (agentId) => {
    setAsignando(true);
    await onAsignar(conversacion.id, agentId);
    setAsignando(false);
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
  const sinAsignar     = !conversacion.agent_id;
  const agentName      = conversacion.app_users?.full_name;
  const agentIniciales = conversacion.app_users?.iniciales;

  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: '100%' }}>

      {/* Header — solo en PC; en móvil lo maneja MensajesPage */}
      {!isMobile && (
        <div style={{
          padding:        '12px 20px',
          borderBottom:   '1px solid #e5e7eb',
          background:     '#f9fafb',
          display:        'flex',
          justifyContent: 'space-between',
          alignItems:     'flex-start',
          gap:            12,
        }}>
          <div style={{ flex: 1, minWidth: 0 }}>
            <div style={{ fontWeight: 700, fontSize: '15px' }}>
              {conversacion.contact_name || conversacion.phone_number}
            </div>
            <div style={{ fontSize: '12px', color: '#6b7280' }}>
              {conversacion.phone_number}
            </div>
            <div style={{ fontSize: '12px', color: '#6b7280', marginTop: '2px', display: 'flex', alignItems: 'center', gap: 6 }}>
              {conversacion.agent_id ? (
                <>
                  <span>Asignado a:</span>
                  {agentIniciales && (
                    <span style={{
                      fontSize: 11, fontWeight: 700,
                      color: ENCARGADO_COLORS[agentIniciales] || '#5f6368',
                      background: (ENCARGADO_COLORS[agentIniciales] || '#9aa0a6') + '22',
                      border: `1px solid ${(ENCARGADO_COLORS[agentIniciales] || '#9aa0a6')}44`,
                      borderRadius: 20, padding: '1px 8px',
                    }}>
                      {agentIniciales}
                    </span>
                  )}
                  {!agentIniciales && <span>{agentName || conversacion.agent_id}</span>}
                </>
              ) : (
                <span style={{ color: '#f59e0b', fontWeight: 600 }}>⚠ Sin asignar</span>
              )}
              <span style={{ color: '#d1d5db' }}>·</span>
              <span>{ESTADO_LABEL[conversacion.estado] || conversacion.estado}</span>
            </div>
          </div>
          <div style={{ display: 'flex', gap: '8px', flexShrink: 0, flexWrap: 'wrap', justifyContent: 'flex-end' }}>
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
      )}

      {/* Barra de estado + acciones en móvil */}
      {isMobile && (
        <div style={{
          padding: '8px 12px',
          background: '#f9fafb',
          borderBottom: '1px solid #e5e7eb',
          display: 'flex', justifyContent: 'space-between', alignItems: 'center',
          flexShrink: 0,
        }}>
          <div style={{ fontSize: 12, color: '#6b7280', display: 'flex', alignItems: 'center', gap: 6 }}>
            {conversacion.agent_id ? (
              <>
                <span>Asignado:</span>
                {agentIniciales && (
                  <span style={{
                    fontSize: 11, fontWeight: 700,
                    color: ENCARGADO_COLORS[agentIniciales] || '#5f6368',
                    background: (ENCARGADO_COLORS[agentIniciales] || '#9aa0a6') + '22',
                    border: `1px solid ${(ENCARGADO_COLORS[agentIniciales] || '#9aa0a6')}44`,
                    borderRadius: 20, padding: '1px 8px',
                  }}>
                    {agentIniciales}
                  </span>
                )}
              </>
            ) : (
              <span style={{ color: '#f59e0b', fontWeight: 600 }}>⚠ Sin asignar</span>
            )}
            <span style={{ color: '#d1d5db' }}>·</span>
            <span>{ESTADO_LABEL[conversacion.estado] || conversacion.estado}</span>
          </div>
          <div style={{ display: 'flex', gap: 6 }}>
            {esBot && (
              <button onClick={onTomar} style={{ ...btnStyle('#3b82f6'), padding: '5px 10px', fontSize: 12 }}>
                Tomar
              </button>
            )}
            {puedeResponder && conversacion.estado === 'con_agente' && (
              <button onClick={onCerrar} style={{ ...btnStyle('#9ca3af'), padding: '5px 10px', fontSize: 12 }}>
                Cerrar
              </button>
            )}
          </div>
        </div>
      )}

      {/* Panel de asignación manual */}
      {sinAsignar && (
        <div style={{
          padding: '10px 12px',
          background: '#fffbeb',
          borderBottom: '1px solid #fde68a',
          display: 'flex', alignItems: 'center', gap: 10, flexWrap: 'wrap',
          flexShrink: 0,
        }}>
          <span style={{ fontSize: 13, color: '#92400e', fontWeight: 500 }}>Asignar a:</span>
          <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
            {appUsers.map(u => (
              <button
                key={u.id}
                onClick={() => handleAsignar(u.id)}
                disabled={asignando}
                style={{
                  padding: '4px 12px', borderRadius: 20,
                  border: `1px solid ${ENCARGADO_COLORS[u.iniciales] || '#dadce0'}`,
                  background: (ENCARGADO_COLORS[u.iniciales] || '#9aa0a6') + '15',
                  color: ENCARGADO_COLORS[u.iniciales] || '#5f6368',
                  fontSize: 12, fontWeight: 700,
                  cursor: asignando ? 'not-allowed' : 'pointer',
                  opacity: asignando ? 0.6 : 1, fontFamily: 'inherit',
                }}
              >
                {u.iniciales || u.full_name}
              </button>
            ))}
          </div>
        </div>
      )}

      {/* Hilo de mensajes */}
      <div style={{
        flex:             1,
        overflowY:        'auto',
        padding:          '16px',
        backgroundColor:  '#e9dfd3',
        backgroundImage:  `url("${BG_PATTERN}")`,
        backgroundRepeat: 'repeat',
        backgroundSize:   '220px 220px',
      }}>
        {loading ? (
          <div style={{ textAlign: 'center', color: '#9ca3af' }}>Cargando mensajes...</div>
        ) : mensajes.length === 0 ? (
          <div style={{ textAlign: 'center', color: '#9ca3af', marginTop: '20px' }}>Sin mensajes aún</div>
        ) : (
          mensajes.map(m => <MensajeBurbuja key={m.id} mensaje={m} />)
        )}
        <div ref={bottomRef} />
      </div>

      {/* Caja de respuesta */}
      {puedeResponder ? (
        <div style={{ borderTop: '1px solid #e5e7eb', background: 'white', flexShrink: 0 }}>
          {sendError && (
            <div style={{ padding: '8px 16px', fontSize: '12px', color: '#dc2626', background: '#fef2f2' }}>
              {sendError}
            </div>
          )}
          <div style={{ padding: '10px 12px', display: 'flex', gap: '8px', alignItems: 'flex-end' }}>
            <textarea
              value={texto}
              onChange={e => setTexto(e.target.value)}
              onKeyDown={e => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); handleEnviar(); } }}
              placeholder="Escribir mensaje..."
              rows={2}
              style={{
                flex: 1, resize: 'none', border: '1px solid #e5e7eb',
                borderRadius: '8px', padding: '8px 12px', fontSize: '14px', outline: 'none',
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
        </div>
      ) : (
        <div style={{ padding: '12px', textAlign: 'center', color: '#9ca3af', fontSize: '13px', borderTop: '1px solid #e5e7eb', flexShrink: 0 }}>
          Conversación cerrada
        </div>
      )}
    </div>
  );
}
