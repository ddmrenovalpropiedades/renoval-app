import React, { useState, useEffect } from 'react';
import { supabase } from '../supabaseClient';
import { Plus, Pencil, Trash2, Check, X } from 'lucide-react';

export default function RespuestasRapidasPage() {
  const [mensajes, setMensajes]   = useState([]);
  const [loading, setLoading]     = useState(true);
  const [editingId, setEditingId] = useState(null); // id del que se está editando
  const [form, setForm]           = useState({ titulo: '', contenido: '' });
  const [showNew, setShowNew]     = useState(false);
  const [newForm, setNewForm]     = useState({ titulo: '', contenido: '' });
  const [saving, setSaving]       = useState(false);
  const [error, setError]         = useState(null);

  const fetchMensajes = async () => {
    setLoading(true);
    const { data } = await supabase
      .from('wa_mensajes_predefinidos')
      .select('*')
      .order('orden', { ascending: true })
      .order('titulo', { ascending: true });
    setMensajes(data || []);
    setLoading(false);
  };

  useEffect(() => { fetchMensajes(); }, []);

  // ── Crear ──────────────────────────────────────────────────────────────────
  const handleCreate = async () => {
    if (!newForm.titulo.trim() || !newForm.contenido.trim()) {
      setError('El título y el contenido son obligatorios.');
      return;
    }
    setSaving(true);
    setError(null);
    const { error: err } = await supabase
      .from('wa_mensajes_predefinidos')
      .insert({ titulo: newForm.titulo.trim(), contenido: newForm.contenido.trim() });
    if (err) { setError(err.message); setSaving(false); return; }
    setNewForm({ titulo: '', contenido: '' });
    setShowNew(false);
    await fetchMensajes();
    setSaving(false);
  };

  // ── Editar ─────────────────────────────────────────────────────────────────
  const startEdit = (m) => {
    setEditingId(m.id);
    setForm({ titulo: m.titulo, contenido: m.contenido });
    setError(null);
  };

  const handleSaveEdit = async () => {
    if (!form.titulo.trim() || !form.contenido.trim()) {
      setError('El título y el contenido son obligatorios.');
      return;
    }
    setSaving(true);
    setError(null);
    const { error: err } = await supabase
      .from('wa_mensajes_predefinidos')
      .update({ titulo: form.titulo.trim(), contenido: form.contenido.trim() })
      .eq('id', editingId);
    if (err) { setError(err.message); setSaving(false); return; }
    setEditingId(null);
    await fetchMensajes();
    setSaving(false);
  };

  const cancelEdit = () => { setEditingId(null); setError(null); };

  // ── Eliminar ───────────────────────────────────────────────────────────────
  const handleDelete = async (id) => {
    if (!window.confirm('¿Eliminar esta respuesta rápida?')) return;
    await supabase.from('wa_mensajes_predefinidos').delete().eq('id', id);
    await fetchMensajes();
  };

  return (
    <div style={{ maxWidth: 720, margin: '0 auto', padding: '32px 24px', fontFamily: "'Google Sans', 'Segoe UI', sans-serif" }}>

      {/* Header */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 24 }}>
        <div>
          <h1 style={{ fontSize: 22, fontWeight: 700, color: '#202124', margin: 0 }}>Respuestas Rápidas</h1>
          <p style={{ fontSize: 13, color: '#6b7280', margin: '4px 0 0' }}>
            Escribe <strong>/</strong> en el chat para acceder a estas respuestas
          </p>
        </div>
        <button
          onClick={() => { setShowNew(true); setError(null); }}
          style={{
            display: 'flex', alignItems: 'center', gap: 6,
            padding: '8px 16px', background: '#25D366', color: 'white',
            border: 'none', borderRadius: 8, cursor: 'pointer',
            fontSize: 14, fontWeight: 600, fontFamily: 'inherit',
          }}
        >
          <Plus size={16} /> Nueva respuesta
        </button>
      </div>

      {/* Error */}
      {error && (
        <div style={{ padding: '10px 14px', background: '#fef2f2', color: '#dc2626', borderRadius: 8, marginBottom: 16, fontSize: 13 }}>
          {error}
        </div>
      )}

      {/* Formulario nueva respuesta */}
      {showNew && (
        <div style={{
          background: '#f0fdf4', border: '1px solid #bbf7d0',
          borderRadius: 10, padding: 16, marginBottom: 20,
        }}>
          <div style={{ fontSize: 13, fontWeight: 600, color: '#166534', marginBottom: 12 }}>Nueva respuesta rápida</div>
          <div style={{ marginBottom: 10 }}>
            <label style={{ fontSize: 12, fontWeight: 600, color: '#374151', display: 'block', marginBottom: 4 }}>
              Título (atajo)
            </label>
            <input
              value={newForm.titulo}
              onChange={e => setNewForm(f => ({ ...f, titulo: e.target.value }))}
              placeholder="ej: visita, precio, disponibilidad..."
              style={{
                width: '100%', padding: '8px 12px', border: '1px solid #d1d5db',
                borderRadius: 8, fontSize: 14, outline: 'none', boxSizing: 'border-box',
              }}
            />
          </div>
          <div style={{ marginBottom: 12 }}>
            <label style={{ fontSize: 12, fontWeight: 600, color: '#374151', display: 'block', marginBottom: 4 }}>
              Contenido del mensaje
            </label>
            <textarea
              value={newForm.contenido}
              onChange={e => setNewForm(f => ({ ...f, contenido: e.target.value }))}
              placeholder="Escribe el mensaje completo..."
              rows={4}
              style={{
                width: '100%', padding: '8px 12px', border: '1px solid #d1d5db',
                borderRadius: 8, fontSize: 14, outline: 'none', resize: 'vertical',
                boxSizing: 'border-box', fontFamily: 'inherit',
              }}
            />
          </div>
          <div style={{ display: 'flex', gap: 8 }}>
            <button
              onClick={handleCreate}
              disabled={saving}
              style={{
                display: 'flex', alignItems: 'center', gap: 5,
                padding: '7px 14px', background: '#25D366', color: 'white',
                border: 'none', borderRadius: 8, cursor: saving ? 'not-allowed' : 'pointer',
                fontSize: 13, fontWeight: 600, fontFamily: 'inherit', opacity: saving ? 0.6 : 1,
              }}
            >
              <Check size={14} /> {saving ? 'Guardando...' : 'Guardar'}
            </button>
            <button
              onClick={() => { setShowNew(false); setNewForm({ titulo: '', contenido: '' }); setError(null); }}
              style={{
                display: 'flex', alignItems: 'center', gap: 5,
                padding: '7px 14px', background: 'white', color: '#374151',
                border: '1px solid #d1d5db', borderRadius: 8, cursor: 'pointer',
                fontSize: 13, fontWeight: 500, fontFamily: 'inherit',
              }}
            >
              <X size={14} /> Cancelar
            </button>
          </div>
        </div>
      )}

      {/* Lista */}
      {loading ? (
        <div style={{ textAlign: 'center', color: '#9ca3af', padding: 40 }}>Cargando...</div>
      ) : mensajes.length === 0 ? (
        <div style={{
          textAlign: 'center', color: '#9ca3af', padding: 48,
          border: '2px dashed #e5e7eb', borderRadius: 12,
        }}>
          <div style={{ fontSize: 32, marginBottom: 8 }}>💬</div>
          <div style={{ fontWeight: 600, marginBottom: 4 }}>No hay respuestas rápidas</div>
          <div style={{ fontSize: 13 }}>Crea tu primera respuesta con el botón de arriba</div>
        </div>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
          {mensajes.map(m => (
            <div key={m.id} style={{
              background: 'white', border: '1px solid #e5e7eb',
              borderRadius: 10, padding: 16,
              boxShadow: '0 1px 3px rgba(0,0,0,0.05)',
            }}>
              {editingId === m.id ? (
                // ── Modo edición ─────────────────────────────────────────────
                <>
                  <div style={{ marginBottom: 10 }}>
                    <label style={{ fontSize: 12, fontWeight: 600, color: '#374151', display: 'block', marginBottom: 4 }}>Título</label>
                    <input
                      value={form.titulo}
                      onChange={e => setForm(f => ({ ...f, titulo: e.target.value }))}
                      style={{
                        width: '100%', padding: '7px 11px', border: '1px solid #d1d5db',
                        borderRadius: 8, fontSize: 14, outline: 'none', boxSizing: 'border-box',
                      }}
                    />
                  </div>
                  <div style={{ marginBottom: 12 }}>
                    <label style={{ fontSize: 12, fontWeight: 600, color: '#374151', display: 'block', marginBottom: 4 }}>Contenido</label>
                    <textarea
                      value={form.contenido}
                      onChange={e => setForm(f => ({ ...f, contenido: e.target.value }))}
                      rows={4}
                      style={{
                        width: '100%', padding: '7px 11px', border: '1px solid #d1d5db',
                        borderRadius: 8, fontSize: 14, outline: 'none', resize: 'vertical',
                        boxSizing: 'border-box', fontFamily: 'inherit',
                      }}
                    />
                  </div>
                  <div style={{ display: 'flex', gap: 8 }}>
                    <button
                      onClick={handleSaveEdit}
                      disabled={saving}
                      style={{
                        display: 'flex', alignItems: 'center', gap: 5,
                        padding: '6px 12px', background: '#1a73e8', color: 'white',
                        border: 'none', borderRadius: 8, cursor: saving ? 'not-allowed' : 'pointer',
                        fontSize: 13, fontWeight: 600, fontFamily: 'inherit', opacity: saving ? 0.6 : 1,
                      }}
                    >
                      <Check size={13} /> {saving ? 'Guardando...' : 'Guardar'}
                    </button>
                    <button
                      onClick={cancelEdit}
                      style={{
                        display: 'flex', alignItems: 'center', gap: 5,
                        padding: '6px 12px', background: 'white', color: '#374151',
                        border: '1px solid #d1d5db', borderRadius: 8, cursor: 'pointer',
                        fontSize: 13, fontWeight: 500, fontFamily: 'inherit',
                      }}
                    >
                      <X size={13} /> Cancelar
                    </button>
                  </div>
                </>
              ) : (
                // ── Modo vista ────────────────────────────────────────────────
                <>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: 12 }}>
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 6 }}>
                        <span style={{
                          fontSize: 12, fontWeight: 700, color: '#25D366',
                          background: '#f0fdf4', border: '1px solid #bbf7d0',
                          borderRadius: 6, padding: '2px 8px',
                        }}>
                          /{m.titulo}
                        </span>
                      </div>
                      <div style={{
                        fontSize: 13, color: '#374151', lineHeight: 1.5,
                        whiteSpace: 'pre-wrap', wordBreak: 'break-word',
                      }}>
                        {m.contenido}
                      </div>
                    </div>
                    <div style={{ display: 'flex', gap: 6, flexShrink: 0 }}>
                      <button
                        onClick={() => startEdit(m)}
                        title="Editar"
                        style={{
                          background: 'none', border: '1px solid #e5e7eb',
                          borderRadius: 8, padding: '6px 8px', cursor: 'pointer',
                          display: 'flex', alignItems: 'center',
                        }}
                      >
                        <Pencil size={14} color="#6b7280" />
                      </button>
                      <button
                        onClick={() => handleDelete(m.id)}
                        title="Eliminar"
                        style={{
                          background: 'none', border: '1px solid #fecaca',
                          borderRadius: 8, padding: '6px 8px', cursor: 'pointer',
                          display: 'flex', alignItems: 'center',
                        }}
                      >
                        <Trash2 size={14} color="#ef4444" />
                      </button>
                    </div>
                  </div>
                </>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
