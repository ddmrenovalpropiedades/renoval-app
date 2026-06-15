// api/send-whatsapp.js
const { createClient } = require('@supabase/supabase-js');

const supabase = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

const PHONE_NUMBER_ID = process.env.WHATSAPP_PHONE_NUMBER_ID;
const ACCESS_TOKEN    = process.env.WHATSAPP_ACCESS_TOKEN;

module.exports = async function handler(req, res) {
  if (req.method !== 'POST') return res.status(405).end();

  const { conversacion_id, to, text, agent_id } = req.body;

  if (!conversacion_id || !to || !text) {
    return res.status(400).json({ error: 'Faltan parámetros' });
  }

  try {
    // Enviar mensaje a WhatsApp
    const waRes = await fetch(
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

    const waData = await waRes.json();

    if (waData.error) {
      console.error('META send-whatsapp error:', JSON.stringify(waData.error));
      return res.status(400).json({ error: waData.error.message });
    }

    const wamid = waData?.messages?.[0]?.id ?? null;

    // Guardar mensaje en Supabase
    const { error: insertError } = await supabase.from('wa_mensajes').insert({
      conversacion_id: conversacion_id,
      wamid,
      direction:    'outbound',
      message_type: 'text',
      message_text: text,
      bot_action:   null,
    });

    if (insertError) {
      console.error('Supabase insert error:', insertError.message);
      return res.status(500).json({ error: insertError.message });
    }

    // Actualizar conversación: asignar agente y cambiar estado
    await supabase
      .from('wa_conversaciones')
      .update({
        agent_id: agent_id || null,
        estado:   'con_agente',
      })
      .eq('id', conversacion_id);

    return res.status(200).json({ ok: true, wamid });

  } catch (err) {
    console.error('send-whatsapp error:', err);
    return res.status(500).json({ error: err.message });
  }
};
