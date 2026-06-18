import { createClient } from '@supabase/supabase-js';
const supabase = createClient(
  process.env.REACT_APP_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);
const INITIALS_TO_EMAIL = {
  DD: 'ddm@renovalpropiedades.com',
  FD: 'fdm@renovalpropiedades.com',
};

export default async function handler(req, res) {
  const authHeader = req.headers['authorization'];
  if (authHeader !== `Bearer ${process.env.CRON_SECRET}`) {
    return res.status(401).json({ error: 'Unauthorized' });
  }

  const target = new Date();
  target.setDate(target.getDate() - 90);
  const targetStr = target.toISOString().split('T')[0];

  // Cargar templates activos de pagos_90_dias
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
    .eq('fecha', targetStr);

  if (pagosError) return res.status(500).json({ error: pagosError.message });
  if (!pagos || pagos.length === 0) {
    return res.status(200).json({ message: `No hay pagos que cumplan 90 días el ${targetStr}.` });
  }

  const created = [];
  const skipped = [];

  for (const pago of pagos) {
    const ownerEmail = INITIALS_TO_EMAIL[pago.pagado_por];
    if (!ownerEmail) continue;

    // Buscar template para este rol
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
      notas: noteParts.join('\n') || null,
      recurrence: 'none',
      position: -Date.now(),
    }).select().single();

    if (insertError) {
      console.error(`Error creando tarea para ${pago.propiedad}:`, insertError);
      continue;
    }

    // Insertar subtareas si las hay
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
    message: `Revisión completada para ${targetStr}.`,
    created,
    skipped,
  });
}
