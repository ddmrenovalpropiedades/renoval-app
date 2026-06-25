// api/save-push-subscription.js
const { createClient } = require('@supabase/supabase-js');

const supabase = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

module.exports = async function handler(req, res) {
  if (req.method !== 'POST') return res.status(405).end();

  const { user_id, subscription } = req.body;
  if (!user_id || !subscription?.endpoint) {
    return res.status(400).json({ error: 'Faltan datos' });
  }

  const { error } = await supabase
    .from('wa_push_subscriptions')
    .upsert({
      user_id,
      endpoint: subscription.endpoint,
      p256dh:   subscription.keys.p256dh,
      auth:     subscription.keys.auth,
    }, { onConflict: 'user_id,endpoint' });

  if (error) return res.status(500).json({ error: error.message });
  return res.status(200).json({ ok: true });
};
