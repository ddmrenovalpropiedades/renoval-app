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
  const [texto, setTexto]                     = useState('');
  const [sending, setSending]                 = useState(false);
  const [appUsers, setAppUsers]               = useState([]);
  const [asignando, setAsignando]             = useState(false);
  const [predefinidos, setPredefinidos]       = useState([]);
  const [showPredefinidos, setShowPredefinidos] = useState(false);
  const [filtroPred, setFiltroPred]           = useState('');
  const [selectedPredIdx, setSelectedPredIdx] = useState(0);
  const bottomRef  = useRef(null);
  const textareaRef = useRef(null);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [mensajes]);

  useEffect(() => {
    supabase.from('app_users').select('id, full_name, iniciales').then(({ data }) => {
      setAppUsers(data || []);
    });
  }, []);

  // Cargar mensajes predefinidos
  useEffect(() => {
    supabase
      .from('wa_mensajes_predefinidos')
      .select('*')
      .order('orden', { ascending: true })
      .order('titulo', { ascending: true })
      .then(({ data }) => setPredefinidos(data || []));
  }, []);

  // Filtrar predefinidos según lo que se escribe después del /
  const predFiltrados = predefinidos.filter(p =>
    filtroPred === '' ||
    p.titulo.toLowerCase().includes(filtroPred.toLowerCase()) ||
    p.contenido.toLowerCase().includes(filtroPred.toLowerCase())
  );

  // Resetear índice seleccionado cuando cambia el filtro
  useEffect(() => {
    setSelectedPredIdx(0);
  }, [filtroPred]);

  const handleTextoChange = (e) => {
    const val = e.target.value;
    setTexto(val);

    // Detectar si el texto empieza con /
    if (val.startsWith('/')) {
      setFiltroPred(val.slice(1)); // lo que viene después del /
      setShowPredefinidos(true);
    } else {
      setShowPredefinidos(false);
      setFiltroPred('');
    }
  };

  const seleccionarPredefinido = (pred) => {
    setTexto(pred.contenido);
    setShowPredefinidos(false);
    setFiltroPred('');
    textareaRef.current?.focus();
  };

  const handleKeyDown = (e) => {
    if (showPredefinidos && predFiltrados.length > 0) {
      if (e.key === 'ArrowDown') {
        e.preventDefault();
        setSelectedPredIdx(i => Math.min(i + 1, predFiltrados.length - 1));
        return;
      }
      if (e.key === 'ArrowUp') {
        e.preventDefault();
        setSelectedPredIdx(i => Math.max(i - 1, 0));
        return;
      }
      if (e.key === 'Tab' || e.key === 'Enter') {
        if (e.key === 'Enter' && showPredefinidos) {
          e.preventDefault();
          seleccionarPredefinido(predFiltrados[selectedPredIdx]);
          return;
        }
      }
      if (e.key === 'Escape') {
        setShowPredefinidos(false);
        return;
      }
    }

    if (e.key === 'Enter' && !e.shiftKey && !showPredefinidos) {
      e.preventDefault();
      handleEnviar();
    }
  };

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

      {/* Header — solo en PC */}
      {!isMobile && (
        <div style={{
          padding: '12px 20px', borderBottom: '1px solid #e5e7eb',
          background: '#f9fafb', display: 'flex',
          justifyContent: 'space-between', alignItems: 'flex-start', gap: 12,
        }}>
          <div style={{ flex: 1, minWidth: 0 }}>
            <div style={{ fontWeight: 700, fontSize: '15px' }}>
              {conversacion.contact_name || conversacion.phone_number}
            </div>
            <div style={{ fontSize: '12px', color: '#6b7280' }}>{conversacion.phone_number}</div>
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
                    }}>{agentIniciales}</span>
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
            {esBot && <button onClick={onTomar} style={btnStyle('#3b82f6')}>Tomar conversación</button>}
            {puedeResponder && conversacion.estado === 'con_agente' && (
              <button onClick={onCerrar} style={btnStyle('#9ca3af')}>Cerrar</button>
            )}
          </div>
        </div>
      )}

      {/* Barra de estado en móvil */}
      {isMobile && (
        <div style={{
          padding: '8px 12px', background: '#f9fafb',
          borderBottom: '1px solid #e5e7eb',
          display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexShrink: 0,
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
                  }}>{agentIniciales}</span>
                )}
              </>
            ) : (
              <span style={{ color: '#f59e0b', fontWeight: 600 }}>⚠ Sin asignar</span>
            )}
            <span style={{ color: '#d1d5db' }}>·</span>
            <span>{ESTADO_LABEL[conversacion.estado] || conversacion.estado}</span>
          </div>
          <div style={{ display: 'flex', gap: 6 }}>
            {esBot && <button onClick={onTomar} style={{ ...btnStyle('#3b82f6'), padding: '5px 10px', fontSize: 12 }}>Tomar</button>}
            {puedeResponder && conversacion.estado === 'con_agente' && (
              <button onClick={onCerrar} style={{ ...btnStyle('#9ca3af'), padding: '5px 10px', fontSize: 12 }}>Cerrar</button>
            )}
          </div>
        </div>
      )}

      {/* Panel de asignación manual */}
      {sinAsignar && (
        <div style={{
          padding: '10px 12px', background: '#fffbeb',
          borderBottom: '1px solid #fde68a',
          display: 'flex', alignItems: 'center', gap: 10, flexWrap: 'wrap', flexShrink: 0,
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
              >{u.iniciales || u.full_name}</button>
            ))}
          </div>
        </div>
      )}

      {/* Hilo de mensajes */}
      <div style={{
        flex: 1, overflowY: 'auto', padding: '16px',
        backgroundColor: '#e9dfd3',
        backgroundImage: `url("${BG_PATTERN}")`,
        backgroundRepeat: 'repeat', backgroundSize: '220px 220px',
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
        <div style={{ borderTop: '1px solid #e5e7eb', background: 'white', flexShrink: 0, position: 'relative' }}>

          {/* Panel de mensajes predefinidos */}
          {showPredefinidos && (
            <div style={{
              position: 'absolute', bottom: '100%', left: 0, right: 0,
              background: 'white', border: '1px solid #e5e7eb',
              borderRadius: '8px 8px 0 0', maxHeight: 280,
              overflowY: 'auto', zIndex: 50,
              boxShadow: '0 -4px 16px rgba(0,0,0,0.1)',
            }}>
              {predFiltrados.length === 0 ? (
                <div style={{ padding: '12px 16px', fontSize: 13, color: '#9ca3af' }}>
                  No hay respuestas que coincidan
                </div>
              ) : (
                <>
                  <div style={{ padding: '8px 16px 4px', fontSize: 11, fontWeight: 600, color: '#9ca3af', letterSpacing: 0.5 }}>
                    RESPUESTAS RÁPIDAS — ↑↓ para navegar, Enter para seleccionar, Esc para cerrar
                  </div>
                  {predFiltrados.map((pred, idx) => (
                    <div
                      key={pred.id}
                      onClick={() => seleccionarPredefinido(pred)}
                      style={{
                        padding: '10px 16px',
                        cursor: 'pointer',
                        background: idx === selectedPredIdx ? '#f0fdf4' : 'white',
                        borderLeft: idx === selectedPredIdx ? '3px solid #25D366' : '3px solid transparent',
                        borderBottom: '1px solid #f3f4f6',
                      }}
                    >
                      <div style={{ fontWeight: 600, fontSize: 13, color: '#111', marginBottom: 2 }}>
                        /{pred.titulo}
                      </div>
                      <div style={{
                        fontSize: 12, color: '#6b7280',
                        overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
                      }}>
                        {pred.contenido}
                      </div>
                    </div>
                  ))}
                </>
              )}
            </div>
          )}

          {sendError && (
            <div style={{ padding: '8px 16px', fontSize: '12px', color: '#dc2626', background: '#fef2f2' }}>
              {sendError}
            </div>
          )}
          <div style={{ padding: '10px 12px', display: 'flex', gap: '8px', alignItems: 'flex-end' }}>
            <textarea
              ref={textareaRef}
              value={texto}
              onChange={handleTextoChange}
              onKeyDown={handleKeyDown}
              placeholder="Escribir mensaje... (escribe / para respuestas rápidas)"
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
