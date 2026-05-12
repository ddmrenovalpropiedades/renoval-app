import React, { useState } from 'react';
import { DndContext, closestCenter, KeyboardSensor, PointerSensor, useSensor, useSensors } from '@dnd-kit/core';
import { sortableKeyboardCoordinates, arrayMove } from '@dnd-kit/sortable';
import { useTasks } from '../hooks/useTasks';
import TaskColumn from '../components/TaskColumn';
import TaskPanel from '../components/TaskPanel';
import { useAuth } from '../context/AuthContext';
import { History, RefreshCw } from 'lucide-react';

export default function TasksPage() {
  const { profile } = useAuth();
  const {
    tasksByCategory, loading, fetchTasks,
    createTask, createSubtask, updateTask,
    completeTask, deleteTask, reorderTasks,
    getSubtasks, CATEGORIES,
  } = useTasks();

  const [selectedTask, setSelectedTask] = useState(null);
  const [showHistory, setShowHistory] = useState(false);

  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 5 } }),
    useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates })
  );

  const handleDragEnd = (event) => {
    const { active, over } = event;
    if (!over || active.id === over.id) return;

    // Encontrar en qué categoría está la tarea
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
    fetchTasks();
  };

  if (loading) {
    return (
      <div style={styles.loading}>
        <div style={styles.loadingSpinner} />
        Cargando tareas...
      </div>
    );
  }

  return (
    <div style={styles.container}>
      {/* Header */}
      <div style={styles.header}>
        <div>
          <h1 style={styles.title}>Tareas Pendientes</h1>
          <p style={styles.subtitle}>
            {profile?.initials} · {Object.values(tasksByCategory).flat().length} tareas activas
          </p>
        </div>
        <div style={styles.headerActions}>
          <button onClick={fetchTasks} style={styles.iconBtn} title="Actualizar">
            <RefreshCw size={16} color="#5f6368" />
          </button>
          <button
            onClick={() => setShowHistory(!showHistory)}
            style={{ ...styles.iconBtn, ...(showHistory ? styles.iconBtnActive : {}) }}
            title="Historial"
          >
            <History size={16} color={showHistory ? '#1a73e8' : '#5f6368'} />
          </button>
        </div>
      </div>

      {/* Columnas de tareas en layout horizontal */}
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
              />
            ))}
          </div>
        </div>
      </DndContext>

      {/* Panel lateral de detalle */}
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
  container: {
    height: '100%',
    display: 'flex',
    flexDirection: 'column',
    overflow: 'hidden',
  },
  header: {
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    marginBottom: 24,
    flexShrink: 0,
  },
  title: {
    fontSize: 24, fontWeight: 700,
    color: '#202124', margin: '0 0 4px',
  },
  subtitle: { fontSize: 14, color: '#5f6368', margin: 0 },
  headerActions: { display: 'flex', gap: 8 },
  iconBtn: {
    background: '#fff', border: '1px solid #dadce0',
    borderRadius: 8, padding: '8px 10px',
    cursor: 'pointer', display: 'flex', alignItems: 'center',
  },
  iconBtnActive: {
    background: '#e8f0fe', borderColor: '#1a73e8',
  },
  columnsWrapper: {
    flex: 1,
    overflow: 'auto',
  },
  columns: {
    display: 'flex',
    gap: 16,
    padding: '4px 4px 24px',
    minWidth: 'max-content',
  },
  loading: {
    display: 'flex', alignItems: 'center',
    justifyContent: 'center', gap: 12,
    height: '100%', color: '#5f6368', fontSize: 14,
  },
  loadingSpinner: {
    width: 20, height: 20, borderRadius: '50%',
    border: '2px solid #e8eaed',
    borderTopColor: '#1a73e8',
    animation: 'spin 0.8s linear infinite',
  },
};
