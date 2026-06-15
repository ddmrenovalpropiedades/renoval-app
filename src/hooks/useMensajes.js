import { useState, useEffect, useCallback } from 'react';
import { supabase } from '../supabaseClient';

export function useMensajes(currentUser) {
  const [conversaciones, setConversaciones] = useState([]);
  const [selectedId, setSelectedId]         = useState(null);
  const [mensajes, setMensajes]             = useState([]);
  const [loading, setLoading]               = useState(true);
  const [loadingMensajes, setLoadingMensajes] = useState(false);
  const [filtroEstado, setFiltroEstado]     = useState('todas');
  const [sendError, setSendError]           = useState(null);

  const isAdmin = currentUser?.isOwner === true;

  // ── Cargar conversaciones ──────────────────────────────────────────────────
  const fetchConversaciones = useCallback(async () => {
    setLoading(true);
    let query = supabase
      .from('wa_conversaciones')
      .select('*, app_users(full_name), wa_mensajes(message_text, created_at, direction)')
      .order('updated_at', { ascending: false });

    if (!isAdmin && currentUser?.id) {
      query = query.or(`agent_id.eq.${currentUser.id},agent_id.is.null`);
    }

    if (filtroEstado !== 'todas') {
      query = query.eq('estado', filtroEstado);
    }

    const { data, error } = await query;
    if (!error) setConversaciones(data || []);
    setLoading(false);
  }, [isAdmin, currentUser?.id, filtroEstado]);

  useEffect(() => {
    fetchConversaciones();
  }, [fetchConversaciones]);

  // ── Cargar hilo de mensajes ────────────────────────────────────────────────
  const fetchMensajes = useCallback(async (id) => {
    if (!id) return;
    setLoadingMensajes(true);
    const { data } = await supabase
      .from('wa_mensajes')
      .select('*')
      .eq('conversacion_id', id)
      .order('created_at', { ascending: true });
    setMensajes(data || []);
    setLoadingMensajes(false);
  }, []);

  // ── Realtime: nuevos mensajes y cambios de estado ─────────────────────────
  useEffect(() => {
    const channel = supabase
      .channel('wa_cambios')
      .on('postgres_changes', {
        event: '*',
        schema: 'public',
        table: 'wa_conversaciones',
      }, () => fetchConversaciones())
      .on('postgres_changes', {
        event: 'INSERT',
        schema: 'public',
        table: 'wa_mensajes',
      }, (payload) => {
        if (payload.new.conversacion_id === selectedId) {
          setMensajes(prev => {
            const exists = prev.find(m => m.id === payload.new.id);
            return exists ? prev : [...prev, payload.new];
          });
        }
        fetchConversaciones();
      })
      .subscribe();

    return () => supabase.removeChannel(channel);
  }, [selectedId, fetchConversaciones]);

  const selectConversacion = useCallback(async (id) => {
    setSelectedId(id);
    setSendError(null);
    await fetchMensajes(id);
  }, [fetchMensajes]);

  // ── Enviar mensaje ─────────────────────────────────────────────────────────
  const enviarMensaje = useCallback(async (texto) => {
    const conv = conversaciones.find(c => c.id === selectedId);
    if (!conv) return false;

    setSendError(null);

    try {
      const res = await fetch('/api/send-whatsapp', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          conversacion_id: selectedId,
          to:              conv.phone_number,
          text:            texto,
          agent_id:        currentUser?.id,
        }),
      });

      const data = await res.json().catch(() => ({}));

      if (!res.ok) {
        setSendError(data?.error || `Error al enviar (status ${res.status})`);
        return false;
      }

      // Refrescar hilo y lista directamente (no depender solo de Realtime)
      await fetchMensajes(selectedId);
      await fetchConversaciones();
      return true;

    } catch (err) {
      setSendError(err.message || 'Error de red al enviar');
      return false;
    }
  }, [selectedId, conversaciones, currentUser?.id, fetchMensajes, fetchConversaciones]);

  // ── Cerrar conversación ────────────────────────────────────────────────────
  const cerrarConversacion = useCallback(async () => {
    await supabase
      .from('wa_conversaciones')
      .update({ estado: 'cerrada' })
      .eq('id', selectedId);
    fetchConversaciones();
  }, [selectedId, fetchConversaciones]);

  // ── Tomar conversación ─────────────────────────────────────────────────────
  const tomarConversacion = useCallback(async () => {
    await supabase
      .from('wa_conversaciones')
      .update({ agent_id: currentUser?.id, estado: 'con_agente' })
      .eq('id', selectedId);
    fetchConversaciones();
  }, [selectedId, currentUser?.id, fetchConversaciones]);

  return {
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
  };
}
