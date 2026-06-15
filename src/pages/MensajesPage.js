import React from 'react';
import { useMensajes } from '../hooks/useMensajes';
import ConversacionesList from '../components/mensajes/ConversacionesList';
import HiloConversacion from '../components/mensajes/HiloConversacion';

export default function MensajesPage({ currentUser }) {
  const {
    conversaciones,
    selectedId,
    mensajes,
    loading,
    loadingMensajes,
    filtroEstado,
    setFiltroEstado,
    sendError,
    selectConversacion,
    enviarMensaje,
    cerrarConversacion,
    tomarConversacion,
  } = useMensajes(currentUser);

  const selectedConv = conversaciones.find(c => c.id === selectedId);

  return (
    <div style={{ display: 'flex', height: '100vh', overflow: 'hidden' }}>
      {/* Panel izquierdo */}
      <div style={{ width: '320px', minWidth: '280px', flexShrink: 0 }}>
        <ConversacionesList
          conversaciones={conversaciones}
          selectedId={selectedId}
          onSelect={selectConversacion}
          filtro={filtroEstado}
          onFiltroChange={setFiltroEstado}
          loading={loading}
        />
      </div>

      {/* Panel derecho */}
      <div style={{ flex: 1, overflow: 'hidden' }}>
        <HiloConversacion
          conversacion={selectedConv}
          mensajes={mensajes}
          loading={loadingMensajes}
          sendError={sendError}
          onEnviar={enviarMensaje}
          onTomar={tomarConversacion}
          onCerrar={cerrarConversacion}
          currentUser={currentUser}
        />
      </div>
    </div>
  );
}
