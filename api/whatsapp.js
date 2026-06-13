// api/whatsapp.js
const { createClient } = require('@supabase/supabase-js');

const supabase = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

const PHONE_NUMBER_ID = process.env.WHATSAPP_PHONE_NUMBER_ID;
const ACCESS_TOKEN    = process.env.WHATSAPP_ACCESS_TOKEN;
const VERIFY_TOKEN    = process.env.WHATSAPP_VERIFY_TOKEN;

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
              { type: 'reply', reply: { id: 'AGENDAR_VISITA',   title: '📅 Agendar visita'      } },
              { type: 'reply', reply: { id: 'MAS_INFORMACION',  title: 'ℹ️ Más información'     } },
              { type: 'reply', reply: { id: 'HABLAR_EJECUTIVO', title: '👤 Hablar con ejecutivo' } },
            ],
          },
        },
      }),
    }
  );
  const data = await res.json();
  return data?.messages?.[0]?.id ?? null;
}

// ─── Obtener o crear conversación ─────────────────────────────────────────────
async function getOrCreateConversacion(phoneNumber, contactName) {
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
      phone_number: phoneNumber,
      contact_name: contactName || null,
      estado: 'bot_activo',
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

      // Ignorar status updates
      if (!messages || messages.length === 0) {
        return res.status(200).end();
      }

      const message     = messages[0];
      const from        = message.from;
      const wamid       = message.id;
      const contactName = value?.contacts?.[0]?.profile?.name || null;

      // Obtener o crear conversación
      const conversacion = await getOrCreateConversacion(from, contactName);
      const convId       = conversacion.id;

      // ── Determinar texto del mensaje entrante ─────────────────────────────
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

      // Guardar mensaje entrante
      await saveMessage({
        conversacionId: convId,
        wamid,
        direction:   'inbound',
        messageType: inboundType,
        messageText: inboundText,
      });

      // ── Lógica del bot ────────────────────────────────────────────────────
      const estado = conversacion.estado;

      // Si ya tiene agente asignado, no responde el bot
      if (estado === 'con_agente') {
        return res.status(200).end();
      }

      // Si está esperando agente, recordar al contacto
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

      // ── Estado: bot_activo ────────────────────────────────────────────────

      // Primer mensaje o texto libre → enviar menú
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

      // ── Respuestas a opciones del menú ────────────────────────────────────
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
