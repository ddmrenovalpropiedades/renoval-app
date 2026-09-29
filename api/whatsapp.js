// api/whatsapp.js
const { createClient } = require('@supabase/supabase-js');
const webpush = require('web-push');
const crypto = require('crypto');

const supabase = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

const PHONE_NUMBER_ID = process.env.WHATSAPP_PHONE_NUMBER_ID;
const ACCESS_TOKEN    = process.env.WHATSAPP_ACCESS_TOKEN;
const VERIFY_TOKEN    = process.env.WHATSAPP_VERIFY_TOKEN;

webpush.setVapidDetails(
  process.env.VAPID_EMAIL,
  process.env.VAPID_PUBLIC_KEY,
  process.env.VAPID_PRIVATE_KEY
);

// ─── Enviar push inmediata (badge=1) ──────────────────────────────────────────
async function sendPushImmediate(subs, payload) {
  const payloadStr = JSON.stringify({ ...payload, badge: 1 });
  await Promise.allSettled(
    subs.map(sub =>
      webpush.sendNotification(
        { endpoint: sub.endpoint, keys: { p256dh: sub.p256dh, auth: sub.auth } },
        payloadStr
      ).catch(async (err) => {
        if (err.statusCode === 404 || err.statusCode === 410) {
          await supabase.from('wa_push_subscriptions').delete().eq('endpoint', sub.endpoint);
        }
      })
    )
  );
}

// ─── URL base del deployment (para links propios, ej. redirectores cortos) ─────
function getBaseUrl() {
  return process.env.VERCEL_URL
    ? `https://${process.env.VERCEL_URL}`
    : 'https://renoval-app.vercel.app';
}

// ─── Disparar cálculo de badge real en background ─────────────────────────────
function triggerBadgeUpdate(agentEmail, agentId, payload, sendToAll) {
  const baseUrl = getBaseUrl();

  fetch(`${baseUrl}/api/send-push-badge`, {
    method:  'POST',
    headers: { 'Content-Type': 'application/json' },
    body:    JSON.stringify({ agentEmail, agentId, payload, sendToAll }),
  }).catch(err => console.error('triggerBadgeUpdate error:', err));
  // Sin await — fire and forget
}

// ─── Extraer URL de un texto ──────────────────────────────────────────────────
function extractUrl(text) {
  if (!text) return null;
  const match = text.match(/https?:\/\/[^\s]+/i);
  return match ? match[0] : null;
}

// ─── Dejar solo dígitos de un número de teléfono ──────────────────────────────
function soloDigitos(str) {
  return (str || '').replace(/\D/g, '');
}

// ─── Generar un código corto (sin caracteres ambiguos) para links propios ─────
const ALFABETO_CODIGO_CORTO = 'ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnopqrstuvwxyz23456789';
function generarCodigoCorto(longitud = 7) {
  const bytes = crypto.randomBytes(longitud);
  let codigo = '';
  for (let i = 0; i < longitud; i++) {
    codigo += ALFABETO_CODIGO_CORTO[bytes[i] % ALFABETO_CODIGO_CORTO.length];
  }
  return codigo;
}

// ─── Feriados de Chile (API pública Boostr, con cache en memoria 24h) ─────────
let feriadosCache   = null; // Set de fechas 'YYYY-MM-DD'
let feriadosCacheTs = 0;

async function obtenerFeriadosChile() {
  const unDiaMs = 24 * 60 * 60 * 1000;
  if (feriadosCache && (Date.now() - feriadosCacheTs) < unDiaMs) {
    return feriadosCache;
  }
  try {
    const controller = new AbortController();
    const timeoutId  = setTimeout(() => controller.abort(), 3000);
    const res = await fetch('https://api.boostr.cl/holidays.json', { signal: controller.signal });
    clearTimeout(timeoutId);
    const json = await res.json();
    const fechas = new Set((json.data || []).map(f => f.date));
    feriadosCache   = fechas;
    feriadosCacheTs = Date.now();
    return fechas;
  } catch (err) {
    console.error('Error obteniendo feriados de Chile:', err.message);
    // Si falla, se usa el cache anterior si existe; si no hay, no se bloquea el bot
    // por esto — simplemente no se detectan feriados hasta que la API vuelva a responder.
    return feriadosCache || new Set();
  }
}

// ─── ¿Estamos en horario laboral? (lunes a viernes, 08:00–17:59 hora de Chile,
//     excluyendo feriados) ─────────────────────────────────────────────────────
async function esHorarioLaboral() {
  const ahora = new Date();

  const horaChile = new Intl.DateTimeFormat('en-US', {
    timeZone: 'America/Santiago',
    hour:     'numeric',
    hour12:   false,
  }).format(ahora);
  let hora = parseInt(horaChile, 10);
  if (hora === 24) hora = 0; // algunos entornos devuelven "24" para medianoche

  const diaChile = new Intl.DateTimeFormat('en-US', {
    timeZone: 'America/Santiago',
    weekday:  'short',
  }).format(ahora);
  const esFinDeSemana = diaChile === 'Sat' || diaChile === 'Sun';

  const fechaChile = new Intl.DateTimeFormat('en-CA', {
    timeZone: 'America/Santiago',
    year: 'numeric', month: '2-digit', day: '2-digit',
  }).format(ahora); // en-CA da directamente 'YYYY-MM-DD'

  const feriados  = await obtenerFeriadosChile();
  const esFeriado = feriados.has(fechaChile);

  return !esFinDeSemana && !esFeriado && hora >= 8 && hora < 18;
}

// ─── Buscar propiedad por URL (revisa Pizarra Arriendo y Pizarra Venta) ────────
async function findPropiedadByUrl(url) {
  if (!url) return null;
  const urlNorm = url.split('?')[0].replace(/\/$/, '').toLowerCase();

  const buscarEnTabla = async (tabla) => {
    const { data: propiedades } = await supabase
      .from(tabla)
      .select('id, propiedad, e1, e2, url_publicacion, conv_asignar_a')
      .not('url_publicacion', 'is', null);
    if (!propiedades || propiedades.length === 0) return null;
    return propiedades.find(p => {
      if (!p.url_publicacion) return false;
      const pNorm = p.url_publicacion.split('?')[0].replace(/\/$/, '').toLowerCase();
      return pNorm === urlNorm;
    }) || null;
  };

  // Se busca primero en Pizarra Arriendo y, si no hay match, en Pizarra Venta —
  // ambas tablas asignan ejecutivo (e1/e2) y link de publicación de la misma forma.
  let match = await buscarEnTabla('pizarra');
  let tabla = 'pizarra';
  if (!match) {
    match = await buscarEnTabla('pizarra_ventas');
    tabla = 'pizarra_ventas';
  }
  if (!match) return null;

  const asignarA  = match.conv_asignar_a || 'e2';
  const iniciales = asignarA === 'e1' ? match.e1 : match.e2;
  let agentId = null;
  if (iniciales) {
    const { data: agente } = await supabase.from('app_users').select('id').eq('iniciales', iniciales).single();
    agentId = agente?.id || null;
  }
  return { propiedadId: match.id, propiedad: match.propiedad, iniciales, agentId, tabla };
}

// ─── Enviar mensaje de texto ───────────────────────────────────────────────────
async function sendTextMessage(to, text) {
  const res = await fetch(
    `https://graph.facebook.com/v19.0/${PHONE_NUMBER_ID}/messages`,
    {
      method: 'POST',
      headers: { Authorization: `Bearer ${ACCESS_TOKEN}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({ messaging_product: 'whatsapp', to, type: 'text', text: { body: text } }),
    }
  );
  const data = await res.json();
  console.log('META sendTextMessage RESPONSE:', JSON.stringify(data));
  return data?.messages?.[0]?.id ?? null;
}

// ─── Enviar menú interactivo principal ─────────────────────────────────────────
async function sendMenuMessage(to) {
  const res = await fetch(
    `https://graph.facebook.com/v19.0/${PHONE_NUMBER_ID}/messages`,
    {
      method: 'POST',
      headers: { Authorization: `Bearer ${ACCESS_TOKEN}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({
        messaging_product: 'whatsapp',
        to,
        type: 'interactive',
        interactive: {
          type: 'button',
          body: { text: '👋 Hola, soy el asistente de *Renoval Propiedades*.\n\n¿En qué te puedo ayudar?' },
          action: {
            buttons: [
              { type: 'reply', reply: { id: 'AGENDAR_VISITA',   title: 'Agendar visita'   } },
              { type: 'reply', reply: { id: 'REQUISITOS',       title: 'Requisitos'       } },
              { type: 'reply', reply: { id: 'HABLAR_EJECUTIVO', title: 'Hablar ejecutivo' } },
            ],
          },
        },
      }),
    }
  );
  const data = await res.json();
  console.log('META sendMenuMessage RESPONSE:', JSON.stringify(data));
  return data?.messages?.[0]?.id ?? null;
}

// ─── Enviar submenú tras Requisitos (2 opciones restantes) ────────────────────
async function sendSubmenuRequisitos(to) {
  const res = await fetch(
    `https://graph.facebook.com/v19.0/${PHONE_NUMBER_ID}/messages`,
    {
      method: 'POST',
      headers: { Authorization: `Bearer ${ACCESS_TOKEN}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({
        messaging_product: 'whatsapp',
        to,
        type: 'interactive',
        interactive: {
          type: 'button',
          body: { text: '¿Cómo te gustaría proceder?' },
          action: {
            buttons: [
              { type: 'reply', reply: { id: 'AGENDAR_VISITA',   title: 'Agendar visita'   } },
              { type: 'reply', reply: { id: 'HABLAR_EJECUTIVO', title: 'Hablar ejecutivo' } },
            ],
          },
        },
      }),
    }
  );
  const data = await res.json();
  console.log('META sendSubmenuRequisitos RESPONSE:', JSON.stringify(data));
  return data?.messages?.[0]?.id ?? null;
}

// ─── Enviar plantilla aprobada "notificacion_lead_derivado" (mensaje de negocio,
//     funciona fuera de la ventana de 24h) ─────────────────────────────────────
async function sendTemplateNotificacionLead(to, { propiedad, contacto, resumen, link }) {
  // Las plantillas de WhatsApp no admiten saltos de línea ni espacios múltiples en
  // los parámetros — se colapsan a un solo espacio para evitar que Meta la rechace.
  const limpiar = (str) => (str || '').replace(/\s+/g, ' ').trim();
  const res = await fetch(
    `https://graph.facebook.com/v19.0/${PHONE_NUMBER_ID}/messages`,
    {
      method: 'POST',
      headers: { Authorization: `Bearer ${ACCESS_TOKEN}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({
        messaging_product: 'whatsapp',
        to,
        type: 'template',
        template: {
          name: 'notificacion_lead_derivado',
          language: { code: 'es' },
          components: [
            {
              type: 'body',
              parameters: [
                { type: 'text', text: limpiar(propiedad) },
                { type: 'text', text: limpiar(contacto) },
                { type: 'text', text: limpiar(resumen) },
                { type: 'text', text: limpiar(link) },
              ],
            },
          ],
        },
      }),
    }
  );
  const data = await res.json();
  console.log('META sendTemplateNotificacionLead RESPONSE:', JSON.stringify(data));
  return data?.messages?.[0]?.id ?? null;
}

// ─── Obtener o crear conversación ─────────────────────────────────────────────
async function getOrCreateConversacion(phoneNumber, contactName, propiedadMatch) {
  const { data: existing } = await supabase
    .from('wa_conversaciones')
    .select('*')
    .eq('phone_number', phoneNumber)
    .in('estado', ['bot_activo', 'esperando_agente', 'con_agente'])
    .order('created_at', { ascending: false })
    .limit(1)
    .single();
  if (existing) return existing;
  const { data: nueva, error } = await supabase
    .from('wa_conversaciones')
    .insert({
      phone_number:    phoneNumber,
      contact_name:    contactName || null,
      estado:          'bot_activo',
      propiedad_id:    propiedadMatch?.propiedadId || null,
      agent_id:        propiedadMatch?.agentId     || null,
      propiedad_tabla: propiedadMatch?.tabla       || null,
    })
    .select().single();
  if (error) throw new Error(`Error creando conversación: ${error.message}`);
  return nueva;
}

// ─── Guardar mensaje ──────────────────────────────────────────────────────────
async function saveMessage({ conversacionId, wamid, direction, messageType, messageText, botAction }) {
  if (wamid) {
    const { data: exists } = await supabase.from('wa_mensajes').select('id').eq('wamid', wamid).single();
    if (exists) return exists;
  }
  const { data, error } = await supabase
    .from('wa_mensajes')
    .insert({ conversacion_id: conversacionId, wamid: wamid || null, direction, message_type: messageType, message_text: messageText, bot_action: botAction || null })
    .select().single();
  if (error) throw new Error(`Error guardando mensaje: ${error.message}`);
  return data;
}

// ─── Actualizar estado ────────────────────────────────────────────────────────
async function updateEstadoConversacion(conversacionId, estado) {
  await supabase.from('wa_conversaciones').update({ estado }).eq('id', conversacionId);
}

// ─── Obtener el bot_action del último mensaje saliente de una conversación ────
async function obtenerUltimoBotAction(conversacionId) {
  const { data } = await supabase
    .from('wa_mensajes')
    .select('bot_action')
    .eq('conversacion_id', conversacionId)
    .eq('direction', 'outbound')
    .order('created_at', { ascending: false })
    .limit(1)
    .maybeSingle();
  return data?.bot_action || null;
}

// ─── Generar resumen de la conversación con Claude ─────────────────────────────
async function generarResumenConversacion(conversacionId) {
  try {
    const { data: mensajes } = await supabase
      .from('wa_mensajes')
      .select('direction, message_text, created_at')
      .eq('conversacion_id', conversacionId)
      .order('created_at', { ascending: true });

    const transcripcion = (mensajes || [])
      .filter(m => m.message_text)
      .map(m => `${m.direction === 'inbound' ? 'Interesado' : 'Bot'}: ${m.message_text}`)
      .join('\n');

    if (!transcripcion) return 'Sin conversación previa registrada.';

    const controller = new AbortController();
    const timeoutId  = setTimeout(() => controller.abort(), 8000);
    const res = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: {
        'Content-Type':      'application/json',
        'x-api-key':          process.env.ANTHROPIC_API_KEY,
        'anthropic-version': '2023-06-01',
      },
      body: JSON.stringify({
        model:      'claude-sonnet-4-5-20250929',
        max_tokens: 300,
        messages: [{
          role: 'user',
          content: 'Resume en máximo 3 líneas, en español y en tono directo, la siguiente conversación de ' +
            'WhatsApp entre un interesado en una propiedad y el bot de atención de Renoval Propiedades. ' +
            'El resumen debe indicar qué opciones del menú fue seleccionando el interesado (por ejemplo: ' +
            'Agendar visita, Requisitos, Hablar con ejecutivo), cualquier pregunta específica que haya hecho, ' +
            'y cualquier horario de visita que haya propuesto. NO menciones el nombre del interesado (ya ' +
            'aparece por separado en la notificación). NO menciones detalles de la propiedad ni del ' +
            'departamento (dormitorios, estacionamiento, bodega, portal, dirección, etc.), ya que el ejecutivo ' +
            'ya conoce la propiedad y esa información ya aparece en otra parte del mensaje. No agregues ' +
            'encabezados ni texto introductorio, solo el resumen.\n\n' + transcripcion,
        }],
      }),
      signal: controller.signal,
    });
    clearTimeout(timeoutId);
    const json    = await res.json();
    const resumen = json?.content?.[0]?.text?.trim();
    return resumen || 'No se pudo generar el resumen automático.';
  } catch (err) {
    console.error('Error generando resumen con Claude:', err.message);
    return 'No se pudo generar el resumen automático (revisar conversación completa en el módulo de Mensajes).';
  }
}

// ─── Obtener el primer nombre del ejecutivo asignado a una conversación ───────
async function obtenerNombreEjecutivo(agentId) {
  if (!agentId) return null;
  const { data: agente } = await supabase.from('app_users').select('full_name').eq('id', agentId).single();
  return (agente?.full_name || '').split(' ')[0] || null;
}

// ─── Notificar al ejecutivo asignado, con resumen y link para iniciar chat ─────
async function notificarEjecutivo({ conversacionId, conversacion, from }) {
  try {
    if (!conversacion.agent_id) {
      console.log('Sin ejecutivo asignado, no se envía notificación de derivación. conversacionId:', conversacionId);
      return;
    }

    const { data: agente } = await supabase
      .from('app_users')
      .select('email, full_name')
      .eq('id', conversacion.agent_id)
      .single();
    if (!agente?.email) return;

    const { data: worker } = await supabase
      .from('workers')
      .select('telefono_personal')
      .eq('user_email', agente.email)
      .maybeSingle();
    const telefonoEjecutivo = soloDigitos(worker?.telefono_personal);
    if (!telefonoEjecutivo) {
      console.log('Ejecutivo sin teléfono personal registrado, no se envía notificación. email:', agente.email);
      return;
    }

    let nombrePropiedad = null;
    if (conversacion.propiedad_id) {
      const tablaPropiedad = conversacion.propiedad_tabla === 'pizarra_ventas' ? 'pizarra_ventas' : 'pizarra';
      const { data: prop } = await supabase.from(tablaPropiedad).select('propiedad').eq('id', conversacion.propiedad_id).single();
      nombrePropiedad = prop?.propiedad || null;
    }

    const resumen = await generarResumenConversacion(conversacionId);

    const nombreEjecutivo  = (agente.full_name || '').split(' ')[0] || 'Equipo Renoval';
    const nombreInteresado = conversacion.contact_name || null;
    const saludoInicial    = nombreInteresado
      ? `Hola ${nombreInteresado}! Soy ${nombreEjecutivo} de Renoval Propiedades, te contacto por tu interés en la propiedad que consultaste.`
      : `Hola! Soy ${nombreEjecutivo} de Renoval Propiedades, te contacto por tu interés en la propiedad que consultaste.`;

    // Link corto propio (en vez del wa.me largo): además de acortar el texto de la
    // plantilla, permite registrar cuándo el ejecutivo lo abre (wa_links.clicked_at),
    // que es la señal que se usa para medir tiempo de respuesta en Métricas.
    const codigoLink = generarCodigoCorto();
    const { error: linkError } = await supabase.from('wa_links').insert({
      id:               codigoLink,
      conversacion_id:  conversacionId,
      agent_id:         conversacion.agent_id,
      telefono_destino: from,
      mensaje:          saludoInicial,
    });
    if (linkError) console.error('Error creando wa_links:', linkError.message);
    const linkWa = `${getBaseUrl()}/l/${codigoLink}`;

    await sendTemplateNotificacionLead(telefonoEjecutivo, {
      propiedad: nombrePropiedad || 'No identificada',
      contacto:  nombreInteresado ? `${nombreInteresado} (${from})` : from,
      resumen,
      link:      linkWa,
    });
  } catch (err) {
    console.error('Error notificando a ejecutivo:', err.message);
    // Fail-open: un error aquí no debe afectar la respuesta al interesado.
  }
}

// ─── Derivar a ejecutivo: mensaje final al interesado + notificación interna ───
async function derivarAEjecutivo({ conversacionId, from, conversacion, dentroHorario, textoDentro, textoFuera, botActionDentro, botActionFuera }) {
  const outText  = dentroHorario ? textoDentro : textoFuera;
  const outWamid = await sendTextMessage(from, outText);
  await saveMessage({ conversacionId, wamid: outWamid, direction: 'outbound', messageType: 'text', messageText: outText, botAction: dentroHorario ? botActionDentro : botActionFuera });
  await updateEstadoConversacion(conversacionId, 'esperando_agente');
  await notificarEjecutivo({ conversacionId, conversacion, from });
}

// ─── Handler principal ────────────────────────────────────────────────────────
module.exports = async function handler(req, res) {

  if (req.method === 'GET') {
    const mode      = req.query['hub.mode'];
    const token     = req.query['hub.verify_token'];
    const challenge = req.query['hub.challenge'];
    if (mode === 'subscribe' && token === VERIFY_TOKEN) return res.status(200).send(challenge);
    return res.status(403).end();
  }

  if (req.method === 'POST') {
    try {
      const body = req.body;
      if (body.object !== 'whatsapp_business_account') return res.status(404).end();

      const entry    = body.entry?.[0];
      const changes  = entry?.changes?.[0];
      const value    = changes?.value;
      // Los webhooks de "statuses" (sent/delivered/read/failed) llegan aparte de los de
      // mensajes entrantes. Se loguean para poder diagnosticar fallos de entrega (ej.
      // mensajes de texto libre rechazados por estar fuera de la ventana de 24h), que de
      // otra forma son invisibles porque Meta igual devuelve un wamid al enviarlos.
      const statuses = value?.statuses;
      if (statuses && statuses.length > 0) {
        statuses.forEach(s => {
          console.log('META STATUS UPDATE:', JSON.stringify({
            id: s.id, status: s.status, recipient_id: s.recipient_id, errors: s.errors || null,
          }));
        });
      }

      const messages = value?.messages;
      if (!messages || messages.length === 0) return res.status(200).end();

      const message     = messages[0];
      const from        = message.from;
      const wamid       = message.id;
      const contactName = value?.contacts?.[0]?.profile?.name || null;

      let inboundText    = null;
      let inboundType    = message.type;
      let selectedOption = null;

      if (message.type === 'text') {
        inboundText = message.text?.body || '';
      } else if (message.type === 'interactive') {
        const reply    = message.interactive?.button_reply;
        selectedOption = reply?.id;
        inboundText    = reply?.title || '';
      }

      console.log('INBOUND from:', from, 'type:', inboundType, 'text:', inboundText);

      let propiedadMatch = null;
      if (message.type === 'text' && inboundText) {
        const url = extractUrl(inboundText);
        if (url) {
          propiedadMatch = await findPropiedadByUrl(url);
          if (propiedadMatch) console.log('URL match:', propiedadMatch.propiedad, '→', propiedadMatch.iniciales);
        }
      }

      const conversacion = await getOrCreateConversacion(from, contactName, propiedadMatch);
      const convId       = conversacion.id;

      if (propiedadMatch && !conversacion.propiedad_id) {
        await supabase.from('wa_conversaciones')
          .update({
            propiedad_id:    propiedadMatch.propiedadId,
            agent_id:        propiedadMatch.agentId || conversacion.agent_id,
            propiedad_tabla: propiedadMatch.tabla,
          })
          .eq('id', convId);
        // Se mantiene en memoria para el resto de este request (ej. notificarEjecutivo).
        conversacion.propiedad_tabla = propiedadMatch.tabla;
      }

      await saveMessage({ conversacionId: convId, wamid, direction: 'inbound', messageType: inboundType, messageText: inboundText });

      // ── Push: inmediata con badge=1, luego badge real en background ───────
      const pushPayload = {
        title: contactName ? `Mensaje de ${contactName}` : 'Nuevo mensaje WhatsApp',
        body:  inboundText || 'Nuevo mensaje recibido',
        url:   '/',
      };

      if (conversacion.agent_id) {
        const { data: agente } = await supabase.from('app_users').select('id, email').eq('id', conversacion.agent_id).single();
        if (agente?.email) {
          const { data: subs } = await supabase.from('wa_push_subscriptions').select('endpoint, p256dh, auth').eq('user_id', agente.email);
          if (subs?.length) await sendPushImmediate(subs, pushPayload);
          triggerBadgeUpdate(agente.email, agente.id, pushPayload, false);
        }
      } else {
        const { data: subs } = await supabase.from('wa_push_subscriptions').select('endpoint, p256dh, auth');
        if (subs?.length) await sendPushImmediate(subs, pushPayload);
        triggerBadgeUpdate(null, null, pushPayload, true);
      }

      // ── Lógica del bot ────────────────────────────────────────────────────
      const estado        = conversacion.estado;
      const dentroHorario = await esHorarioLaboral();

      if (estado === 'con_agente') return res.status(200).end();

      if (estado === 'esperando_agente') {
        const outText  = 'Un ejecutivo te responderá a la brevedad. 🙏';
        const outWamid = await sendTextMessage(from, outText);
        await saveMessage({ conversacionId: convId, wamid: outWamid, direction: 'outbound', messageType: 'text', messageText: outText, botAction: 'recordatorio_espera' });
        return res.status(200).end();
      }

      // Mensajes de derivación final reutilizados en más de un punto del flujo
      const MSG_HABLAR_EJECUTIVO_DENTRO = '👤 Perfecto, en breve uno de nuestros ejecutivos se comunicará contigo. ¡Gracias por contactarnos!';
      const MSG_HABLAR_EJECUTIVO_FUERA  = '👤 Perfecto, uno de nuestros ejecutivos se comunicará contigo en horario laboral para responder a tus consultas. ¡Gracias por contactarnos!';

      const lastBotAction = await obtenerUltimoBotAction(convId);

      // 1) Primer contacto: aún no se envió ningún menú → enviar menú principal
      if (!lastBotAction) {
        const outWamid = await sendMenuMessage(from);
        await saveMessage({ conversacionId: convId, wamid: outWamid, direction: 'outbound', messageType: 'interactive', messageText: 'Menú principal enviado', botAction: 'menu_principal' });
        return res.status(200).end();
      }

      // 2) Se preguntó por horarios de visita → cualquier respuesta deriva
      if (lastBotAction === 'agendar_visita_horarios_pregunta') {
        const nombreEjecutivo    = (await obtenerNombreEjecutivo(conversacion.agent_id)) || 'Un ejecutivo';
        const textoAgendarDentro = `📅  ${nombreEjecutivo} se pondrá en contacto contigo en breve para coordinar la visita. ¡Gracias por tu interés!`;
        const textoAgendarFuera  = `📅  ${nombreEjecutivo} se pondrá en contacto contigo en horario laboral para coordinar la visita. ¡Gracias por tu interés!`;
        await derivarAEjecutivo({
          conversacionId: convId, from, conversacion, dentroHorario,
          textoDentro: textoAgendarDentro, textoFuera: textoAgendarFuera,
          botActionDentro: 'agendar_visita_placeholder', botActionFuera: 'agendar_visita_fuera_horario',
        });
        return res.status(200).end();
      }

      // 3) Se está esperando selección de un menú (principal o submenú tras Requisitos)
      const esperandoMenu = lastBotAction === 'menu_principal' || lastBotAction === 'submenu_requisitos';

      if (esperandoMenu) {
        // Respondió con texto libre en vez de tocar un botón → deriva de inmediato
        if (!selectedOption) {
          await derivarAEjecutivo({
            conversacionId: convId, from, conversacion, dentroHorario,
            textoDentro: MSG_HABLAR_EJECUTIVO_DENTRO, textoFuera: MSG_HABLAR_EJECUTIVO_FUERA,
            botActionDentro: 'escalar_agente', botActionFuera: 'escalar_agente_fuera_horario',
          });
          return res.status(200).end();
        }

        if (selectedOption === 'AGENDAR_VISITA') {
          const outText  = 'Perfecto. ¿Me puedes dar 3 opciones de horario en las que puedas ir a ver la propiedad en los siguientes 7 días?';
          const outWamid = await sendTextMessage(from, outText);
          await saveMessage({ conversacionId: convId, wamid: outWamid, direction: 'outbound', messageType: 'text', messageText: outText, botAction: 'agendar_visita_horarios_pregunta' });
          return res.status(200).end();
        }

        if (selectedOption === 'REQUISITOS') {
          const outTextRequisitos  = '📋 *Requisitos:* (no es necesario enviar documentación previo a una visita)\n' +
            '- Ganar 3 veces el valor de arriendo (se puede complementar renta con más de una persona)\n' +
            '- No tener morosidad en Dicom\n' +
            '- Tener contrato de trabajo indefinido o emitir boleta de honorarios\n' +
            '- Se solicita mes de garantía y medio mes de corretaje + IVA\n\n' +
            'En caso de cumplir requisitos (basta con decirme que los cumples) se puede coordinar visita. Si posterior a la visita se desea arrendar, se solicita la documentación.';
          const outWamidRequisitos = await sendTextMessage(from, outTextRequisitos);
          await saveMessage({ conversacionId: convId, wamid: outWamidRequisitos, direction: 'outbound', messageType: 'text', messageText: outTextRequisitos, botAction: 'requisitos' });

          const outWamidSubmenu = await sendSubmenuRequisitos(from);
          await saveMessage({ conversacionId: convId, wamid: outWamidSubmenu, direction: 'outbound', messageType: 'interactive', messageText: 'Submenú requisitos enviado', botAction: 'submenu_requisitos' });
          return res.status(200).end();
        }

        if (selectedOption === 'HABLAR_EJECUTIVO') {
          await derivarAEjecutivo({
            conversacionId: convId, from, conversacion, dentroHorario,
            textoDentro: MSG_HABLAR_EJECUTIVO_DENTRO, textoFuera: MSG_HABLAR_EJECUTIVO_FUERA,
            botActionDentro: 'escalar_agente', botActionFuera: 'escalar_agente_fuera_horario',
          });
          return res.status(200).end();
        }
      }

      // 4) Cualquier otro caso no contemplado (defensivo): reenviar el menú principal
      const outWamidFallback = await sendMenuMessage(from);
      await saveMessage({ conversacionId: convId, wamid: outWamidFallback, direction: 'outbound', messageType: 'interactive', messageText: 'Menú principal enviado', botAction: 'menu_principal' });
      return res.status(200).end();

    } catch (err) {
      console.error('WhatsApp webhook error:', err);
      return res.status(200).end();
    }
  }

  return res.status(405).end();
};
