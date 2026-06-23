import React, { useState } from 'react';
import {
  DndContext, KeyboardSensor, PointerSensor,
  useSensor, useSensors, DragOverlay, pointerWithin,
  useDroppable,
} from '@dnd-kit/core';
import {
  sortableKeyboardCoordinates, arrayMove,
  SortableContext, verticalListSortingStrategy, useSortable,
} from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';
import { useTasks } from '../hooks/useTasks';
import { supabase } from '../supabaseClient';
import TaskColumn from '../components/TaskColumn';
import TaskPanel from '../components/TaskPanel';
import { useAuth } from '../context/AuthContext';
import { ChevronDown, History, Plus, X, Settings, Clock, Download } from 'lucide-react';
import GallerySidebar, { unlockNextGalleryImage } from '../components/GallerySidebar';
import PlanningPage from './PlanningPage';
import HistoryPanel from '../components/HistoryPanel';
import TaskTemplatesPanel from '../components/TaskTemplatesPanel';
import DevGarPanel from '../components/DevGarPanel';
import { USER_INITIALS } from '../supabaseClient';
import { exportTareasAllUsers } from '../hooks/exportTareasAllUsers';

const ALL_USERS = Object.entries(USER_INITIALS).map(([email, initials]) => ({ email, initials }));
const DEFAULT_CATEGORIES = ['Llegada arrendatario', 'Publicar/Arrendar', 'Equipo', 'Solicitudes', 'Misceláneo', 'PAGOS'];

// ── Helpers de layout ─────────────────────────────────────────────────────────

// Convierte layout [[A,B],[C],[D,E]] → [A,B,C,D,E]
function flattenLayout(layout) {
  return layout.flat();
}

// Convierte array plano [A,B,C,D,E] → una columna por listado [[A],[B],[C],[D],[E]]
function buildDefaultLayout(names) {
  return names.map(name => [name]);
}

// Devuelve { colIndex, rowIndex } de un listado en el layout, o null
function findInLayout(layout, name) {
  for (let c = 0; c < layout.length; c++) {
    const r = layout[c].indexOf(name);
    if (r !== -1) return { colIndex: c, rowIndex: r };
  }
  return null;
}

// Elimina listado del layout y limpia columnas vacías
function removeFromLayout(layout, name) {
  return layout
    .map(col => col.filter(n => n !== name))
    .filter(col => col.length > 0);
}

// IDs de zonas drop especiales
const DROP_ZONE_NEW_COL = '__NEW_COL__';
function colDropId(colIdx) { return `__COL_DROP_${colIdx}__`; }

// ── Componente columna sortable (drag handle en el nombre del listado) ────────
function SortableListCard({ category, colIndex, rowIndex, layout, isDraggingThis, ...props }) {
  const { attributes, listeners, setNodeRef, transform, transition } = useSortable({
    id: category,
    data: { type: 'listCard', category, colIndex, rowIndex },
  });
  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
    opacity: isDraggingThis ? 0.3 : 1,
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

// ── Zona drop: columna invisible completa (useDroppable) ─────────────────────
function DroppableColumn({ colIdx, isDraggingAny, children, style }) {
  const { setNodeRef, isOver } = useDroppable({ id: colDropId(colIdx) });
  return (
    <div ref={setNodeRef} style={{
      ...style,
      outline: isOver ? '2px dashed #1a73e8' : '2px dashed transparent',
      borderRadius: 14,
      background: isOver ? 'rgba(26,115,232,0.04)' : 'transparent',
      transition: 'all 0.15s',
    }}>
      {children}
    </div>
  );
}

// ── Zona drop: nueva columna al final (solo visible al arrastrar) ─────────────
function NewColumnDropZone() {
  const { setNodeRef, isOver } = useDroppable({ id: DROP_ZONE_NEW_COL });
  return (
    <div ref={setNodeRef} style={{
      minWidth: isOver ? 100 : 40, width: isOver ? 100 : 40,
      alignSelf: 'stretch', minHeight: 80,
      border: `2px dashed ${isOver ? '#1a73e8' : '#c5cae9'}`,
      borderRadius: 12,
      background: isOver ? '#e8f0fe' : 'rgba(200,210,255,0.10)',
      display: 'flex', alignItems: 'center', justifyContent: 'center',
      flexShrink: 0,
      transition: 'all 0.15s',
      opacity: 1,
    }}>
      {isOver && <Plus size={22} color="#1a73e8" />}
    </div>
  );
}

export default function TasksPage() {
  const { profile } = useAuth();
  const [viewingEmail, setViewingEmail] = useState(null);
  const [showHistory, setShowHistory] = useState(false);
  const [showTemplates, setShowTemplates] = useState(false);
  const [showDevGar, setShowDevGar] = useState(false);
  const [subtaskReloadTrigger, setSubtaskReloadTrigger] = useState(0);
  const [exporting, setExporting] = useState(false);

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
  const [categories, setCategories] = useState(null);
  const [showNewCategory, setShowNewCategory] = useState(false);
  const [activeTab, setActiveTab] = useState('tasks');
  const [showGallery, setShowGallery] = useState(false);
  const [galleryUnlockCounter, setGalleryUnlockCounter] = useState(0);

  const isDiego = profile?.email === 'ddm@renovalpropiedades.com';
  const isOwner = profile?.isOwner;
  const [newCatName, setNewCatName] = useState('');
  const [newCatColor, setNewCatColor] = useState('#0891b2');

  // ── Estado de layout: [[cat, cat?], [cat, cat?], ...] ──────────────────────
  const [layout, setLayout] = useState(null); // null = no cargado aún
  const [draggingCategory, setDraggingCategory] = useState(null);
  const [overDropZone, setOverDropZone] = useState(null); // id de zona activa

  const handleExportTareas = async () => {
    setExporting(true);
    await exportTareasAllUsers();
    setExporting(false);
  };

  // ── Cargar categorías ────────────────────────────────────────────────────────
  React.useEffect(() => {
    if (!profile?.email) return;
    const loadCategories = async () => {
      const { data } = await supabase.from('task_categories').select('*').order('position', { ascending: true });
      if (data && data.length > 0) {
        const filtered = data.filter(c => c.is_default || c.user_email === profile.email);
        const migrated = filtered.map(c => {
          if (c.name === 'Entrada') return { ...c, name: 'Llegada arrendatario' };
          if (c.name === 'Salida') return { ...c, name: 'Publicar/Arrendar' };
          return c;
        });
        setCategories(migrated);
      } else {
        setCategories(DEFAULT_CATEGORIES.map((name, i) => ({
          name, color: ['#1565C0','#2E7D32','#6A1B9A','#E65100','#37474F'][i],
          position: i, is_default: i < 4,
        })));
      }
    };
    loadCategories();
  }, [profile?.email]);

  // ── Cargar layout desde localStorage una vez que tenemos categorías ──────────
  React.useEffect(() => {
    if (!categories || !profile?.email) return;
    const catNames = categories.map(c => c.name);
    const storageKey = `tasksLayout_${profile.email}`;

    try {
      const saved = localStorage.getItem(storageKey);
      if (saved) {
        const parsed = JSON.parse(saved);
        // Migrar nombres viejos
        const migrated = parsed.map(col =>
          col.map(n => {
            if (n === 'Entrada') return 'Llegada arrendatario';
            if (n === 'Salida') return 'Publicar/Arrendar';
            return n;
          }).filter(n => catNames.includes(n))
        ).filter(col => col.length > 0);

        // Añadir categorías nuevas que no estén en el layout guardado
        const inLayout = migrated.flat();
        const missing = catNames.filter(n => !inLayout.includes(n));
        // Agregar faltantes al final, de a 2
        const extra = buildDefaultLayout(missing);
        const finalLayout = [...migrated, ...extra];
        setLayout(finalLayout);
        return;
      }
    } catch (e) { /* ignore */ }

    // Sin layout guardado: construir desde cero
    // Migrar columnOrder viejo si existe
    try {
      const oldKey = `tasksColumnOrder_${profile.email}`;
      const oldSaved = localStorage.getItem(oldKey);
      if (oldSaved) {
        const oldOrder = JSON.parse(oldSaved).map(n => {
          if (n === 'Entrada') return 'Llegada arrendatario';
          if (n === 'Salida') return 'Publicar/Arrendar';
          return n;
        }).filter(n => catNames.includes(n));
        const missing = catNames.filter(n => !oldOrder.includes(n));
        const full = [...oldOrder, ...missing];
        const newLayout = buildDefaultLayout(full);
        setLayout(newLayout);
        localStorage.setItem(storageKey, JSON.stringify(newLayout));
        return;
      }
    } catch (e) { /* ignore */ }

    const defaultLayout = buildDefaultLayout(catNames);
    setLayout(defaultLayout);
  }, [categories, profile?.email]);

  const saveLayout = React.useCallback((newLayout) => {
    if (!profile?.email) return;
    setLayout(newLayout);
    localStorage.setItem(`tasksLayout_${profile.email}`, JSON.stringify(newLayout));
  }, [profile?.email]);

  const getCategoryColor = (name) => {
    const cat = categories?.find(c => c.name === name);
    return cat?.color || '#37474F';
  };

  const isProtected = (name) => ['Llegada arrendatario','Publicar/Arrendar','Equipo','Solicitudes','PAGOS'].includes(name);

  // ── Auto-insertar PAGOS para admins ─────────────────────────────────────────
  React.useEffect(() => {
    if (!profile?.email) return;
    const isAdmin = ['ddm@renovalpropiedades.com','fdm@renovalpropiedades.com'].includes(profile.email);
    if (!isAdmin) return;
    const hasPagos = categories?.some(c => c.name === 'PAGOS');
    if (hasPagos) return;
    const insertPagos = async () => {
      const pos = (categories?.length || 6);
      const { data } = await supabase.from('task_categories')
        .insert({ name: 'PAGOS', color: '#C62828', position: pos, is_default: false, user_email: profile.email })
        .select().single();
      if (data) {
        setCategories(prev => [...(prev || []), data]);
        setLayout(prev => {
          if (!prev) return prev;
          const newLayout = [...prev, ['PAGOS']];
          localStorage.setItem(`tasksLayout_${profile.email}`, JSON.stringify(newLayout));
          return newLayout;
        });
      }
    };
    insertPagos();
  }, [profile?.email, categories]);

  const handleAddCategory = async () => {
    if (!newCatName.trim()) return;
    const pos = (categories?.length || 5);
    const { data } = await supabase.from('task_categories')
      .insert({ name: newCatName.trim(), color: newCatColor, position: pos, is_default: false, user_email: profile?.email })
      .select().single();
    if (data) {
      setCategories(prev => [...(prev || []), data]);
      setLayout(prev => {
        const newLayout = prev ? [...prev, [data.name]] : [[data.name]];
        localStorage.setItem(`tasksLayout_${profile?.email}`, JSON.stringify(newLayout));
        return newLayout;
      });
    }
    setNewCatName('');
    setNewCatColor('#0891b2');
    setShowNewCategory(false);
  };

  const handleDeleteCategory = async (name) => {
    if (isProtected(name)) return;
    if (!window.confirm(`¿Eliminar la lista "${name}"? Las tareas en esta lista también se eliminarán.`)) return;
    await supabase.from('tasks').delete().eq('category', name).eq('assigned_to', effectiveEmail);
    await supabase.from('task_categories').delete().eq('name', name).eq('user_email', profile?.email);
    setCategories(prev => prev.filter(c => c.name !== name));
    setLayout(prev => {
      if (!prev) return prev;
      const newLayout = removeFromLayout(prev, name);
      localStorage.setItem(`tasksLayout_${profile?.email}`, JSON.stringify(newLayout));
      return newLayout;
    });
  };

  // ── DnD ─────────────────────────────────────────────────────────────────────
  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 5 } }),
    useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates })
  );

  const handleDragStart = (event) => {
    const id = event.active.id;
    if (layout && flattenLayout(layout).includes(id)) {
      setDraggingCategory(id);
    }
  };

  const handleDragOver = (event) => {
    const overId = event.over?.id;
    setOverDropZone(overId || null);
  };

  const handleDragEnd = (event) => {
    const { active, over } = event;
    setDraggingCategory(null);
    setOverDropZone(null);
    if (!over || !layout) return;

    const draggedCat = active.id;
    if (!flattenLayout(layout).includes(draggedCat)) {
      // Drag de tarea dentro de columna (reorder vertical)
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
      return;
    }

    const overId = String(over.id);
    const src = findInLayout(layout, draggedCat);
    if (!src) return;

    // ── Soltar en zona "nueva columna" ────────────────────────────────────────
    if (overId === DROP_ZONE_NEW_COL) {
      const withoutDrag = removeFromLayout(layout, draggedCat);
      saveLayout([...withoutDrag, [draggedCat]]);
      return;
    }

    // ── Soltar sobre columna invisible (useDroppable) → agregar al final de esa col ──
    const colDropMatch = overId.match(/^__COL_DROP_(\d+)__$/);
    if (colDropMatch) {
      const colIdx = parseInt(colDropMatch[1]);
      // Si es la misma columna y tiene 1 elemento, no hacer nada
      if (src.colIndex === colIdx && layout[colIdx].length === 1) return;
      const newLayout = layout.map(col => col.filter(n => n !== draggedCat)).filter(col => col.length > 0);
      const adjustedIdx = src.colIndex < colIdx ? colIdx - 1 : colIdx;
      if (newLayout[adjustedIdx]) {
        newLayout[adjustedIdx] = [...newLayout[adjustedIdx], draggedCat];
      } else {
        newLayout.push([draggedCat]);
      }
      saveLayout(newLayout);
      return;
    }

    // ── Soltar sobre otro listado → swap de posiciones ────────────────────────
    if (flattenLayout(layout).includes(overId) && overId !== draggedCat) {
      const dst = findInLayout(layout, overId);
      if (!dst) return;
      const newLayout = layout.map(col => [...col]);
      newLayout[src.colIndex][src.rowIndex] = overId;
      newLayout[dst.colIndex][dst.rowIndex] = draggedCat;
      saveLayout(newLayout);
    }
  };

  const handleCompleteTask = async (task) => {
    await completeTask(task);
    if (selectedTask?.id === task.id) setSelectedTask(null);
    await fetchTasks();
    if (isDiego) {
      const activeSet = localStorage.getItem('galleryActiveSet');
      if (activeSet) { await unlockNextGalleryImage(activeSet); setGalleryUnlockCounter(c => c + 1); }
    }
  };

  const handleSubtaskCompleted = async () => {
    if (isDiego) {
      const activeSet = localStorage.getItem('galleryActiveSet');
      if (activeSet) { await unlockNextGalleryImage(activeSet); setGalleryUnlockCounter(c => c + 1); }
    }
  };

  const totalTasks = Object.values(tasksByCategory).flat().length;

  // IDs sortables: solo los listados (las zonas drop usan useDroppable, no useSortable)
  const allSortableIds = layout ? flattenLayout(layout) : [];

  return (
    <div style={styles.container}>
      <div style={styles.header}>
        <div>
          <div style={{ display:'flex', alignItems:'center', gap:16 }}>
            <h1 style={styles.title}>Tareas Pendientes</h1>
            <div style={{ display:'flex' }}>
              <button onClick={() => setActiveTab('tasks')} style={{ padding:'4px 14px', background:'none', border:'none', cursor:'pointer', fontSize:13, fontWeight:500, color: activeTab==='tasks' ? '#1a73e8' : '#5f6368', borderBottom: activeTab==='tasks' ? '2px solid #1a73e8' : '2px solid transparent', fontFamily:'inherit' }}>Tareas</button>
              <button onClick={() => setActiveTab('planning')} style={{ padding:'4px 14px', background:'none', border:'none', cursor:'pointer', fontSize:13, fontWeight:500, color: activeTab==='planning' ? '#1a73e8' : '#5f6368', borderBottom: activeTab==='planning' ? '2px solid #1a73e8' : '2px solid transparent', fontFamily:'inherit' }}>Planificación</button>
            </div>
          </div>
          <div style={styles.subtitleRow}>
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
          <button onClick={() => setShowDevGar(true)} style={{ ...styles.refreshBtn, display:'flex', alignItems:'center', gap:5, padding:'6px 12px', fontSize:12, fontWeight:500, cursor:'pointer', fontFamily:'inherit' }} title="Tareas Dev Gar programadas">
            <Clock size={14} /> Dev Gar
          </button>
          <button onClick={() => setShowHistory(true)} style={styles.refreshBtn} title="Historial">
            <History size={16} color="#5f6368" />
          </button>
          <button onClick={handleExportTareas} disabled={exporting} title="Exportar tareas a Excel"
            style={{ ...styles.refreshBtn, padding:'8px 10px', opacity:exporting?0.6:1, cursor:exporting?'not-allowed':'pointer' }}>
            <Download size={15} color="#34a853" />
          </button>
          <button onClick={() => setShowNewCategory(true)} style={{ ...styles.refreshBtn, display:'flex', alignItems:'center', gap:5, padding:'6px 12px', background:'#e8f0fe', border:'1px solid #1a73e8', color:'#1a73e8', borderRadius:8, fontSize:12, fontWeight:600, cursor:'pointer', fontFamily:'inherit' }} title="Nueva lista">
            <Plus size={14} /> Nueva lista
          </button>
          {isOwner && (
            <button onClick={() => setShowTemplates(true)}
              style={{ ...styles.refreshBtn, display:'flex', alignItems:'center', gap:5, padding:'6px 12px', background:'#fff', border:'1px solid #dadce0', color:'#5f6368', borderRadius:8, fontSize:12, fontWeight:500, cursor:'pointer', fontFamily:'inherit' }}
              title="Configurar tareas automáticas">
              <Settings size={14} /> Automáticas
            </button>
          )}
          {isDiego && (
            <button onClick={() => setShowGallery(g => !g)}
              style={{ ...styles.refreshBtn, width:36, height:36, fontWeight:700, fontSize:16, background: showGallery ? '#202124' : '#fff', color: showGallery ? '#fff' : '#202124', border:'1px solid #dadce0', borderRadius:8, display:'flex', alignItems:'center', justifyContent:'center', cursor:'pointer' }}
              title="Galería">G</button>
          )}
        </div>
      </div>

      {isViewingOther && (
        <div style={styles.viewingBanner}>
          Estás viendo y editando las tareas de <strong>{effectiveInitials}</strong>.
          <button onClick={() => { setViewingEmail(null); setSelectedTask(null); }} style={styles.bannerBtn}>
            Volver a mi vista
          </button>
        </div>
      )}

      {loading || !layout ? (
        <div style={styles.loading}>Cargando tareas...</div>
      ) : (
        <div style={styles.mainArea}>
          <div style={styles.columnsArea}>
            {activeTab === 'planning' && (
              <PlanningPage allTasks={Object.values(tasksByCategory).flat()} userEmail={profile?.email} userName={profile?.name} />
            )}
            {activeTab === 'tasks' && (
              <DndContext
                sensors={sensors}
                collisionDetection={pointerWithin}
                onDragStart={handleDragStart}
                onDragOver={handleDragOver}
                onDragEnd={handleDragEnd}
              >
                <SortableContext items={allSortableIds} strategy={verticalListSortingStrategy}>
                  <div style={styles.columnsWrapper}>
                    <div style={styles.columnsGrid}>
                      {layout.map((col, colIndex) => (
                        <DroppableColumn
                          key={colIndex}
                          colIdx={colIndex}
                          style={styles.invisibleColumn}
                        >
                          {col.map((category, rowIndex) => (
                            <SortableListCard
                              key={category}
                              category={category}
                              colIndex={colIndex}
                              rowIndex={rowIndex}
                              layout={layout}
                              isDraggingThis={draggingCategory === category}
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
                              onSubtaskCompleted={handleSubtaskCompleted}
                            />
                          ))}
                        </DroppableColumn>
                      ))}
                      {/* Zona drop nueva columna */}
                      {draggingCategory && <NewColumnDropZone />}
                    </div>
                  </div>
                </SortableContext>

                <DragOverlay>
                  {draggingCategory && (
                    <div style={{ opacity: 0.85, transform: 'rotate(1.5deg)', pointerEvents: 'none' }}>
                      <TaskColumn
                        category={draggingCategory}
                        tasks={tasksByCategory[draggingCategory] || []}
                        onOpenTask={() => {}}
                        onCompleteTask={() => {}}
                        onCreateTask={() => {}}
                        currentUserEmail={effectiveEmail}
                        dormantTasks={dormantByCategory[draggingCategory] || []}
                      />
                    </div>
                  )}
                </DragOverlay>
              </DndContext>
            )}
          </div>

          {selectedTask && (
            <div style={styles.sidebarArea}>
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
            </div>
          )}
          {isDiego && showGallery && (
            <div style={styles.sidebarArea}>
              <GallerySidebar
                onClose={() => setShowGallery(false)}
                userEmail={profile?.email}
                unlockedSinceOpen={galleryUnlockCounter}
              />
            </div>
          )}
        </div>
      )}

      {showHistory && (
        <HistoryPanel onClose={() => setShowHistory(false)} ownerEmail={effectiveEmail} />
      )}
      {showDevGar && (
        <DevGarPanel onClose={() => setShowDevGar(false)} />
      )}
      {showTemplates && (
        <TaskTemplatesPanel onClose={() => setShowTemplates(false)} />
      )}

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
    </div>
  );
}

const styles = {
  container: { height: '100%', display: 'flex', flexDirection: 'column', overflow: 'hidden' },
  header: { display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 16, flexShrink: 0 },
  title: { fontSize: 24, fontWeight: 700, color: '#202124', margin: '0 0 6px' },
  subtitleRow: { display: 'flex', alignItems: 'center', gap: 8 },
  userSelectorWrapper: { position: 'relative', display: 'inline-flex', alignItems: 'center' },
  userSelector: { appearance: 'none', border: '1px solid #dadce0', borderRadius: 8, padding: '5px 28px 5px 10px', fontSize: 13, fontWeight: 600, color: '#202124', background: '#fff', cursor: 'pointer', outline: 'none', fontFamily: 'inherit' },
  selectorIcon: { position: 'absolute', right: 8, pointerEvents: 'none' },
  userBadge: { fontSize: 13, fontWeight: 600, color: '#1a73e8', background: '#e8f0fe', borderRadius: 8, padding: '4px 10px' },
  taskCountText: { fontSize: 14, color: '#5f6368', display: 'flex', alignItems: 'center', gap: 6 },
  viewingBadge: { background: '#fce8e6', color: '#c5221f', fontSize: 11, fontWeight: 600, padding: '2px 8px', borderRadius: 20 },
  refreshBtn: { background: '#fff', border: '1px solid #dadce0', borderRadius: 8, padding: '8px 10px', cursor: 'pointer', display: 'flex', alignItems: 'center' },
  viewingBanner: { background: '#fff3e0', border: '1px solid #ffe0b2', borderRadius: 8, padding: '10px 16px', fontSize: 13, color: '#e65100', marginBottom: 16, flexShrink: 0, display: 'flex', alignItems: 'center', gap: 12 },
  bannerBtn: { marginLeft: 'auto', padding: '5px 12px', background: '#e65100', color: '#fff', border: 'none', borderRadius: 6, fontSize: 12, cursor: 'pointer', fontFamily: 'inherit' },
  mainArea: { flex: 1, display: 'flex', overflow: 'hidden', gap: 0 },
  columnsArea: { flex: 1, display: 'flex', flexDirection: 'column', overflow: 'hidden' },
  columnsWrapper: { flex: 1, overflow: 'auto' },
  columnsGrid: {
    display: 'flex',
    flexDirection: 'row',
    gap: 16,
    padding: '4px 4px 24px',
    alignItems: 'flex-start',
    minWidth: 'max-content',
    minHeight: '100%',
  },
  invisibleColumn: {
    display: 'flex',
    flexDirection: 'column',
    gap: 16,
    alignItems: 'stretch',
    minWidth: 260,
    width: 260,
    flexShrink: 0,
  },
  sidebarArea: { flexShrink: 0, height: '100%', overflow: 'hidden' },
  loading: { display: 'flex', alignItems: 'center', justifyContent: 'center', height: '100%', color: '#5f6368', fontSize: 14 },
};
