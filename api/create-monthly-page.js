import { createClient } from '@supabase/supabase-js';

const supabase = createClient(
  process.env.REACT_APP_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

export default async function handler(req, res) {
  // Protección: solo llamadas del cron de Vercel o con token secreto
  const authHeader = req.headers['authorization'];
  if (authHeader !== `Bearer ${process.env.CRON_SECRET}`) {
    return res.status(401).json({ error: 'Unauthorized' });
  }

  // Calcular el mes actual (el cron corre el día 1, así que "ahora" ya es el mes nuevo)
  const now = new Date();
  const year = now.getFullYear();
  const month = String(now.getMonth() + 1).padStart(2, '0');
  const mesNuevo = `${year}-${month}`;

  // Verificar si ya existe
  const { data: existing } = await supabase
    .from('arrendadas_meses')
    .select('mes')
    .eq('mes', mesNuevo)
    .single();

  if (existing) {
    return res.status(200).json({ message: `El mes ${mesNuevo} ya existe.` });
  }

  // Insertar el mes nuevo (página en blanco)
  const { error } = await supabase
    .from('arrendadas_meses')
    .insert({ mes: mesNuevo });

  if (error) {
    console.error('Error creando mes:', error);
    return res.status(500).json({ error: error.message });
  }

  return res.status(200).json({ message: `Mes ${mesNuevo} creado correctamente.` });
}
