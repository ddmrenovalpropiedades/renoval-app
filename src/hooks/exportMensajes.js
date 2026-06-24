// src/hooks/exportMensajes.js
// Descarga un Excel con conversaciones y mensajes de las últimas 2 semanas.
import * as XLSX from 'xlsx';
import { supabase } from '../supabaseClient';

const ESTADO_LABEL = {
  bot_activo:       'Bot activo',
  esperando_agente: 'Esperando agente',
  con_agente:       'Con agente',
  cerrada:          'Cerrada',
};

export async function exportMensajes() {
  const hace2semanas = new Date();
  hace2semanas.setDate(hace2semanas.getDate() - 14);
  const desde = hace2semanas.toISOString();

  // ── 1. Conversaciones con actividad en las últimas 2 semanas ──────────────
  let convs = [];
  let from = 0;
  while (true) {
    const { data } = await supabase
      .from('wa_conversaciones')
      .select('*')
      .gte('updated_at', desde)
      .order('updated_at', { ascending: false })
      .range(from, from + 999);
    if (!data || data.length === 0) break;
    convs = [...convs, ...data];
    if (data.length < 1000) break;
    from += 1000;
  }

  // ── 2. Mensajes de esas conversaciones ────────────────────────────────────
  const convIds = convs.map(c => c.id);
  let mensajes = [];
  if (convIds.length > 0) {
    from = 0;
    while (true) {
      const { data } = await supabase
        .from('wa_mensajes')
        .select('*')
        .in('conversacion_id', convIds)
        .gte('created_at', desde)
        .order('conversacion_id', { ascending: true })
        .order('created_at',      { ascending: true })
        .range(from, from + 999);
      if (!data || data.length === 0) break;
      mensajes = [...mensajes, ...data];
      if (data.length < 1000) break;
      from += 1000;
    }
  }

  const convMap = {};
  convs.forEach(c => { convMap[c.id] = c; });

  // ── 3. Armar filas ────────────────────────────────────────────────────────
  const convRows = convs.map(c => ({
    'ID':           c.id,
    'Contacto':     c.contact_name || '',
    'Teléfono':     c.phone_number  || '',
    'Propiedad ID': c.propiedad_id  || '',
    'Agente ID':    c.agent_id      || '',
    'Estado':       ESTADO_LABEL[c.estado] || c.estado || '',
    'Creada':       c.created_at    || '',
    'Actualizada':  c.updated_at    || '',
  }));

  const convColumns = ['ID','Contacto','Teléfono','Propiedad ID','Agente ID','Estado','Creada','Actualizada'];

  const msgRows = mensajes.map(m => {
    const conv = convMap[m.conversacion_id] || {};
    return {
      'Conv ID':    m.conversacion_id,
      'Contacto':   conv.contact_name || '',
      'Teléfono':   conv.phone_number  || '',
      'Estado Conv': ESTADO_LABEL[conv.estado] || conv.estado || '',
      'Dirección':  m.direction === 'inbound' ? 'Entrante' : 'Saliente',
      'Mensaje':    m.message_text || '',
      'Tipo':       m.message_type  || '',
      'Acción Bot': m.bot_action    || '',
      'Fecha/Hora': m.created_at    || '',
    };
  });

  const msgColumns = ['Conv ID','Contacto','Teléfono','Estado Conv','Dirección','Mensaje','Tipo','Acción Bot','Fecha/Hora'];

  // ── 4. Generar Excel ──────────────────────────────────────────────────────
  const wb = XLSX.utils.book_new();

  const wsConvs = XLSX.utils.json_to_sheet(
    convRows.length > 0 ? convRows : [Object.fromEntries(convColumns.map(c => [c, '']))],
    { header: convColumns }
  );
  wsConvs['!cols'] = convColumns.map(col => ({
    wch: Math.max(col.length, ...convRows.map(r => String(r[col] ?? '').length)) + 2,
  }));
  XLSX.utils.book_append_sheet(wb, wsConvs, 'Conversaciones');

  const wsMsgs = XLSX.utils.json_to_sheet(
    msgRows.length > 0 ? msgRows : [Object.fromEntries(msgColumns.map(c => [c, '']))],
    { header: msgColumns }
  );
  wsMsgs['!cols'] = msgColumns.map(col => ({
    wch: Math.max(col.length, ...msgRows.map(r => String(r[col] ?? '').length)) + 2,
  }));
  XLSX.utils.book_append_sheet(wb, wsMsgs, 'Mensajes');

  const now = new Date();
  const fecha = `${now.getFullYear()}-${String(now.getMonth()+1).padStart(2,'0')}-${String(now.getDate()).padStart(2,'0')}`;
  XLSX.writeFile(wb, `Mensajes_${fecha}.xlsx`);
}
