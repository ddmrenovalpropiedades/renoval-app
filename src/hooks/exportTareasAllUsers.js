// src/hooks/exportTareasAllUsers.js
// Función standalone para exportar todas las tareas de todos los usuarios,
// una pestaña por usuario, en un solo archivo Excel.
import * as XLSX from 'xlsx';
import { supabase } from '../supabaseClient';
import { USER_INITIALS } from '../supabaseClient';

const TASK_COLUMNS = [
  { key: 'category',        label: 'Lista' },
  { key: 'title',           label: 'Tarea' },
  { key: 'parent_title',    label: 'Tarea padre' },
  { key: 'completed',       label: 'Completada' },
  { key: 'next_occurrence', label: 'Fecha vencimiento' },
  { key: 'notes',           label: 'Notas' },
];

export async function exportTareasAllUsers() {
  // Fetch todas las tareas activas (no completadas) de todos los usuarios
  let all = [];
  let from = 0;
  while (true) {
    const { data, error } = await supabase
      .from('tasks')
      .select('*')
      .eq('completed', false)
      .is('parent_id', null)          // solo tareas padre
      .order('owner_email', { ascending: true })
      .order('category', { ascending: true })
      .order('position', { ascending: true })
      .range(from, from + 999);
    if (error || !data || data.length === 0) break;
    all = [...all, ...data];
    if (data.length < 1000) break;
    from += 1000;
  }

  // Fetch subtareas (parent_id != null)
  let subtasks = [];
  from = 0;
  while (true) {
    const { data } = await supabase
      .from('tasks')
      .select('*')
      .eq('completed', false)
      .not('parent_id', 'is', null)
      .order('parent_id', { ascending: true })
      .order('position', { ascending: true })
      .range(from, from + 999);
    if (!data || data.length === 0) break;
    subtasks = [...subtasks, ...data];
    if (data.length < 1000) break;
    from += 1000;
  }

  // Mapa id → título para referencias de padre
  const titleById = {};
  all.forEach(t => { titleById[t.id] = t.title; });

  // Agrupar por email
  const byEmail = {};
  [...all, ...subtasks].forEach(task => {
    const email = task.owner_email || task.assigned_to || '';
    if (!byEmail[email]) byEmail[email] = [];
    byEmail[email].push(task);
  });

  const wb = XLSX.utils.book_new();

  // Una pestaña por usuario
  for (const [email, tasks] of Object.entries(byEmail)) {
    const initials = USER_INITIALS[email] || email.split('@')[0];
    const sheetName = initials.substring(0, 31); // Excel limita a 31 chars

    const rows = tasks.map(t => ({
      'Lista':             t.category || '',
      'Tarea':             t.title || '',
      'Tarea padre':       t.parent_id ? (titleById[t.parent_id] || '') : '',
      'Completada':        t.completed ? 'Sí' : 'No',
      'Fecha vencimiento': t.next_occurrence || t.due_date || '',
      'Notas':             t.notes || '',
    }));

    const ws = XLSX.utils.json_to_sheet(rows, {
      header: TASK_COLUMNS.map(c => c.label),
    });

    // Ancho automático
    ws['!cols'] = TASK_COLUMNS.map(c => ({
      wch: Math.max(c.label.length, ...rows.map(r => String(r[c.label] ?? '').length)) + 2,
    }));

    XLSX.utils.book_append_sheet(wb, ws, sheetName);
  }

  if (Object.keys(byEmail).length === 0) {
    // Hoja vacía si no hay datos
    XLSX.utils.book_append_sheet(wb, XLSX.utils.aoa_to_sheet([['Sin tareas']]), 'Sin datos');
  }

  const now = new Date();
  const fecha = `${now.getFullYear()}-${String(now.getMonth()+1).padStart(2,'0')}-${String(now.getDate()).padStart(2,'0')}`;
  XLSX.writeFile(wb, `Tareas_${fecha}.xlsx`);
}
