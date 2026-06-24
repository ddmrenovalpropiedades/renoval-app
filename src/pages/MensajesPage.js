import React, { useState } from 'react';
import { useMensajes } from '../hooks/useMensajes';
import ConversacionesList from '../components/mensajes/ConversacionesList';
import HiloConversacion from '../components/mensajes/HiloConversacion';
import { exportMensajes } from '../hooks/exportMensajes';
import { Download } from 'lucide-react';

export default function MensajesPage({ currentUser }) {
  const {
    conversaciones,
    selectedId,
    mensajes,
    loading,
    loadingMensajes,
    filtroEstado,
    setFiltroEstado,
    filtroUsuario,
    setFiltroUsuario,
    sendError,
    isAdmin,
    selectConversacion,
    enviarMensaje,
    cerrarConversacion,
    tomarConversacion,
    asignarConversacion,
  } = useMensajes(currentUser);

  const [exporting, setExporting] = useState(false);

  const handleExport = async () => {
    setExporting(true);
    await exportMensajes();
    setExporting(false);
  };

  const selectedConv = conversaciones.find(c => c.id === selectedId);

  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: '100vh', overflow: 'hidden' }}>
      {/* Barra superior */}
      <div style={{
        display: 'flex', alignItems: 'center', justifyContent: 'space-between',
        padding: '10px 16px', borderBottom: '1px solid #e5e7eb',
        background: '#f9fafb', flexShrink: 0,
      }}>
        <span style={{ fontWeight: 700, fontSize: 16, color: '#202124' }}>Mensajes WhatsApp</span>
        <button
          onClick={handleExport}
          disabled={exporting}
          title="Descargar últimas 2 semanas en Excel"
          style={{
            display: 'flex', alignItems: 'center', gap: 6,
            padding: '7px 13px', background: '#fff',
            border: '1px solid #dadce0', borderRadius: 8,
            fontSize: 13, cursor: exporting ? 'not-allowed' : 'pointer',
            color: '#3c4043', fontFamily: 'inherit',
            opacity: exporting ? 0.5 : 1,
          }}
        >
          <Download size={14} color="#34a853" />
          {exporting ? 'Descargando...' : 'Excel (2 semanas)'}
        </button>
      </div>

      {/* Contenido principal */}
      <div style={{ display: 'flex', flex: 1, overflow: 'hidden' }}>
        {/* Panel izquierdo */}
        <div style={{ width: '320px', minWidth: '280px', flexShrink: 0 }}>
          <ConversacionesList
            conversaciones={conversaciones}
            selectedId={selectedId}
            onSelect={selectConversacion}
            filtroEstado={filtroEstado}
            onFiltroEstadoChange={setFiltroEstado}
            filtroUsuario={filtroUsuario}
            onFiltroUsuarioChange={setFiltroUsuario}
            isAdmin={isAdmin}
            currentUser={currentUser}
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
            onAsignar={asignarConversacion}
            currentUser={currentUser}
          />
        </div>
      </div>
    </div>
  );
}
