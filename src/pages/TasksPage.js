import React, { useState } from 'react';
import { DndContext, KeyboardSensor, PointerSensor, useSensor, useSensors, DragOverlay, pointerWithin } from '@dnd-kit/core';
import { sortableKeyboardCoordinates, arrayMove, SortableContext, horizontalListSortingStrategy, useSortable } from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';
import { useTasks } from '../hooks/useTasks';
import { supabase } from '../supabaseClient';
import TaskColumn from '../components/TaskColumn';
import TaskPanel from '../components/TaskPanel';
import { useAuth } from '../context/AuthContext';
import { RefreshCw, ChevronDown, History, Plus, X } from 'lucide-react';
import HistoryPanel from '../components/HistoryPanel';
import { USER_INITIALS } from '../supabaseClient';

const ALL_USERS = Object.entries(USER_INITIALS).map(([email, initials]) => ({ email, initials }));
const DEFAULT_CATEGORIES = ['Entrada', 'Salida', 'Equipo', 'Solicitudes', 'Misceláneo'];


// Wrapper that makes a column sortable by its header
function SortableColumn({ category, isDragging, ...props }) {
  const { attributes, listeners, setNodeRef, transform, transition } = useSortable({
    id: category,
  });
  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
    opacity: isDragging ? 0.3 : 1,
    cursor: 'default',
  };
  return (
    <div ref={setNodeRef} style={style}>
      <TaskColumn
        {...props}
        category={category}
        columnDragHandleProps={{ ...attributes, ...listeners }}
      />
    </div>
  );
}

export default function TasksPage() {
  const { profile } = useAuth();
  const [viewingEmail, setViewingEmail] = useState(null);
  const [showHistory, setShowHistory] = useState(false);
  const [subtaskReloadTrigger, setSubtaskReloadTrigger] = useState(0);

  const effectiveEmail = viewingEmail || profile?.email;
  const effectiveInitials = USER_INITIALS[effectiveEmail] || profile?.initials;
  const isViewingOther = viewingEmail && viewingEmail !== profile?.email;

  const {
    tasksByCategory, dormantByCategory, loading, fetchTasks,
    createTask, createSubtask, updateTask,
    completeTask, deleteTask, reorderTasks,
    getSubtasks, CATEGORIES,
  } = useTasks(viewingEmail);

  const [selectedTask, setSelectedTask] = useState(null);
  const [categories, setCategories] = useState(null); // null = loading
  const [showNewCategory, setShowNewCategory] = useState(false);
  const [newCatName, setNewCatName] = useState('');
  const [newCatColor, setNewCatColor] = useState('#0891b2');

  // Load categories from Supabase on mount
  React.useEffect(() => {
    const loadCategories = async () => {
      const { data } = await supabase.from('task_categories').select('*').order('position', { ascending: true });
      if (data && data.length > 0) {
        setCategories(data);
      } else {
        // Fallback to default categories
        setCategories(DEFAULT_CATEGORIES.map((name, i) => ({ name, color: ['#1565C0','#2E7D32','#6A1B9A','#E65100','#37474F'][i], position: i, is_default: i < 4 })));
      }
    };
    loadCategories();
  }, []);

  const [columnOrder, setColumnOrder] = useState([...DEFAULT_CATEGORIES]);

  // Sync column order when categories load
  React.useEffect(() => {
    if (!categories) return;
    const catNames = categories.map(c => c.name);
    try {
      const saved = localStorage.getItem('tasksColumnOrder');
      if (saved) {
        const parsed = JSON.parse(saved);
        const merged = [...parsed.filter(c => catNames.includes(c)), ...catNames.filter(c => !parsed.includes(c))];
        setColumnOrder(merged);
        return;
      }
    } catch(e) {}
    setColumnOrder(catNames);
  }, [categories]);
  const [draggingColumn, setDraggingColumn] = useState(null);

  const getCategoryColor = (name) => {
    const cat = categories?.find(c => c.name === name);
    return cat?.color || '#37474F';
  };

  const isProtected = (name) => ['Entrada','Salida','Equipo','Solicitudes'].includes(name);

  const handleAddCategory = async () => {
    if (!newCatName.trim()) return;
    const pos = (categories?.length || 5);
    const { data } = await supabase.from('task_categories')
      .insert({ name: newCatName.trim(), color: newCatColor, position: pos, is_default: false })
      .select().single();
    if (data) {
      setCategories(prev => [...(prev||[]), data]);
      setColumnOrder(prev => [...prev, data.name]);
      localStorage.setItem('tasksColumnOrder', JSON.stringify([...columnOrder, data.name]));
    }
    setNewCatName('');
    setNewCatColor('#0891b2');
    setShowNewCategory(false);
  };

  const handleDeleteCategory = async (name) => {
    if (isProtected(name)) return;
    if (!window.confirm(`¿Eliminar la lista "${name}"? Las tareas en esta lista también se eliminarán.`)) return;
    await supabase.from('tasks').delete().eq('category', name);
    await supabase.from('task_categories').delete().eq('name', name);
    setCategories(prev => prev.filter(c => c.name !== name));
    const newOrder = columnOrder.filter(c => c !== name);
    setColumnOrder(newOrder);
    localStorage.setItem('tasksColumnOrder', JSON.stringify(newOrder));
  };

  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 5 } }),
    useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates })
  );

  const handleDragStart = (event) => {
    if (columnOrder.includes(event.active.id)) {
      setDraggingColumn(event.active.id);
    }
  };

  const handleDragEnd = (event) => {
    const { active, over } = event;
    setDraggingColumn(null);
    if (!over || active.id === over.id) return;

    // Check if dragging a column
    if (columnOrder.includes(active.id)) {
      const oldIdx = columnOrder.indexOf(active.id);
      const newIdx = columnOrder.indexOf(over.id);
      if (oldIdx !== -1 && newIdx !== -1) {
        const newOrder = arrayMove(columnOrder, oldIdx, newIdx);
        setColumnOrder(newOrder);
        localStorage.setItem('tasksColumnOrder', JSON.stringify(newOrder));
      }
      return;
    }

    // Otherwise dragging a task
    for (const category of CATEGORIES) {
      const catTasks = tasksByCategory[category];
      const oldIndex = catTasks.findIndex(t => t.id === active.id);
      const newIndex = catTasks.findIndex(t => t.id === over.id);
      if (oldIndex !== -1 && newIndex !== -1) {
        const reordered = arrayMove(catTasks, oldIndex, newIndex);
        reorderTasks(category, reordered.map(t => t.id));
        break;
      }
    }
  };

  const handleCompleteTask = async (task) => {
    await completeTask(task);
    if (selectedTask?.id === task.id) setSelectedTask(null);
    await fetchTasks();
  };

  const totalTasks = Object.values(tasksByCategory).flat().length;

  return (
    <div style={styles.container}>
      {/* Header */}
      <div style={styles.header}>
        <div>
          <h1 style={styles.title}>Tareas Pendientes</h1>
          <div style={styles.subtitleRow}>
            {/* Selector de usuario (solo propietarios) */}
            {profile?.isOwner ? (
              <div style={styles.userSelectorWrapper}>
                <select
                  value={viewingEmail || profile?.email}
                  onChange={e => {
                    setViewingEmail(e.target.value === profile?.email ? null : e.target.value);
                    setSelectedTask(null);
                  }}
                  style={styles.userSelector}
                >
                  {ALL_USERS.map(u => (
                    <option key={u.email} value={u.email}>
                      {u.initials}{u.email === profile?.email ? ' (yo)' : ''}
                    </option>
                  ))}
                </select>
                <ChevronDown size={14} color="#5f6368" style={styles.selectorIcon} />
              </div>
            ) : (
              <span style={styles.userBadge}>{profile?.initials}</span>
            )}
            <span style={styles.taskCountText}>
              {isViewingOther && (
                <span style={styles.viewingBadge}>Vista de {effectiveInitials}</span>
              )}
              · {totalTasks} tareas activas
            </span>
          </div>
        </div>
        <div style={{display:'flex',gap:8}}>
          <button onClick={fetchTasks} style={styles.refreshBtn} title="Actualizar">
            <RefreshCw size={16} color="#5f6368" />
          </button>
          <button onClick={() => setShowHistory(true)} style={styles.refreshBtn} title="Historial">
            <History size={16} color="#5f6368" />
          </button>
          <button onClick={() => setShowNewCategory(true)} style={{ ...styles.refreshBtn, display:'flex', alignItems:'center', gap:5, padding:'6px 12px', background:'#e8f0fe', border:'1px solid #1a73e8', color:'#1a73e8', borderRadius:8, fontSize:12, fontWeight:600, cursor:'pointer', fontFamily:'inherit' }} title="Nueva lista">
            <Plus size={14} /> Nueva lista
          </button>
        </div>
      </div>

      {/* Banner vista de otro usuario */}
      {isViewingOther && (
        <div style={styles.viewingBanner}>
          Estás viendo y editando las tareas de <strong>{effectiveInitials}</strong>.
          <button onClick={() => { setViewingEmail(null); setSelectedTask(null); }} style={styles.bannerBtn}>
            Volver a mi vista
          </button>
        </div>
      )}

      {loading ? (
        <div style={styles.loading}>Cargando tareas...</div>
      ) : (
        <DndContext sensors={sensors} collisionDetection={pointerWithin} onDragStart={handleDragStart} onDragEnd={handleDragEnd}>
          <div style={styles.columnsWrapper}>
            <div style={styles.columns}>
              <SortableContext items={columnOrder} strategy={horizontalListSortingStrategy}>
                {columnOrder.map(category => (
                  <SortableColumn
                    key={category}
                    category={category}
                    isDragging={draggingColumn === category}
                    tasks={tasksByCategory[category] || []}
                    onOpenTask={setSelectedTask}
                    onCompleteTask={handleCompleteTask}
                    onCreateTask={createTask}
                    currentUserEmail={effectiveEmail}
                    dormantTasks={dormantByCategory[category] || []}
                    subtaskReloadTrigger={subtaskReloadTrigger}
                    customColor={getCategoryColor(category)}
                    canDelete={!isProtected(category)}
                    onDelete={() => handleDeleteCategory(category)}
                  />
                ))}
              </SortableContext>
            </div>
          </div>
          <DragOverlay>
            {draggingColumn && (
              <div style={{ opacity: 0.8, transform: 'rotate(2deg)', pointerEvents: 'none' }}>
                <TaskColumn
                  category={draggingColumn}
                  tasks={tasksByCategory[draggingColumn] || []}
                  onOpenTask={() => {}}
                  onCompleteTask={() => {}}
                  onCreateTask={() => {}}
                  currentUserEmail={effectiveEmail}
                  dormantTasks={dormantByCategory[draggingColumn] || []}
                />
              </div>
            )}
          </DragOverlay>
        </DndContext>
      )}

      {showHistory && (
        <HistoryPanel
          onClose={() => setShowHistory(false)}
          ownerEmail={effectiveEmail}
        />
      )}
      {/* Modal nueva categoría */}
      {showNewCategory && (
        <div style={{ position:'fixed', inset:0, background:'rgba(0,0,0,0.4)', display:'flex', alignItems:'center', justifyContent:'center', zIndex:2000 }}>
          <div style={{ background:'#fff', borderRadius:16, padding:28, width:360, boxShadow:'0 8px 32px rgba(0,0,0,0.18)', fontFamily:"'Google Sans','Segoe UI',sans-serif" }}>
            <div style={{ display:'flex', justifyContent:'space-between', alignItems:'center', marginBottom:20 }}>
              <h3 style={{ fontSize:18, fontWeight:700, color:'#202124', margin:0 }}>Nueva lista</h3>
              <button onClick={() => setShowNewCategory(false)} style={{ background:'none', border:'none', cursor:'pointer', padding:4 }}><X size={18} color="#5f6368" /></button>
            </div>
            <div style={{ marginBottom:14 }}>
              <label style={{ fontSize:12, fontWeight:600, color:'#5f6368', display:'block', marginBottom:6 }}>Nombre de la lista *</label>
              <input value={newCatName} onChange={e => setNewCatName(e.target.value)}
                placeholder="Ej: Seguimiento" autoFocus
                onKeyDown={e => e.key === 'Enter' && handleAddCategory()}
                style={{ width:'100%', border:'1px solid #dadce0', borderRadius:8, padding:'9px 12px', fontSize:14, outline:'none', fontFamily:'inherit' }} />
            </div>
            <div style={{ marginBottom:20 }}>
              <label style={{ fontSize:12, fontWeight:600, color:'#5f6368', display:'block', marginBottom:6 }}>Color</label>
              <div style={{ display:'flex', gap:10, flexWrap:'wrap' }}>
                {['#1565C0','#2E7D32','#6A1B9A','#E65100','#C62828','#00695C','#0891b2','#7B1FA2','#F57F17','#37474F','#AD1457','#1B5E20'].map(c => (
                  <button key={c} onClick={() => setNewCatColor(c)} style={{ width:28, height:28, borderRadius:'50%', background:c, border: newCatColor===c ? '3px solid #202124' : '3px solid transparent', cursor:'pointer', padding:0 }} />
                ))}
                <input type="color" value={newCatColor} onChange={e => setNewCatColor(e.target.value)}
                  style={{ width:28, height:28, borderRadius:'50%', border:'1px solid #dadce0', cursor:'pointer', padding:0 }} title="Color personalizado" />
              </div>
            </div>
            <div style={{ display:'flex', gap:8 }}>
              <button onClick={handleAddCategory} disabled={!newCatName.trim()}
                style={{ flex:1, padding:'10px', background: newCatName.trim() ? '#1a73e8' : '#e8eaed', color: newCatName.trim() ? '#fff' : '#9aa0a6', border:'none', borderRadius:8, fontSize:14, fontWeight:500, cursor: newCatName.trim() ? 'pointer' : 'not-allowed', fontFamily:'inherit' }}>
                Crear lista
              </button>
              <button onClick={() => setShowNewCategory(false)}
                style={{ padding:'10px 16px', background:'none', border:'1px solid #dadce0', borderRadius:8, fontSize:14, cursor:'pointer', fontFamily:'inherit', color:'#5f6368' }}>
                Cancelar
              </button>
            </div>
          </div>
        </div>
      )}

      {selectedTask && (
        <TaskPanel
          task={selectedTask}
          onClose={() => { setSelectedTask(null); fetchTasks(); }}
          onUpdate={updateTask}
          onDelete={deleteTask}
          onComplete={handleCompleteTask}
          createSubtask={createSubtask}
          getSubtasks={getSubtasks}
          onSubtasksChanged={() => { fetchTasks(); setSubtaskReloadTrigger(k => k + 1); }}
        />
      )}
    </div>
  );
}

const styles = {
  container: { height: '100%', display: 'flex', flexDirection: 'column', overflow: 'hidden' },
  header: {
    display: 'flex', justifyContent: 'space-between',
    alignItems: 'flex-start', marginBottom: 16, flexShrink: 0,
  },
  title: { fontSize: 24, fontWeight: 700, color: '#202124', margin: '0 0 6px' },
  subtitleRow: { display: 'flex', alignItems: 'center', gap: 8 },
  userSelectorWrapper: { position: 'relative', display: 'inline-flex', alignItems: 'center' },
  userSelector: {
    appearance: 'none', border: '1px solid #dadce0',
    borderRadius: 8, padding: '5px 28px 5px 10px',
    fontSize: 13, fontWeight: 600, color: '#202124',
    background: '#fff', cursor: 'pointer', outline: 'none',
    fontFamily: 'inherit',
  },
  selectorIcon: { position: 'absolute', right: 8, pointerEvents: 'none' },
  userBadge: {
    fontSize: 13, fontWeight: 600, color: '#1a73e8',
    background: '#e8f0fe', borderRadius: 8,
    padding: '4px 10px',
  },
  taskCountText: { fontSize: 14, color: '#5f6368', display: 'flex', alignItems: 'center', gap: 6 },
  viewingBadge: {
    background: '#fce8e6', color: '#c5221f',
    fontSize: 11, fontWeight: 600,
    padding: '2px 8px', borderRadius: 20,
  },
  refreshBtn: {
    background: '#fff', border: '1px solid #dadce0',
    borderRadius: 8, padding: '8px 10px',
    cursor: 'pointer', display: 'flex', alignItems: 'center',
  },
  viewingBanner: {
    background: '#fff3e0', border: '1px solid #ffe0b2',
    borderRadius: 8, padding: '10px 16px',
    fontSize: 13, color: '#e65100',
    marginBottom: 16, flexShrink: 0,
    display: 'flex', alignItems: 'center', gap: 12,
  },
  bannerBtn: {
    marginLeft: 'auto', padding: '5px 12px',
    background: '#e65100', color: '#fff',
    border: 'none', borderRadius: 6,
    fontSize: 12, cursor: 'pointer', fontFamily: 'inherit',
  },
  columnsWrapper: { flex: 1, overflow: 'auto' },
  columns: { display: 'flex', gap: 16, padding: '4px 4px 24px', minWidth: 'max-content', alignItems: 'flex-start' },
  loading: { display: 'flex', alignItems: 'center', justifyContent: 'center', height: '100%', color: '#5f6368', fontSize: 14 },
};
