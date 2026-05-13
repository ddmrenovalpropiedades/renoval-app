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
      updates.next_occurrence = null;
    }
    const { data, error } = await supabase
      .from('tasks').update(updates).eq('id', id).select().single();
    if (!error) {
      setTasks(prev => prev.map(t => t.id === id ? { ...t, ...data } : t));

      // Sincronizar notas y recurrencia con la tarea espejo (Solicitudes ↔ Equipo)
      const syncFields = {};
      if ('notes' in updates) syncFields.notes = updates.notes;
      if ('recurrence' in updates) syncFields.recurrence = updates.recurrence;
      if ('recurrence_config' in updates) syncFields.recurrence_config = updates.recurrence_config;
      if ('next_occurrence' in updates) syncFields.next_occurrence = updates.next_occurrence;
      if ('urgent' in updates) syncFields.urgent = updates.urgent;
      if ('due_date' in updates) syncFields.due_date = updates.due_date;

      if (Object.keys(syncFields).length > 0 && data) {
        if (data.category === 'Solicitudes') {
          // Sincronizar hacia la tarea de Equipo del destinatario
          await supabase.from('tasks')
            .update(syncFields)
            .eq('solicitud_id', id)
            .eq('category', 'Equipo');
        } else if (data.category === 'Equipo' && data.solicitud_id) {
          // Sincronizar hacia la Solicitud original
          await supabase.from('tasks')
            .update(syncFields)
            .eq('id', data.solicitud_id)
            .eq('category', 'Solicitudes');
        }
      }
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
        // Estructura BD: Equipo.owner_email=destinatario, Equipo.assigned_to=remitente
        // Solicitud espejo: owner_email=remitente, assigned_to=destinatario
        const remitente = task.assigned_to;  // quien delegó
        const destinatario = task.owner_email; // quien recibe

        let mirror = null;
        // Primero intentar por solicitud_id
        if (task.solicitud_id) {
          const { data } = await supabase.from('tasks')
            .select('*').eq('id', task.solicitud_id).eq('category', 'Solicitudes').maybeSingle();
          mirror = data;
        }
        // Fallback: buscar por remitente + título + destinatario
        if (!mirror && remitente) {
          const { data } = await supabase.from('tasks')
            .select('*')
            .eq('category', 'Solicitudes')
            .eq('owner_email', remitente)
            .eq('assigned_to', destinatario)
            .eq('title', task.title)
            .maybeSingle();
          mirror = data;
        }
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
        // Solicitud.owner_email=remitente, Solicitud.assigned_to=destinatario
        const destinatario = task.assigned_to;

        // Buscar tarea Equipo por solicitud_id primero
        if (task.id) {
          const { data: equipoRows } = await supabase.from('tasks')
            .select('id').eq('solicitud_id', task.id).eq('category', 'Equipo');
          if (equipoRows && equipoRows.length > 0) {
            for (const row of equipoRows) {
              await supabase.from('tasks').delete().eq('id', row.id);
            }
          } else if (destinatario) {
            // Fallback: por destinatario + título
            await supabase.from('tasks').delete()
              .eq('category', 'Equipo')
              .eq('owner_email', destinatario)
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
