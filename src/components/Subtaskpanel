import React, { useState } from 'react';
import { X, AlertCircle } from 'lucide-react';
import { supabase } from '../supabaseClient';

export default function SubtaskPanel({ subtask, onClose, onUpdate, onComplete }) {
  const [notes, setNotes] = useState(subtask.notes || '');
  const [urgent, setUrgent] = useState(subtask.urgent || false);
  const [dueDate, setDueDate] = useState(subtask.due_date || '');
  const [saved, setSaved] = useState(false);

  const handleSave = async (updates = {}) => {
    const payload = {
      notes: notes.trim() || null,
      urgent,
      due_date: dueDate || null,
      ...updates,
    };
    await supabase.from('tasks').update(payload).eq('id', subtask.id);
    if (onUpdate) onUpdate(subtask.id, payload);
    setSaved(true);
    setTimeout(() => setSaved(false), 2000);
  };

  const toggleUrgent = async () => {
    const newVal = !urgent;
    setUrgent(newVal);
    await supabase.from('tasks').update({ urgent: newVal }).eq('id', subtask.id);
    if (onUpdate) onUpdate(subtask.id, { urgent: newVal });
  };

  return (
    <div style={styles.overlay} onClick={e => { if (e.target === e.currentTarget) { handleSave(); onClose(); } }}>
      <div style={styles.panel}>
        {/* Header */}
        <div style={styles.header}>
          <div style={styles.headerLeft}>
            <span style={styles.subtaskLabel}>SUBTAREA</span>
            {urgent && <AlertCircle size={14} color="#ea4335" />}
          </div>
          <div style={styles.headerActions}>
            {saved && <span style={styles.savedText}>✓ Guardado</span>}
            <button onClick={() => { handleSave(); onClose(); }} style={styles.iconBtn}>
              <X size={18} color="#5f6368" />
            </button>
          </div>
        </div>

        <div style={styles.scrollContent}>
          {/* Título (solo lectura) */}
          <div style={styles.titleRow}>
            <h2 style={styles.title}>{subtask.title}</h2>
          </div>

          {/* Urgente */}
          <div style={styles.section}>
            <div style={styles.sectionTitle}>Prioridad</div>
            <button
              onClick={toggleUrgent}
              style={{ ...styles.urgentBtn, ...(urgent ? styles.urgentBtnActive : {}) }}
            >
              <AlertCircle size={14} color={urgent ? '#fff' : '#ea4335'} />
              {urgent ? 'Urgente — click para quitar' : 'Marcar como urgente'}
            </button>
          </div>

          {/* Fecha límite */}
          <div style={styles.section}>
            <div style={styles.sectionTitle}>Fecha límite</div>
            <input
              type="date"
              value={dueDate}
              onChange={e => setDueDate(e.target.value)}
              onBlur={() => handleSave()}
              style={styles.dateInput}
            />
            {dueDate && (
              <button onClick={() => { setDueDate(''); handleSave({ due_date: null }); }} style={styles.clearDate}>
                Quitar fecha
              </button>
            )}
          </div>

          {/* Notas */}
          <div style={styles.section}>
            <div style={styles.sectionTitle}>Notas</div>
            <textarea
              value={notes}
              onChange={e => setNotes(e.target.value)}
              onBlur={() => handleSave()}
              placeholder="Agregar notas..."
              style={styles.notesInput}
              rows={4}
            />
          </div>
        </div>

        {/* Footer */}
        <div style={styles.footer}>
          <button onClick={() => { onComplete(subtask); onClose(); }} style={styles.completeBtn}>
            ✓ Marcar como completada
          </button>
        </div>
      </div>
    </div>
  );
}

const styles = {
  overlay: {
    position: 'fixed', inset: 0,
    background: 'rgba(0,0,0,0.3)',
    display: 'flex', justifyContent: 'flex-end',
    zIndex: 1100,
  },
  panel: {
    width: 340, height: '100vh',
    background: '#fff',
    boxShadow: '-4px 0 24px rgba(0,0,0,0.12)',
    display: 'flex', flexDirection: 'column',
    fontFamily: "'Google Sans', 'Segoe UI', sans-serif",
  },
  header: {
    display: 'flex', alignItems: 'center',
    justifyContent: 'space-between',
    padding: '16px 20px',
    borderBottom: '1px solid #e8eaed',
    flexShrink: 0,
  },
  headerLeft: { display: 'flex', alignItems: 'center', gap: 8 },
  subtaskLabel: {
    fontSize: 11, fontWeight: 700,
    color: '#5f6368', letterSpacing: 0.8,
    background: '#f1f3f4', padding: '3px 8px',
    borderRadius: 20,
  },
  headerActions: { display: 'flex', alignItems: 'center', gap: 8 },
  savedText: { fontSize: 12, color: '#34a853', fontWeight: 500 },
  iconBtn: {
    background: 'none', border: 'none',
    cursor: 'pointer', padding: 6, borderRadius: 6,
    display: 'flex', alignItems: 'center',
  },
  scrollContent: { flex: 1, overflowY: 'auto' },
  titleRow: { padding: '20px 20px 12px' },
  title: { fontSize: 17, fontWeight: 500, color: '#202124', margin: 0, lineHeight: 1.4 },
  section: { padding: '12px 20px', borderTop: '1px solid #f1f3f4' },
  sectionTitle: { fontSize: 12, fontWeight: 600, color: '#5f6368', marginBottom: 10 },
  urgentBtn: {
    display: 'flex', alignItems: 'center', gap: 8,
    padding: '8px 14px', borderRadius: 8,
    border: '1px solid #ea4335', background: '#fff',
    color: '#ea4335', fontSize: 13, cursor: 'pointer',
    fontFamily: 'inherit', fontWeight: 500,
  },
  urgentBtnActive: { background: '#ea4335', color: '#fff' },
  dateInput: {
    padding: '8px 12px', border: '1px solid #dadce0',
    borderRadius: 8, fontSize: 14, outline: 'none',
    fontFamily: 'inherit', width: '100%',
  },
  clearDate: {
    marginTop: 6, background: 'none', border: 'none',
    color: '#5f6368', fontSize: 12, cursor: 'pointer',
    textDecoration: 'underline', padding: 0,
  },
  notesInput: {
    width: '100%', border: '1px solid #e8eaed',
    borderRadius: 8, padding: '10px 12px',
    fontSize: 14, color: '#202124',
    resize: 'none', fontFamily: 'inherit', outline: 'none',
  },
  footer: {
    padding: '16px 20px',
    borderTop: '1px solid #f1f3f4',
    flexShrink: 0,
  },
  completeBtn: {
    width: '100%', padding: '10px',
    background: '#e8f0fe', color: '#1a73e8',
    border: 'none', borderRadius: 8,
    fontSize: 14, fontWeight: 500,
    cursor: 'pointer', fontFamily: 'inherit',
  },
};
