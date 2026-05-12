import { useState, useEffect, useCallback } from 'react';
import { supabase } from '../supabaseClient';
import { useAuth } from '../context/AuthContext';

const CATEGORIES = ['Entrada', 'Salida', 'Equipo', 'Solicitudes', 'Misceláneo'];

export function useTasks(targetEmail = null) {
  const { user } = useAuth();
  const [tasks, setTasks] = useState([]);
  const [loading, setLoading] = useState(true);

  // Email efectivo: si se pasa targetEmail (vista de propietario), usar ese
  const effectiveEmail = targetEmail || user?.email;

  const fetchTasks = useCallback(async () => {
    if (!effectiveEmail) return;
    setLoading(true);

    const { data, error } = await supabase
      .from('tasks')
      .select('*')
      .eq('completed', false)
      .is('parent_id', null)
      .or(`owner_email.eq.${effectiveEmail},assigned_to.eq.${effectiveEmail}`)
      .lte('next_occurrence', new Date().toISOString().split('T')[0])
      .order('position', { ascending: true })
      .order('created_at', { ascending: false });

    // También traer tareas sin next_occurrence (no recurrentes)
    const { data: noDate } = await supabase
      .from('tasks')
      .select('*')
      .eq('completed', false)
      .is('parent_id', null)
      .is('next_occurrence', null)
      .or(`owner_email.eq.${effectiveEmail},assigned_to.eq.${effectiveEmail}`)
      .order('position', { ascending: true })
      .order('created_at', { ascending: false });

    if (!error) {
      const all = [...(data || []), ...(noDate || [])];
      // Deduplicar por id
      const unique = Array.from(new Map(all.map(t => [t.id, t])).values());
      setTasks(unique);
    }
    setLoading(false);
  }, [effectiveEmail]);

  useEffect(() => { fetchTasks(); }, [fetchTasks]);

  const getSubtasks = async (parentId) => {
    const { data } = await supabase
      .from('tasks')
      .select('*')
      .eq('parent_id', parentId)
      .eq('completed', false)
      .order('position', { ascending: true });
    return data || [];
  };

  const createTask = async (taskData) => {
    const email = effectiveEmail;
    const categoryTasks = tasks.filter(t =>
      t.category === taskData.category &&
      (t.owner_email === email || t.assigned_to === email)
    );
    const minPosition = categoryTasks.length > 0
      ? Math.min(...categoryTasks.map(t => t.position)) - 1 : 0;

    const newTask = {
      owner_email: email,
      title: taskData.title,
      category: taskData.category,
      notes: taskData.notes || null,
      assigned_to: taskData.assigned_to || null,
      recurrence: taskData.recurrence || 'none',
      recurrence_config: taskData.recurrence_config || null,
      next_occurrence: null,
      position: minPosition,
      completed: false,
    };

    const { data, error } = await supabase.from('tasks').insert(newTask).select().single();
    if (!error) {
      setTasks(prev => [data, ...prev]);
      if (taskData.category === 'Solicitudes' && taskData.assigned_to) {
        await supabase.from('tasks').insert({
          owner_email: taskData.assigned_to,
          title: taskData.title,
          category: 'Equipo',
          notes: taskData.notes || null,
          assigned_to: email,
          position: -Date.now(),
          completed: false,
        });
      }
    }
    return { data, error };
  };

  const createSubtask = async (parentId, title) => {
    const parent = tasks.find(t => t.id === parentId);
    const { data, error } = await supabase.from('tasks').insert({
      owner_email: effectiveEmail,
      title,
      category: parent?.category || 'Entrada',
      parent_id: parentId,
      position: Date.now(),
      completed: false,
    }).select().single();
    return { data, error };
  };

  const updateTask = async (id, updates) => {
    const { data, error } = await supabase
      .from('tasks').update(updates).eq('id', id).select().single();
    if (!error) {
      setTasks(prev => prev.map(t => t.id === id ? { ...t, ...data } : t));
    }
    return { data, error };
  };

  const completeTask = async (task) => {
    // Guardar en historial
    await supabase.from('tasks_history').insert({
      owner_email: task.owner_email,
      category: task.category,
      title: task.title,
      notes: task.notes,
      assigned_to: task.assigned_to,
    });

    if (task.recurrence && task.recurrence !== 'none') {
      // Calcular próxima ocurrencia y ocultar hasta entonces
      const next = getNextOccurrence(task);
      await supabase.from('tasks').update({
        next_occurrence: next,
      }).eq('id', task.id);
      // Quitar de la vista local hasta la próxima fecha
      setTasks(prev => prev.filter(t => t.id !== task.id));
    } else {
      await supabase.from('tasks').delete().eq('id', task.id);
      setTasks(prev => prev.filter(t => t.id !== task.id));

      // Sincronizar espejo Equipo ↔ Solicitudes
      if (task.category === 'Equipo' && task.assigned_to) {
        const { data: mirror } = await supabase
          .from('tasks').select('*')
          .eq('owner_email', task.assigned_to)
          .eq('category', 'Solicitudes')
          .eq('title', task.title)
          .maybeSingle();
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
          .from('tasks').select('*')
          .eq('owner_email', task.assigned_to)
          .eq('category', 'Equipo')
          .eq('title', task.title)
          .maybeSingle();
        if (mirror) {
          await supabase.from('tasks').delete().eq('id', mirror.id);
        }
      }
    }
  };

  const deleteTask = async (id) => {
    await supabase.from('tasks').delete().eq('id', id);
    setTasks(prev => prev.filter(t => t.id !== id));
  };

  const reorderTasks = async (category, orderedIds) => {
    setTasks(prev => {
      const others = prev.filter(t => t.category !== category);
      const reordered = orderedIds.map((id, index) => {
        const task = prev.find(t => t.id === id);
        return { ...task, position: index };
      });
      return [...reordered, ...others];
    });
    for (let i = 0; i < orderedIds.length; i++) {
      await supabase.from('tasks').update({ position: i }).eq('id', orderedIds[i]);
    }
  };

  const getNextOccurrence = (task) => {
    const config = task.recurrence_config || {};
    const now = new Date();

    switch (task.recurrence) {
      case 'daily':
        now.setDate(now.getDate() + 1);
        break;
      case 'weekly': {
        const weekdays = config.weekdays || [1];
        // Encontrar el próximo día de la semana configurado
        let daysAhead = 1;
        for (let i = 1; i <= 7; i++) {
          const next = new Date(now);
          next.setDate(now.getDate() + i);
          if (weekdays.includes(next.getDay())) { daysAhead = i; break; }
        }
        now.setDate(now.getDate() + daysAhead);
        break;
      }
      case 'monthly': {
        const day = config.day || now.getDate();
        now.setMonth(now.getMonth() + 1);
        now.setDate(day);
        break;
      }
      case 'yearly': {
        const day = config.day || now.getDate();
        const month = config.month ? config.month - 1 : now.getMonth();
        now.setFullYear(now.getFullYear() + 1);
        now.setMonth(month);
        now.setDate(day);
        break;
      }
      default: break;
    }
    return now.toISOString().split('T')[0];
  };

  const tasksByCategory = CATEGORIES.reduce((acc, cat) => {
    acc[cat] = tasks.filter(t =>
      t.category === cat &&
      (t.owner_email === effectiveEmail || t.assigned_to === effectiveEmail)
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
