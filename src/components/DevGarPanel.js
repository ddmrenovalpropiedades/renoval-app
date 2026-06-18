import React, { useState, useEffect } from 'react';
import { supabase } from '../supabaseClient';
import { X, Trash2, Edit2, Check } from 'lucide-react';

const formatDate = (iso) => {
  if (!iso) return '';
  const [y, m, d] = iso.split('-');
  return `${d}/${m}/${y}`;
};

export default function DevGarPanel({ onClose }) {
  const [tasks, setTasks] = useState([]);
  const [loading, setLoading] = useState(true);
  const [editingId, setEditingId] = useState(null);
  const [editDate, setEditDate] = useState('');
  const [confirmDelete, setConfirmDelete] = useState(null);

  useEffect(() => {
    fetchDevGar();
  }, []);

  const fetchDevGar = async () => {
    setLoading(true);
    const today = new Date().toISOString().split('T')[0];
    const { data } = await supabase
      .from('tasks')
      .select('*')
      .ilike('title', 'Dev Gar%')
      .gt('next_occurrence', today)
      .order('next_occurrence', { ascending: true });
    setTasks(data || []);
    setLoading(false);
  };

  const handleSaveDate = async (id) => {
    if (!editDate) return;
    await supabase.from('tasks').update({ next_occurrence: editDate }).eq('id', id);
    setTasks(prev => prev.map(t => t.id === id ? { ...t, next_occurrence: editDate } : t));
    setEditingId(null);
    setEditDate('');
  };

  const handleDelete = async (id) => {
    if (confirmDelete !== id) { setConfirmDelete(id); return; }
    await supabase.from('tasks').delete().eq('id', id);
    setTasks(prev => prev.filter(t => t.id !== id));
    setConfirmDelete(null);
  };

  const s = styles;

  return (
    <div style={s.overlay} onClick={e => e.target === e.currentTarget && onClose()}>
      <div style={s.panel}>
        <div style={s.header}>
          <div>
            <span style={s.title}>Tareas Dev Gar programadas</span>
            <div style={s.subtitle}>Devolución de garantía pendiente de notificar</div>
          </div>
          <button onClick={onClose} style={s.closeBtn}><X size={18} color="#5f6368" /></button>
        </div>

        <div style={s.body}>
          {loading ? (
            <div style={s.empty}>Cargando...</div>
          ) : tasks.length === 0 ? (
            <div style={s.empty}>No hay tareas Dev Gar programadas.</div>
          ) : (
            tasks.map(task => (
              <div key={task.id} style={s.card}>
                <div style={s.cardTitle}>{task.title}</div>
                <div style={s.cardMeta}>
                  <span style={s.ownerBadge}>{task.owner_email?.split('@')[0]}</span>
                  <span style={s.category}>{task.category}</span>
                </div>

                <div style={s.dateRow}>
                  <span style={s.dateLabel}>Fecha programada:</span>
                  {editingId === task.id ? (
                    <div style={s.editRow}>
                      <input
                        type="date"
                        value={editDate}
                        onChange={e => setEditDate(e.target.value)}
                        style={s.dateInput}
                        autoFocus
                      />
                      <button onClick={() => handleSaveDate(task.id)} style={s.saveBtn}>
                        <Check size={13} />
                      </button>
                      <button onClick={() => setEditingId(null)} style={s.cancelBtn}>
                        <X size={13} />
                      </button>
                    </div>
                  ) : (
                    <div style={s.editRow}>
                      <span style={s.dateValue}>{formatDate(task.next_occurrence)}</span>
                      <button
                        onClick={() => { setEditingId(task.id); setEditDate(task.next_occurrence); }}
                        style={s.editBtn}
                        title="Editar fecha"
                      >
                        <Edit2 size={13} color="#5f6368" />
                      </button>
                    </div>
                  )}
                </div>

                <div style={s.actions}>
                  {confirmDelete === task.id ? (
                    <>
                      <span style={s.confirmText}>¿Eliminar esta tarea?</span>
                      <button onClick={() => handleDelete(task.id)} style={s.deleteBtnConfirm}>Sí, eliminar</button>
                      <button onClick={() => setConfirmDelete(null)} style={s.cancelBtnSm}>Cancelar</button>
                    </>
                  ) : (
                    <button onClick={() => handleDelete(task.id)} style={s.deleteBtn}>
                      <Trash2 size={13} style={{ marginRight: 4 }} /> Eliminar
                    </button>
                  )}
                </div>
              </div>
            ))
          )}
        </div>
      </div>
    </div>
  );
}

const styles = {
  overlay: { position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.35)', display: 'flex', alignItems: 'flex-start', justifyContent: 'flex-end', zIndex: 2000 },
  panel: { background: '#fff', width: 420, height: '100vh', display: 'flex', flexDirection: 'column', boxShadow: '-4px 0 24px rgba(0,0,0,0.15)', fontFamily: "'Google Sans','Segoe UI',sans-serif" },
  header: { display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', padding: '20px 24px 16px', borderBottom: '1px solid #e8eaed', flexShrink: 0 },
  title: { fontSize: 16, fontWeight: 700, color: '#202124', display: 'block' },
  subtitle: { fontSize: 12, color: '#5f6368', marginTop: 2 },
  closeBtn: { background: 'none', border: 'none', cursor: 'pointer', padding: 4, borderRadius: 6, display: 'flex', flexShrink: 0 },
  body: { flex: 1, overflowY: 'auto', padding: '16px 24px' },
  empty: { padding: 32, textAlign: 'center', color: '#9aa0a6', fontSize: 14 },
  card: { background: '#f8f9fa', border: '1px solid #e8eaed', borderRadius: 10, padding: '14px 16px', marginBottom: 12 },
  cardTitle: { fontSize: 14, fontWeight: 600, color: '#202124', marginBottom: 6 },
  cardMeta: { display: 'flex', gap: 8, marginBottom: 10 },
  ownerBadge: { fontSize: 11, fontWeight: 700, background: '#e8f0fe', color: '#1a73e8', borderRadius: 20, padding: '2px 8px' },
  category: { fontSize: 11, color: '#5f6368', background: '#f1f3f4', borderRadius: 20, padding: '2px 8px' },
  dateRow: { display: 'flex', alignItems: 'center', gap: 8, marginBottom: 10 },
  dateLabel: { fontSize: 12, color: '#5f6368', fontWeight: 500, flexShrink: 0 },
  editRow: { display: 'flex', alignItems: 'center', gap: 6 },
  dateValue: { fontSize: 13, fontWeight: 600, color: '#202124' },
  dateInput: { border: '1px solid #1a73e8', borderRadius: 6, padding: '4px 8px', fontSize: 12, outline: 'none', fontFamily: 'inherit' },
  saveBtn: { background: '#e6f4ea', border: 'none', borderRadius: 6, padding: '4px 6px', cursor: 'pointer', color: '#34a853', display: 'flex' },
  cancelBtn: { background: 'none', border: 'none', borderRadius: 6, padding: '4px 6px', cursor: 'pointer', color: '#5f6368', display: 'flex' },
  editBtn: { background: 'none', border: 'none', cursor: 'pointer', padding: 4, borderRadius: 5, display: 'flex' },
  actions: { display: 'flex', alignItems: 'center', gap: 8 },
  deleteBtn: { display: 'flex', alignItems: 'center', padding: '5px 10px', background: 'none', border: '1px solid #dadce0', borderRadius: 6, fontSize: 12, color: '#ea4335', cursor: 'pointer', fontFamily: 'inherit' },
  deleteBtnConfirm: { padding: '5px 12px', background: '#ea4335', color: '#fff', border: 'none', borderRadius: 6, fontSize: 12, cursor: 'pointer', fontFamily: 'inherit' },
  cancelBtnSm: { padding: '5px 10px', background: 'none', border: '1px solid #dadce0', borderRadius: 6, fontSize: 12, cursor: 'pointer', fontFamily: 'inherit', color: '#5f6368' },
  confirmText: { fontSize: 12, color: '#ea4335', fontWeight: 500 },
};
