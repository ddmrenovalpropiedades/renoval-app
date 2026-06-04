export default async function handler(req, res) {
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });

  const authHeader = req.headers['authorization'];
  if (authHeader !== `Bearer ${process.env.CRON_SECRET}`) {
    return res.status(401).json({ error: 'Unauthorized' });
  }

  const { propiedad, mailAdmin, mesLabel, isTest } = req.body;
  if (!propiedad || !mailAdmin) return res.status(400).json({ error: 'Missing fields' });

  const asunto = `${isTest ? '[PRUEBA] ' : ''}Consulta Gasto Común ${mesLabel}`;
  const cuerpo = `Buenos días,

Junto con saludar, quería solicitar el saldo de gasto común de la siguiente propiedad:
${propiedad}

Quedo atento a su respuesta,

Saludos`;

  try {
    const response = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-api-key': process.env.ANTHROPIC_API_KEY,
        'anthropic-version': '2023-06-01',
        'anthropic-beta': 'mcp-client-2025-04-04',
      },
      body: JSON.stringify({
        model: 'claude-sonnet-4-20250514',
        max_tokens: 1000,
        system: 'Eres un asistente que envía correos usando Gmail. Usa la herramienta de Gmail para enviar el correo exactamente como se indica, sin modificar el contenido ni agregar texto adicional.',
        messages: [{
          role: 'user',
          content: `Envía este correo usando Gmail:
Para: ${mailAdmin}
CC: edith@renovalpropiedades.com
Asunto: ${asunto}
Cuerpo:
${cuerpo}`,
        }],
        mcp_servers: [{
          type: 'url',
          url: 'https://gmailmcp.googleapis.com/mcp/v1',
          name: 'gmail',
        }],
      }),
    });

    const data = await response.json();
    if (!response.ok) return res.status(500).json({ error: data.error?.message || 'API error' });
    return res.status(200).json({ ok: true, content: data.content });
  } catch (err) {
    return res.status(500).json({ error: err.message });
  }
}
