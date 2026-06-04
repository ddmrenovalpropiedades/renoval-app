export default async function handler(req, res) {
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });

  const authHeader = req.headers['authorization'];
  if (authHeader !== `Bearer ${process.env.CRON_SECRET}`) {
    return res.status(401).json({ error: 'Unauthorized' });
  }

  const { mes } = req.body;
  const mesLabel = (() => {
    const [y, m] = mes.split('-');
    const names = ['Enero','Febrero','Marzo','Abril','Mayo','Junio','Julio','Agosto','Septiembre','Octubre','Noviembre','Diciembre'];
    return `${names[parseInt(m)-1]} ${y}`;
  })();

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
        max_tokens: 2000,
        system: `Eres un asistente que revisa la bandeja de entrada de Gmail buscando respuestas a consultas de gasto común enviadas desde gcrenovalpropiedades@gmail.com.

Busca correos recibidos que sean respuestas a consultas de gasto común del mes ${mesLabel}.
Para cada respuesta encontrada con un PDF adjunto, analiza el PDF e intenta extraer el valor del gasto común.

Responde ÚNICAMENTE con un JSON array con este formato exacto (sin texto adicional, sin backticks):
[{"propiedad": "nombre de la propiedad consultada", "gc_valor": "valor extraído como string ej: $85.000", "respondido_at": "fecha ISO"}]

Si no hay respuestas, responde con: []`,
        messages: [{
          role: 'user',
          content: `Revisa la bandeja de entrada buscando respuestas a consultas de gasto común del mes ${mesLabel}. Extrae los valores de GC de los PDFs adjuntos si los hay. Devuelve el JSON.`,
        }],
        mcp_servers: [{
          type: 'url',
          url: 'https://gmailmcp.googleapis.com/mcp/v1',
          name: 'gmail',
        }],
      }),
    });

    const data = await response.json();
    if (!response.ok) return res.status(500).json({ error: data.error?.message, replies: [] });

    const text = data.content?.filter(b => b.type === 'text').map(b => b.text).join('') || '[]';
    let replies = [];
    try {
      const clean = text.replace(/```json|```/g, '').trim();
      replies = JSON.parse(clean);
    } catch(e) { replies = []; }

    return res.status(200).json({ replies });
  } catch (err) {
    return res.status(500).json({ error: err.message, replies: [] });
  }
}
