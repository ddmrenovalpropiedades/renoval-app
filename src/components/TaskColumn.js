import React, { useState, useEffect } from 'react';
import { useSortable, SortableContext, verticalListSortingStrategy } from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';
import { Plus, RefreshCw, ChevronDown, ChevronRight, AlertCircle } from 'lucide-react';
import { supabase, USER_INITIALS } from '../supabaseClient';
import AnimatedCheckbox from './AnimatedCheckbox';
import SubtaskPanel from './SubtaskPanel';

const CATEGORY_COLORS = {
  'Entrada':     { header: '#1565C0', light: '#E3F2FD' },
  'Salida':      { header: '#2E7D32', light: '#E8F5E9' },
  'Equipo':      { header: '#6A1B9A', light: '#F3E5F5' },
  'Solicitudes': { header: '#E65100', light: '#FFF3E0' },
  'Misceláneo':  { header: '#37474F', light: '#ECEFF1' },
};

const WORKERS = Object.entries(USER_INITIALS).map(([email, initials]) => ({ email, initials }));

// Subtarea en el listado
function SubtaskItem({ subtask, onComplete, onOpen }) {
  return (
    <div style={styles.subtaskItem}>
      <AnimatedCheckbox onClick={() => onComplete(subtask)} size={16} color="#1a73e8" urgent={subtask.urgent} />
      <span onClick={() => onOpen(subtask)} style={{ ...styles.subtaskLabel, cursor: 'pointer' }}>
        {subtask.title}
      </span>
      {subtask.urgent && <AlertCircle size={11} color="#ea4335" style={{ flexShrink: 0 }} />}
      {subtask.due_date && new Date(subtask.due_date) < new Date() && (
        <span style={styles.overdueDot} title="Vencida" />
      )}
    </div>
  );
}

// Tarea principal
function TaskItem({ task, onOpen, onComplete, categoryColor, ownerInitials }) {
  const [subtasks, setSubtasks] = useState([]);
  const [expanded, setExpanded] = useState(true);
  const [selectedSubtask, setSelectedSubtask] = useState(null);

  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({ id: task.id });
  const style = { transform: CSS.Transform.toString(transform), transition, opacity: isDragging ? 0.5 : 1 };

  useEffect(() => { loadSubtasks(); }, [task.id]); // eslint-disable-line

  const loadSubtasks = async () => {
    const { data } = await supabase
      .from('tasks')
      .select('*')
      .eq('parent_id', task.id)
      .eq('completed', false)
      .order('position', { ascending: true });
    setSubtasks(data || []);
  };

  // Refrescar subtareas cuando cambia el panel
  const handleSubtaskUpdate = (id, updates) => {
    setSubtasks(prev => prev.map(s => s.id === id ? { ...s, ...updates } : s));
  };

  const handleCompleteSubtask = async (subtask) => {
    await supabase.from('tasks').delete().eq('id', subtask.id);
    const remaining = subtasks.filter(s => s.id !== subtask.id);
    setSubtasks(remaining);
    if (remaining.length === 0) onComplete(task);
  };

  // Nuevo subtask añadido desde panel → refrescar lista
  const handleSubtaskAdded = () => { loadSubtasks(); };

  const hasSubtasks = subtasks.length > 0;
  const isUrgent = task.urgent;
  const isOverdue = task.due_date && new Date(task.due_date) < new Date();

  // Prefijo de siglas para Solicitudes/Equipo
  const prefix = task.assigned_to
    ? `[${USER_INITIALS[task.assigned_to] || '?'}] `
    : '';

  return (
    <div ref={setNodeRef} style={{ ...styles.taskWrapper, ...style }}>
      <div style={styles.taskItem}>
        <span {...listeners} {...attributes} style={styles.grip}>⠿</span>
        <AnimatedCheckbox
          onClick={() => !hasSubtasks && onComplete(task)}
          color={categoryColor}
          urgent={isUrgent}
        />
        <span onClick={() => onOpen(task)} style={styles.taskTitle}>
          {isUrgent && <AlertCircle size={12} color="#ea4335" style={{ marginRight: 4, verticalAlign: 'middle', flexShrink: 0 }} />}
          {prefix}{task.title}
          {task.recurrence && task.recurrence !== 'none' && (
            <RefreshCw size={10} style={{ marginLeft: 5, color: '#9aa0a6', verticalAlign: 'middle' }} />
          )}
          {isOverdue && <span style={styles.overdueBadge}>Vencida</span>}
        </span>
      </div>

      {/* Subtareas */}
      {hasSubtasks && (
        <>
          <div style={styles.subtaskToggle}>
            <button onClick={() => setExpanded(!expanded)} style={styles.expandBtn}>
              {expanded ? <ChevronDown size={12} color="#9aa0a6" /> : <ChevronRight size={12} color="#9aa0a6" />}
              <span style={styles.subtaskBadge}>{subtasks.length} subtarea{subtasks.length !== 1 ? 's' : ''}</span>
            </button>
          </div>
          {expanded && (
            <div style={styles.subtaskList}>
              {subtasks.map(sub => (
                <SubtaskItem
                  key={sub.id}
                  subtask={sub}
                  onComplete={handleCompleteSubtask}
                  onOpen={setSelectedSubtask}
                />
              ))}
            </div>
          )}
        </>
      )}

      {/* Panel de subtarea */}
      {selectedSubtask && (
        <SubtaskPanel
          subtask={selectedSubtask}
          onClose={() => setSelectedSubtask(null)}
          onUpdate={handleSubtaskUpdate}
          onComplete={handleCompleteSubtask}
        />
      )}
    </div>
  );
}

// Modal para asignar destinatario al crear solicitud
function AssignModal({ onConfirm, onCancel, currentUserEmail }) {
  const [title, setTitle] = useState('');
  const [assignedTo, setAssignedTo] = useState('');
  const others = WORKERS.filter(w => w.email !== currentUserEmail);

  return (
    <div style={styles.modalOverlay}>
      <div style={styles.modal}>
        <h3 style={styles.modalTitle}>Nueva Solicitud</h3>
        <div style={styles.modalField}>
          <label style={styles.modalLabel}>Tarea</label>
          <input
            autoFocus
            value={title}
            onChange={e => setTitle(e.target.value)}
            placeholder="Descripción de la tarea..."
            style={styles.modalInput}
            onKeyDown={e => e.key === 'Escape' && onCancel()}
          />
        </div>
        <div style={styles.modalField}>
          <label style={styles.modalLabel}>Asignar a</label>
          <div style={styles.workerGrid}>
            {others.map(w => (
              <button
                key={w.email}
                onClick={() => setAssignedTo(w.email)}
                style={{
                  ...styles.workerBtn,
                  ...(assignedTo === w.email ? styles.workerBtnActive : {}),
                }}
              >
                {w.initials}
              </button>
            ))}
          </div>
        </div>
        <div style={styles.modalActions}>
          <button
            onClick={() => title.trim() && assignedTo && onConfirm(title.trim(), assignedTo)}
            disabled={!title.trim() || !assignedTo}
            style={{ ...styles.modalConfirm, ...(!title.trim() || !assignedTo ? styles.modalConfirmDisabled : {}) }}
          >
            Crear solicitud
          </button>
          <button onClick={onCancel} style={styles.modalCancel}>Cancelar</button>
        </div>
      </div>
    </div>
  );
}

// Columna principal
export default function TaskColumn({ category, tasks, onOpenTask, onCompleteTask, onCreateTask, currentUserEmail }) {
  const colors = CATEGORY_COLORS[category];
  const [newTitle, setNewTitle] = useState('');
  const [adding, setAdding] = useState(false);
  const [collapsed, setCollapsed] = useState(false);
  const [showAssignModal, setShowAssignModal] = useState(false);
  const isSolicitudes = category === 'Solicitudes';

  const handleAdd = async (e) => {
    e?.preventDefault();
    if (!newTitle.trim()) return;
    await onCreateTask({ title: newTitle.trim(), category });
    setNewTitle('');
    setAdding(false);
  };

  const handleNewTask = () => {
    if (isSolicitudes) {
      setShowAssignModal(true);
    } else {
      setAdding(true);
    }
  };

  const handleSolicitudConfirm = async (title, assignedTo) => {
    const senderInitials = USER_INITIALS[currentUserEmail] || '?';
    const recipientInitials = USER_INITIALS[assignedTo] || '?';
    await onCreateTask({
      title,
      category,
      assigned_to: assignedTo,
      senderInitials,
      recipientInitials,
    });
    setShowAssignModal(false);
  };

  return (
    <div style={{ ...styles.column, borderTop: `3px solid ${colors.header}` }}>
      <div style={{ ...styles.columnHeader, background: colors.light }}>
        <button onClick={() => setCollapsed(!collapsed)} style={styles.collapseToggle}>
          {collapsed ? <ChevronRight size={14} color={colors.header} /> : <ChevronDown size={14} color={colors.header} />}
        </button>
        <span style={{ ...styles.categoryName, color: colors.header }}>{category.toUpperCase()}</span>
        <span style={styles.taskCount}>{tasks.length}</span>
        <button onClick={handleNewTask} style={{ ...styles.addBtn, color: colors.header }} title="Nueva tarea">
          <Plus size={16} />
        </button>
      </div>

      {!collapsed && (
        <div style={styles.taskList}>
          <SortableContext items={tasks.map(t => t.id)} strategy={verticalListSortingStrategy}>
            {tasks.map(task => (
              <TaskItem
                key={task.id}
                task={task}
                onOpen={onOpenTask}
                onComplete={onCompleteTask}
                categoryColor={colors.header}
                currentUserEmail={currentUserEmail}
              />
            ))}
          </SortableContext>

          {adding && !isSolicitudes ? (
            <form onSubmit={handleAdd} style={styles.addForm}>
              <input
                autoFocus
                value={newTitle}
                onChange={e => setNewTitle(e.target.value)}
                placeholder="Título de la tarea..."
                style={styles.addInput}
                onKeyDown={e => e.key === 'Escape' && setAdding(false)}
              />
              <div style={styles.addFormActions}>
                <button type="submit" style={styles.addConfirmBtn}>Agregar</button>
                <button type="button" onClick={() => setAdding(false)} style={styles.addCancelBtn}>Cancelar</button>
              </div>
            </form>
          ) : (
            <button onClick={handleNewTask} style={styles.addTaskBtn}>
              <Plus size={14} color="#9aa0a6" />
              <span style={styles.addTaskLabel}>Nueva tarea</span>
            </button>
          )}
        </div>
      )}

      {showAssignModal && (
        <AssignModal
          onConfirm={handleSolicitudConfirm}
          onCancel={() => setShowAssignModal(false)}
          currentUserEmail={currentUserEmail}
        />
      )}
    </div>
  );
}

const styles = {
  column: {
    background: '#fff', borderRadius: 12,
    border: '1px solid #e8eaed',
    minWidth: 260, width: 260, flexShrink: 0,
    display: 'flex', flexDirection: 'column',
    overflow: 'hidden',
    boxShadow: '0 1px 6px rgba(0,0,0,0.06)',
  },
  columnHeader: {
    display: 'flex', alignItems: 'center',
    padding: '10px 12px', gap: 6,
    borderBottom: '1px solid #e8eaed',
  },
  collapseToggle: { background: 'none', border: 'none', cursor: 'pointer', padding: 2, display: 'flex', alignItems: 'center' },
  categoryName: { fontSize: 11, fontWeight: 700, letterSpacing: 0.8, flex: 1 },
  taskCount: { fontSize: 11, color: '#9aa0a6', background: '#f1f3f4', borderRadius: 10, padding: '1px 7px' },
  addBtn: { background: 'none', border: 'none', cursor: 'pointer', padding: 4, borderRadius: 6, display: 'flex', alignItems: 'center' },
  taskList: { padding: '6px 0', flex: 1, overflowY: 'auto', maxHeight: 'calc(100vh - 200px)' },
  taskWrapper: { borderBottom: '1px solid #f8f9fa' },
  taskItem: { display: 'flex', alignItems: 'center', padding: '7px 10px 7px 8px', gap: 8 },
  grip: { cursor: 'grab', color: '#dadce0', fontSize: 14, flexShrink: 0, userSelect: 'none' },
  taskTitle: {
    flex: 1, fontSize: 14, color: '#3c4043',
    cursor: 'pointer', lineHeight: 1.4,
    overflow: 'hidden', textOverflow: 'ellipsis',
    whiteSpace: 'nowrap', display: 'flex', alignItems: 'center',
  },
  overdueBadge: {
    marginLeft: 6, fontSize: 10, color: '#ea4335',
    background: '#fce8e6', padding: '1px 6px',
    borderRadius: 10, fontWeight: 600, flexShrink: 0,
  },
  subtaskToggle: { paddingLeft: 36 },
  expandBtn: {
    background: 'none', border: 'none', cursor: 'pointer',
    display: 'flex', alignItems: 'center', gap: 4,
    padding: '2px 4px',
  },
  subtaskBadge: { fontSize: 11, color: '#9aa0a6' },
  subtaskList: { paddingLeft: 36, paddingBottom: 6 },
  subtaskItem: { display: 'flex', alignItems: 'center', gap: 8, padding: '4px 10px 4px 0' },
  subtaskLabel: { fontSize: 13, color: '#5f6368', flex: 1, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' },
  overdueDot: { width: 6, height: 6, borderRadius: '50%', background: '#ea4335', flexShrink: 0 },
  addForm: { padding: '8px 12px', borderTop: '1px solid #f1f3f4' },
  addInput: { width: '100%', border: '1px solid #1a73e8', borderRadius: 8, padding: '8px 10px', fontSize: 14, outline: 'none', fontFamily: 'inherit', marginBottom: 8 },
  addFormActions: { display: 'flex', gap: 8 },
  addConfirmBtn: { padding: '6px 14px', background: '#1a73e8', color: '#fff', border: 'none', borderRadius: 6, fontSize: 13, cursor: 'pointer', fontFamily: 'inherit' },
  addCancelBtn: { padding: '6px 14px', background: 'none', color: '#5f6368', border: '1px solid #dadce0', borderRadius: 6, fontSize: 13, cursor: 'pointer', fontFamily: 'inherit' },
  addTaskBtn: { display: 'flex', alignItems: 'center', gap: 8, width: '100%', padding: '8px 12px', background: 'none', border: 'none', cursor: 'pointer' },
  addTaskLabel: { fontSize: 13, color: '#9aa0a6' },
  // Modal
  modalOverlay: { position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.4)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 2000 },
  modal: { background: '#fff', borderRadius: 16, padding: 28, width: 360, boxShadow: '0 8px 32px rgba(0,0,0,0.18)', fontFamily: "'Google Sans', 'Segoe UI', sans-serif" },
  modalTitle: { fontSize: 18, fontWeight: 700, color: '#202124', margin: '0 0 20px' },
  modalField: { marginBottom: 16 },
  modalLabel: { fontSize: 12, fontWeight: 600, color: '#5f6368', display: 'block', marginBottom: 8 },
  modalInput: { width: '100%', border: '1px solid #dadce0', borderRadius: 8, padding: '10px 12px', fontSize: 14, outline: 'none', fontFamily: 'inherit' },
  workerGrid: { display: 'flex', gap: 8 },
  workerBtn: { width: 44, height: 44, borderRadius: 10, border: '2px solid #dadce0', background: '#fff', fontSize: 13, fontWeight: 700, cursor: 'pointer', color: '#3c4043' },
  workerBtnActive: { border: '2px solid #1a73e8', background: '#e8f0fe', color: '#1a73e8' },
  modalActions: { display: 'flex', gap: 8, marginTop: 20 },
  modalConfirm: { flex: 1, padding: '10px', background: '#1a73e8', color: '#fff', border: 'none', borderRadius: 8, fontSize: 14, cursor: 'pointer', fontFamily: 'inherit', fontWeight: 500 },
  modalConfirmDisabled: { background: '#e8eaed', color: '#9aa0a6', cursor: 'not-allowed' },
  modalCancel: { padding: '10px 16px', background: 'none', border: '1px solid #dadce0', borderRadius: 8, fontSize: 14, cursor: 'pointer', fontFamily: 'inherit', color: '#5f6368' },
};
