import { createClient } from '@supabase/supabase-js';

const supabase = createClient(
  process.env.REACT_APP_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

const INITIALS_TO_EMAIL = {
  DD: 'ddm@renovalpropiedades.com',
  FD: 'fdm@renovalpropiedades.com',
};

// ── Endpoint temporal de un solo uso ─────────────────────────────
// Backfill de tareas PAGOS para pagos con antigüedad entre 60 y 90 días
// (2 a 3 meses) que no generaron su tarea automática por el bug de la
// columna 'notas' vs 'notes' en check-pagos-tasks.js. Reutiliza la misma
// lógica de templates/dedupe/subtareas que ese cron, pero sobre un rango
// de fechas en vez de un solo día exacto.
//
// Borrar este archivo (o dejarlo sin llamar) una vez usado — no está
// pensado para correr en cron.
export default async function handler(req, res) {
  const authHeader = req.headers['authorization'];
  if (authHeader !== `Bearer ${process.env.CRON_SECRET}`) {
    return res.status(401).json({ error: 'Unauthorized' });
  }

  const hoy = new Date();
  const low = new Date(hoy); low.setDate(low.getDate() - 90);
  const high = new Date(hoy); high.setDate(high.getDate() - 60);
  const lowStr = low.toISOString().split('T')[0];
  const highStr = high.toISOString().split('T')[0];

  const { data: templates } = await supabase
    .from('task_templates')
    .select('*')
    .eq('trigger', 'pagos_90_dias')
    .eq('active', true);

  if (!templates || templates.length === 0) {
    return res.status(200).json({ message: 'No hay templates activos para pagos_90_dias.' });
  }

  const { data: pagos, error: pagosError } = await supabase
    .from('pagos')
    .select('id, propiedad, descripcion, cxc, notas, pagado_por, fecha')
    .in('pagado_por', ['DD', 'FD'])
    .in('estado', ['P', 'PG'])
    .gte('fecha', lowStr)
    .lte('fecha', highStr);

  if (pagosError) return res.status(500).json({ error: pagosError.message });

  const created = [];
  const skipped = [];
  const failed = [];

  for (const pago of (pagos || [])) {
    const ownerEmail = INITIALS_TO_EMAIL[pago.pagado_por];
    if (!ownerEmail) continue;

    const roleKey = pago.pagado_por.toLowerCase();
    const tpl = templates.find(t => t.assignee_role === roleKey);
    if (!tpl) continue;

    const taskTitle = tpl.task_title.replace('{{propiedad}}', pago.propiedad);

    const { data: existing } = await supabase
      .from('tasks')
      .select('id')
      .eq('category', 'PAGOS')
      .eq('owner_email', ownerEmail)
      .eq('title', taskTitle)
      .maybeSingle();

    if (existing) { skipped.push(pago.propiedad); continue; }

    const noteParts = [];
    if (pago.descripcion) noteParts.push(`Descripción: ${pago.descripcion}`);
    if (pago.cxc != null && pago.cxc !== '') {
      noteParts.push(`CxC: $${Math.round(Number(pago.cxc)).toLocaleString('es-CL')}`);
    }
    if (pago.notas) noteParts.push(`Notas: ${pago.notas}`);

    const { data: parentTask, error: insertError } = await supabase.from('tasks').insert({
      owner_email: ownerEmail,
      title: taskTitle,
      category: 'PAGOS',
      urgent: true,
      completed: false,
      notes: noteParts.join('\n') || null,
      recurrence: 'none',
      position: -Date.now(),
    }).select().single();

    if (insertError) {
      console.error(`Error creando tarea para ${pago.propiedad}:`, insertError);
      failed.push({ propiedad: pago.propiedad, error: insertError.message });
      continue;
    }

    const subtasks = tpl.subtasks || [];
    for (let i = 0; i < subtasks.length; i++) {
      await supabase.from('tasks').insert({
        owner_email: ownerEmail,
        title: subtasks[i],
        category: 'PAGOS',
        parent_id: parentTask.id,
        completed: false,
        position: i,
      });
    }

    created.push(pago.propiedad);
  }

  return res.status(200).json({
    message: `Backfill completado para pagos entre ${lowStr} y ${highStr}.`,
    created,
    skipped,
    failed,
  });
}
