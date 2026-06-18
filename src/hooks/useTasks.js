import { useState, useEffect, useCallback } from 'react';
import { supabase } from '../supabaseClient';
import { useAuth } from '../context/AuthContext';
import { USER_INITIALS } from '../supabaseClient';

const CATEGORIES = ['Entrada', 'Salida', 'Equipo', 'Solicitudes', 'Misceláneo'];

const parseLocalDate = (dateStr) => {
  if (!dateStr) return null;
  const [y, m, d] = dateStr.split('-').map(Number);
  return new Date(y, m - 1, d);
};

export const formatLocalDate = (dateStr) => {
  if (!dateStr) return '';
  const d = parseLocalDate(dateStr);
  return d.toLocaleDateString('es-CL', { day: '2-digit', month: '2-digit', year: 'numeric' });
};

const insertMirrorTask = async (mirrorTask) => {
  try {
    const response = await fetch('/api/create-mirror-task', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${process.env.REACT_APP_CRON_SECRET}`,
      },
      body: JSON.stringify({ mirrorTask }),
    });
    const result = await response.json();
    if (!response.ok) console.error('insertMirrorTask error:', result.error);
    return result.data;
  } catch(e) {
    console.error('insertMirrorTask fetch error:', e.message);
    return null;
  }
};

// ── Efectos secundarios al completar subtareas ────────────────
async function handleSubtaskSideEffects(subtaskTitle, parentTask) {
  const title = (subtaskTitle || '').trim();

  // Extraer nombre de propiedad del título de la tarea padre (ej: "Arriendo Av. Providencia 123")
  const propMatch = parentTask?.title?.match(/^(?:Arriendo|Dev Gar)\s+(.+)$/i);
  const propiedad = propMatch ? propMatch[1].trim() : null;

  // Notificar dueño → aviso = Listo en Pizarra
  if (title === 'Notificar dueno' || title === 'Notificar dueño') {
    if (propiedad) {
      await supabase.from('pizarra')
        .update({ aviso: 'Listo' })
        .ilike('propiedad', propiedad);
    }
  }

  // Respaldar publicacion → respaldo = Listo en Pizarra
  if (title === 'Respaldar publicacion' || title === 'Respaldar publicación') {
    if (propiedad) {
      await supabase.from('pizarra')
        .update({ respaldo: 'Listo' })
        .ilike('propiedad', propiedad);
    }
  }

  // Liquidacion → liquidacion = Listo en Arrendadas
  if (title === 'Liquidacion' || title === 'Liquidación') {
    if (propiedad) {
      await supabase.from('arrendadas')
        .update({ liquidacion: 'Listo' })
        .ilike('propiedad', propiedad);
    }
  }

  // Respaldo contrato carpeta → contrato = Listo en Arrendadas
  if (title === 'Respaldo contrato carpeta') {
    if (propiedad) {
      await supabase.from('arrendadas')
        .update({ contrato: 'Listo' })
        .ilike('propiedad', propiedad);
    }
  }

  // Pago cuentas → cuentas = Listo en Arrendadas
  if (title === 'Pago cuentas') {
    if (propiedad) {
      await supabase.from('arrendadas')
        .update({ cuentas: 'Listo' })
        .ilike('propiedad', propiedad);
    }
  }
}

// ── Dev Gar completada → dev_gar = Listo en Arrendadas ───────
async function handleDevGarSideEffect(taskTitle) {
  const match = (taskTitle || '').match(/^Dev Gar\s+(.+)$/i);
  if (!match) return;
  const propiedad = match[1].trim();
  await supabase.from('arrendadas')
    .update({ dev_gar: 'Listo' })
    .ilike('propiedad', propiedad);
}

export function useTasks(targetEmail = null) {
  const { user } = useAuth();
  const [tasks, setTasks] = useState([]);
  const [loading, setLoading] = useState(true);

  const effectiveEmail = targetEmail || user?.email;
  const today = new Date().toISOString().split('T')[0];

  const fetchTasks = useCallback(async () => {
    if (!effectiveEmail) return;
    setLoading(true);

    const [ownActiveRes, ownDormantRes, equipoActiveRes] = await Promise.all([
      supabase.from('tasks').select('*').eq('completed', false).is('parent_id', null)
        .eq('owner_email', effectiveEmail)
        .or(`next_occurrence.is.null,next_occurrence.lte.${today}`)
        .order('position', { ascending: true }).order('created_at', { ascending: false }),
      supabase.from('tasks').select('*').eq('completed', false).is('parent_id', null)
        .eq('owner_email', effectiveEmail).gt('next_occurrence', today)
        .order('next_occurrence', { ascending: true }),
      supabase.from('tasks').select('*').eq('completed', false).is('parent_id', null)
        .eq('category', 'Equipo').eq('delegated_to', effectiveEmail)
        .or(`next_occurrence.is.null,next_occurrence.lte.${today}`)
        .order('position', { ascending: true }),
    ]);

    const { data: equipoDormant } = await supabase.from('tasks').select('*')
      .eq('completed', false).is('parent_id', null)
      .eq('category', 'Equipo').eq('delegated_to', effectiveEmail)
      .gt('next_occurrence', today)
      .order('next_occurrence', { ascending: true });

    const allActive = [...(ownActiveRes.data || []), ...(equipoActiveRes.data || [])];
    const allDormant = [
      ...(ownDormantRes.data || []).map(t => ({ ...t, _dormant: true })),
      ...(equipoDormant || []).map(t => ({ ...t, _dormant: true })),
    ];
    const all = [...allActive, ...allDormant];
    const unique = Array.from(new Map(all.map(t => [t.id, t])).values());
    const today2 = new Date().toISOString().split('T')[0];
    const toUpgrade = unique.filter(t => t.proxima_vencer && !t.urgent && t.due_date && t.due_date <= today2);
    for (const t of toUpgrade) {
      await supabase.from('tasks').update({ urgent: true, proxima_vencer: false }).eq('id', t.id);
      t.urgent = true; t.proxima_vencer = false;
    }
    setTasks(unique);
    setLoading(false);
  }, [effectiveEmail, today]);

  useEffect(() => { fetchTasks(); }, [fetchTasks]);

  const getSubtasks = async (parentId) => {
    const { data } = await supabase.from('tasks').select('*')
      .eq('parent_id', parentId).eq('completed', false)
      .order('position', { ascending: true });
    return data || [];
  };

  const createTask = async (taskData) => {
    const email = effectiveEmail;
    const categoryTasks = tasks.filter(t => t.category === taskData.category && t.owner_email === email);
    const minPosition = categoryTasks.length > 0 ? Math.min(...categoryTasks.map(t => t.position)) - 1 : 0;

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
    if (error) console.error('createTask error:', error);
    if (!error && data) {
      setTasks(prev => [data, ...prev]);
      if (taskData.category === 'Solicitudes' && taskData.assigned_to) {
        await insertMirrorTask({
          owner_email: taskData.assigned_to,
          title: taskData.title,
          category: 'Equipo',
          notes: taskData.notes || null,
          delegated_to: taskData.assigned_to,
          assigned_to: email,
          solicitud_id: data.id,
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

    if (!error && data && parent?.category === 'Solicitudes' && parent?.assigned_to) {
      const { data: equipoParent } = await supabase.from('tasks')
        .select('id').eq('solicitud_id', parentId).eq('category', 'Equipo').maybeSingle();
      if (equipoParent) {
        await insertMirrorTask({
          owner_email: parent.assigned_to,
          title,
          category: 'Equipo',
          parent_id: equipoParent.id,
          position: Date.now(),
          completed: false,
          solicitud_id: data.id,
        });
      }
    }
    if (!error && data && parent?.category === 'Equipo' && parent?.solicitud_id) {
      const { data: solicitudParent } = await supabase.from('tasks')
        .select('id,owner_email').eq('id', parent.solicitud_id).eq('category', 'Solicitudes').maybeSingle();
      if (solicitudParent) {
        await insertMirrorTask({
          owner_email: solicitudParent.owner_email,
          title,
          category: 'Solicitudes',
          parent_id: solicitudParent.id,
          position: Date.now(),
          completed: false,
          solicitud_id: data.id,
        });
      }
    }
    return { data, error };
  };

  const updateTask = async (id, updates) => {
    if (updates.recurrence && updates.recurrence !== 'none' && updates.recurrence_config) {
      updates.next_occurrence = null;
    }
    const { data, error } = await supabase.from('tasks').update(updates).eq('id', id).select().single();
    if (!error && data) {
      setTasks(prev => prev.map(t => t.id === id ? { ...t, ...data } : t));
      const syncFields = {};
      ['notes','recurrence','recurrence_config','next_occurrence','urgent','due_date'].forEach(f => {
        if (f in updates) syncFields[f] = updates[f];
      });
      if (Object.keys(syncFields).length > 0) {
        if (data.category === 'Solicitudes') {
          await supabase.from('tasks').update(syncFields).eq('solicitud_id', id).eq('category', 'Equipo');
        } else if (data.category === 'Equipo' && data.solicitud_id) {
          await supabase.from('tasks').update(syncFields).eq('id', data.solicitud_id).eq('category', 'Solicitudes');
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

    // Efecto secundario: Dev Gar completada
    if (task.title && task.title.startsWith('Dev Gar ')) {
      await handleDevGarSideEffect(task.title);
    }

    if (task.recurrence && task.recurrence !== 'none') {
      const next = getNextOccurrence(task);
      await supabase.from('tasks').update({ next_occurrence: next }).eq('id', task.id);
      setTasks(prev => prev.map(t => t.id === task.id ? { ...t, next_occurrence: next, _dormant: true } : t));
      if (task.category === 'Solicitudes') {
        await supabase.from('tasks').update({ next_occurrence: next })
          .eq('solicitud_id', task.id).eq('category', 'Equipo');
      } else if (task.category === 'Equipo' && task.solicitud_id) {
        await supabase.from('tasks').update({ next_occurrence: next })
          .eq('id', task.solicitud_id).eq('category', 'Solicitudes');
      }
    } else {
      await supabase.from('tasks').delete().eq('id', task.id);
      setTasks(prev => prev.filter(t => t.id !== task.id));

      if (task.category === 'Equipo') {
        const remitente = task.assigned_to;
        const destinatario = task.owner_email;
        let mirror = null;
        if (task.solicitud_id) {
          const { data } = await supabase.from('tasks').select('*')
            .eq('id', task.solicitud_id).eq('category', 'Solicitudes').maybeSingle();
          mirror = data;
        }
        if (!mirror && remitente) {
          const { data } = await supabase.from('tasks').select('*')
            .eq('category', 'Solicitudes').eq('owner_email', remitente)
            .eq('assigned_to', destinatario).eq('title', task.title).maybeSingle();
          mirror = data;
        }
        if (mirror) {
          await supabase.from('tasks_history').insert({
            owner_email: mirror.owner_email, category: mirror.category,
            title: mirror.title, notes: mirror.notes,
          });
          await supabase.from('tasks').delete().eq('id', mirror.id);
        }
      }
      if (task.category === 'Solicitudes') {
        const destinatario = task.assigned_to;
        if (task.id) {
          const { data: equipoRows } = await supabase.from('tasks')
            .select('id').eq('solicitud_id', task.id).eq('category', 'Equipo');
          if (equipoRows?.length > 0) {
            for (const row of equipoRows) await supabase.from('tasks').delete().eq('id', row.id);
          } else if (destinatario) {
            await supabase.from('tasks').delete().eq('category', 'Equipo')
              .eq('owner_email', destinatario).eq('title', task.title);
          }
        }
      }
    }
  };

  // Nueva función: completar subtarea con efectos secundarios
  const completeSubtask = async (subtask, parentTask) => {
    await handleSubtaskSideEffects(subtask.title, parentTask);
    await supabase.from('tasks').delete().eq('id', subtask.id);
  };

  const deleteTask = async (id) => {
    const task = tasks.find(t => t.id === id);
    await supabase.from('tasks').delete().eq('id', id);
    if (task?.category === 'Solicitudes') {
      await supabase.from('tasks').delete().eq('solicitud_id', id).eq('category', 'Equipo');
    }
    setTasks(prev => prev.filter(t => t.id !== id));
  };

  const reorderTasks = async (category, orderedIds) => {
    setTasks(prev => {
      const others = prev.filter(t => !(orderedIds.includes(t.id)));
      const reordered = orderedIds.map((id, index) => ({ ...prev.find(t => t.id === id), position: index }));
      return [...reordered, ...others];
    });
    for (let i = 0; i < orderedIds.length; i++) {
      await supabase.from('tasks').update({ position: i }).eq('id', orderedIds[i]);
    }
  };

  const getNextOccurrence = (task) => {
    const config = task.recurrence_config || {};
    const now = new Date();
    now.setHours(12, 0, 0, 0);
    const clampDay = (year, month, day) => Math.min(day, new Date(year, month + 1, 0).getDate());
    switch (task.recurrence) {
      case 'daily': now.setDate(now.getDate() + 1); break;
      case 'weekly': {
        const weekdays = config.weekdays?.length ? config.weekdays : [1];
        for (let i = 1; i <= 7; i++) {
          const next = new Date(now); next.setDate(now.getDate() + i);
          if (weekdays.includes(next.getDay())) return next.toISOString().split('T')[0];
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

  const getDisplayTitle = (task) => {
    if (task.category === 'Solicitudes' && task.assigned_to) {
      return `[${USER_INITIALS[task.assigned_to] || '?'}] ${task.title}`;
    }
    if (task.category === 'Equipo' && task.assigned_to) {
      return `[${USER_INITIALS[task.assigned_to] || '?'}] ${task.title}`;
    }
    return task.title;
  };

  const allCats = [...new Set([...CATEGORIES, ...tasks.map(t => t.category).filter(Boolean)])];

  const tasksByCategory = allCats.reduce((acc, cat) => {
    if (cat === 'Equipo') {
      acc[cat] = tasks.filter(t =>
        t.category === 'Equipo' &&
        (t.delegated_to === effectiveEmail || t.owner_email === effectiveEmail) &&
        !t._dormant
      );
    } else {
      acc[cat] = tasks.filter(t => t.category === cat && t.owner_email === effectiveEmail && !t._dormant);
    }
    return acc;
  }, {});

  const dormantByCategory = allCats.reduce((acc, cat) => {
    if (cat === 'Equipo') {
      acc[cat] = tasks.filter(t =>
        t.category === 'Equipo' &&
        (t.delegated_to === effectiveEmail || t.owner_email === effectiveEmail) &&
        t._dormant
      );
    } else {
      acc[cat] = tasks.filter(t => t.category === cat && t.owner_email === effectiveEmail && t._dormant);
    }
    return acc;
  }, {});

  return {
    tasks, tasksByCategory, dormantByCategory, loading,
    fetchTasks, createTask, createSubtask, completeSubtask,
    updateTask, completeTask, deleteTask,
    reorderTasks, getSubtasks, getDisplayTitle, CATEGORIES,
  };
}
