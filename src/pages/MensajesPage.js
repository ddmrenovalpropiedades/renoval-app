import React, { useState, useEffect } from 'react';
import ConversacionesList from '../components/mensajes/ConversacionesList';
import HiloConversacion from '../components/mensajes/HiloConversacion';
import { exportMensajes } from '../hooks/exportMensajes';
import { Download, ArrowLeft } from 'lucide-react';

function useIsMobile() {
  const [isMobile, setIsMobile] = useState(() => window.innerWidth < 768);
  useEffect(() => {
    const handler = () => setIsMobile(window.innerWidth < 768);
    window.addEventListener('resize', handler);
    return () => window.removeEventListener('resize', handler);
  }, []);
  return isMobile;
}

export default function MensajesPage({ currentUser, mensajesHook }) {
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
    lecturas,
    selectConversacion,
    enviarMensaje,
    cerrarConversacion,
    tomarConversacion,
    asignarConversacion,
  } = mensajesHook;

  const [exporting, setExporting] = useState(false);
  const isMobile = useIsMobile();

  const handleExport = async () => {
    setExporting(true);
    await exportMensajes();
    setExporting(false);
  };

  const selectedConv = conversaciones.find(c => c.id === selectedId);

  // En móvil: si hay conversación seleccionada, mostrar el hilo
  const mostrarHilo = isMobile && selectedId;

  // ── Vista móvil ────────────────────────────────────────────────────────────
  if (isMobile) {
    return (
      <div style={{ display: 'flex', flexDirection: 'column', height: '100%', overflow: 'hidden' }}>
        {mostrarHilo ? (
          // ── Hilo de conversación en móvil ────────────────────────────────
          <div style={{ display: 'flex', flexDirection: 'column', height: '100%' }}>
            {/* Header con botón volver */}
            <div style={{
              display: 'flex', alignItems: 'center', gap: 10,
              padding: '10px 12px',
              borderBottom: '1px solid #e5e7eb',
              background: '#075E54',
              flexShrink: 0,
            }}>
              <button
                onClick={() => selectConversacion(null)}
                style={{ background: 'none', border: 'none', cursor: 'pointer', padding: 4, display: 'flex', alignItems: 'center' }}
              >
                <ArrowLeft size={22} color="white" />
              </button>
              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{ fontWeight: 700, fontSize: 15, color: 'white', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                  {selectedConv?.contact_name || selectedConv?.phone_number || ''}
                </div>
                <div style={{ fontSize: 11, color: 'rgba(255,255,255,0.75)', marginTop: 1 }}>
                  {selectedConv?.phone_number || ''}
                </div>
              </div>
            </div>
            {/* Hilo */}
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
                isMobile={true}
              />
            </div>
          </div>
        ) : (
          // ── Lista de conversaciones en móvil ─────────────────────────────
          <div style={{ display: 'flex', flexDirection: 'column', height: '100%' }}>
            {/* Header */}
            <div style={{
              display: 'flex', alignItems: 'center', justifyContent: 'space-between',
              padding: '12px 16px',
              background: '#075E54',
              flexShrink: 0,
            }}>
              <span style={{ fontWeight: 700, fontSize: 17, color: 'white' }}>Mensajes</span>
              <button
                onClick={handleExport}
                disabled={exporting}
                style={{
                  display: 'flex', alignItems: 'center', gap: 5,
                  padding: '5px 10px', background: 'rgba(255,255,255,0.15)',
                  border: '1px solid rgba(255,255,255,0.3)', borderRadius: 8,
                  fontSize: 12, cursor: exporting ? 'not-allowed' : 'pointer',
                  color: 'white', fontFamily: 'inherit',
                  opacity: exporting ? 0.5 : 1,
                }}
              >
                <Download size={13} color="white" />
                {exporting ? '...' : 'Excel'}
              </button>
            </div>
            {/* Lista */}
            <div style={{ flex: 1, overflow: 'hidden' }}>
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
                lecturas={lecturas}
              />
            </div>
          </div>
        )}
      </div>
    );
  }

  // ── Vista PC: layout original lado a lado ──────────────────────────────────
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
            lecturas={lecturas}
          />
        </div>
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
