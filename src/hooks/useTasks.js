import { useState, useEffect, useCallback } from 'react';
import { supabase } from '../supabaseClient';
import { useAuth } from '../context/AuthContext';

const CATEGORIES = ['Entrada', 'Salida', 'Equipo', 'Solicitudes', 'Misceláneo'];

export function useTasks() {
  const { user } = useAuth();
  const [tasks, setTasks] = useState([]);
  const [loading, setLoading] = useState(true);

  const fetchTasks = useCallback(async () => {
    if (!user?.email) return;
    setLoading(true);
    const { data, error } = await supabase
      .from('tasks')
      .select('*')
      .eq('completed', false)
      .is('parent_id', null)
      .order('position', { ascending: true })
      .order('created_at', { ascending: false });

    if (!error) setTasks(data || []);
    setLoading(false);
  }, [user]);

  useEffect(() => { fetchTasks(); }, [fetchTasks]);

  // Obtener subtareas de una tarea
  const getSubtasks = async (parentId) => {
    const { data } = await supabase
      .from('tasks')
      .select('*')
      .eq('parent_id', parentId)
      .eq('completed', false)
      .order('position', { ascending: true });
    return data || [];
  };

  // Crear tarea
  const createTask = async (taskData) => {
    const email = user.email;
    const categoryTasks = tasks.filter(t =>
      t.category === taskData.category &&
      (t.owner_email === email || t.assigned_to === email)
    );
    const minPosition = categoryTasks.length > 0
      ? Math.min(...categoryTasks.map(t => t.position)) - 1
      : 0;

    const newTask = {
      owner_email: email,
      title: taskData.title,
      category: taskData.category,
      notes: taskData.notes || null,
      assigned_to: taskData.assigned_to || null,
      recurrence: taskData.recurrence || 'none',
      recurrence_config: taskData.recurrence_config || null,
      position: minPosition,
      completed: false,
    };

    const { data, error } = await supabase.from('tasks').insert(newTask).select().single();
    if (!error) {
      setTasks(prev => [data, ...prev.filter(t =>
        !(t.category === data.category && t.owner_email !== email && t.assigned_to !== email)
      ), ...prev.filter(t =>
        t.category === data.category && t.owner_email !== email && t.assigned_to !== email
      )]);
      // Si es Solicitudes, crear copia en Equipo del destinatario
      if (taskData.category === 'Solicitudes' && taskData.assigned_to) {
        await supabase.from('tasks').insert({
          owner_email: taskData.assigned_to,
          title: taskData.title,
          category: 'Equipo',
          notes: taskData.notes || null,
          assigned_to: email, // quien delegó
          position: -Date.now(),
          completed: false,
        });
      }
    }
    return { data, error };
  };

  // Crear subtarea
  const createSubtask = async (parentId, title) => {
    const { data, error } = await supabase.from('tasks').insert({
      owner_email: user.email,
      title,
      category: tasks.find(t => t.id === parentId)?.category || 'Entrada',
      parent_id: parentId,
      position: Date.now(),
      completed: false,
    }).select().single();
    return { data, error };
  };

  // Actualizar tarea
  const updateTask = async (id, updates) => {
    const { data, error } = await supabase
      .from('tasks').update(updates).eq('id', id).select().single();
    if (!error) {
      setTasks(prev => prev.map(t => t.id === id ? { ...t, ...data } : t));
    }
    return { data, error };
  };

  // Completar tarea
  const completeTask = async (task) => {
    // Guardar en historial
    await supabase.from('tasks_history').insert({
      owner_email: task.owner_email,
      category: task.category,
      title: task.title,
      notes: task.notes,
      assigned_to: task.assigned_to,
    });

    // Si es recurrente, calcular próxima ocurrencia
    if (task.recurrence && task.recurrence !== 'none') {
      const next = getNextOccurrence(task);
      await supabase.from('tasks').update({
        completed: false,
        position: -Date.now(),
        next_occurrence: next,
      }).eq('id', task.id);
      setTasks(prev => prev.map(t => t.id === task.id
        ? { ...t, completed: false, next_occurrence: next }
        : t
      ));
    } else {
      // Eliminar tarea y sus subtareas (CASCADE)
      await supabase.from('tasks').delete().eq('id', task.id);
      setTasks(prev => prev.filter(t => t.id !== task.id));

      // Si es tarea de Equipo o Solicitudes, completar el espejo
      if (task.category === 'Equipo' && task.assigned_to) {
        const { data: mirror } = await supabase
          .from('tasks')
          .select('*')
          .eq('owner_email', task.assigned_to)
          .eq('category', 'Solicitudes')
          .eq('title', task.title)
          .single();
        if (mirror) {
          await supabase.from('tasks_history').insert({
            owner_email: mirror.owner_email,
            category: mirror.category,
            title: mirror.title,
            notes: mirror.notes,
            assigned_to: mirror.assigned_to,
          });
          await supabase.from('tasks').delete().eq('id', mirror.id);
        }
      }
      if (task.category === 'Solicitudes' && task.assigned_to) {
        const { data: mirror } = await supabase
          .from('tasks')
          .select('*')
          .eq('owner_email', task.assigned_to)
          .eq('category', 'Equipo')
          .eq('title', task.title)
          .single();
        if (mirror) {
          await supabase.from('tasks').delete().eq('id', mirror.id);
        }
      }
    }
  };

  // Eliminar tarea
  const deleteTask = async (id) => {
    await supabase.from('tasks').delete().eq('id', id);
    setTasks(prev => prev.filter(t => t.id !== id));
  };

  // Reordenar tareas (drag & drop)
  const reorderTasks = async (category, orderedIds) => {
    setTasks(prev => {
      const others = prev.filter(t => t.category !== category ||
        (t.owner_email !== user.email && t.assigned_to !== user.email));
      const reordered = orderedIds.map((id, index) => {
        const task = prev.find(t => t.id === id);
        return { ...task, position: index };
      });
      return [...reordered, ...others];
    });
    // Actualizar posiciones en BD
    for (let i = 0; i < orderedIds.length; i++) {
      await supabase.from('tasks').update({ position: i }).eq('id', orderedIds[i]);
    }
  };

  // Calcular próxima ocurrencia
  const getNextOccurrence = (task) => {
    const now = new Date();
    switch (task.recurrence) {
      case 'daily':   now.setDate(now.getDate() + 1); break;
      case 'weekly':  now.setDate(now.getDate() + 7); break;
      case 'monthly': now.setMonth(now.getMonth() + 1); break;
      case 'yearly':  now.setFullYear(now.getFullYear() + 1); break;
      default: break;
    }
    return now.toISOString().split('T')[0];
  };

  // Agrupar tareas por categoría para el usuario actual
  const tasksByCategory = CATEGORIES.reduce((acc, cat) => {
    acc[cat] = tasks.filter(t =>
      t.category === cat &&
      (t.owner_email === user?.email || t.assigned_to === user?.email)
    );
    return acc;
  }, {});

  return {
    tasks, tasksByCategory, loading,
    fetchTasks, createTask, createSubtask,
    updateTask, completeTask, deleteTask,
    reorderTasks, getSubtasks,
    CATEGORIES,
  };
}
