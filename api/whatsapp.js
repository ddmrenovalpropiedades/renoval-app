// api/whatsapp.js
const { createClient } = require('@supabase/supabase-js');
const webpush = require('web-push');

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

// ─── Calcular badge real para un usuario ──────────────────────────────────────
// Cuenta conversaciones visibles para el usuario donde hay mensajes inbound
// más nuevos que su última lectura (o nunca leídas).
async function calcularBadgeParaUsuario(userEmail, userId) {
  // Obtener lecturas del usuario
  const { data: lecturas } = await supabase
    .from('wa_conv_lecturas')
    .select('conv_id, leida_en')
    .eq('user_id', userEmail);

  const lecturasMap = {};
  (lecturas || []).forEach(l => { lecturasMap[l.conv_id] = l.leida_en; });

  // Obtener conversaciones visibles para este usuario (propias + sin asignar)
  const { data: convs } = await supabase
    .from('wa_conversaciones')
    .select('id, agent_id, wa_mensajes(created_at, direction)')
    .or(`agent_id.eq.${userId},agent_id.is.null`)
    .neq('estado', 'cerrada');

  if (!convs) return 0;

  let count = 0;
  for (const conv of convs) {
    const ultimaLectura   = lecturasMap[conv.id] ? new Date(lecturasMap[conv.id]) : null;
    const mensajesInbound = (conv.wa_mensajes || []).filter(m => m.direction === 'inbound');
    if (!mensajesInbound.length) continue;

    const ultimoInbound = new Date(
      mensajesInbound.reduce((max, m) =>
        new Date(m.created_at) > new Date(max) ? m.created_at : max,
        mensajesInbound[0].created_at
      )
    );

    if (!ultimaLectura || ultimoInbound > ultimaLectura) count++;
  }

  return count;
}

// ─── Enviar push a todos los dispositivos de un usuario ───────────────────────
async function sendPushToUser(userEmail, userId, payload) {
  const { data: subs } = await supabase
    .from('wa_push_subscriptions')
    .select('endpoint, p256dh, auth')
    .eq('user_id', userEmail);

  if (!subs || subs.length === 0) return;

  const badge      = await calcularBadgeParaUsuario(userEmail, userId);
  const payloadStr = JSON.stringify({ ...payload, badge });

  await Promise.allSettled(
    subs.map(sub =>
      webpush.sendNotification(
        { endpoint: sub.endpoint, keys: { p256dh: sub.p256dh, auth: sub.auth } },
        payloadStr
      ).catch(async (err) => {
        if (err.statusCode === 404 || err.statusCode === 410) {
          await supabase
            .from('wa_push_subscriptions')
            .delete()
            .eq('endpoint', sub.endpoint);
        }
      })
    )
  );
}

// ─── Enviar push a todos los usuarios (conv sin asignar) ──────────────────────
async function sendPushToAll(payload) {
  // Obtener todos los usuarios suscritos con su user_id (email) y app_users id
  const { data: subs } = await supabase
    .from('wa_push_subscriptions')
    .select('user_id, endpoint, p256dh, auth');

  if (!subs || subs.length === 0) return;

  // Obtener ids de app_users para calcular badge
  const { data: appUsers } = await supabase
    .from('app_users')
    .select('id, email');

  const emailToId = {};
  (appUsers || []).forEach(u => { emailToId[u.email] = u.id; });

  // Calcular badge por usuario y enviar
  const userEmails = [...new Set(subs.map(s => s.user_id))];
  const badges = {};
  await Promise.all(
    userEmails.map(async email => {
      const userId  = emailToId[email];
      if (!userId) return;
      badges[email] = await calcularBadgeParaUsuario(email, userId);
    })
  );

  await Promise.allSettled(
    subs.map(sub => {
      const badge      = badges[sub.user_id] || 1;
      const payloadStr = JSON.stringify({ ...payload, badge });
      return webpush.sendNotification(
        { endpoint: sub.endpoint, keys: { p256dh: sub.p256dh, auth: sub.auth } },
        payloadStr
      ).catch(async (err) => {
        if (err.statusCode === 404 || err.statusCode === 410) {
          await supabase
            .from('wa_push_subscriptions')
            .delete()
            .eq('endpoint', sub.endpoint);
        }
      });
    })
  );
}

// ─── Extraer URL de un texto ──────────────────────────────────────────────────
function extractUrl(text) {
  if (!text) return null;
  const match = text.match(/https?:\/\/[^\s]+/i);
  return match ? match[0] : null;
}

// ─── Buscar propiedad por URL y obtener agent_id según conv_asignar_a ─────────
async function findPropiedadByUrl(url) {
  if (!url) return null;

  const urlNorm = url.split('?')[0].replace(/\/$/, '').toLowerCase();

  const { data: propiedades } = await supabase
    .from('pizarra')
    .select('id, propiedad, e1, e2, url_publicacion, conv_asignar_a')
    .not('url_publicacion', 'is', null);

  if (!propiedades || propiedades.length === 0) return null;

  const match = propiedades.find(p => {
    if (!p.url_publicacion) return false;
    const pNorm = p.url_publicacion.split('?')[0].replace(/\/$/, '').toLowerCase();
    return pNorm === urlNorm;
  });

  if (!match) return null;

  const asignarA  = match.conv_asignar_a || 'e2';
  const iniciales = asignarA === 'e1' ? match.e1 : match.e2;

  let agentId = null;
  if (iniciales) {
    const { data: agente } = await supabase
      .from('app_users')
      .select('id')
      .eq('iniciales', iniciales)
      .single();
    agentId = agente?.id || null;
  }

  return {
    propiedadId: match.id,
    propiedad:   match.propiedad,
    iniciales,
    agentId,
  };
}

// ─── Enviar mensaje de texto simple ───────────────────────────────────────────
async function sendTextMessage(to, text) {
  const res = await fetch(
    `https://graph.facebook.com/v19.0/${PHONE_NUMBER_ID}/messages`,
    {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${ACCESS_TOKEN}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        messaging_product: 'whatsapp',
        to,
        type: 'text',
        text: { body: text },
      }),
    }
  );
  const data = await res.json();
  console.log('META sendTextMessage RESPONSE:', JSON.stringify(data));
  return data?.messages?.[0]?.id ?? null;
}

// ─── Enviar menú interactivo ───────────────────────────────────────────────────
async function sendMenuMessage(to) {
  const res = await fetch(
    `https://graph.facebook.com/v19.0/${PHONE_NUMBER_ID}/messages`,
    {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${ACCESS_TOKEN}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        messaging_product: 'whatsapp',
        to,
        type: 'interactive',
        interactive: {
          type: 'button',
          body: {
            text: '👋 Hola, soy el asistente de *Renoval Propiedades*.\n\n¿En qué te puedo ayudar?',
          },
          action: {
            buttons: [
              { type: 'reply', reply: { id: 'AGENDAR_VISITA',   title: 'Agendar visita'   } },
              { type: 'reply', reply: { id: 'MAS_INFORMACION',  title: 'Más información'  } },
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
      phone_number:  phoneNumber,
      contact_name:  contactName || null,
      estado:        'bot_activo',
      propiedad_id:  propiedadMatch?.propiedadId || null,
      agent_id:      propiedadMatch?.agentId     || null,
    })
    .select()
    .single();

  if (error) throw new Error(`Error creando conversación: ${error.message}`);
  return nueva;
}

// ─── Guardar mensaje en Supabase ──────────────────────────────────────────────
async function saveMessage({ conversacionId, wamid, direction, messageType, messageText, botAction }) {
  if (wamid) {
    const { data: exists } = await supabase
      .from('wa_mensajes')
      .select('id')
      .eq('wamid', wamid)
      .single();
    if (exists) return exists;
  }

  const { data, error } = await supabase
    .from('wa_mensajes')
    .insert({
      conversacion_id: conversacionId,
      wamid:           wamid || null,
      direction,
      message_type:    messageType,
      message_text:    messageText,
      bot_action:      botAction || null,
    })
    .select()
    .single();

  if (error) throw new Error(`Error guardando mensaje: ${error.message}`);
  return data;
}

// ─── Actualizar estado de conversación ───────────────────────────────────────
async function updateEstadoConversacion(conversacionId, estado) {
  await supabase
    .from('wa_conversaciones')
    .update({ estado })
    .eq('id', conversacionId);
}

// ─── Handler principal ────────────────────────────────────────────────────────
module.exports = async function handler(req, res) {

  // Verificación del webhook (GET)
  if (req.method === 'GET') {
    const mode      = req.query['hub.mode'];
    const token     = req.query['hub.verify_token'];
    const challenge = req.query['hub.challenge'];
    if (mode === 'subscribe' && token === VERIFY_TOKEN) {
      return res.status(200).send(challenge);
    }
    return res.status(403).end();
  }

  // Recepción de mensajes (POST)
  if (req.method === 'POST') {
    try {
      const body = req.body;

      if (body.object !== 'whatsapp_business_account') {
        return res.status(404).end();
      }

      const entry    = body.entry?.[0];
      const changes  = entry?.changes?.[0];
      const value    = changes?.value;
      const messages = value?.messages;

      if (!messages || messages.length === 0) {
        return res.status(200).end();
      }

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

      // ── Matching de URL ───────────────────────────────────────────────────
      let propiedadMatch = null;
      if (message.type === 'text' && inboundText) {
        const url = extractUrl(inboundText);
        if (url) {
          propiedadMatch = await findPropiedadByUrl(url);
          if (propiedadMatch) {
            console.log('URL match:', propiedadMatch.propiedad, '→ asignado a:', propiedadMatch.iniciales);
          }
        }
      }

      // ── Obtener o crear conversación ──────────────────────────────────────
      const conversacion = await getOrCreateConversacion(from, contactName, propiedadMatch);
      const convId       = conversacion.id;

      if (propiedadMatch && !conversacion.propiedad_id) {
        await supabase
          .from('wa_conversaciones')
          .update({
            propiedad_id: propiedadMatch.propiedadId,
            agent_id:     propiedadMatch.agentId || conversacion.agent_id,
          })
          .eq('id', convId);
      }

      await saveMessage({
        conversacionId: convId,
        wamid,
        direction:   'inbound',
        messageType: inboundType,
        messageText: inboundText,
      });

      // ── Enviar push notification con badge real ───────────────────────────
      const pushPayload = {
        title: contactName ? `Mensaje de ${contactName}` : 'Nuevo mensaje WhatsApp',
        body:  inboundText || 'Nuevo mensaje recibido',
        url:   '/',
      };

      if (conversacion.agent_id) {
        const { data: agente } = await supabase
          .from('app_users')
          .select('id, email')
          .eq('id', conversacion.agent_id)
          .single();
        if (agente?.email) {
          await sendPushToUser(agente.email, agente.id, pushPayload);
        }
      } else {
        await sendPushToAll(pushPayload);
      }

      // ── Lógica del bot ────────────────────────────────────────────────────
      const estado = conversacion.estado;

      if (estado === 'con_agente') {
        return res.status(200).end();
      }

      if (estado === 'esperando_agente') {
        const outText  = 'Un ejecutivo te responderá a la brevedad. 🙏';
        const outWamid = await sendTextMessage(from, outText);
        await saveMessage({
          conversacionId: convId,
          wamid:       outWamid,
          direction:   'outbound',
          messageType: 'text',
          messageText: outText,
          botAction:   'recordatorio_espera',
        });
        return res.status(200).end();
      }

      if (!selectedOption) {
        const outWamid = await sendMenuMessage(from);
        await saveMessage({
          conversacionId: convId,
          wamid:       outWamid,
          direction:   'outbound',
          messageType: 'interactive',
          messageText: 'Menú principal enviado',
          botAction:   'menu_principal',
        });
        return res.status(200).end();
      }

      if (selectedOption === 'AGENDAR_VISITA') {
        const outText  = '📅 Pronto podrás agendar tu visita directamente aquí.\nPor ahora, un ejecutivo se pondrá en contacto contigo para coordinar. ¡Gracias por tu interés!';
        const outWamid = await sendTextMessage(from, outText);
        await saveMessage({
          conversacionId: convId,
          wamid:       outWamid,
          direction:   'outbound',
          messageType: 'text',
          messageText: outText,
          botAction:   'agendar_visita_placeholder',
        });
        await updateEstadoConversacion(convId, 'esperando_agente');
      }

      if (selectedOption === 'MAS_INFORMACION') {
        const outText  = 'ℹ️ Con gusto te enviamos más información sobre la propiedad. Un ejecutivo te contactará en breve con todos los detalles. 🏠';
        const outWamid = await sendTextMessage(from, outText);
        await saveMessage({
          conversacionId: convId,
          wamid:       outWamid,
          direction:   'outbound',
          messageType: 'text',
          messageText: outText,
          botAction:   'mas_informacion',
        });
        await updateEstadoConversacion(convId, 'esperando_agente');
      }

      if (selectedOption === 'HABLAR_EJECUTIVO') {
        const outText  = '👤 Perfecto, en breve uno de nuestros ejecutivos se comunicará contigo. ¡Gracias por contactarnos!';
        const outWamid = await sendTextMessage(from, outText);
        await saveMessage({
          conversacionId: convId,
          wamid:       outWamid,
          direction:   'outbound',
          messageType: 'text',
          messageText: outText,
          botAction:   'escalar_agente',
        });
        await updateEstadoConversacion(convId, 'esperando_agente');
      }

      return res.status(200).end();

    } catch (err) {
      console.error('WhatsApp webhook error:', err);
      return res.status(200).end();
    }
  }

  return res.status(405).end();
};
