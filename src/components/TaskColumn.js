import React, { useState, useEffect } from 'react';
import { useSortable, SortableContext, verticalListSortingStrategy } from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';
import { Plus, RefreshCw, ChevronDown, ChevronRight } from 'lucide-react';
import { supabase } from '../supabaseClient';

const CATEGORY_COLORS = {
  'Entrada':     { header: '#1565C0', light: '#E3F2FD', border: '#BBDEFB', sub: '#C5D8F8' },
  'Salida':      { header: '#2E7D32', light: '#E8F5E9', border: '#C8E6C9', sub: '#C5E1A5' },
  'Equipo':      { header: '#6A1B9A', light: '#F3E5F5', border: '#E1BEE7', sub: '#D1C4E9' },
  'Solicitudes': { header: '#E65100', light: '#FFF3E0', border: '#FFE0B2', sub: '#FFECB3' },
  'Misceláneo':  { header: '#37474F', light: '#ECEFF1', border: '#CFD8DC', sub: '#B0BEC5' },
};

// Checkbox animado
function AnimatedCheckbox({ onClick, size = 20, color = '#1a73e8' }) {
  const [hovered, setHovered] = useState(false);
  const [pressed, setPressed] = useState(false);

  return (
    <button
      onClick={onClick}
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => { setHovered(false); setPressed(false); }}
      onMouseDown={() => setPressed(true)}
      onMouseUp={() => setPressed(false)}
      style={{
        width: size, height: size,
        borderRadius: '50%',
        border: `2px solid ${hovered ? color : '#dadce0'}`,
        background: pressed ? color : hovered ? `${color}22` : 'none',
        cursor: 'pointer',
        flexShrink: 0,
        padding: 0,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        transition: 'all 0.15s ease',
        transform: pressed ? 'scale(0.9)' : 'scale(1)',
      }}
      title="Completar"
    >
      {hovered && (
        <svg width={size * 0.5} height={size * 0.5} viewBox="0 0 12 12">
          <polyline
            points="1.5,6 4.5,9 10.5,3"
            fill="none"
            stroke={pressed ? '#fff' : color}
            strokeWidth="2"
            strokeLinecap="round"
            strokeLinejoin="round"
          />
        </svg>
      )}
    </button>
  );
}

// Subtarea en la lista
function SubtaskItem({ subtask, onComplete }) {
  return (
    <div style={styles.subtaskItem}>
      <AnimatedCheckbox onClick={() => onComplete(subtask)} size={16} color="#1a73e8" />
      <span style={styles.subtaskLabel}>{subtask.title}</span>
    </div>
  );
}

// Tarea principal con subtareas
function TaskItem({ task, onOpen, onComplete, categoryColor }) {
  const [subtasks, setSubtasks] = useState([]);
  const [expanded, setExpanded] = useState(true);

  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({ id: task.id });
  const style = { transform: CSS.Transform.toString(transform), transition, opacity: isDragging ? 0.5 : 1 };

  useEffect(() => {
    loadSubtasks();
  }, [task.id]); // eslint-disable-line

  const loadSubtasks = async () => {
    const { data } = await supabase
      .from('tasks')
      .select('*')
      .eq('parent_id', task.id)
      .eq('completed', false)
      .order('position', { ascending: true });
    setSubtasks(data || []);
  };

  const handleCompleteSubtask = async (subtask) => {
    await supabase.from('tasks').delete().eq('id', subtask.id);
    const remaining = subtasks.filter(s => s.id !== subtask.id);
    setSubtasks(remaining);
    if (remaining.length === 0) {
      onComplete(task);
    }
  };

  const hasSubtasks = subtasks.length > 0;

  return (
    <div ref={setNodeRef} style={{ ...styles.taskWrapper, ...style }}>
      <div style={styles.taskItem}>
        <span
          {...listeners} {...attributes}
          style={styles.grip}
        >⠿</span>
        <AnimatedCheckbox onClick={() => !hasSubtasks && onComplete(task)} color={categoryColor} />
        <span onClick={() => onOpen(task)} style={styles.taskTitle}>
          {task.title}
          {task.recurrence && task.recurrence !== 'none' && (
            <RefreshCw size={10} style={{ marginLeft: 5, color: '#9aa0a6', verticalAlign: 'middle' }} />
          )}
        </span>
        {hasSubtasks && (
          <button onClick={() => setExpanded(!expanded)} style={styles.expandBtn}>
            {expanded
              ? <ChevronDown size={13} color="#9aa0a6" />
              : <ChevronRight size={13} color="#9aa0a6" />
            }
            <span style={styles.subtaskBadge}>{subtasks.length}</span>
          </button>
        )}
      </div>
      {hasSubtasks && expanded && (
        <div style={styles.subtaskList}>
          {subtasks.map(sub => (
            <SubtaskItem key={sub.id} subtask={sub} onComplete={handleCompleteSubtask} />
          ))}
        </div>
      )}
    </div>
  );
}

// Columna de categoría
export default function TaskColumn({ category, tasks, onOpenTask, onCompleteTask, onCreateTask }) {
  const colors = CATEGORY_COLORS[category];
  const [newTitle, setNewTitle] = useState('');
  const [adding, setAdding] = useState(false);
  const [collapsed, setCollapsed] = useState(false);

  const handleAdd = async (e) => {
    e.preventDefault();
    if (!newTitle.trim()) return;
    await onCreateTask({ title: newTitle.trim(), category });
    setNewTitle('');
    setAdding(false);
  };

  return (
    <div style={{ ...styles.column, borderTop: `3px solid ${colors.header}` }}>
      {/* Header */}
      <div style={{ ...styles.columnHeader, background: colors.light }}>
        <button onClick={() => setCollapsed(!collapsed)} style={styles.collapseToggle}>
          {collapsed
            ? <ChevronRight size={14} color={colors.header} />
            : <ChevronDown size={14} color={colors.header} />
          }
        </button>
        <span style={{ ...styles.categoryName, color: colors.header }}>
          {category.toUpperCase()}
        </span>
        <span style={styles.taskCount}>{tasks.length}</span>
        <button onClick={() => setAdding(true)} style={{ ...styles.addBtn, color: colors.header }} title="Nueva tarea">
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
              />
            ))}
          </SortableContext>

          {adding ? (
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
            <button onClick={() => setAdding(true)} style={styles.addTaskBtn}>
              <Plus size={14} color="#9aa0a6" />
              <span style={styles.addTaskLabel}>Nueva tarea</span>
            </button>
          )}
        </div>
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
  collapseToggle: {
    background: 'none', border: 'none',
    cursor: 'pointer', padding: 2,
    display: 'flex', alignItems: 'center',
  },
  categoryName: { fontSize: 11, fontWeight: 700, letterSpacing: 0.8, flex: 1 },
  taskCount: {
    fontSize: 11, color: '#9aa0a6',
    background: '#f1f3f4', borderRadius: 10,
    padding: '1px 7px',
  },
  addBtn: {
    background: 'none', border: 'none',
    cursor: 'pointer', padding: 4,
    borderRadius: 6, display: 'flex', alignItems: 'center',
  },
  taskList: {
    padding: '6px 0', flex: 1,
    overflowY: 'auto',
    maxHeight: 'calc(100vh - 200px)',
  },
  taskWrapper: { borderBottom: '1px solid #f8f9fa' },
  taskItem: {
    display: 'flex', alignItems: 'center',
    padding: '7px 10px 7px 8px', gap: 8,
  },
  grip: {
    cursor: 'grab', color: '#dadce0',
    fontSize: 14, flexShrink: 0,
    userSelect: 'none',
  },
  taskTitle: {
    flex: 1, fontSize: 14, color: '#3c4043',
    cursor: 'pointer', lineHeight: 1.4,
    overflow: 'hidden', textOverflow: 'ellipsis',
    whiteSpace: 'nowrap',
  },
  expandBtn: {
    background: 'none', border: 'none',
    cursor: 'pointer', display: 'flex',
    alignItems: 'center', gap: 2, padding: 2,
    flexShrink: 0,
  },
  subtaskBadge: {
    fontSize: 10, color: '#9aa0a6',
    background: '#f1f3f4', borderRadius: 8,
    padding: '1px 5px',
  },
  subtaskList: { paddingLeft: 36, paddingBottom: 6 },
  subtaskItem: {
    display: 'flex', alignItems: 'center',
    gap: 8, padding: '4px 10px 4px 0',
  },
  subtaskLabel: { fontSize: 13, color: '#5f6368' },
  addForm: { padding: '8px 12px', borderTop: '1px solid #f1f3f4' },
  addInput: {
    width: '100%', border: '1px solid #1a73e8',
    borderRadius: 8, padding: '8px 10px',
    fontSize: 14, outline: 'none',
    fontFamily: 'inherit', marginBottom: 8,
  },
  addFormActions: { display: 'flex', gap: 8 },
  addConfirmBtn: {
    padding: '6px 14px', background: '#1a73e8',
    color: '#fff', border: 'none', borderRadius: 6,
    fontSize: 13, cursor: 'pointer', fontFamily: 'inherit',
  },
  addCancelBtn: {
    padding: '6px 14px', background: 'none',
    color: '#5f6368', border: '1px solid #dadce0',
    borderRadius: 6, fontSize: 13, cursor: 'pointer',
    fontFamily: 'inherit',
  },
  addTaskBtn: {
    display: 'flex', alignItems: 'center',
    gap: 8, width: '100%', padding: '8px 12px',
    background: 'none', border: 'none', cursor: 'pointer',
  },
  addTaskLabel: { fontSize: 13, color: '#9aa0a6' },
};
