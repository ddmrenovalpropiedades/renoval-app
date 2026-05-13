import React, { useState } from 'react';
import { DndContext, closestCenter, KeyboardSensor, PointerSensor, useSensor, useSensors } from '@dnd-kit/core';
import { sortableKeyboardCoordinates, arrayMove } from '@dnd-kit/sortable';
import { useTasks } from '../hooks/useTasks';
import TaskColumn from '../components/TaskColumn';
import TaskPanel from '../components/TaskPanel';
import { useAuth } from '../context/AuthContext';
import { RefreshCw, ChevronDown, History } from 'lucide-react';
import HistoryPanel from '../components/HistoryPanel';
import { USER_INITIALS } from '../supabaseClient';

const ALL_USERS = Object.entries(USER_INITIALS).map(([email, initials]) => ({ email, initials }));

export default function TasksPage() {
  const { profile } = useAuth();
  const [viewingEmail, setViewingEmail] = useState(null);
  const [showHistory, setShowHistory] = useState(false);

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

  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 5 } }),
    useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates })
  );

  const handleDragEnd = (event) => {
    const { active, over } = event;
    if (!over || active.id === over.id) return;
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
        <DndContext sensors={sensors} collisionDetection={closestCenter} onDragEnd={handleDragEnd}>
          <div style={styles.columnsWrapper}>
            <div style={styles.columns}>
              {CATEGORIES.map(category => (
                <TaskColumn
                  key={category}
                  category={category}
                  tasks={tasksByCategory[category] || []}
                  onOpenTask={setSelectedTask}
                  onCompleteTask={handleCompleteTask}
                  onCreateTask={createTask}
                  currentUserEmail={effectiveEmail}
                  dormantTasks={dormantByCategory[category] || []}
                />
              ))}
            </div>
          </div>
        </DndContext>
      )}

      {showHistory && (
        <HistoryPanel
          onClose={() => setShowHistory(false)}
          ownerEmail={effectiveEmail}
        />
      )}
      {selectedTask && (
        <TaskPanel
          task={selectedTask}
          onClose={() => setSelectedTask(null)}
          onUpdate={updateTask}
          onDelete={deleteTask}
          onComplete={handleCompleteTask}
          createSubtask={createSubtask}
          getSubtasks={getSubtasks}
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
  columns: { display: 'flex', gap: 16, padding: '4px 4px 24px', minWidth: 'max-content' },
  loading: { display: 'flex', alignItems: 'center', justifyContent: 'center', height: '100%', color: '#5f6368', fontSize: 14 },
};
