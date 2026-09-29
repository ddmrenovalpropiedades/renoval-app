import React, { useState, useEffect } from 'react';
import ConversacionesList from '../components/mensajes/ConversacionesList';
import HiloConversacion from '../components/mensajes/HiloConversacion';
import MetricasPage from './MetricasPage';
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

// ─── Pestañas Mensajes / Métricas, reutilizadas en el header móvil y PC ───────
function TabsMensajeria({ vista, onChange, dark }) {
  const base = {
    padding: '6px 14px',
    borderRadius: 8,
    fontSize: 13,
    fontWeight: 600,
    cursor: 'pointer',
    fontFamily: 'inherit',
    border: dark ? '1px solid rgba(255,255,255,0.3)' : '1px solid #dadce0',
  };
  const activeDark    = { background: 'white', color: '#075E54', border: '1px solid white' };
  const inactiveDark  = { background: 'rgba(255,255,255,0.12)', color: 'white' };
  const activeLight   = { background: '#075E54', color: 'white', border: '1px solid #075E54' };
  const inactiveLight = { background: '#fff', color: '#3c4043' };

  const estiloTab = (tab) => ({
    ...base,
    ...(dark
      ? (vista === tab ? activeDark : inactiveDark)
      : (vista === tab ? activeLight : inactiveLight)),
  });

  return (
    <div style={{ display: 'flex', gap: 6 }}>
      <button style={estiloTab('mensajes')} onClick={() => onChange('mensajes')}>Mensajes</button>
      <button style={estiloTab('metricas')} onClick={() => onChange('metricas')}>Métricas</button>
    </div>
  );
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
  const [vista, setVista] = useState('mensajes'); // 'mensajes' | 'metricas'
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
          // ── Lista de conversaciones o Métricas, en móvil ─────────────────
          <div style={{ display: 'flex', flexDirection: 'column', height: '100%' }}>
            {/* Header */}
            <div style={{
              display: 'flex', alignItems: 'center', justifyContent: 'space-between',
              padding: '12px 16px', gap: 10,
              background: '#075E54',
              flexShrink: 0,
              flexWrap: 'wrap',
            }}>
              <TabsMensajeria vista={vista} onChange={setVista} dark />
              {vista === 'mensajes' && (
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
              )}
            </div>
            {/* Contenido */}
            <div style={{ flex: 1, overflow: 'auto' }}>
              {vista === 'metricas' ? (
                <MetricasPage />
              ) : (
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
              )}
            </div>
          </div>
        )}
      </div>
    );
  }

  // ── Vista PC ─────────────────────────────────────────────────────────────
  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: '100vh', overflow: 'hidden' }}>
      {/* Barra superior */}
      <div style={{
        display: 'flex', alignItems: 'center', justifyContent: 'space-between',
        padding: '10px 16px', borderBottom: '1px solid #e5e7eb',
        background: '#f9fafb', flexShrink: 0, gap: 12, flexWrap: 'wrap',
      }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 16 }}>
          <span style={{ fontWeight: 700, fontSize: 16, color: '#202124' }}>Mensajería</span>
          <TabsMensajeria vista={vista} onChange={setVista} />
        </div>
        {vista === 'mensajes' && (
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
        )}
      </div>

      {/* Contenido principal */}
      {vista === 'metricas' ? (
        <div style={{ flex: 1, overflow: 'auto' }}>
          <MetricasPage />
        </div>
      ) : (
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
      )}
    </div>
  );
}
