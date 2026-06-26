// api/send-push-badge.js
// Recibe el payload de push y los destinatarios, calcula el badge real
// por usuario y envía la notificación actualizada.
// Se llama de forma asíncrona desde api/whatsapp.js para no bloquear el webhook.

const { createClient } = require('@supabase/supabase-js');
const webpush = require('web-push');

const supabase = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

webpush.setVapidDetails(
  process.env.VAPID_EMAIL,
  process.env.VAPID_PUBLIC_KEY,
  process.env.VAPID_PRIVATE_KEY
);

async function calcularBadge(userEmail, userId) {
  const { data: lecturas } = await supabase
    .from('wa_conv_lecturas')
    .select('conv_id, leida_en')
    .eq('user_id', userEmail);

  const lecturasMap = {};
  (lecturas || []).forEach(l => { lecturasMap[l.conv_id] = l.leida_en; });

  const { data: convs } = await supabase
    .from('wa_conversaciones')
    .select('id, agent_id, wa_mensajes(created_at, direction)')
    .or(`agent_id.eq.${userId},agent_id.is.null`)
    .neq('estado', 'cerrada');

  if (!convs) return 1;

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

  return count || 1;
}

async function sendPush(subs, payloadStr) {
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

module.exports = async function handler(req, res) {
  if (req.method !== 'POST') return res.status(405).end();

  // Responder inmediatamente para no bloquear al caller
  res.status(200).end();

  try {
    const { agentEmail, agentId, payload, sendToAll } = req.body;

    if (sendToAll) {
      // Conv sin asignar → enviar a todos con badge individual
      const { data: subs } = await supabase
        .from('wa_push_subscriptions')
        .select('user_id, endpoint, p256dh, auth');
      if (!subs || subs.length === 0) return;

      const { data: appUsers } = await supabase
        .from('app_users')
        .select('id, email');
      const emailToId = {};
      (appUsers || []).forEach(u => { emailToId[u.email] = u.id; });

      const userEmails = [...new Set(subs.map(s => s.user_id))];
      const badges = {};
      await Promise.all(
        userEmails.map(async email => {
          const uid = emailToId[email];
          if (!uid) return;
          badges[email] = await calcularBadge(email, uid);
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
              await supabase.from('wa_push_subscriptions').delete().eq('endpoint', sub.endpoint);
            }
          });
        })
      );
    } else {
      // Conv asignada → enviar solo al agente
      const { data: subs } = await supabase
        .from('wa_push_subscriptions')
        .select('endpoint, p256dh, auth')
        .eq('user_id', agentEmail);
      if (!subs || subs.length === 0) return;

      const badge      = await calcularBadge(agentEmail, agentId);
      const payloadStr = JSON.stringify({ ...payload, badge });
      await sendPush(subs, payloadStr);
    }
  } catch (err) {
    console.error('send-push-badge error:', err);
  }
};
