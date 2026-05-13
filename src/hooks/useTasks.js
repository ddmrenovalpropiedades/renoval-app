import { useState, useEffect, useCallback } from 'react';
import { supabase } from '../supabaseClient';
import { useAuth } from '../context/AuthContext';

const CATEGORIES = ['Entrada', 'Salida', 'Equipo', 'Solicitudes', 'Misceláneo'];

export function useTasks(targetEmail = null) {
  const { user } = useAuth();
  const [tasks, setTasks] = useState([]);
  const [loading, setLoading] = useState(true);

  const effectiveEmail = targetEmail || user?.email;
  const today = new Date().toISOString().split('T')[0];

  const fetchTasks = useCallback(async () => {
    if (!effectiveEmail) return;
    setLoading(true);

    // Tareas propias activas (visibles hoy o sin fecha)
    const { data: ownActive } = await supabase
      .from('tasks')
      .select('*')
      .eq('completed', false)
      .is('parent_id', null)
      .eq('owner_email', effectiveEmail)
      .or(`next_occurrence.is.null,next_occurrence.lte.${today}`)
      .order('position', { ascending: true })
      .order('created_at', { ascending: false });

    // Tareas recurrentes propias dormidas (next_occurrence > hoy)
    const { data: ownDormant } = await supabase
      .from('tasks')
      .select('*')
      .eq('completed', false)
      .is('parent_id', null)
      .eq('owner_email', effectiveEmail)
      .gt('next_occurrence', today)
      .order('next_occurrence', { ascending: true });

    // Tareas de Equipo: donde effectiveEmail es el DESTINATARIO (delegated_to)
    // En la BD: owner_email = quien delegó, delegated_to = quien recibe
    const { data: equipoActive } = await supabase
      .from('tasks')
      .select('*')
      .eq('completed', false)
      .is('parent_id', null)
      .eq('category', 'Equipo')
      .eq('delegated_to', effectiveEmail)
      .or(`next_occurrence.is.null,next_occurrence.lte.${today}`)
      .order('position', { ascending: true });

    const allActive = [...(ownActive || []), ...(equipoActive || [])];
    const allDormant = (ownDormant || []).map(t => ({ ...t, _dormant: true }));
    const unique = Array.from(new Map([...allActive, ...allDormant].map(t => [t.id, t])).values());
    setTasks(unique);
    setLoading(false);
  }, [effectiveEmail, today]);

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
      t.category === taskData.category && t.owner_email === email
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
      // Crear tarea espejo en Equipo del destinatario
      if (taskData.category === 'Solicitudes' && taskData.assigned_to) {
        await supabase.from('tasks').insert({
          owner_email: taskData.assigned_to,  // aparece en lista del destinatario
          title: taskData.title,
          category: 'Equipo',
          notes: taskData.notes || null,
          delegated_to: taskData.assigned_to, // quien debe hacer la tarea
          assigned_to: email,                  // quien delegó (para referencia)
          solicitud_id: data.id,               // referencia a la solicitud original
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
    // Si se cambia recurrencia, recalcular next_occurrence
    if (updates.recurrence && updates.recurrence !== 'none' && updates.recurrence_config) {
      updates.next_occurrence = null; // se mostrará de inmediato con nueva config
    }
    const { data, error } = await supabase
      .from('tasks').update(updates).eq('id', id).select().single();
    if (!error) {
      setTasks(prev => prev.map(t => t.id === id ? { ...t, ...data } : t));
    }
    return { data, error };
  };

  const completeTask = async (task) => {
    await supabase.from('tasks_history').insert({
      owner_email: task.owner_email,
      category: task.category,
      title: task.title,
      notes: task.notes,
      assigned_to: task.assigned_to,
    });

    if (task.recurrence && task.recurrence !== 'none') {
      const next = getNextOccurrence(task);
      await supabase.from('tasks').update({ next_occurrence: next }).eq('id', task.id);
      setTasks(prev => prev.map(t => t.id === task.id
        ? { ...t, next_occurrence: next, _dormant: true }
        : t
      ));
    } else {
      await supabase.from('tasks').delete().eq('id', task.id);
      setTasks(prev => prev.filter(t => t.id !== task.id));

      // Sincronizar espejo Solicitudes ↔ Equipo
      if (task.category === 'Equipo') {
        // Buscar solicitud original por solicitud_id o por título+delegante
        let mirrorQuery = supabase.from('tasks').select('*').eq('category', 'Solicitudes');
        if (task.solicitud_id) {
          mirrorQuery = mirrorQuery.eq('id', task.solicitud_id);
        } else {
          mirrorQuery = mirrorQuery.eq('title', task.title).eq('assigned_to', task.assigned_to);
        }
        const { data: mirror } = await mirrorQuery.maybeSingle();
        if (mirror) {
          await supabase.from('tasks_history').insert({
            owner_email: mirror.owner_email,
            category: mirror.category,
            title: mirror.title,
            notes: mirror.notes,
          });
          await supabase.from('tasks').delete().eq('id', mirror.id);
        }
      }
      if (task.category === 'Solicitudes') {
        // Borrar tarea de Equipo del destinatario
        let equipoQuery = supabase.from('tasks').select('id').eq('category', 'Equipo');
        if (task.id) {
          equipoQuery = equipoQuery.eq('solicitud_id', task.id);
        }
        const { data: equipoRows } = await equipoQuery;
        if (equipoRows && equipoRows.length > 0) {
          for (const row of equipoRows) {
            await supabase.from('tasks').delete().eq('id', row.id);
          }
        } else {
          // Fallback: buscar por título y owner del destinatario
          if (task.assigned_to) {
            await supabase.from('tasks')
              .delete()
              .eq('category', 'Equipo')
              .eq('owner_email', task.assigned_to)
              .eq('title', task.title);
          }
        }
      }
    }
  };

  const deleteTask = async (id) => {
    const task = tasks.find(t => t.id === id);
    await supabase.from('tasks').delete().eq('id', id);
    // Borrar espejo si es solicitud
    if (task?.category === 'Solicitudes') {
      await supabase.from('tasks').delete().eq('solicitud_id', id).eq('category', 'Equipo');
    }
    setTasks(prev => prev.filter(t => t.id !== id));
  };

  const reorderTasks = async (category, orderedIds) => {
    setTasks(prev => {
      const others = prev.filter(t => t.category !== category || t.owner_email !== effectiveEmail);
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

    const clampDay = (year, month, day) => {
      const maxDay = new Date(year, month + 1, 0).getDate();
      return Math.min(day, maxDay);
    };

    switch (task.recurrence) {
      case 'daily':
        now.setDate(now.getDate() + 1);
        break;
      case 'weekly': {
        const weekdays = config.weekdays?.length ? config.weekdays : [1];
        for (let i = 1; i <= 7; i++) {
          const next = new Date(now);
          next.setDate(now.getDate() + i);
          if (weekdays.includes(next.getDay())) { return next.toISOString().split('T')[0]; }
        }
        now.setDate(now.getDate() + 7);
        break;
      }
      case 'monthly': {
        const day = config.day || now.getDate();
        now.setMonth(now.getMonth() + 1);
        now.setDate(clampDay(now.getFullYear(), now.getMonth(), day));
        break;
      }
      case 'yearly': {
        const day = config.day || now.getDate();
        const month = config.month ? config.month - 1 : now.getMonth();
        now.setFullYear(now.getFullYear() + 1);
        now.setMonth(month);
        now.setDate(clampDay(now.getFullYear(), month, day));
        break;
      }
      default: break;
    }
    return now.toISOString().split('T')[0];
  };

  const tasksByCategory = CATEGORIES.reduce((acc, cat) => {
    if (cat === 'Equipo') {
      // Equipo: tareas donde el usuario es el destinatario
      acc[cat] = tasks.filter(t =>
        t.category === 'Equipo' &&
        (t.delegated_to === effectiveEmail || t.owner_email === effectiveEmail) &&
        !t._dormant
      );
    } else {
      acc[cat] = tasks.filter(t =>
        t.category === cat &&
        t.owner_email === effectiveEmail &&
        !t._dormant
      );
    }
    return acc;
  }, {});

  const dormantByCategory = CATEGORIES.reduce((acc, cat) => {
    acc[cat] = tasks.filter(t =>
      t.category === cat &&
      t.owner_email === effectiveEmail &&
      t._dormant
    );
    return acc;
  }, {});

  return {
    tasks, tasksByCategory, dormantByCategory, loading,
    fetchTasks, createTask, createSubtask,
    updateTask, completeTask, deleteTask,
    reorderTasks, getSubtasks, CATEGORIES,
  };
}
