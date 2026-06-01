export default async function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const { userEmail } = req.body || {};

  // Seleccionar el refresh token según el usuario
  const refreshTokenMap = {
    'ddm@renovalpropiedades.com':      process.env.GOOGLE_REFRESH_TOKEN,
    'fdm@renovalpropiedades.com':      process.env.GOOGLE_REFRESH_TOKEN_FDM,
    'edith@renovalpropiedades.com':    process.env.GOOGLE_REFRESH_TOKEN_EDITH,
  };

  const refreshToken = refreshTokenMap[userEmail];
  if (!refreshToken) {
    return res.status(200).json({ summary: 'No hay acceso configurado al correo para este usuario.' });
  }

  try {
    // 1. Obtener access token
    const tokenRes = await fetch('https://oauth2.googleapis.com/token', {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: new URLSearchParams({
        client_id: process.env.GOOGLE_CLIENT_ID,
        client_secret: process.env.GOOGLE_CLIENT_SECRET,
        refresh_token: refreshToken,
        grant_type: 'refresh_token',
      }),
    });
    const tokenData = await tokenRes.json();
    if (!tokenData.access_token) {
      return res.status(500).json({ error: 'No se pudo obtener access token', detail: tokenData });
    }
    const accessToken = tokenData.access_token;

    // 2. Buscar correos de las últimas 24 horas en inbox
    const since = Math.floor((Date.now() - 24 * 60 * 60 * 1000) / 1000);
    const searchRes = await fetch(
      `https://gmail.googleapis.com/gmail/v1/users/me/messages?q=in:inbox after:${since}&maxResults=20`,
      { headers: { Authorization: `Bearer ${accessToken}` } }
    );
    const searchData = await searchRes.json();
    const messages = searchData.messages || [];

    if (messages.length === 0) {
      return res.status(200).json({ summary: 'No hay correos nuevos en las últimas 24 horas.' });
    }

    // 3. Obtener detalles de cada mensaje
    const details = await Promise.all(
      messages.slice(0, 15).map(async (msg) => {
        const msgRes = await fetch(
          `https://gmail.googleapis.com/gmail/v1/users/me/messages/${msg.id}?format=metadata&metadataHeaders=From&metadataHeaders=Subject&metadataHeaders=Date`,
          { headers: { Authorization: `Bearer ${accessToken}` } }
        );
        const msgData = await msgRes.json();
        const headers = msgData.payload?.headers || [];
        const from = headers.find(h => h.name === 'From')?.value || 'Desconocido';
        const subject = headers.find(h => h.name === 'Subject')?.value || '(sin asunto)';
        const snippet = msgData.snippet || '';
        return { from, subject, snippet };
      })
    );

    // 4. Llamar a Claude para resumir
    const claudeRes = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-api-key': process.env.ANTHROPIC_API_KEY,
        'anthropic-version': '2023-06-01',
      },
      body: JSON.stringify({
        model: 'claude-sonnet-4-6',
        max_tokens: 1000,
        system: 'Eres un asistente de planificación. Resume correos de forma concisa en español. Para cada correo indica remitente, asunto y un resumen de 1-2 líneas. Usa formato de lista con viñetas (•).',
        messages: [{
          role: 'user',
          content: `Resume estos ${details.length} correos recibidos en las últimas 24 horas:\n\n${details.map((d, i) =>
            `${i + 1}. De: ${d.from}\nAsunto: ${d.subject}\nContenido: ${d.snippet}`
          ).join('\n\n')}`
        }]
      })
    });

    const claudeData = await claudeRes.json();
    const summary = claudeData.content?.find(b => b.type === 'text')?.text || 'No se pudo generar el resumen.';
    return res.status(200).json({ summary });

  } catch (e) {
    return res.status(500).json({ error: e.message });
  }
}
