import React, { useState, useEffect, useCallback } from 'react';
import { supabase } from '../supabaseClient';
import { useAuth } from '../context/AuthContext';
import { X, FileText, Trash2 } from 'lucide-react';

const ENCARGADO_COLORS = { DD: '#1565C0', FD: '#2E7D32', EA: '#6A1B9A', FG: '#E65100' };

function formatFechaHora(iso) {
  if (!iso) return '';
  const d = new Date(iso);
  return d.toLocaleDateString('es-CL', { day: '2-digit', month: 'short', year: 'numeric' }) +
    ' · ' + d.toLocaleTimeString('es-CL', { hour: '2-digit', minute: '2-digit' });
}

// ── Envoltorio de celda ─────────────────────────────────────────
// Envuelve el contenido de una celda de "propiedad". Si `propiedad` viene
// resuelta (existe en Cartera), muestra un ícono de documento en la esquina
// inferior derecha, visible SOLO al pasar el mouse por la celda — nunca
// interfiere con el click normal de la celda (edición inline, etc.) porque
// usa stopPropagation.
export function FichaCellWrap({ children, propiedad, onOpenFicha, style }) {
  const [hover, setHover] = useState(false);
  return (
    <div
      style={{ position: 'relative', width: '100%', ...style }}
      onMouseEnter={() => setHover(true)}
      onMouseLeave={() => setHover(false)}
    >
      {children}
      {propiedad && (
        <button
          onClick={e => { e.stopPropagation(); onOpenFicha(propiedad); }}
          title="Ver Ficha de la propiedad"
          style={{ position: 'absolute', bottom: -6, right: -4, background: '#fff', border: 'none', cursor: 'pointer', padding: 1, display: 'flex', color: '#5f6368', borderRadius: 4, opacity: hover ? 1 : 0, transition: 'opacity 0.15s' }}>
          <FileText size={11} />
        </button>
      )}
    </div>
  );
}

// ── Barra lateral: Ficha / bitácora de la propiedad ─────────────
// Compartida entre todos los usuarios y actualizada en tiempo real vía
// Supabase Realtime sobre la tabla property_bitacora.
export default function FichaSidebar({ propiedad, onClose }) {
  const { profile } = useAuth();
  const [entries, setEntries] = useState([]);
  const [loading, setLoading] = useState(true);
  const [newText, setNewText] = useState('');
  const [sending, setSending] = useState(false);
  const [confirmDeleteId, setConfirmDeleteId] = useState(null);

  const fetchEntries = useCallback(async () => {
    setLoading(true);
    const { data } = await supabase
      .from('property_bitacora')
      .select('*')
      .eq('propiedad', propiedad)
      .order('created_at', { ascending: false });
    setEntries(data || []);
    setLoading(false);
  }, [propiedad]);

  useEffect(() => { fetchEntries(); }, [fetchEntries]);

  // Filtramos en el cliente en vez de usar un filtro de Postgrest
  // (`propiedad=eq.${propiedad}`) porque el nombre de la propiedad puede
  // traer comas (la dirección completa de Cartera), y esas comas rompen la
  // sintaxis de filtro de Postgrest.
  useEffect(() => {
    const channel = supabase
      .channel('property_bitacora_' + Math.random().toString(36).slice(2))
      .on('postgres_changes', { event: '*', schema: 'public', table: 'property_bitacora' }, (payload) => {
        const row = payload.eventType === 'DELETE' ? payload.old : payload.new;
        if (!row || row.propiedad !== propiedad) return;
        if (payload.eventType === 'INSERT') {
          setEntries(prev => prev.some(e => e.id === payload.new.id) ? prev : [payload.new, ...prev]);
        } else if (payload.eventType === 'DELETE') {
          setEntries(prev => prev.filter(e => e.id !== payload.old.id));
        }
      })
      .subscribe();
    return () => supabase.removeChannel(channel);
  }, [propiedad]);

  const handleAdd = async () => {
    const texto = newText.trim();
    if (!texto) return;
    setSending(true);
    const payload = {
      propiedad,
      texto,
      autor_email: profile?.email || null,
      autor_iniciales: profile?.iniciales || null,
    };
    const { data, error } = await supabase.from('property_bitacora').insert(payload).select().single();
    if (!error && data) {
      setEntries(prev => prev.some(e => e.id === data.id) ? prev : [data, ...prev]);
      setNewText('');
    }
    setSending(false);
  };

  const handleDelete = async (id) => {
    await supabase.from('property_bitacora').delete().eq('id', id);
    setEntries(prev => prev.filter(e => e.id !== id));
    setConfirmDeleteId(null);
  };

  return (
    <div style={{ position: 'fixed', top: 0, right: 0, height: '100vh', width: 380, maxWidth: '90vw', background: '#fff', boxShadow: '-6px 0 24px rgba(0,0,0,0.18)', zIndex: 2500, display: 'flex', flexDirection: 'column', fontFamily: "'Google Sans','Segoe UI',sans-serif" }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', padding: '18px 20px', borderBottom: '1px solid #e8eaed', flexShrink: 0 }}>
        <div>
          <div style={{ fontSize: 11, fontWeight: 700, color: '#9aa0a6', letterSpacing: 0.5, marginBottom: 2 }}>FICHA</div>
          <div style={{ fontSize: 15, fontWeight: 700, color: '#202124' }}>{propiedad}</div>
        </div>
        <button onClick={onClose} style={{ background: 'none', border: 'none', cursor: 'pointer', padding: 4, color: '#5f6368' }}><X size={18} /></button>
      </div>

      <div style={{ padding: '14px 20px', borderBottom: '1px solid #e8eaed', flexShrink: 0 }}>
        <textarea
          value={newText}
          onChange={e => setNewText(e.target.value)}
          placeholder="Agregar entrada a la bitácora..."
          style={{ width: '100%', minHeight: 70, border: '1px solid #dadce0', borderRadius: 8, padding: '8px 10px', fontSize: 13, outline: 'none', fontFamily: 'inherit', resize: 'vertical', boxSizing: 'border-box' }}
        />
        <div style={{ display: 'flex', justifyContent: 'flex-end', marginTop: 8 }}>
          <button onClick={handleAdd} disabled={sending || !newText.trim()}
            style={{ padding: '7px 16px', background: newText.trim() ? '#1a73e8' : '#e8eaed', color: newText.trim() ? '#fff' : '#9aa0a6', border: 'none', borderRadius: 8, fontSize: 13, fontWeight: 500, cursor: newText.trim() ? 'pointer' : 'not-allowed', fontFamily: 'inherit' }}>
            {sending ? 'Agregando...' : 'Agregar'}
          </button>
        </div>
      </div>

      <div style={{ flex: 1, overflow: 'auto', padding: '14px 20px', display: 'flex', flexDirection: 'column', gap: 12 }}>
        {loading ? (
          <div style={{ fontSize: 12, color: '#9aa0a6', textAlign: 'center', padding: 20 }}>Cargando...</div>
        ) : entries.length === 0 ? (
          <div style={{ fontSize: 12, color: '#9aa0a6', textAlign: 'center', padding: 20, fontStyle: 'italic' }}>Sin entradas en la bitácora todavía.</div>
        ) : entries.map(entry => (
          <div key={entry.id} style={{ background: '#f8f9fa', border: '1px solid #e8eaed', borderRadius: 8, padding: '10px 12px' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 6 }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                {entry.autor_iniciales && (
                  <span style={{ fontSize: 10, fontWeight: 700, color: ENCARGADO_COLORS[entry.autor_iniciales] || '#5f6368', background: (ENCARGADO_COLORS[entry.autor_iniciales] || '#9aa0a6') + '22', border: `1px solid ${(ENCARGADO_COLORS[entry.autor_iniciales] || '#9aa0a6')}44`, borderRadius: 20, padding: '1px 7px' }}>
                    {entry.autor_iniciales}
                  </span>
                )}
                <span style={{ fontSize: 11, color: '#9aa0a6' }}>{formatFechaHora(entry.created_at)}</span>
              </div>
              {confirmDeleteId === entry.id ? (
                <div style={{ display: 'flex', gap: 4 }}>
                  <button onClick={() => handleDelete(entry.id)} style={{ background: '#fce8e6', border: 'none', borderRadius: 5, cursor: 'pointer', padding: '3px 5px', color: '#ea4335', display: 'flex' }} title="Confirmar eliminar"><Trash2 size={11} /></button>
                  <button onClick={() => setConfirmDeleteId(null)} style={{ background: 'none', border: 'none', cursor: 'pointer', padding: '3px 5px', color: '#5f6368', display: 'flex' }} title="Cancelar"><X size={11} /></button>
                </div>
              ) : (
                <button onClick={() => setConfirmDeleteId(entry.id)} style={{ background: 'none', border: 'none', cursor: 'pointer', padding: '3px 4px', color: '#9aa0a6', display: 'flex' }} title="Eliminar"><Trash2 size={11} /></button>
              )}
            </div>
            <div style={{ fontSize: 13, color: '#3c4043', lineHeight: 1.5, whiteSpace: 'pre-wrap' }}>{entry.texto}</div>
          </div>
        ))}
      </div>
    </div>
  );
}
