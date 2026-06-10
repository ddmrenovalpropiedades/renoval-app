import { createClient } from '@supabase/supabase-js';

const supabaseAdmin = createClient(
  process.env.REACT_APP_SUPABASE_URL || 'https://yyxsurlhzvazwgmerglc.supabase.co',
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

export default async function handler(req, res) {
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });

  const authHeader = req.headers['authorization'];
  if (authHeader !== `Bearer ${process.env.CRON_SECRET}`) {
    return res.status(401).json({ error: 'Unauthorized' });
  }

  const { mirrorTask } = req.body;
  if (!mirrorTask) return res.status(400).json({ error: 'Missing mirrorTask' });

  const { data, error } = await supabaseAdmin.from('tasks').insert(mirrorTask).select().single();
  if (error) {
    console.error('create-mirror-task error:', error);
    return res.status(500).json({ error: error.message });
  }
  return res.status(200).json({ data });
}
