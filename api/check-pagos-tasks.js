import { createClient } from '@supabase/supabase-js';

const supabase = createClient(
  process.env.REACT_APP_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

const INITIALS_TO_EMAIL = {
  'DD': 'ddm@renovalpropiedades.com',
  'FD': 'fdm@renovalpropiedades.com',
};

export default async function handler(req, res) {
  const authHeader = req.headers['authorization'];
  if (authHeader !== `Bearer ${process.env.CRON_SECRET}`) {
    return res.status(401).json({ error: 'Unauthorized' });
  }

  // Fecha exacta de hoy - 90 días
  const target = new Date();
  target.setDate(target.getDate() - 90);
  const targetStr = target.toISOString().split('T')[0];

  // Buscar pagos de DD/FD cuya fecha es exactamente hoy - 90 días
  const { data: pagos, error: pagosError } = await supabase
    .from('pagos')
    .select('id, propiedad, descripcion, cxc, notas, pagado_por, fecha')
    .in('pagado_por', ['DD', 'FD'])
    .eq('fecha', targetStr);

  if (pagosError) {
    console.error('Error consultando pagos:', pagosError);
    return res.status(500).json({ error: pagosError.message });
  }

  if (!pagos || pagos.length === 0) {
    return res.status(200).json({ message: `No hay pagos que cumplan 90 días el ${targetStr}.` });
  }

  const created = [];
  const skipped = [];

  for (const pago of pagos) {
    const ownerEmail = INITIALS_TO_EMAIL[pago.pagado_por];
    if (!ownerEmail) continue;

    // No crear si ya existe tarea PAGOS con este título para este usuario (completada o no)
    const { data: existing } = await supabase
      .from('tasks')
      .select('id')
      .eq('category', 'PAGOS')
      .eq('owner_email', ownerEmail)
      .eq('title', pago.propiedad)
      .maybeSingle();

    if (existing) {
      skipped.push(pago.propiedad);
      continue;
    }

    const noteParts = [];
    if (pago.descripcion) noteParts.push(`Descripción: ${pago.descripcion}`);
    if (pago.cxc != null && pago.cxc !== '') {
      noteParts.push(`CxC: $${Math.round(Number(pago.cxc)).toLocaleString('es-CL')}`);
    }
    if (pago.notas) noteParts.push(`Notas: ${pago.notas}`);

    const { error: insertError } = await supabase.from('tasks').insert({
      owner_email: ownerEmail,
      title: pago.propiedad,
      category: 'PAGOS',
      urgent: true,
      completed: false,
      notas: noteParts.join('\n') || null,
      recurrence: 'none',
      position: -Date.now(),
    });

    if (insertError) {
      console.error(`Error creando tarea para ${pago.propiedad}:`, insertError);
    } else {
      created.push(pago.propiedad);
    }
  }

  return res.status(200).json({
    message: `Revisión completada para ${targetStr}.`,
    created,
    skipped,
  });
}
