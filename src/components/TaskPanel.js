import React, { useState, useEffect, useRef } from 'react';
import { X, Plus, Trash2, RefreshCw, ChevronDown, GripVertical, Check } from 'lucide-react';
import { USER_INITIALS } from '../supabaseClient';

const RECURRENCE_OPTIONS = [
  { value: 'none',    label: 'No se repite' },
  { value: 'daily',   label: 'Diariamente' },
  { value: 'weekly',  label: 'Semanalmente' },
  { value: 'monthly', label: 'Mensualmente' },
  { value: 'yearly',  label: 'Anualmente' },
];

const WORKERS = Object.entries(USER_INITIALS).map(([email, initials]) => ({ email, initials }));

export default function TaskPanel({ task, onClose, onUpdate, onDelete, onComplete, createSubtask, getSubtasks }) {
  const [title, setTitle] = useState(task.title);
  const [notes, setNotes] = useState(task.notes || '');
  const [recurrence, setRecurrence] = useState(task.recurrence || 'none');
  const [subtasks, setSubtasks] = useState([]);
  const [newSubtask, setNewSubtask] = useState('');
  const [assignedTo, setAssignedTo] = useState(task.assigned_to || '');
  const [saving, setSaving] = useState(false);
  const titleRef = useRef();

  useEffect(() => {
    loadSubtasks();
  }, [task.id]);

  const loadSubtasks = async () => {
    const data = await getSubtasks(task.id);
    setSubtasks(data);
  };

  const handleSave = async () => {
    if (!title.trim()) return;
    setSaving(true);
    await onUpdate(task.id, {
      title: title.trim(),
      notes: notes.trim() || null,
      recurrence,
      assigned_to: assignedTo || null,
    });
    setSaving(false);
  };

  const handleAddSubtask = async (e) => {
    e.preventDefault();
    if (!newSubtask.trim()) return;
    const { data } = await createSubtask(task.id, newSubtask.trim());
    if (data) setSubtasks(prev => [...prev, data]);
    setNewSubtask('');
  };

  const handleCompleteSubtask = async (subtask) => {
const { supabase } = await import('../supabaseClient');
    await supabase.from('tasks').delete().eq('id', subtask.id);
    const remaining = subtasks.filter(s => s.id !== subtask.id);
    setSubtasks(remaining);
    // Si no quedan subtareas, completar la tarea principal
    if (remaining.length === 0) {
      await onComplete(task);
      onClose();
    }
  };

  const handleDeleteSubtask = async (subtaskId) => {
    const { supabase } = await import('../supabaseClient');
    await supabase.from('tasks').delete().eq('id', subtaskId);
    setSubtasks(prev => prev.filter(s => s.id !== subtaskId));
  };

  const isSolicitud = task.category === 'Solicitudes';

  return (
    <div style={styles.overlay} onClick={(e) => { if (e.target === e.currentTarget) { handleSave(); onClose(); } }}>
      <div style={styles.panel}>
        {/* Header */}
        <div style={styles.header}>
          <span style={{ ...styles.categoryBadge, background: getCategoryColor(task.category) }}>
            {task.category}
          </span>
          <div style={styles.headerActions}>
            {saving && <span style={styles.savingText}>Guardando...</span>}
            <button onClick={() => { onDelete(task.id); onClose(); }} style={styles.iconBtn} title="Eliminar tarea">
              <Trash2 size={16} color="#ea4335" />
            </button>
            <button onClick={() => { handleSave(); onClose(); }} style={styles.iconBtn} title="Cerrar">
              <X size={18} color="#5f6368" />
            </button>
          </div>
        </div>

        {/* Título */}
        <div style={styles.titleRow}>
          <button onClick={() => { onComplete(task); onClose(); }} style={styles.completeBtn} title="Marcar como completada">
            <Check size={18} color="#1a73e8" />
          </button>
          <textarea
            ref={titleRef}
            value={title}
            onChange={e => setTitle(e.target.value)}
            onBlur={handleSave}
            style={styles.titleInput}
            rows={1}
            placeholder="Título de la tarea"
          />
        </div>

        {/* Destinatario (solo Solicitudes) */}
        {isSolicitud && (
          <div style={styles.field}>
            <label style={styles.fieldLabel}>Asignar a</label>
            <select
              value={assignedTo}
              onChange={e => setAssignedTo(e.target.value)}
              onBlur={handleSave}
              style={styles.select}
            >
              <option value="">Seleccionar usuario</option>
              {WORKERS.map(w => (
                <option key={w.email} value={w.email}>{w.initials} — {w.email}</option>
              ))}
            </select>
          </div>
        )}

        {/* Subtareas */}
        <div style={styles.section}>
          <div style={styles.sectionTitle}>
            <span>Subtareas</span>
            <span style={styles.subtaskCount}>{subtasks.length}</span>
          </div>
          {subtasks.map(sub => (
            <div key={sub.id} style={styles.subtaskRow}>
              <button onClick={() => handleCompleteSubtask(sub)} style={styles.subtaskCheck}>
                <div style={styles.subtaskCheckBox} />
              </button>
              <span style={styles.subtaskTitle}>{sub.title}</span>
              <button onClick={() => handleDeleteSubtask(sub.id)} style={styles.subtaskDelete}>
                <X size={12} color="#9aa0a6" />
              </button>
            </div>
          ))}
          <form onSubmit={handleAddSubtask} style={styles.addSubtaskRow}>
            <Plus size={14} color="#5f6368" />
            <input
              value={newSubtask}
              onChange={e => setNewSubtask(e.target.value)}
              placeholder="Agregar subtarea"
              style={styles.subtaskInput}
            />
          </form>
        </div>

        {/* Notas */}
        <div style={styles.section}>
          <div style={styles.sectionTitle}>Notas</div>
          <textarea
            value={notes}
            onChange={e => setNotes(e.target.value)}
            onBlur={handleSave}
            placeholder="Agregar notas..."
            style={styles.notesInput}
            rows={3}
          />
        </div>

        {/* Recurrencia */}
        <div style={styles.section}>
          <div style={styles.sectionTitle}>
            <RefreshCw size={13} style={{ marginRight: 6 }} />
            Repetir
          </div>
          <div style={styles.recurrenceOptions}>
            {RECURRENCE_OPTIONS.map(opt => (
              <button
                key={opt.value}
                onClick={() => { setRecurrence(opt.value); onUpdate(task.id, { recurrence: opt.value }); }}
                style={{
                  ...styles.recurrenceBtn,
                  ...(recurrence === opt.value ? styles.recurrenceBtnActive : {}),
                }}
              >
                {opt.label}
              </button>
            ))}
          </div>
        </div>

        {/* Footer */}
        <div style={styles.footer}>
          <span style={styles.createdAt}>
            Creada {new Date(task.created_at).toLocaleDateString('es-CL')}
          </span>
          {task.recurrence && task.recurrence !== 'none' && task.next_occurrence && (
            <span style={styles.nextOccurrence}>
              Próxima: {new Date(task.next_occurrence).toLocaleDateString('es-CL')}
            </span>
          )}
        </div>
      </div>
    </div>
  );
}

function getCategoryColor(cat) {
  const colors = {
    'Entrada': '#1565C0', 'Salida': '#2E7D32',
    'Equipo': '#6A1B9A', 'Solicitudes': '#E65100', 'Misceláneo': '#37474F',
  };
  return colors[cat] || '#5f6368';
}

const styles = {
  overlay: {
    position: 'fixed', inset: 0,
    background: 'rgba(0,0,0,0.3)',
    display: 'flex', justifyContent: 'flex-end',
    zIndex: 1000,
  },
  panel: {
    width: 380, height: '100vh',
    background: '#fff',
    boxShadow: '-4px 0 24px rgba(0,0,0,0.12)',
    display: 'flex', flexDirection: 'column',
    overflow: 'hidden',
    fontFamily: "'Google Sans', 'Segoe UI', sans-serif",
  },
  header: {
    display: 'flex', alignItems: 'center',
    justifyContent: 'space-between',
    padding: '16px 20px',
    borderBottom: '1px solid #e8eaed',
  },
  categoryBadge: {
    color: '#fff', fontSize: 11, fontWeight: 600,
    padding: '3px 10px', borderRadius: 20,
    textTransform: 'uppercase', letterSpacing: 0.5,
  },
  headerActions: { display: 'flex', alignItems: 'center', gap: 8 },
  savingText: { fontSize: 12, color: '#9aa0a6' },
  iconBtn: {
    background: 'none', border: 'none', cursor: 'pointer',
    padding: 6, borderRadius: 6, display: 'flex', alignItems: 'center',
  },
  titleRow: {
    display: 'flex', alignItems: 'flex-start',
    gap: 12, padding: '20px 20px 8px',
  },
  completeBtn: {
    width: 28, height: 28, borderRadius: '50%',
    border: '2px solid #1a73e8', background: 'none',
    cursor: 'pointer', display: 'flex',
    alignItems: 'center', justifyContent: 'center',
    flexShrink: 0, marginTop: 2,
  },
  titleInput: {
    flex: 1, border: 'none', outline: 'none',
    fontSize: 18, fontWeight: 500, color: '#202124',
    resize: 'none', fontFamily: 'inherit',
    lineHeight: 1.4,
  },
  field: { padding: '8px 20px' },
  fieldLabel: { fontSize: 12, color: '#5f6368', marginBottom: 6, display: 'block' },
  select: {
    width: '100%', padding: '8px 12px',
    border: '1px solid #dadce0', borderRadius: 8,
    fontSize: 14, color: '#202124',
    background: '#fff', cursor: 'pointer',
  },
  section: {
    padding: '12px 20px',
    borderTop: '1px solid #f1f3f4',
  },
  sectionTitle: {
    fontSize: 12, fontWeight: 600, color: '#5f6368',
    marginBottom: 10, display: 'flex', alignItems: 'center',
  },
  subtaskCount: {
    marginLeft: 6, background: '#e8eaed',
    color: '#5f6368', fontSize: 11,
    padding: '1px 7px', borderRadius: 10,
  },
  subtaskRow: {
    display: 'flex', alignItems: 'center',
    gap: 10, padding: '6px 0',
  },
  subtaskCheck: {
    width: 18, height: 18, borderRadius: '50%',
    border: '2px solid #dadce0', background: 'none',
    cursor: 'pointer', flexShrink: 0, padding: 0,
    display: 'flex', alignItems: 'center', justifyContent: 'center',
  },
  subtaskCheckBox: { width: 8, height: 8, borderRadius: '50%' },
  subtaskTitle: { flex: 1, fontSize: 14, color: '#3c4043' },
  subtaskDelete: {
    background: 'none', border: 'none',
    cursor: 'pointer', padding: 4, opacity: 0,
  },
  addSubtaskRow: {
    display: 'flex', alignItems: 'center',
    gap: 10, padding: '6px 0',
  },
  subtaskInput: {
    flex: 1, border: 'none', outline: 'none',
    fontSize: 14, color: '#202124',
    fontFamily: 'inherit',
  },
  notesInput: {
    width: '100%', border: '1px solid #e8eaed',
    borderRadius: 8, padding: '10px 12px',
    fontSize: 14, color: '#202124',
    resize: 'none', fontFamily: 'inherit',
    outline: 'none',
  },
  recurrenceOptions: {
    display: 'flex', flexWrap: 'wrap', gap: 8,
  },
  recurrenceBtn: {
    padding: '6px 12px', borderRadius: 20,
    border: '1px solid #dadce0', background: '#fff',
    fontSize: 12, cursor: 'pointer', color: '#3c4043',
  },
  recurrenceBtnActive: {
    background: '#e8f0fe', borderColor: '#1a73e8',
    color: '#1a73e8', fontWeight: 600,
  },
  footer: {
    marginTop: 'auto', padding: '16px 20px',
    borderTop: '1px solid #f1f3f4',
    display: 'flex', justifyContent: 'space-between',
  },
  createdAt: { fontSize: 12, color: '#9aa0a6' },
  nextOccurrence: { fontSize: 12, color: '#1a73e8' },
};
