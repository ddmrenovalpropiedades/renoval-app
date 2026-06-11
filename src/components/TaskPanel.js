import React, { useState, useEffect, useRef } from 'react';
import { X, Trash2, RefreshCw, AlertCircle, Check } from 'lucide-react';
import { supabase } from '../supabaseClient';
import { formatLocalDate } from '../hooks/useTasks';
import AnimatedCheckbox from './AnimatedCheckbox';
// ─── Date picker dd/mm/yyyy ────────────────────────────────────────────────────
function DatePicker({ value, onChange, style = {} }) {
  const fmt = (iso) => {
    if (!iso) return '';
    const [y, m, d] = iso.split('-');
    return `${d}/${m}/${y}`;
  };
  return (
    <div style={{ position: 'relative', display: 'inline-flex', alignItems: 'center', cursor: 'pointer', ...style }}>
      <span style={{ fontSize: 13, fontFamily: 'inherit', color: value ? 'inherit' : '#9aa0a6', pointerEvents: 'none', userSelect: 'none', whiteSpace: 'nowrap' }}>
        {value ? fmt(value) : 'dd/mm/aaaa'}
      </span>
      <input type="date" value={value || ''} onChange={e => onChange(e.target.value)}
        style={{ position: 'absolute', inset: 0, opacity: 0, cursor: 'pointer', width: '100%', height: '100%', border: 'none', padding: 0, margin: 0 }} />
    </div>
  );
}



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

const getCategoryColor = (cat) => {
  const colors = { 'Entrada': '#1565C0', 'Salida': '#2E7D32', 'Equipo': '#6A1B9A', 'Solicitudes': '#E65100', 'Misceláneo': '#37474F' };
  return colors[cat] || '#5f6368';
};

function SaveRecurrenceButton({ onClick }) {
  const [pressed, setPressed] = useState(false);
  const [saved, setSaved] = useState(false);

  const handleClick = async () => {
    setPressed(true);
    await onClick();
    setPressed(false);
    setSaved(true);
    setTimeout(() => setSaved(false), 2000);
  };

  return (
    <button onClick={handleClick} style={{
      ...saveRecBtnStyle,
      transform: pressed ? 'scale(0.96)' : 'scale(1)',
      background: saved ? '#34a853' : '#1a73e8',
    }}>
      <Check size={14} style={{ marginRight: 6 }} />
      {saved ? '✓ Guardada' : 'Guardar recurrencia'}
    </button>
  );
}

const saveRecBtnStyle = {
  marginTop: 12, padding: '8px 16px',
  color: '#fff', border: 'none', borderRadius: 8,
  fontSize: 13, cursor: 'pointer', fontFamily: 'inherit',
  fontWeight: 500, display: 'flex', alignItems: 'center',
  transition: 'all 0.15s ease',
};

export default function TaskPanel({ task, onClose, onUpdate, onDelete, onComplete, createSubtask, getSubtasks, onSubtasksChanged }) {
  const [title, setTitle] = useState(task.title);
  const [notes, setNotes] = useState(task.notes || '');
  const [recurrence, setRecurrence] = useState(task.recurrence || 'none');
  const [recurrenceConfig, setRecurrenceConfig] = useState(task.recurrence_config || {});
  const [subtasks, setSubtasks] = useState([]);
  const [newSubtask, setNewSubtask] = useState('');
  const [urgent, setUrgent] = useState(task.urgent || false);
  const [proxima, setProxima] = useState(task.proxima_vencer || false);
  const [dueDate, setDueDate] = useState(task.due_date || '');
  const [savedMsg, setSavedMsg] = useState('');
  const subtaskInputRef = useRef();

  useEffect(() => { loadSubtasks(); }, [task.id]); // eslint-disable-line

  const loadSubtasks = async () => {
    const data = await getSubtasks(task.id);
    setSubtasks(data);
  };

  const showSaved = (msg = '✓ Guardado') => {
    setSavedMsg(msg);
    setTimeout(() => setSavedMsg(''), 2500);
  };

  const handleSave = async (extra = {}) => {
    if (!title.trim()) return;
    if (task._dormant && Object.keys(extra).length === 0) return; // don't auto-save dormant
    await onUpdate(task.id, {
      title: title.trim(),
      notes: notes.trim() || null,
      recurrence,
      recurrence_config: recurrenceConfig,
      urgent,
      proxima_vencer: proxima,
      due_date: dueDate || null,
      ...extra,
    });
  };

  const handleAddSubtask = async () => {
    if (!newSubtask.trim()) return;
    // Use createSubtask from hook — handles mirroring to Equipo automatically
    const { data } = await createSubtask(task.id, newSubtask.trim());
    if (data) {
      setSubtasks(prev => [...prev, data]);
      if (onSubtasksChanged) onSubtasksChanged();
    }
    setNewSubtask('');
    subtaskInputRef.current?.focus();
  };

  const handleSubtaskKeyDown = (e) => {
    if (e.key === 'Enter') { e.preventDefault(); handleAddSubtask(); }
    if (e.key === 'Escape') setNewSubtask('');
  };

  const handleCompleteSubtask = async (subtask) => {
    await supabase.from('tasks').delete().eq('id', subtask.id);
    const remaining = subtasks.filter(s => s.id !== subtask.id);
    setSubtasks(remaining);
    if (remaining.length === 0) { await onComplete(task); onClose(); }
  };

  const handleDeleteSubtask = async (subtaskId) => {
    await supabase.from('tasks').delete().eq('id', subtaskId);
    setSubtasks(prev => prev.filter(s => s.id !== subtaskId));
  };

  const handleRecurrenceChange = (value) => {
    setRecurrence(value);
    const newConfig = value === 'weekly' ? { weekdays: [1] } :
                      value === 'monthly' ? { day: new Date().getDate() } : {};
    setRecurrenceConfig(newConfig);
  };

  const handleSaveRecurrence = async () => {
    await onUpdate(task.id, { recurrence, recurrence_config: recurrenceConfig });
    showSaved('✓ Recurrencia guardada');
  };

  const toggleProxima = async () => {
    const newVal = !proxima;
    setProxima(newVal);
    if (newVal && urgent) { setUrgent(false); await onUpdate(task.id, { proxima_vencer: true, urgent: false }); }
    else { await onUpdate(task.id, { proxima_vencer: newVal }); }
    showSaved(newVal ? '🟠 Importante/por vencer' : '✓ Prioridad quitada');
  };

  const toggleUrgent = async () => {
    const newVal = !urgent;
    setUrgent(newVal);
    await onUpdate(task.id, { urgent: newVal });
    showSaved(newVal ? '🔴 Marcada como urgente' : '✓ Urgencia quitada');
  };

  const toggleWeekday = (day) => {
    const current = recurrenceConfig.weekdays || [];
    const updated = current.includes(day) ? current.filter(d => d !== day) : [...current, day];
    setRecurrenceConfig({ ...recurrenceConfig, weekdays: updated });
  };

  return (
    <div style={styles.overlay} onClick={e => { if (e.target === e.currentTarget) { handleSave(); onClose(); } }}>
      <div style={styles.panel}>
        {/* Header */}
        <div style={styles.header}>
          <span style={{ ...styles.categoryBadge, background: getCategoryColor(task.category) }}>
            {task.category}
          </span>
          <div style={styles.headerActions}>
            {savedMsg && <span style={styles.savedMsg}>{savedMsg}</span>}
            <button onClick={() => { onDelete(task.id); onClose(); }} style={styles.iconBtn} title="Eliminar">
              <Trash2 size={16} color="#ea4335" />
            </button>
            <button onClick={() => { handleSave(); onClose(); }} style={styles.iconBtn}>
              <X size={18} color="#5f6368" />
            </button>
          </div>
        </div>

        <div style={styles.scrollContent}>
          {/* Banner tarea dormida */}
          {task._dormant && (
            <div style={{ background: '#e8f0fe', padding: '10px 20px', fontSize: 13, color: '#1a73e8', display: 'flex', alignItems: 'center', gap: 8 }}>
              <span>🔄</span>
              <span>Tarea recurrente dormida · próxima aparición: <strong>{task.next_occurrence ? formatLocalDate(task.next_occurrence) : '—'}</strong></span>
            </div>
          )}
          {/* Título */}
          <div style={styles.titleRow}>
            <AnimatedCheckbox 
              onClick={() => { if (!task._dormant) { onComplete(task); onClose(); } }}
              color={task._dormant ? '#9aa0a6' : getCategoryColor(task.category)} 
              urgent={urgent}
              proxima={proxima}
            />
            <textarea
              value={title}
              onChange={e => setTitle(e.target.value)}
              onBlur={() => !task._dormant && handleSave()}
              style={styles.titleInput}
              rows={1}
              placeholder="Título de la tarea"
            />
          </div>

          {/* Urgente */}
          <div style={styles.section}>
            <div style={styles.sectionTitle}>Prioridad</div>
            <button onClick={toggleUrgent} style={{ ...styles.urgentBtn, ...(urgent ? styles.urgentBtnActive : {}) }}>
              <AlertCircle size={14} color={urgent ? '#fff' : '#ea4335'} />
              {urgent ? 'Urgente — click para quitar' : 'Marcar como urgente'}
            </button>
            <button onClick={toggleProxima} style={{ ...styles.proximaBtn, ...(proxima ? styles.proximaBtnActive : {}) }}>
              <AlertCircle size={14} color={proxima ? '#fff' : '#f57c00'} />
              {proxima ? 'Importante/por vencer — click para quitar' : 'Marcar como importante/por vencer'}
            </button>
          </div>

          {/* Fecha límite */}
          <div style={styles.section}>
            <div style={styles.sectionTitle}>Fecha límite</div>
            <DatePicker
                value={dueDate}
                onChange={v => { setDueDate(v); handleSave({ due_date: v || null }); }}
                style={{ border: '1px solid #dadce0', borderRadius: 6, padding: '6px 10px', background: '#fff' }}
              />
            {dueDate && (
              <button onClick={() => { setDueDate(''); handleSave({ due_date: null }); }} style={styles.clearDate}>
                Quitar fecha
              </button>
            )}
          </div>

          {/* Subtareas */}
          <div style={styles.section}>
            <div style={styles.sectionTitle}>
              Subtareas <span style={styles.subtaskCount}>{subtasks.length}</span>
            </div>
            {subtasks.map(sub => (
              <div key={sub.id} style={styles.subtaskRow}
                onMouseEnter={e => { const b = e.currentTarget.querySelector('.del-btn'); if(b) b.style.opacity='1'; }}
                onMouseLeave={e => { const b = e.currentTarget.querySelector('.del-btn'); if(b) b.style.opacity='0'; }}
              >
                <button onClick={() => handleCompleteSubtask(sub)} style={styles.subtaskCheck}>
                  <div style={styles.subtaskCheckInner} />
                </button>
                <span style={styles.subtaskTitle}>{sub.title}</span>
                <button className="del-btn" onClick={() => handleDeleteSubtask(sub.id)}
                  style={{ ...styles.subtaskDelete, opacity: 0, transition: 'opacity 0.15s' }}>
                  <X size={12} color="#9aa0a6" />
                </button>
              </div>
            ))}
            <div style={styles.addSubtaskRow}>
              <button onClick={handleAddSubtask} style={styles.addSubtaskBtn} title="Agregar subtarea">
                <span style={{ color: '#1a73e8', fontSize: 18, lineHeight: 1 }}>+</span>
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
              onBlur={() => handleSave()}
              placeholder="Agregar notas..."
              style={styles.notesInput}
              rows={3}
            />
          </div>

          {/* Recurrencia */}
          <div style={styles.section}>
            <div style={styles.sectionTitle}>
              <RefreshCw size={13} style={{ marginRight: 6 }} /> Repetir
            </div>
            <div style={styles.recurrenceOptions}>
              {RECURRENCE_OPTIONS.map(opt => (
                <button key={opt.value} onClick={() => handleRecurrenceChange(opt.value)}
                  style={{ ...styles.recurrenceBtn, ...(recurrence === opt.value ? styles.recurrenceBtnActive : {}) }}>
                  {opt.label}
                </button>
              ))}
            </div>

            {recurrence === 'weekly' && (
              <div style={styles.recurrenceDetail}>
                <p style={styles.recurrenceDetailLabel}>Repetir los días:</p>
                <div style={styles.weekdayRow}>
                  {WEEKDAYS.map(d => (
                    <button key={d.value} onClick={() => toggleWeekday(d.value)}
                      style={{ ...styles.weekdayBtn, ...((recurrenceConfig.weekdays || []).includes(d.value) ? styles.weekdayBtnActive : {}) }}>
                      {d.label}
                    </button>
                  ))}
                </div>
              </div>
            )}
            {recurrence === 'monthly' && (
              <div style={styles.recurrenceDetail}>
                <p style={styles.recurrenceDetailLabel}>Día del mes:</p>
                <input type="number" min={1} max={31}
                  value={recurrenceConfig.day || new Date().getDate()}
                  onChange={e => setRecurrenceConfig({ ...recurrenceConfig, day: parseInt(e.target.value) })}
                  style={styles.dayInput} />
              </div>
            )}
            {recurrence === 'yearly' && (
              <div style={styles.recurrenceDetail}>
                <p style={styles.recurrenceDetailLabel}>Fecha (día/mes):</p>
                <div style={styles.dateRow}>
                  <input type="number" min={1} max={31} placeholder="Día"
                    value={recurrenceConfig.day || new Date().getDate()}
                    onChange={e => setRecurrenceConfig({ ...recurrenceConfig, day: parseInt(e.target.value) })}
                    style={{ ...styles.dayInput, width: 70 }} />
                  <span style={{ color: '#5f6368' }}>/</span>
                  <input type="number" min={1} max={12} placeholder="Mes"
                    value={recurrenceConfig.month || (new Date().getMonth() + 1)}
                    onChange={e => setRecurrenceConfig({ ...recurrenceConfig, month: parseInt(e.target.value) })}
                    style={{ ...styles.dayInput, width: 70 }} />
                </div>
              </div>
            )}
            {recurrence !== 'none' && (
              <SaveRecurrenceButton onClick={handleSaveRecurrence} />
            )}
          </div>
        </div>

        <div style={styles.footer}>
          <span style={styles.createdAt}>Creada {new Date(task.created_at).toLocaleDateString('es-CL')}</span>
          {task.recurrence && task.recurrence !== 'none' && task.next_occurrence && (
            <span style={styles.nextOccurrence}>Próxima: {new Date(task.next_occurrence).toLocaleDateString('es-CL')}</span>
          )}
        </div>
      </div>
    </div>
  );
}

const styles = {
  overlay: { position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.3)', display: 'flex', justifyContent: 'flex-end', zIndex: 1000 },
  panel: { width: 380, height: '100vh', background: '#fff', boxShadow: '-4px 0 24px rgba(0,0,0,0.12)', display: 'flex', flexDirection: 'column', overflow: 'hidden', fontFamily: "'Google Sans', 'Segoe UI', sans-serif" },
  header: { display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '16px 20px', borderBottom: '1px solid #e8eaed', flexShrink: 0 },
  categoryBadge: { color: '#fff', fontSize: 11, fontWeight: 600, padding: '3px 10px', borderRadius: 20, textTransform: 'uppercase', letterSpacing: 0.5 },
  headerActions: { display: 'flex', alignItems: 'center', gap: 8 },
  savedMsg: { fontSize: 12, color: '#34a853', fontWeight: 500, background: '#e6f4ea', padding: '3px 10px', borderRadius: 20 },
  iconBtn: { background: 'none', border: 'none', cursor: 'pointer', padding: 6, borderRadius: 6, display: 'flex', alignItems: 'center' },
  scrollContent: { flex: 1, overflowY: 'auto', display: 'flex', flexDirection: 'column' },
  titleRow: { display: 'flex', alignItems: 'flex-start', gap: 12, padding: '20px 20px 8px' },
  titleInput: { flex: 1, border: 'none', outline: 'none', fontSize: 18, fontWeight: 500, color: '#202124', resize: 'none', fontFamily: 'inherit', lineHeight: 1.4 },
  section: { padding: '12px 20px', borderTop: '1px solid #f1f3f4' },
  sectionTitle: { fontSize: 12, fontWeight: 600, color: '#5f6368', marginBottom: 10, display: 'flex', alignItems: 'center' },
  urgentBtn: { display: 'flex', alignItems: 'center', gap: 8, padding: '8px 14px', borderRadius: 8, border: '1px solid #ea4335', background: '#fff', color: '#ea4335', fontSize: 13, cursor: 'pointer', fontFamily: 'inherit', fontWeight: 500 },
  urgentBtnActive: { background: '#ea4335', color: '#fff' },
  proximaBtn: { display: 'flex', alignItems: 'center', gap: 8, padding: '8px 14px', borderRadius: 8, border: '1px solid #f57c00', background: '#fff', color: '#f57c00', fontSize: 13, cursor: 'pointer', fontFamily: 'inherit', fontWeight: 500, marginTop: 8 },
  proximaBtnActive: { background: '#f57c00', color: '#fff' },
  dateInput: { padding: '8px 12px', border: '1px solid #dadce0', borderRadius: 8, fontSize: 14, outline: 'none', fontFamily: 'inherit', width: '100%' },
  clearDate: { marginTop: 6, background: 'none', border: 'none', color: '#5f6368', fontSize: 12, cursor: 'pointer', textDecoration: 'underline', padding: 0 },
  subtaskCount: { marginLeft: 6, background: '#e8eaed', color: '#5f6368', fontSize: 11, padding: '1px 7px', borderRadius: 10 },
  subtaskRow: { display: 'flex', alignItems: 'center', gap: 10, padding: '6px 0' },
  subtaskCheck: { width: 18, height: 18, borderRadius: '50%', border: '2px solid #dadce0', background: 'none', cursor: 'pointer', flexShrink: 0, padding: 0, display: 'flex', alignItems: 'center', justifyContent: 'center' },
  subtaskCheckInner: { width: 8, height: 8, borderRadius: '50%' },
  subtaskTitle: { flex: 1, fontSize: 14, color: '#3c4043' },
  subtaskDelete: { background: 'none', border: 'none', cursor: 'pointer', padding: 4 },
  addSubtaskRow: { display: 'flex', alignItems: 'center', gap: 8, paddingTop: 8, borderTop: '1px dashed #e8eaed', marginTop: 4 },
  addSubtaskBtn: { width: 24, height: 24, borderRadius: '50%', border: '2px solid #1a73e8', background: 'none', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0, padding: 0 },
  subtaskInput: { flex: 1, border: 'none', outline: 'none', fontSize: 13, color: '#202124', fontFamily: 'inherit' },
  notesInput: { width: '100%', border: '1px solid #e8eaed', borderRadius: 8, padding: '10px 12px', fontSize: 14, color: '#202124', resize: 'none', fontFamily: 'inherit', outline: 'none' },
  recurrenceOptions: { display: 'flex', flexWrap: 'wrap', gap: 8, marginBottom: 12 },
  recurrenceBtn: { padding: '6px 12px', borderRadius: 20, border: '1px solid #dadce0', background: '#fff', fontSize: 12, cursor: 'pointer', color: '#3c4043' },
  recurrenceBtnActive: { background: '#e8f0fe', borderColor: '#1a73e8', color: '#1a73e8', fontWeight: 600 },
  recurrenceDetail: { marginTop: 4 },
  recurrenceDetailLabel: { fontSize: 12, color: '#5f6368', marginBottom: 8 },
  weekdayRow: { display: 'flex', gap: 6, flexWrap: 'wrap' },
  weekdayBtn: { width: 34, height: 34, borderRadius: '50%', border: '1px solid #dadce0', background: '#fff', fontSize: 12, cursor: 'pointer', color: '#3c4043', display: 'flex', alignItems: 'center', justifyContent: 'center' },
  weekdayBtnActive: { background: '#1a73e8', borderColor: '#1a73e8', color: '#fff', fontWeight: 600 },
  dayInput: { width: 80, padding: '7px 10px', border: '1px solid #dadce0', borderRadius: 8, fontSize: 14, outline: 'none', textAlign: 'center' },
  dateRow: { display: 'flex', alignItems: 'center', gap: 8 },
  saveRecurrenceBtn: { marginTop: 12, padding: '8px 16px', background: '#1a73e8', color: '#fff', border: 'none', borderRadius: 8, fontSize: 13, cursor: 'pointer', fontFamily: 'inherit', fontWeight: 500, display: 'flex', alignItems: 'center' },
  footer: { padding: '14px 20px', borderTop: '1px solid #f1f3f4', display: 'flex', justifyContent: 'space-between', flexShrink: 0 },
  createdAt: { fontSize: 12, color: '#9aa0a6' },
  nextOccurrence: { fontSize: 12, color: '#1a73e8' },
};
