import React, { useState, useEffect, useRef } from 'react';
import { X, Plus, Trash2, RefreshCw, Check } from 'lucide-react';
import { USER_INITIALS } from '../supabaseClient';

const RECURRENCE_OPTIONS = [
  { value: 'none',    label: 'No se repite' },
  { value: 'daily',   label: 'Diariamente' },
  { value: 'weekly',  label: 'Semanalmente' },
  { value: 'monthly', label: 'Mensualmente' },
  { value: 'yearly',  label: 'Anualmente' },
];

const WEEKDAYS = [
  { value: 1, label: 'Lu' }, { value: 2, label: 'Ma' }, { value: 3, label: 'Mi' },
  { value: 4, label: 'Ju' }, { value: 5, label: 'Vi' }, { value: 6, label: 'Sa' },
  { value: 0, label: 'Do' },
];

const WORKERS = Object.entries(USER_INITIALS).map(([email, initials]) => ({ email, initials }));

export default function TaskPanel({ task, onClose, onUpdate, onDelete, onComplete, createSubtask, getSubtasks }) {
  const [title, setTitle] = useState(task.title);
  const [notes, setNotes] = useState(task.notes || '');
  const [recurrence, setRecurrence] = useState(task.recurrence || 'none');
  const [recurrenceConfig, setRecurrenceConfig] = useState(task.recurrence_config || {});
  const [subtasks, setSubtasks] = useState([]);
  const [newSubtask, setNewSubtask] = useState('');
  const [assignedTo, setAssignedTo] = useState(task.assigned_to || '');
  const [saving, setSaving] = useState(false);
  const titleRef = useRef();
  const subtaskInputRef = useRef();

  useEffect(() => {
    loadSubtasks();
  }, [task.id]); // eslint-disable-line react-hooks/exhaustive-deps

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
      recurrence_config: recurrenceConfig,
      assigned_to: assignedTo || null,
    });
    setSaving(false);
  };

  const handleAddSubtask = async () => {
    if (!newSubtask.trim()) return;
    const { data } = await createSubtask(task.id, newSubtask.trim());
    if (data) setSubtasks(prev => [...prev, data]);
    setNewSubtask('');
    subtaskInputRef.current?.focus();
  };

  const handleSubtaskKeyDown = (e) => {
    if (e.key === 'Enter') { e.preventDefault(); handleAddSubtask(); }
    if (e.key === 'Escape') setNewSubtask('');
  };

  const handleCompleteSubtask = async (subtask) => {
    const { supabase } = await import('../supabaseClient');
    await supabase.from('tasks').delete().eq('id', subtask.id);
    const remaining = subtasks.filter(s => s.id !== subtask.id);
    setSubtasks(remaining);
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

  const handleRecurrenceChange = (value) => {
    setRecurrence(value);
    const newConfig = value === 'weekly' ? { weekdays: [1] } :
                      value === 'monthly' ? { day: new Date().getDate() } : {};
    setRecurrenceConfig(newConfig);
  };

  const handleSaveRecurrence = () => {
    onUpdate(task.id, { recurrence, recurrence_config: recurrenceConfig });
  };

  const toggleWeekday = (day) => {
    const current = recurrenceConfig.weekdays || [];
    const updated = current.includes(day) ? current.filter(d => d !== day) : [...current, day];
    setRecurrenceConfig({ ...recurrenceConfig, weekdays: updated });
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

        {/* Contenido scrolleable */}
        <div style={styles.scrollContent}>

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
              <div key={sub.id} style={styles.subtaskRow}
                onMouseEnter={e => e.currentTarget.querySelector('.del-btn').style.opacity = '1'}
                onMouseLeave={e => e.currentTarget.querySelector('.del-btn').style.opacity = '0'}
              >
                <button onClick={() => handleCompleteSubtask(sub)} style={styles.subtaskCheck}>
                  <div style={styles.subtaskCheckBox} />
                </button>
                <span style={styles.subtaskTitle}>{sub.title}</span>
                <button
                  className="del-btn"
                  onClick={() => handleDeleteSubtask(sub.id)}
                  style={{ ...styles.subtaskDelete, opacity: 0, transition: 'opacity 0.15s' }}
                >
                  <X size={12} color="#9aa0a6" />
                </button>
              </div>
            ))}

            {/* Input nueva subtarea */}
            <div style={styles.addSubtaskRow}>
              <button onClick={handleAddSubtask} style={styles.addSubtaskBtn} title="Agregar subtarea">
                <Plus size={14} color="#1a73e8" />
              </button>
              <input
                ref={subtaskInputRef}
                value={newSubtask}
                onChange={e => setNewSubtask(e.target.value)}
                onKeyDown={handleSubtaskKeyDown}
                placeholder="Agregar subtarea (Enter para confirmar)"
                style={styles.subtaskInput}
              />
            </div>
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
                  onClick={() => handleRecurrenceChange(opt.value)}
                  style={{
                    ...styles.recurrenceBtn,
                    ...(recurrence === opt.value ? styles.recurrenceBtnActive : {}),
                  }}
                >
                  {opt.label}
                </button>
              ))}
            </div>

            {/* Config semanal: elegir días */}
            {recurrence === 'weekly' && (
              <div style={styles.recurrenceDetail}>
                <p style={styles.recurrenceDetailLabel}>Repetir los días:</p>
                <div style={styles.weekdayRow}>
                  {WEEKDAYS.map(d => (
                    <button
                      key={d.value}
                      onClick={() => toggleWeekday(d.value)}
                      style={{
                        ...styles.weekdayBtn,
                        ...((recurrenceConfig.weekdays || []).includes(d.value) ? styles.weekdayBtnActive : {}),
                      }}
                    >
                      {d.label}
                    </button>
                  ))}
                </div>
              </div>
            )}

            {/* Config mensual: elegir día del mes */}
            {recurrence === 'monthly' && (
              <div style={styles.recurrenceDetail}>
                <p style={styles.recurrenceDetailLabel}>Día del mes:</p>
                <input
                  type="number"
                  min={1} max={31}
                  value={recurrenceConfig.day || new Date().getDate()}
                  onChange={e => setRecurrenceConfig({ ...recurrenceConfig, day: parseInt(e.target.value) })}
                  style={styles.dayInput}
                />
              </div>
            )}

            {/* Config anual: elegir fecha */}
            {recurrence === 'yearly' && (
              <div style={styles.recurrenceDetail}>
                <p style={styles.recurrenceDetailLabel}>Fecha (día/mes):</p>
                <div style={styles.dateRow}>
                  <input
                    type="number" min={1} max={31} placeholder="Día"
                    value={recurrenceConfig.day || new Date().getDate()}
                    onChange={e => setRecurrenceConfig({ ...recurrenceConfig, day: parseInt(e.target.value) })}
                    style={{ ...styles.dayInput, width: 70 }}
                  />
                  <span style={{ color: '#5f6368' }}>/</span>
                  <input
                    type="number" min={1} max={12} placeholder="Mes"
                    value={recurrenceConfig.month || (new Date().getMonth() + 1)}
                    onChange={e => setRecurrenceConfig({ ...recurrenceConfig, month: parseInt(e.target.value) })}
                    style={{ ...styles.dayInput, width: 70 }}
                  />
                </div>
              </div>
            )}

            {recurrence !== 'none' && (
              <button onClick={handleSaveRecurrence} style={styles.saveRecurrenceBtn}>
                Guardar recurrencia
              </button>
            )}
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
    flexShrink: 0,
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
  scrollContent: {
    flex: 1, overflowY: 'auto',
    display: 'flex', flexDirection: 'column',
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
    resize: 'none', fontFamily: 'inherit', lineHeight: 1.4,
  },
  field: { padding: '8px 20px' },
  fieldLabel: { fontSize: 12, color: '#5f6368', marginBottom: 6, display: 'block' },
  select: {
    width: '100%', padding: '8px 12px',
    border: '1px solid #dadce0', borderRadius: 8,
    fontSize: 14, color: '#202124',
    background: '#fff', cursor: 'pointer',
  },
  section: { padding: '12px 20px', borderTop: '1px solid #f1f3f4' },
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
    cursor: 'pointer', padding: 4,
  },
  addSubtaskRow: {
    display: 'flex', alignItems: 'center',
    gap: 8, paddingTop: 8,
    borderTop: '1px dashed #e8eaed',
    marginTop: 4,
  },
  addSubtaskBtn: {
    width: 24, height: 24, borderRadius: '50%',
    border: '2px solid #1a73e8', background: 'none',
    cursor: 'pointer', display: 'flex',
    alignItems: 'center', justifyContent: 'center',
    flexShrink: 0, padding: 0,
  },
  subtaskInput: {
    flex: 1, border: 'none', outline: 'none',
    fontSize: 13, color: '#202124',
    fontFamily: 'inherit',
  },
  notesInput: {
    width: '100%', border: '1px solid #e8eaed',
    borderRadius: 8, padding: '10px 12px',
    fontSize: 14, color: '#202124',
    resize: 'none', fontFamily: 'inherit', outline: 'none',
  },
  recurrenceOptions: { display: 'flex', flexWrap: 'wrap', gap: 8, marginBottom: 12 },
  recurrenceBtn: {
    padding: '6px 12px', borderRadius: 20,
    border: '1px solid #dadce0', background: '#fff',
    fontSize: 12, cursor: 'pointer', color: '#3c4043',
  },
  recurrenceBtnActive: {
    background: '#e8f0fe', borderColor: '#1a73e8',
    color: '#1a73e8', fontWeight: 600,
  },
  recurrenceDetail: { marginTop: 4 },
  recurrenceDetailLabel: { fontSize: 12, color: '#5f6368', marginBottom: 8 },
  weekdayRow: { display: 'flex', gap: 6, flexWrap: 'wrap' },
  weekdayBtn: {
    width: 34, height: 34, borderRadius: '50%',
    border: '1px solid #dadce0', background: '#fff',
    fontSize: 12, cursor: 'pointer', color: '#3c4043',
    display: 'flex', alignItems: 'center', justifyContent: 'center',
  },
  weekdayBtnActive: {
    background: '#1a73e8', borderColor: '#1a73e8',
    color: '#fff', fontWeight: 600,
  },
  dayInput: {
    width: 80, padding: '7px 10px',
    border: '1px solid #dadce0', borderRadius: 8,
    fontSize: 14, outline: 'none', textAlign: 'center',
  },
  dateRow: { display: 'flex', alignItems: 'center', gap: 8 },
  saveRecurrenceBtn: {
    marginTop: 12, padding: '8px 16px',
    background: '#1a73e8', color: '#fff',
    border: 'none', borderRadius: 8,
    fontSize: 13, cursor: 'pointer',
    fontFamily: 'inherit', fontWeight: 500,
  },
  footer: {
    padding: '14px 20px',
    borderTop: '1px solid #f1f3f4',
    display: 'flex', justifyContent: 'space-between',
    flexShrink: 0,
  },
  createdAt: { fontSize: 12, color: '#9aa0a6' },
  nextOccurrence: { fontSize: 12, color: '#1a73e8' },
};
