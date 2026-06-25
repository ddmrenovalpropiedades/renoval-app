import { useState, useEffect, useCallback, useRef } from 'react';
import { supabase } from '../supabaseClient';

const USER_INITIALS = {
  'ddm@renovalpropiedades.com':      'DD',
  'fdm@renovalpropiedades.com':      'FD',
  'edith@renovalpropiedades.com':    'EA',
  'fernanda@renovalpropiedades.com': 'FG',
};

const ADMIN_EMAILS = ['ddm@renovalpropiedades.com', 'fdm@renovalpropiedades.com'];

export function useMensajes(currentUser) {
  const [conversaciones, setConversaciones] = useState([]);
  const [selectedId, setSelectedId]         = useState(null);
  const [mensajes, setMensajes]             = useState([]);
  const [loading, setLoading]               = useState(true);
  const [loadingMensajes, setLoadingMensajes] = useState(false);
  const [filtroEstado, setFiltroEstado]     = useState('todas');
  const [filtroUsuario, setFiltroUsuario]   = useState('mis_conv');
  const [sendError, setSendError]           = useState(null);
  const [lecturas, setLecturas]             = useState({});

  const isAdmin = ADMIN_EMAILS.includes(currentUser?.email);

  // Ref para que el closure del Realtime siempre lea el selectedId actual
  const selectedIdRef = useRef(null);
  const audioRef      = useRef(null);

  // Mantener ref sincronizado con el estado
  useEffect(() => {
    selectedIdRef.current = selectedId;
  }, [selectedId]);

  // ── Audio ──────────────────────────────────────────────────────────────────
  useEffect(() => {
    audioRef.current = new Audio('/sounds/notification.mp3');
    audioRef.current.volume = 0.5;
  }, []);

  const unlockAudio = useCallback(() => {
    if (!audioRef.current) return;
    audioRef.current.play().then(() => {
      audioRef.current.pause();
      audioRef.current.currentTime = 0;
    }).catch(() => {});
  }, []);

  const playNotification = useCallback(() => {
    if (!audioRef.current) return;
    audioRef.current.currentTime = 0;
    audioRef.current.play().catch(() => {});
  }, []);

  // ── Cargar lecturas ────────────────────────────────────────────────────────
  const fetchLecturas = useCallback(async () => {
    if (!currentUser?.email) return;
    const { data } = await supabase
      .from('wa_conv_lecturas')
      .select('conv_id, leida_en')
      .eq('user_id', currentUser.email);
    if (data) {
      const map = {};
      data.forEach(r => { map[r.conv_id] = r.leida_en; });
      setLecturas(map);
    }
  }, [currentUser?.email]);

  useEffect(() => {
    fetchLecturas();
  }, [fetchLecturas]);

  // ── Marcar conversación como leída ─────────────────────────────────────────
  const marcarLeida = useCallback(async (convId) => {
    if (!currentUser?.email || !convId) return;
    const ahora = new Date().toISOString();
    await supabase
      .from('wa_conv_lecturas')
      .upsert(
        { conv_id: convId, user_id: currentUser.email, leida_en: ahora },
        { onConflict: 'conv_id,user_id' }
      );
    setLecturas(prev => ({ ...prev, [convId]: ahora }));
  }, [currentUser?.email]);

  // ── Cargar conversaciones ──────────────────────────────────────────────────
  const fetchConversaciones = useCallback(async () => {
    if (!currentUser?.id) return;
    setLoading(true);

    let query = supabase
      .from('wa_conversaciones')
      .select('*, app_users(id, full_name, iniciales), wa_mensajes(message_text, created_at, direction)')
      .order('updated_at', { ascending: false });

    if (!isAdmin) {
      query = query.or(`agent_id.eq.${currentUser.id},agent_id.is.null`);
    } else {
      if (filtroUsuario === 'mis_conv') {
        query = query.or(`agent_id.eq.${currentUser.id},agent_id.is.null`);
      } else if (filtroUsuario === 'sin_asignar') {
        query = query.is('agent_id', null);
      } else if (filtroUsuario !== 'todas') {
        query = query.eq('agent_id', filtroUsuario);
      }
    }

    if (filtroEstado !== 'todas') {
      query = query.eq('estado', filtroEstado);
    }

    const { data, error } = await query;
    if (!error) setConversaciones(data || []);
    setLoading(false);
  }, [currentUser?.id, isAdmin, filtroEstado, filtroUsuario]);

  useEffect(() => {
    fetchConversaciones();
  }, [fetchConversaciones]);

  // ── Badge count ────────────────────────────────────────────────────────────
  const badgeCount = conversaciones.reduce((acc, conv) => {
    const esPropia     = conv.agent_id === currentUser?.id;
    const esSinAsignar = conv.agent_id === null;
    if (!esPropia && !esSinAsignar) return acc;

    const ultimaLectura   = lecturas[conv.id] ? new Date(lecturas[conv.id]) : null;
    const mensajesInbound = (conv.wa_mensajes || []).filter(m => m.direction === 'inbound');
    if (!mensajesInbound.length) return acc;

    const ultimoInbound = new Date(mensajesInbound[mensajesInbound.length - 1].created_at);
    if (!ultimaLectura || ultimoInbound > ultimaLectura) return acc + 1;
    return acc;
  }, 0);

  // ── Realtime ───────────────────────────────────────────────────────────────
  // Se suscribe UNA sola vez. Usa selectedIdRef para leer el valor actual
  // sin necesidad de re-suscribirse, evitando conflictos de canal duplicado.
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
        const nuevo       = payload.new;
        const currentSel  = selectedIdRef.current;

        // Sonar siempre que llega un mensaje inbound, igual que WhatsApp Web
        if (nuevo.direction === 'inbound') {
          playNotification();
        }

        // Si el hilo está abierto: agregar mensaje y marcar como leída
        if (nuevo.conversacion_id === currentSel) {
          setMensajes(prev => {
            const exists = prev.find(m => m.id === nuevo.id);
            return exists ? prev : [...prev, nuevo];
          });
          marcarLeida(nuevo.conversacion_id);
        }

        fetchConversaciones();
      })
      .subscribe();

    return () => supabase.removeChannel(channel);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);  // Sin dependencias: el canal se crea una sola vez

  // Mantener fetchConversaciones y marcarLeida accesibles desde el closure
  // sin recrear el canal usando refs
  const fetchConversacionesRef = useRef(fetchConversaciones);
  const marcarLeidaRef         = useRef(marcarLeida);
  const playNotificationRef    = useRef(playNotification);
  useEffect(() => { fetchConversacionesRef.current = fetchConversaciones; }, [fetchConversaciones]);
  useEffect(() => { marcarLeidaRef.current = marcarLeida; },               [marcarLeida]);
  useEffect(() => { playNotificationRef.current = playNotification; },     [playNotification]);

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

  const selectConversacion = useCallback(async (id) => {
    setSelectedId(id);
    setSendError(null);
    await fetchMensajes(id);
    await marcarLeida(id);
  }, [fetchMensajes, marcarLeida]);

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

  // ── Asignar conversación ───────────────────────────────────────────────────
  const asignarConversacion = useCallback(async (conversacionId, agentId) => {
    await supabase
      .from('wa_conversaciones')
      .update({ agent_id: agentId || null })
      .eq('id', conversacionId);
    fetchConversaciones();
  }, [fetchConversaciones]);

  return {
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
    badgeCount,
    unlockAudio,
    selectConversacion,
    enviarMensaje,
    cerrarConversacion,
    tomarConversacion,
    asignarConversacion,
    fetchConversaciones,
    marcarLeida,
    USER_INITIALS,
  };
}
