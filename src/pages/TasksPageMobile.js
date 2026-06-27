import React, { useState, useEffect, useCallback, useRef } from 'react';
import { Plus, X, ChevronDown, ChevronRight, RefreshCw,
         Clock, Check, History, Settings } from 'lucide-react';
import { supabase } from '../supabaseClient';
import { useTasks } from '../hooks/useTasks';
import { useAuth } from '../context/AuthContext';
import AnimatedCheckbox from '../components/AnimatedCheckbox';
import TaskPanel from '../components/TaskPanel';
import PlanningPage from './PlanningPage';
import HistoryPanel from '../components/HistoryPanel';
import TaskTemplatesPanel from '../components/TaskTemplatesPanel';
import DevGarPanel from '../components/DevGarPanel';
import { formatLocalDate } from '../hooks/useTasks';

const DEFAULT_CATEGORIES = [
  'Llegada arrendatario','Publicar/Arrendar','Equipo','Solicitudes','Misceláneo','PAGOS'
];

// ── Side effects al completar subtareas ──────────────────────
async function runSubtaskSideEffects(subtaskTitle, parentTaskTitle) {
  const title = (subtaskTitle || '').trim();
  const propMatch = (parentTaskTitle || '').match(/^(?:Arriendo|Dev Gar)\s+(.+)$/i);
  const propiedad = propMatch ? propMatch[1].trim() : null;
  if (!propiedad) return;
  if (title === 'Notificar dueño' || title === 'Notificar dueno')
    await supabase.from('pizarra').update({ aviso: 'Listo' }).ilike('propiedad', propiedad);
  if (title === 'Respaldar publicación' || title === 'Respaldar publicacion')
    await supabase.from('pizarra').update({ respaldo: 'Listo' }).ilike('propiedad', propiedad);
  if (title === 'Publicar')
    await supabase.from('pizarra').update({ status: 'Listo' }).ilike('propiedad', propiedad);
  if (title === 'Liquidación' || title === 'Liquidacion')
    await supabase.from('arrendadas').update({ liquidacion: 'Listo' }).ilike('propiedad', propiedad);
  if (title === 'Respaldo contrato carpeta')
    await supabase.from('arrendadas').update({ contrato: 'Listo' }).ilike('propiedad', propiedad);
  if (title === 'Pago cuentas')
    await supabase.from('arrendadas').update({ cuentas: 'Listo' }).ilike('propiedad', propiedad);
}

// ── Subtask item ──────────────────────────────────────────────
function SubtaskRow({ subtask, onComplete, color }) {
  return (
    <div style={ms.subtaskRow}>
      <div style={ms.subtaskIndent} />
      <button
        onClick={() => onComplete(subtask)}
        style={{ ...ms.subtaskCheck, borderColor: color }}
      >
        <div />
      </button>
      <span style={ms.subtaskTitle}>{subtask.title}</span>
      {subtask.urgent && <span style={ms.urgentDot}>!</span>}
    </div>
  );
}

// ── Task row ──────────────────────────────────────────────────
function TaskRow({ task, onOpen, onComplete, color, reloadKey }) {
  const [subtasks, setSubtasks] = useState([]);
  const [expanded, setExpanded] = useState(false);

  const loadSubtasks = useCallback(async () => {
    const { data } = await supabase.from('tasks').select('*')
      .eq('parent_id', task.id).eq('completed', false)
      .order('position', { ascending: true });
    setSubtasks(data || []);
  }, [task.id]);

  useEffect(() => { loadSubtasks(); }, [loadSubtasks, reloadKey]);

  const handleCompleteSubtask = async (subtask) => {
    await runSubtaskSideEffects(subtask.title, task.title);
    if (task.category === 'Equipo' && subtask.solicitud_id)
      await supabase.from('tasks').delete().eq('id', subtask.solicitud_id);
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

  const hasSubtasks = subtasks.length > 0;
  const isUrgent = task.urgent;
  const isProxima = task.proxima_vencer && !task.urgent;
  const isOverdue = task.due_date && new Date(task.due_date) < new Date();

  return (
    <div style={ms.taskBlock}>
      <div style={ms.taskRow} onClick={() => onOpen(task)}>
        {/* Checkbox — stopPropagation para no abrir el panel */}
        <div onClick={e => { e.stopPropagation(); if (!hasSubtasks) onComplete(task); }}>
          <AnimatedCheckbox
            size={22}
            urgent={isUrgent}
            proxima={isProxima}
            onClick={() => !hasSubtasks && onComplete(task)}
          />
        </div>

        <div style={ms.taskContent}>
          <div style={ms.taskTitleRow}>
            {isUrgent && <span style={ms.urgentDot}>!</span>}
            {isProxima && <span style={{ ...ms.urgentDot, background: '#f57c00' }}>!</span>}
            <span style={ms.taskTitle}>{task.title}</span>
            {task.recurrence && task.recurrence !== 'none' && (
              <RefreshCw size={11} color="#9aa0a6" />
            )}
          </div>
          <div style={ms.taskMeta}>
            {isOverdue && <span style={ms.overdueBadge}>Vencida</span>}
            {task.due_date && !isOverdue && (
              <span style={ms.dueDateText}>
                {new Date(task.due_date + 'T12:00:00').toLocaleDateString('es-CL', { day: '2-digit', month: '2-digit' })}
              </span>
            )}
            {hasSubtasks && (
              <span style={ms.subtaskCountBadge}>
                {subtasks.length} subtarea{subtasks.length !== 1 ? 's' : ''}
              </span>
            )}
          </div>
        </div>

        {/* Expand subtasks */}
        {hasSubtasks && (
          <button
            style={ms.expandBtn}
            onClick={e => { e.stopPropagation(); setExpanded(v => !v); }}
          >
            {expanded
              ? <ChevronDown size={18} color="#9aa0a6" />
              : <ChevronRight size={18} color="#9aa0a6" />}
          </button>
        )}
      </div>

      {expanded && hasSubtasks && (
        <div style={ms.subtaskList}>
          {subtasks.map(sub => (
            <SubtaskRow key={sub.id} subtask={sub} onComplete={handleCompleteSubtask} color={color} />
          ))}
        </div>
      )}
    </div>
  );
}

// ── Quick add bar ─────────────────────────────────────────────
function QuickAddBar({ onAdd, onCancel, color }) {
  const [title, setTitle] = useState('');
  const inputRef = useRef(null);

  useEffect(() => { inputRef.current?.focus(); }, []);

  const handleAdd = async () => {
    if (!title.trim()) return;
    await onAdd(title.trim());
    setTitle('');
  };

  return (
    <div style={ms.quickAddBar}>
      <div style={{ ...ms.quickAddAccent, background: color }} />
      <input
        ref={inputRef}
        value={title}
        onChange={e => setTitle(e.target.value)}
        onKeyDown={e => { if (e.key === 'Enter') handleAdd(); if (e.key === 'Escape') onCancel(); }}
        placeholder="Título de la tarea"
        style={ms.quickAddInput}
      />
      <div style={ms.quickAddActions}>
        <button
          onClick={handleAdd}
          disabled={!title.trim()}
          style={{ ...ms.quickAddSave, opacity: title.trim() ? 1 : 0.4 }}
        >
          <Check size={18} color="#1a73e8" />
        </button>
        <button onClick={onCancel} style={ms.quickAddCancel}>
          <X size={18} color="#9aa0a6" />
        </button>
      </div>
    </div>
  );
}

// ── Main mobile tasks page ────────────────────────────────────
export default function TasksPageMobile() {
  const { profile } = useAuth();
  const [activeTab, setActiveTab] = useState('tasks'); // 'tasks' | 'planning'
  const [selectedCat, setSelectedCat] = useState(null);
  const [categories, setCategories] = useState(null);
  const [selectedTask, setSelectedTask] = useState(null);
  const [adding, setAdding] = useState(false);
  const [reloadKey, setReloadKey] = useState(0);
  const [showHistory, setShowHistory] = useState(false);
  const [showTemplates, setShowTemplates] = useState(false);
  const [showDevGar, setShowDevGar] = useState(false);
  const tabsRef = useRef(null);

  const isOwner = profile?.isOwner;

  // ── Orden propio para móvil, independiente del PC ─────────────
  const mobileOrderKey = profile?.email ? `tasksOrderMobile_${profile.email}` : null;

  const applyMobileOrder = (cats, savedOrder) => {
    if (!savedOrder || !savedOrder.length) return cats;
    const ordered = savedOrder
      .map(name => cats.find(c => c.name === name))
      .filter(Boolean);
    const missing = cats.filter(c => !savedOrder.includes(c.name));
    return [...ordered, ...missing];
  };

  const saveMobileOrder = (cats) => {
    if (!mobileOrderKey) return;
    localStorage.setItem(mobileOrderKey, JSON.stringify(cats.map(c => c.name)));
  };

  const moveCategory = (idx, dir) => {
    const newIdx = idx + dir;
    if (newIdx < 0 || newIdx >= categories.length) return;
    const next = [...categories];
    [next[idx], next[newIdx]] = [next[newIdx], next[idx]];
    setCategories(next);
    saveMobileOrder(next);
  };

  const {
    tasksByCategory, dormantByCategory, loading, fetchTasks,
    createTask, createSubtask, updateTask, completeTask, deleteTask,
    getSubtasks,
  } = useTasks(null);

  // ── Cargar categorías ─────────────────────────────────────────
  useEffect(() => {
    if (!profile?.email) return;
    const load = async () => {
      const { data } = await supabase.from('task_categories').select('*')
        .order('position', { ascending: true });
      if (data && data.length > 0) {
        const filtered = data
          .filter(c => c.is_default || c.user_email === profile.email)
          .map(c => {
            if (c.name === 'Entrada') return { ...c, name: 'Llegada arrendatario' };
            if (c.name === 'Salida') return { ...c, name: 'Publicar/Arrendar' };
            return c;
          });
        // Aplicar orden guardado para móvil
        const savedOrder = (() => {
          try { return JSON.parse(localStorage.getItem(`tasksOrderMobile_${profile.email}`) || 'null'); } catch { return null; }
        })();
        const ordered = applyMobileOrder(filtered, savedOrder);
        setCategories(ordered);
        if (!selectedCat) setSelectedCat(ordered[0]?.name || DEFAULT_CATEGORIES[0]);
      } else {
        const defaults = DEFAULT_CATEGORIES.map((name, i) => ({
          name, color: ['#1565C0','#2E7D32','#6A1B9A','#E65100','#37474F','#C62828'][i],
        }));
        setCategories(defaults);
        if (!selectedCat) setSelectedCat(defaults[0].name);
      }
    };
    load();
  }, [profile?.email]); // eslint-disable-line

  const getCatColor = (name) => {
    const cat = categories?.find(c => c.name === name);
    return cat?.color || '#37474F';
  };

  const currentColor = getCatColor(selectedCat);
  const currentTasks = tasksByCategory[selectedCat] || [];
  const totalTasks = Object.values(tasksByCategory).flat().length;

  const handleComplete = async (task) => {
    await completeTask(task);
    if (selectedTask?.id === task.id) setSelectedTask(null);
    await fetchTasks();
  };

  const handleAddTask = async (title) => {
    await createTask({ title, category: selectedCat });
    setAdding(false);
    await fetchTasks();
  };

  // Scroll activo tab a la vista
  useEffect(() => {
    if (!tabsRef.current || !selectedCat || !categories) return;
    const idx = categories.findIndex(c => c.name === selectedCat);
    const tabEl = tabsRef.current.children[idx];
    if (tabEl) tabEl.scrollIntoView({ behavior: 'smooth', inline: 'center', block: 'nearest' });
  }, [selectedCat, categories]);

  if (!categories || loading) {
    return (
      <div style={ms.loadingScreen}>
        <div style={ms.loadingText}>Cargando tareas...</div>
      </div>
    );
  }

  return (
    <div style={ms.container}>

      {/* ── Header ── */}
      <div style={ms.header}>
        <div style={ms.headerTop}>
          <div>
            <div style={ms.headerTitle}>Tareas</div>
            <div style={ms.headerSub}>{totalTasks} tareas activas</div>
          </div>
          <div style={ms.headerActions}>
            <button onClick={() => setShowDevGar(true)} style={ms.headerBtn} title="Dev Gar">
              <Clock size={18} color="#5f6368" />
            </button>
            <button onClick={() => setShowHistory(true)} style={ms.headerBtn} title="Historial">
              <History size={18} color="#5f6368" />
            </button>
            {isOwner && (
              <button onClick={() => setShowTemplates(true)} style={ms.headerBtn} title="Automáticas">
                <Settings size={18} color="#5f6368" />
              </button>
            )}
          </div>
        </div>

        {/* ── Tab bar (tasks / planning) ── */}
        <div style={ms.viewTabs}>
          <button
            onClick={() => setActiveTab('tasks')}
            style={{ ...ms.viewTab, ...(activeTab === 'tasks' ? ms.viewTabActive : {}) }}
          >Tareas</button>
          <button
            onClick={() => setActiveTab('planning')}
            style={{ ...ms.viewTab, ...(activeTab === 'planning' ? ms.viewTabActive : {}) }}
          >Planificación</button>
        </div>
      </div>

      {activeTab === 'planning' ? (
        <div style={{ flex: 1, overflow: 'auto' }}>
          <PlanningPage
            allTasks={Object.values(tasksByCategory).flat()}
            userEmail={profile?.email}
            userName={profile?.name}
            isMobile={true}
          />
        </div>
      ) : (
        <>
          {/* ── Category chips (scroll horizontal) ── */}
          <div style={ms.catBar}>
            <div ref={tabsRef} style={ms.catScroll}>
              {categories.map((cat, idx) => {
                const active = selectedCat === cat.name;
                const color = cat.color || '#37474F';
                const count = (tasksByCategory[cat.name] || []).length;
                return (
                  <div key={cat.name} style={{ display: 'inline-flex', alignItems: 'center', gap: 2, flexShrink: 0 }}>
                    {/* Flecha izquierda — solo en chip activo y no primero */}
                    {active && idx > 0 && (
                      <button
                        onClick={e => { e.stopPropagation(); moveCategory(idx, -1); }}
                        style={{ ...ms.orderArrow, borderColor: color, color }}
                        title="Mover izquierda"
                      >‹</button>
                    )}
                    <button
                      onClick={() => setSelectedCat(cat.name)}
                      style={{
                        ...ms.catChip,
                        ...(active ? { background: color, color: '#fff', borderColor: color }
                                   : { background: '#fff', color, borderColor: color + '55' }),
                      }}
                    >
                      {cat.name}
                      {count > 0 && (
                        <span style={{
                          ...ms.catChipCount,
                          background: active ? 'rgba(255,255,255,0.3)' : color + '22',
                          color: active ? '#fff' : color,
                        }}>{count}</span>
                      )}
                    </button>
                    {/* Flecha derecha — solo en chip activo y no último */}
                    {active && idx < categories.length - 1 && (
                      <button
                        onClick={e => { e.stopPropagation(); moveCategory(idx, 1); }}
                        style={{ ...ms.orderArrow, borderColor: color, color }}
                        title="Mover derecha"
                      >›</button>
                    )}
                  </div>
                );
              })}
            </div>
          </div>

          {/* ── Task list ── */}
          <div style={ms.taskList}>
            {currentTasks.length === 0 && !adding ? (
              <div style={ms.emptyState}>
                <div style={ms.emptyIcon}>✓</div>
                <div style={ms.emptyTitle}>Sin tareas pendientes</div>
                <div style={ms.emptySub}>Toca + para agregar una tarea</div>
              </div>
            ) : (
              <>
                {currentTasks.map(task => (
                  <TaskRow
                    key={task.id}
                    task={task}
                    onOpen={setSelectedTask}
                    onComplete={handleComplete}
                    color={currentColor}
                    reloadKey={reloadKey}
                  />
                ))}

                {/* Dormant tasks */}
                {(dormantByCategory[selectedCat] || []).length > 0 && (
                  <DormantSection tasks={dormantByCategory[selectedCat]} onOpen={setSelectedTask} color={currentColor} />
                )}
              </>
            )}

            {/* Quick add bar (aparece sobre el FAB) */}
            {adding && (
              <QuickAddBar
                onAdd={handleAddTask}
                onCancel={() => setAdding(false)}
                color={currentColor}
              />
            )}

            {/* Espaciado para el FAB */}
            <div style={{ height: 88 }} />
          </div>

          {/* ── FAB ── */}
          {!adding && (
            <button
              onClick={() => setAdding(true)}
              style={{ ...ms.fab, background: currentColor }}
            >
              <Plus size={26} color="#fff" />
            </button>
          )}
        </>
      )}

      {/* ── Task panel (pantalla completa en móvil) ── */}
      {selectedTask && (
        <div style={ms.fullscreenPanel}>
          <TaskPanel
            task={selectedTask}
            onClose={() => { setSelectedTask(null); fetchTasks(); setReloadKey(k => k + 1); }}
            onUpdate={updateTask}
            onDelete={deleteTask}
            onComplete={handleComplete}
            createSubtask={createSubtask}
            getSubtasks={getSubtasks}
            onSubtasksChanged={() => { fetchTasks(); setReloadKey(k => k + 1); }}
          />
        </div>
      )}

      {/* ── Modals ── */}
      {showHistory && <HistoryPanel onClose={() => setShowHistory(false)} ownerEmail={profile?.email} />}
      {showDevGar && <DevGarPanel onClose={() => setShowDevGar(false)} />}
      {showTemplates && <TaskTemplatesPanel onClose={() => setShowTemplates(false)} />}
    </div>
  );
}

// ── Dormant section ───────────────────────────────────────────
function DormantSection({ tasks, onOpen, color }) {
  const [open, setOpen] = useState(false);
  return (
    <div style={ms.dormantSection}>
      <button onClick={() => setOpen(v => !v)} style={ms.dormantToggle}>
        <RefreshCw size={13} color="#9aa0a6" />
        <span style={ms.dormantLabel}>
          {open ? 'Ocultar' : 'Ver'} recurrentes dormidas ({tasks.length})
        </span>
        {open ? <ChevronDown size={13} color="#9aa0a6" /> : <ChevronRight size={13} color="#9aa0a6" />}
      </button>
      {open && tasks.map(task => (
        <div key={task.id} style={ms.dormantItem} onClick={() => onOpen(task)}>
          <RefreshCw size={12} color={color} style={{ flexShrink: 0 }} />
          <span style={{ ...ms.dormantTitle, color }}>{task.title}</span>
          <span style={ms.dormantDate}>
            {task.next_occurrence ? formatLocalDate(task.next_occurrence) : ''}
          </span>
        </div>
      ))}
    </div>
  );
}

// ── Styles ────────────────────────────────────────────────────
const ms = {
  container: {
    height: '100%', display: 'flex', flexDirection: 'column',
    background: '#f8f9fa', fontFamily: "'Google Sans','Segoe UI',sans-serif",
    overflow: 'hidden', position: 'relative',
  },
  loadingScreen: { flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center' },
  loadingText: { fontSize: 14, color: '#9aa0a6' },

  // Header
  header: {
    background: '#fff', borderBottom: '1px solid #e8eaed', flexShrink: 0,
    paddingTop: 12,
  },
  headerTop: {
    display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start',
    padding: '0 16px 10px',
  },
  headerTitle: { fontSize: 22, fontWeight: 700, color: '#202124' },
  headerSub: { fontSize: 12, color: '#9aa0a6', marginTop: 2 },
  headerActions: { display: 'flex', gap: 4 },
  headerBtn: {
    background: 'none', border: 'none', cursor: 'pointer',
    padding: 8, borderRadius: 8, display: 'flex', alignItems: 'center',
  },

  // View tabs
  viewTabs: { display: 'flex', padding: '0 16px', gap: 0 },
  viewTab: {
    padding: '8px 16px', background: 'none', border: 'none',
    borderBottom: '2px solid transparent', fontSize: 13, fontWeight: 500,
    cursor: 'pointer', color: '#5f6368', fontFamily: 'inherit',
  },
  viewTabActive: { color: '#1a73e8', borderBottomColor: '#1a73e8' },

  // Category chips
  catBar: {
    background: '#fff', flexShrink: 0,
    borderBottom: '1px solid #f1f3f4',
  },
  catScroll: {
    display: 'flex', gap: 8, overflowX: 'auto', padding: '10px 16px',
    scrollbarWidth: 'none', msOverflowStyle: 'none',
    WebkitOverflowScrolling: 'touch',
  },
  catChip: {
    display: 'inline-flex', alignItems: 'center', gap: 6,
    padding: '6px 14px', borderRadius: 20, border: '1.5px solid',
    fontSize: 13, fontWeight: 600, cursor: 'pointer', flexShrink: 0,
    fontFamily: 'inherit', transition: 'all 0.15s',
    whiteSpace: 'nowrap',
  },
  catChipCount: {
    fontSize: 11, fontWeight: 700, padding: '1px 7px',
    borderRadius: 10, minWidth: 20, textAlign: 'center',
  },
  orderArrow: {
    background: 'none', border: '1px solid', borderRadius: 20,
    width: 22, height: 28, display: 'flex', alignItems: 'center',
    justifyContent: 'center', cursor: 'pointer', fontSize: 16,
    fontWeight: 700, padding: 0, flexShrink: 0, lineHeight: 1,
  },

  // Task list
  taskList: { flex: 1, overflowY: 'auto', background: '#f8f9fa' },

  // Task row
  taskBlock: { background: '#fff', marginBottom: 1 },
  taskRow: {
    display: 'flex', alignItems: 'center', padding: '13px 16px',
    gap: 12, cursor: 'pointer', minHeight: 56,
  },
  taskContent: { flex: 1, minWidth: 0 },
  taskTitleRow: { display: 'flex', alignItems: 'center', gap: 6, marginBottom: 2 },
  taskTitle: {
    fontSize: 15, color: '#202124', lineHeight: 1.4,
    overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', flex: 1,
  },
  taskMeta: { display: 'flex', alignItems: 'center', gap: 6, marginTop: 2 },
  urgentDot: {
    display: 'inline-flex', alignItems: 'center', justifyContent: 'center',
    width: 16, height: 16, borderRadius: '50%', background: '#ea4335',
    color: '#fff', fontSize: 10, fontWeight: 900, flexShrink: 0,
  },
  overdueBadge: {
    fontSize: 11, color: '#ea4335', background: '#fce8e6',
    padding: '1px 7px', borderRadius: 10, fontWeight: 600,
  },
  dueDateText: { fontSize: 11, color: '#9aa0a6' },
  subtaskCountBadge: {
    fontSize: 11, color: '#5f6368', background: '#f1f3f4',
    padding: '1px 7px', borderRadius: 10,
  },
  expandBtn: {
    background: 'none', border: 'none', cursor: 'pointer',
    padding: 4, display: 'flex', alignItems: 'center', flexShrink: 0,
  },

  // Subtask rows
  subtaskList: { background: '#fafafa', borderTop: '1px solid #f1f3f4' },
  subtaskRow: {
    display: 'flex', alignItems: 'center', padding: '9px 16px 9px 0',
    gap: 10, borderBottom: '1px solid #f8f9fa',
  },
  subtaskIndent: { width: 40, flexShrink: 0 },
  subtaskCheck: {
    width: 18, height: 18, borderRadius: '50%', border: '2px solid',
    background: 'none', cursor: 'pointer', flexShrink: 0, padding: 0,
    display: 'flex', alignItems: 'center', justifyContent: 'center',
  },
  subtaskTitle: { flex: 1, fontSize: 13, color: '#5f6368' },

  // Quick add
  quickAddBar: {
    display: 'flex', alignItems: 'center', gap: 12,
    background: '#fff', padding: '12px 16px',
    borderTop: '2px solid #1a73e8', margin: '0',
    position: 'sticky', bottom: 0,
  },
  quickAddAccent: { width: 3, height: 40, borderRadius: 3, flexShrink: 0 },
  quickAddInput: {
    flex: 1, border: 'none', outline: 'none', fontSize: 16,
    fontFamily: 'inherit', color: '#202124', background: 'transparent',
    padding: '8px 0',
  },
  quickAddActions: { display: 'flex', gap: 4 },
  quickAddSave: {
    background: 'none', border: 'none', cursor: 'pointer',
    padding: 8, display: 'flex', alignItems: 'center',
  },
  quickAddCancel: {
    background: 'none', border: 'none', cursor: 'pointer',
    padding: 8, display: 'flex', alignItems: 'center',
  },

  // FAB
  fab: {
    position: 'absolute', bottom: 24, right: 20,
    width: 56, height: 56, borderRadius: 16,
    border: 'none', cursor: 'pointer',
    display: 'flex', alignItems: 'center', justifyContent: 'center',
    boxShadow: '0 4px 16px rgba(0,0,0,0.22)',
    zIndex: 100, transition: 'transform 0.15s',
  },

  // Empty state
  emptyState: {
    display: 'flex', flexDirection: 'column', alignItems: 'center',
    justifyContent: 'center', padding: '60px 32px', gap: 8,
  },
  emptyIcon: {
    width: 56, height: 56, borderRadius: '50%', background: '#e8f0fe',
    display: 'flex', alignItems: 'center', justifyContent: 'center',
    fontSize: 24, color: '#1a73e8', marginBottom: 8,
  },
  emptyTitle: { fontSize: 16, fontWeight: 600, color: '#202124' },
  emptySub: { fontSize: 13, color: '#9aa0a6' },

  // Fullscreen panel override
  fullscreenPanel: {
    position: 'fixed', inset: 0, zIndex: 500,
  },

  // Dormant
  dormantSection: { background: '#fff', borderTop: '1px solid #f1f3f4', marginTop: 8 },
  dormantToggle: {
    display: 'flex', alignItems: 'center', gap: 6, width: '100%',
    padding: '10px 16px', background: 'none', border: 'none',
    cursor: 'pointer', fontFamily: 'inherit',
  },
  dormantLabel: { fontSize: 12, color: '#9aa0a6', flex: 1, textAlign: 'left' },
  dormantItem: {
    display: 'flex', alignItems: 'center', gap: 10,
    padding: '9px 16px', borderBottom: '1px solid #f8f9fa',
    cursor: 'pointer',
  },
  dormantTitle: { flex: 1, fontSize: 13, fontStyle: 'italic' },
  dormantDate: {
    fontSize: 11, color: '#9aa0a6', background: '#e8f0fe',
    borderRadius: 10, padding: '1px 8px',
  },
};
