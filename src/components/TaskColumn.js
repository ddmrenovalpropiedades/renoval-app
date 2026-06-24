import React, { useState, useEffect, useCallback } from 'react';
import { useSortable, SortableContext, verticalListSortingStrategy } from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';
import { Plus, RefreshCw, ChevronDown, ChevronRight, Clock, Trash2, ChevronsDown } from 'lucide-react';
import { supabase, USER_INITIALS } from '../supabaseClient';
import AnimatedCheckbox from './AnimatedCheckbox';
import SubtaskPanel from './SubtaskPanel';
import { formatLocalDate } from '../hooks/useTasks';

const CATEGORY_COLORS = {
  'Entrada':     { header: '#1565C0', light: '#E3F2FD' },
  'Salida':      { header: '#2E7D32', light: '#E8F5E9' },
  'Equipo':      { header: '#6A1B9A', light: '#F3E5F5' },
  'Solicitudes': { header: '#E65100', light: '#FFF3E0' },
  'Misceláneo':  { header: '#37474F', light: '#ECEFF1' },
};

const WORKERS = Object.entries(USER_INITIALS).map(([email, initials]) => ({ email, initials }));
const VISIBLE_LIMIT = 8; // máximo items (tareas + subtareas) antes de truncar

// ── Efectos secundarios al completar subtareas ────────────────────────────────
async function runSubtaskSideEffects(subtaskTitle, parentTaskTitle) {
  const title = (subtaskTitle || '').trim();
  const propMatch = (parentTaskTitle || '').match(/^(?:Arriendo|Dev Gar)\s+(.+)$/i);
  const propiedad = propMatch ? propMatch[1].trim() : null;
  if (!propiedad) return;

  if (title === 'Notificar dueño' || title === 'Notificar dueno') {
    await supabase.from('pizarra').update({ aviso: 'Listo' }).ilike('propiedad', propiedad);
  }
  if (title === 'Respaldar publicación' || title === 'Respaldar publicacion') {
    await supabase.from('pizarra').update({ respaldo: 'Listo' }).ilike('propiedad', propiedad);
  }
  if (title === 'Publicar') {
    await supabase.from('pizarra').update({ status: 'Listo' }).ilike('propiedad', propiedad);
  }
  if (title === 'Liquidación' || title === 'Liquidacion') {
    await supabase.from('arrendadas').update({ liquidacion: 'Listo' }).ilike('propiedad', propiedad);
  }
  if (title === 'Respaldo contrato carpeta') {
    await supabase.from('arrendadas').update({ contrato: 'Listo' }).ilike('propiedad', propiedad);
  }
  if (title === 'Pago cuentas') {
    await supabase.from('arrendadas').update({ cuentas: 'Listo' }).ilike('propiedad', propiedad);
  }
}

function SubtaskItem({ subtask, onComplete, onOpen }) {
  return (
    <div style={styles.subtaskItem}>
      <AnimatedCheckbox onClick={() => onComplete(subtask)} size={16} urgent={subtask.urgent} />
      <span onClick={() => onOpen(subtask)} style={{ ...styles.subtaskLabel, cursor: 'pointer' }}>
        {subtask.title}
      </span>
      {subtask.urgent && (
        <span style={styles.urgentDot} title="Urgente">!</span>
      )}
    </div>
  );
}

// ── TaskItem: devuelve su "peso" en items (1 tarea + N subtareas si expandida) ──
function TaskItem({ task, onOpen, onComplete, currentUserEmail, reloadKey, onWeightChange }) {
  const [subtasks, setSubtasks] = useState([]);
  const [expanded, setExpanded] = useState(true);
  const [selectedSubtask, setSelectedSubtask] = useState(null);

  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({ id: task.id });
  const style = { transform: CSS.Transform.toString(transform), transition, opacity: isDragging ? 0.5 : 1 };

  const loadSubtasks = useCallback(async () => {
    const { data } = await supabase.from('tasks').select('*')
      .eq('parent_id', task.id).eq('completed', false)
      .order('position', { ascending: true });
    setSubtasks(data || []);
  }, [task.id]);

  useEffect(() => { loadSubtasks(); }, [loadSubtasks, reloadKey]);

  // Notificar al padre el peso de este item (1 tarea + subtareas visibles)
  useEffect(() => {
    if (onWeightChange) {
      onWeightChange(task.id, 1 + (expanded ? subtasks.length : 0));
    }
  }, [task.id, subtasks.length, expanded, onWeightChange]);

  const handleCompleteSubtask = async (subtask) => {
    await runSubtaskSideEffects(subtask.title, task.title);

    if (task.category === 'Equipo' && subtask.solicitud_id) {
      await supabase.from('tasks').delete().eq('id', subtask.solicitud_id);
    }
    if (task.category === 'Solicitudes') {
      const { data: mirror } = await supabase.from('tasks').select('id')
        .eq('solicitud_id', subtask.id).eq('category', 'Equipo').maybeSingle();
      if (mirror) await supabase.from('tasks').delete().eq('id', mirror.id);
    }

    await supabase.from('tasks').delete().eq('id', subtask.id);
    const remaining = subtasks.filter(s => s.id !== subtask.id);
    setSubtasks(remaining);
    if (remaining.length === 0) onComplete(task);
  };

  const handleSubtaskUpdate = (id, updates) => {
    setSubtasks(prev => prev.map(s => s.id === id ? { ...s, ...updates } : s));
  };

  const isUrgent = task.urgent;
  const isProxima = task.proxima_vencer && !task.urgent;
  const isOverdue = task.due_date && new Date(task.due_date) < new Date();
  const hasSubtasks = subtasks.length > 0;

  let prefix = '';
  if ((task.category === 'Solicitudes' || task.category === 'Equipo') && task.assigned_to) {
    prefix = `[${USER_INITIALS[task.assigned_to] || '?'}] `;
  }

  return (
    <div ref={setNodeRef} style={{ ...styles.taskWrapper, ...style }}>
      <div style={styles.taskItem}>
        <span {...listeners} {...attributes} style={styles.grip}>⠿</span>
        <AnimatedCheckbox onClick={() => !hasSubtasks && onComplete(task)} urgent={isUrgent} proxima={task.proxima_vencer} />
        <span onClick={() => onOpen(task)} style={styles.taskTitle}>
          {isUrgent && <span style={styles.urgentDot} title="Urgente">!</span>}
          {isProxima && <span style={{ ...styles.urgentDot, background: '#f57c00' }} title="Importante/por vencer">!</span>}
          {prefix}{task.title}
          {task.recurrence && task.recurrence !== 'none' && (
            <RefreshCw size={10} style={{ marginLeft: 5, color: '#9aa0a6', verticalAlign: 'middle' }} />
          )}
          {isOverdue && <span style={styles.overdueBadge}>Vencida</span>}
        </span>
      </div>

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
                <SubtaskItem key={sub.id} subtask={sub}
                  onComplete={handleCompleteSubtask}
                  onOpen={setSelectedSubtask} />
              ))}
            </div>
          )}
        </>
      )}

      {selectedSubtask && (
        <SubtaskPanel subtask={selectedSubtask}
          onClose={() => setSelectedSubtask(null)}
          onUpdate={handleSubtaskUpdate}
          onComplete={handleCompleteSubtask} />
      )}
    </div>
  );
}

function SolicitudesHistory({ currentUserEmail }) {
  const [items, setItems] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchHistory = async () => {
      const { data } = await supabase.from('tasks_history')
        .select('*').eq('owner_email', currentUserEmail).eq('category', 'Solicitudes')
        .order('completed_at', { ascending: false }).limit(10);
      setItems(data || []);
      setLoading(false);
    };
    fetchHistory();
  }, [currentUserEmail]);

  if (loading) return <div style={styles.historyEmpty}>Cargando...</div>;
  if (!items.length) return <div style={styles.historyEmpty}>Sin tareas completadas aún.</div>;

  return (
    <div>
      {items.map(item => (
        <div key={item.id} style={styles.historyItem}>
          <span style={styles.historyPrefix}>
            {item.assigned_to ? `[${USER_INITIALS[item.assigned_to] || '?'}]` : ''}
          </span>
          <span style={styles.historyTitle}>{item.title}</span>
          <span style={styles.historyDate}>
            {new Date(item.completed_at).toLocaleDateString('es-CL', { day: '2-digit', month: '2-digit' })}
          </span>
        </div>
      ))}
    </div>
  );
}

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
          <input autoFocus value={title} onChange={e => setTitle(e.target.value)}
            placeholder="Descripción de la tarea..." style={styles.modalInput}
            onKeyDown={e => e.key === 'Escape' && onCancel()} />
        </div>
        <div style={styles.modalField}>
          <label style={styles.modalLabel}>Asignar a</label>
          <div style={styles.workerGrid}>
            {others.map(w => (
              <button key={w.email} onClick={() => setAssignedTo(w.email)}
                style={{ ...styles.workerBtn, ...(assignedTo === w.email ? styles.workerBtnActive : {}) }}>
                {w.initials}
              </button>
            ))}
          </div>
        </div>
        <div style={styles.modalActions}>
          <button onClick={() => title.trim() && assignedTo && onConfirm(title.trim(), assignedTo)}
            disabled={!title.trim() || !assignedTo}
            style={{ ...styles.modalConfirm, ...(!title.trim() || !assignedTo ? styles.modalConfirmDisabled : {}) }}>
            Crear solicitud
          </button>
          <button onClick={onCancel} style={styles.modalCancel}>Cancelar</button>
        </div>
      </div>
    </div>
  );
}

// ── Componente principal TaskColumn ──────────────────────────────────────────
export default function TaskColumn({
  category, tasks, dormantTasks = [], onOpenTask, onCompleteTask, onCreateTask,
  currentUserEmail, subtaskReloadTrigger = 0, columnDragHandleProps = {},
  customColor, canDelete = false, onDelete, onSubtaskCompleted,
  isFirstInMultiCol = false,
}) {
  const colors = customColor
    ? { header: customColor, light: customColor + '22' }
    : (CATEGORY_COLORS[category] || { header: '#37474F', light: '#ECEFF1' });

  const [newTitle, setNewTitle] = useState('');
  const [adding, setAdding] = useState(false);
  const [collapsed, setCollapsed] = useState(false);
  const [showDormant, setShowDormant] = useState(false);
  const [showHistory, setShowHistory] = useState(false);
  const [showAssignModal, setShowAssignModal] = useState(false);
  const [subtaskReloadKey, setSubtaskReloadKey] = useState(0);

  // ── Truncamiento ───────────────────────────────────────────────────────────
  const [expanded, setExpanded] = useState(false);
  // Mapa taskId → peso (1 + subtareas visibles)
  const [taskWeights, setTaskWeights] = useState({});

  useEffect(() => { setSubtaskReloadKey(k => k + 1); }, [subtaskReloadTrigger]);

  const handleWeightChange = useCallback((taskId, weight) => {
    setTaskWeights(prev => {
      if (prev[taskId] === weight) return prev;
      return { ...prev, [taskId]: weight };
    });
  }, []);

  // Truncar solo cuando es el primer listado en columna con 2+ listados
  const { visibleTasks, hiddenCount, needsTruncation } = React.useMemo(() => {
    if (!isFirstInMultiCol || expanded || tasks.length === 0) {
      return { visibleTasks: tasks, hiddenCount: 0, needsTruncation: false };
    }
    let count = 0;
    let cutoff = tasks.length;
    for (let i = 0; i < tasks.length; i++) {
      const weight = taskWeights[tasks[i].id] ?? 1;
      count += weight;
      if (count > VISIBLE_LIMIT) {
        cutoff = i;
        break;
      }
    }
    const hidden = tasks.length - cutoff;
    return {
      visibleTasks: tasks.slice(0, cutoff),
      hiddenCount: hidden,
      needsTruncation: hidden > 0,
    };
  }, [tasks, taskWeights, expanded, isFirstInMultiCol]);

  const isSolicitudes = category === 'Solicitudes';

  const handleAdd = async (e) => {
    e?.preventDefault();
    if (!newTitle.trim()) return;
    await onCreateTask({ title: newTitle.trim(), category });
    setNewTitle('');
    setAdding(false);
  };

  const handleNewTask = () => isSolicitudes ? setShowAssignModal(true) : setAdding(true);

  const handleSolicitudConfirm = async (title, assignedTo) => {
    await onCreateTask({ title, category, assigned_to: assignedTo,
      senderInitials: USER_INITIALS[currentUserEmail] || '?',
      recipientInitials: USER_INITIALS[assignedTo] || '?' });
    setShowAssignModal(false);
  };

  return (
    <div style={{ ...styles.column, borderTop: `3px solid ${colors.header}` }}>
      <div style={{ ...styles.columnHeader, background: colors.light }}>
        <button onClick={() => setCollapsed(!collapsed)} style={styles.collapseToggle}>
          {collapsed ? <ChevronRight size={14} color={colors.header} /> : <ChevronDown size={14} color={colors.header} />}
        </button>
        <span
          {...columnDragHandleProps}
          style={{ ...styles.categoryName, color: colors.header, cursor: 'grab', userSelect: 'none' }}
          title="Arrastrar listado"
        >
          {category.toUpperCase()}
        </span>
        <span style={styles.taskCount}>{tasks.length}</span>
        {isSolicitudes && (
          <button onClick={() => setShowHistory(!showHistory)} style={{ ...styles.addBtn, color: colors.header }} title="Historial de solicitudes">
            <Clock size={14} />
          </button>
        )}
        {canDelete && onDelete && (
          <button onClick={onDelete} style={{ ...styles.addBtn, color: '#ea4335' }} title="Eliminar lista">
            <Trash2 size={14} />
          </button>
        )}
        <button onClick={handleNewTask} style={{ ...styles.addBtn, color: colors.header }} title="Nueva tarea">
          <Plus size={16} />
        </button>
      </div>

      {!collapsed && (
        <div style={styles.taskList}>
          <SortableContext items={visibleTasks.map(t => t.id)} strategy={verticalListSortingStrategy}>
            {visibleTasks.map(task => (
              <TaskItem
                key={task.id}
                task={task}
                onOpen={onOpenTask}
                onComplete={onCompleteTask}
                currentUserEmail={currentUserEmail}
                reloadKey={subtaskReloadKey}
                onWeightChange={handleWeightChange}
              />
            ))}
          </SortableContext>

          {/* Botón expandir si hay tareas ocultas */}
          {needsTruncation && !expanded && (
            <button
              onClick={() => setExpanded(true)}
              style={styles.expandAllBtn}
            >
              <ChevronsDown size={13} color={colors.header} />
              <span style={{ ...styles.expandAllLabel, color: colors.header }}>
                Ver {hiddenCount} tarea{hiddenCount !== 1 ? 's' : ''} más
              </span>
            </button>
          )}
          {/* Botón colapsar si está expandido y superaba el límite */}
          {expanded && tasks.length > VISIBLE_LIMIT && (
            <button
              onClick={() => setExpanded(false)}
              style={styles.expandAllBtn}
            >
              <ChevronRight size={13} color="#9aa0a6" style={{ transform: 'rotate(-90deg)' }} />
              <span style={{ ...styles.expandAllLabel, color: '#9aa0a6' }}>Colapsar lista</span>
            </button>
          )}

          {adding && !isSolicitudes ? (
            <form onSubmit={handleAdd} style={styles.addForm}>
              <input autoFocus value={newTitle} onChange={e => setNewTitle(e.target.value)}
                placeholder="Título de la tarea..." style={styles.addInput}
                onKeyDown={e => e.key === 'Escape' && setAdding(false)} />
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

          {isSolicitudes && showHistory && (
            <div style={styles.historySection}>
              <div style={styles.historySectionTitle}>
                <Clock size={11} color="#E65100" />
                <span>Últimas 10 completadas</span>
              </div>
              <SolicitudesHistory currentUserEmail={currentUserEmail} />
            </div>
          )}

          {dormantTasks.length > 0 && (
            <div style={styles.dormantSection}>
              <button onClick={() => setShowDormant(!showDormant)} style={styles.dormantToggle}>
                <RefreshCw size={11} color="#9aa0a6" />
                <span style={styles.dormantLabel}>
                  {showDormant ? 'Ocultar' : 'Mostrar'} recurrentes dormidas ({dormantTasks.length})
                </span>
                {showDormant ? <ChevronDown size={11} color="#9aa0a6" /> : <ChevronRight size={11} color="#9aa0a6" />}
              </button>
              {showDormant && dormantTasks.map(task => {
                let prefix = '';
                if ((task.category === 'Solicitudes' || task.category === 'Equipo') && task.assigned_to) {
                  prefix = `[${USER_INITIALS[task.assigned_to] || '?'}] `;
                }
                return (
                  <div key={task.id} style={styles.dormantItem} onClick={() => onOpenTask(task)}>
                    <RefreshCw size={11} color="#1a73e8" style={{ flexShrink: 0 }} />
                    <span style={styles.dormantTitle}>{prefix}{task.title}</span>
                    <span style={styles.dormantDate}>
                      {task.next_occurrence ? formatLocalDate(task.next_occurrence) : ''}
                    </span>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      )}

      {showAssignModal && (
        <AssignModal onConfirm={handleSolicitudConfirm}
          onCancel={() => setShowAssignModal(false)}
          currentUserEmail={currentUserEmail} />
      )}
    </div>
  );
}

const styles = {
  column: { background: '#fff', borderRadius: 12, border: '1px solid #e8eaed', minWidth: 260, width: 260, flexShrink: 0, display: 'flex', flexDirection: 'column', overflow: 'visible', alignSelf: 'flex-start', boxShadow: '0 1px 6px rgba(0,0,0,0.06)' },
  columnHeader: { display: 'flex', alignItems: 'center', padding: '10px 12px', gap: 6, borderBottom: '1px solid #e8eaed' },
  collapseToggle: { background: 'none', border: 'none', cursor: 'pointer', padding: 2, display: 'flex', alignItems: 'center' },
  categoryName: { fontSize: 11, fontWeight: 700, letterSpacing: 0.8, flex: 1 },
  taskCount: { fontSize: 11, color: '#9aa0a6', background: '#f1f3f4', borderRadius: 10, padding: '1px 7px' },
  addBtn: { background: 'none', border: 'none', cursor: 'pointer', padding: 4, borderRadius: 6, display: 'flex', alignItems: 'center' },
  taskList: { padding: '6px 0' },
  taskWrapper: { borderBottom: '1px solid #f8f9fa' },
  taskItem: { display: 'flex', alignItems: 'center', padding: '7px 10px 7px 8px', gap: 8 },
  grip: { cursor: 'grab', color: '#dadce0', fontSize: 14, flexShrink: 0, userSelect: 'none' },
  taskTitle: { flex: 1, fontSize: 14, color: '#3c4043', cursor: 'pointer', lineHeight: 1.4, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', display: 'flex', alignItems: 'center', gap: 4 },
  urgentDot: { display: 'inline-flex', alignItems: 'center', justifyContent: 'center', width: 14, height: 14, borderRadius: '50%', background: '#ea4335', color: '#fff', fontSize: 10, fontWeight: 900, flexShrink: 0, lineHeight: 1 },
  overdueBadge: { marginLeft: 6, fontSize: 10, color: '#ea4335', background: '#fce8e6', padding: '1px 6px', borderRadius: 10, fontWeight: 600, flexShrink: 0 },
  subtaskToggle: { paddingLeft: 36 },
  expandBtn: { background: 'none', border: 'none', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 4, padding: '2px 4px' },
  subtaskBadge: { fontSize: 11, color: '#9aa0a6' },
  subtaskList: { paddingLeft: 36, paddingBottom: 6 },
  subtaskItem: { display: 'flex', alignItems: 'center', gap: 8, padding: '4px 10px 4px 0' },
  subtaskLabel: { fontSize: 13, color: '#5f6368', flex: 1, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' },
  expandAllBtn: {
    display: 'flex', alignItems: 'center', gap: 6,
    width: '100%', padding: '7px 14px',
    background: 'none', border: 'none', cursor: 'pointer',
    borderTop: '1px dashed #e8eaed',
  },
  expandAllLabel: { fontSize: 12, fontWeight: 600 },
  addForm: { padding: '8px 12px', borderTop: '1px solid #f1f3f4' },
  addInput: { width: '100%', border: '1px solid #1a73e8', borderRadius: 8, padding: '8px 10px', fontSize: 14, outline: 'none', fontFamily: 'inherit', marginBottom: 8 },
  addFormActions: { display: 'flex', gap: 8 },
  addConfirmBtn: { padding: '6px 14px', background: '#1a73e8', color: '#fff', border: 'none', borderRadius: 6, fontSize: 13, cursor: 'pointer', fontFamily: 'inherit' },
  addCancelBtn: { padding: '6px 14px', background: 'none', color: '#5f6368', border: '1px solid #dadce0', borderRadius: 6, fontSize: 13, cursor: 'pointer', fontFamily: 'inherit' },
  addTaskBtn: { display: 'flex', alignItems: 'center', gap: 8, width: '100%', padding: '8px 12px', background: 'none', border: 'none', cursor: 'pointer' },
  addTaskLabel: { fontSize: 13, color: '#9aa0a6' },
  historySection: { borderTop: '1px solid #f1f3f4', padding: '8px 0' },
  historySectionTitle: { display: 'flex', alignItems: 'center', gap: 5, padding: '4px 12px 8px', fontSize: 11, fontWeight: 600, color: '#E65100' },
  historyItem: { display: 'flex', alignItems: 'center', gap: 6, padding: '5px 12px', borderBottom: '1px solid #fafafa' },
  historyPrefix: { fontSize: 11, fontWeight: 700, color: '#E65100', flexShrink: 0 },
  historyTitle: { flex: 1, fontSize: 12, color: '#5f6368', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' },
  historyDate: { fontSize: 11, color: '#9aa0a6', flexShrink: 0 },
  historyEmpty: { padding: '12px 16px', fontSize: 12, color: '#9aa0a6', textAlign: 'center' },
  dormantSection: { borderTop: '1px dashed #e8eaed', padding: '4px 0' },
  dormantToggle: { display: 'flex', alignItems: 'center', gap: 5, width: '100%', padding: '6px 12px', background: 'none', border: 'none', cursor: 'pointer', fontFamily: 'inherit' },
  dormantLabel: { fontSize: 11, color: '#9aa0a6', flex: 1, textAlign: 'left' },
  dormantItem: { display: 'flex', alignItems: 'center', gap: 8, padding: '5px 12px 5px 24px', cursor: 'pointer', background: '#f8f9ff', borderBottom: '1px solid #f1f3f4' },
  dormantTitle: { flex: 1, fontSize: 12, color: '#1a73e8', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', fontStyle: 'italic' },
  dormantDate: { fontSize: 11, color: '#9aa0a6', background: '#e8f0fe', borderRadius: 10, padding: '1px 7px', flexShrink: 0 },
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
