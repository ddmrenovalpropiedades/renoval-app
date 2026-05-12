import React, { useState } from 'react';
import { useSortable, SortableContext, verticalListSortingStrategy } from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';
import { Plus, RefreshCw, ChevronDown, ChevronRight } from 'lucide-react';

const CATEGORY_COLORS = {
  'Entrada':    { header: '#1565C0', light: '#E3F2FD', border: '#BBDEFB' },
  'Salida':     { header: '#2E7D32', light: '#E8F5E9', border: '#C8E6C9' },
  'Equipo':     { header: '#6A1B9A', light: '#F3E5F5', border: '#E1BEE7' },
  'Solicitudes':{ header: '#E65100', light: '#FFF3E0', border: '#FFE0B2' },
  'Misceláneo': { header: '#37474F', light: '#ECEFF1', border: '#CFD8DC' },
};

// Componente de tarea individual (draggable)
function TaskItem({ task, onOpen, onComplete }) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({ id: task.id });
  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
    opacity: isDragging ? 0.5 : 1,
  };

  return (
    <div ref={setNodeRef} style={{ ...styles.taskItem, ...style }}>
      <div {...listeners} {...attributes} style={styles.grip}>
        <span style={{fontSize:10, color:"#dadce0"}}>⠿</span>
      </div>
      <button
        onClick={() => onComplete(task)}
        style={styles.checkbox}
        title="Completar"
      >
        <div style={styles.checkboxInner} />
      </button>
      <span
        onClick={() => onOpen(task)}
        style={styles.taskTitle}
      >
        {task.title}
        {task.recurrence && task.recurrence !== 'none' && (
          <RefreshCw size={11} style={{ marginLeft: 6, color: '#9aa0a6', verticalAlign: 'middle' }} />
        )}
      </span>
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
        <button
          onClick={() => setAdding(true)}
          style={{ ...styles.addBtn, color: colors.header }}
          title="Nueva tarea"
        >
          <Plus size={16} />
        </button>
      </div>

      {/* Tasks */}
      {!collapsed && (
        <div style={styles.taskList}>
          <SortableContext items={tasks.map(t => t.id)} strategy={verticalListSortingStrategy}>
            {tasks.map(task => (
              <TaskItem
                key={task.id}
                task={task}
                onOpen={onOpenTask}
                onComplete={onCompleteTask}
              />
            ))}
          </SortableContext>

          {/* Añadir tarea */}
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
    background: '#fff',
    borderRadius: 12,
    border: '1px solid #e8eaed',
    minWidth: 260,
    width: 260,
    flexShrink: 0,
    display: 'flex',
    flexDirection: 'column',
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
  categoryName: {
    fontSize: 11, fontWeight: 700,
    letterSpacing: 0.8, flex: 1,
  },
  taskCount: {
    fontSize: 11, color: '#9aa0a6',
    background: '#f1f3f4', borderRadius: 10,
    padding: '1px 7px',
  },
  addBtn: {
    background: 'none', border: 'none',
    cursor: 'pointer', padding: 4,
    borderRadius: 6, display: 'flex',
    alignItems: 'center',
  },
  taskList: {
    padding: '8px 0',
    flex: 1,
    overflowY: 'auto',
    maxHeight: 'calc(100vh - 200px)',
  },
  taskItem: {
    display: 'flex', alignItems: 'center',
    padding: '7px 12px', gap: 8,
    cursor: 'pointer',
    transition: 'background 0.1s',
    '&:hover': { background: '#f8f9fa' },
  },
  grip: {
    cursor: 'grab', display: 'flex',
    alignItems: 'center', flexShrink: 0,
  },
  checkbox: {
    width: 18, height: 18, borderRadius: '50%',
    border: '2px solid #dadce0',
    background: 'none', cursor: 'pointer',
    flexShrink: 0, padding: 0,
    display: 'flex', alignItems: 'center', justifyContent: 'center',
    transition: 'border-color 0.15s',
  },
  checkboxInner: { width: 8, height: 8, borderRadius: '50%' },
  taskTitle: {
    flex: 1, fontSize: 14, color: '#3c4043',
    cursor: 'pointer', lineHeight: 1.4,
    overflow: 'hidden', textOverflow: 'ellipsis',
    whiteSpace: 'nowrap',
  },
  addForm: {
    padding: '8px 12px',
    borderTop: '1px solid #f1f3f4',
  },
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
    background: 'none', border: 'none',
    cursor: 'pointer', borderTop: '1px solid transparent',
  },
  addTaskLabel: { fontSize: 13, color: '#9aa0a6' },
};
