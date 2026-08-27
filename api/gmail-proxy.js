export default async function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }
  const { userEmail, mode = 'recent', ownerEmails = [] } = req.body || {};
  // Seleccionar el refresh token según el usuario
  const refreshTokenMap = {
    'ddm@renovalpropiedades.com':      process.env.GOOGLE_REFRESH_TOKEN,
    'fdm@renovalpropiedades.com':      process.env.GOOGLE_REFRESH_TOKEN_FDM,
    'edith@renovalpropiedades.com':    process.env.GOOGLE_REFRESH_TOKEN_EDITH,
    'fernanda@renovalpropiedades.com': process.env.GOOGLE_REFRESH_TOKEN_FERNANDA,
  };
  const refreshToken = refreshTokenMap[userEmail];
  if (!refreshToken) {
    return res.status(200).json({ emails: [], error: 'No hay acceso configurado al correo para este usuario.' });
  }
  // 'owners': correos de propietarios (columna Mail Prop. de Cartera) de los
  // últimos 7 días. 'recent' (default): últimas 36 horas.
  const isOwnersMode = mode === 'owners';
  if (isOwnersMode && ownerEmails.length === 0) {
    return res.status(200).json({ emails: [] });
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
    // 2. Armar la búsqueda: rango de tiempo + (si es modo 'owners') filtro por remitente
    const rangeMs = isOwnersMode ? 7 * 24 * 60 * 60 * 1000 : 36 * 60 * 60 * 1000;
    const since = Math.floor((Date.now() - rangeMs) / 1000);
    let query = `in:inbox after:${since}`;
    if (isOwnersMode) {
      const fromClause = ownerEmails.map(e => `from:${e}`).join(' OR ');
      query += ` (${fromClause})`;
    }
    const searchRes = await fetch(
      `https://gmail.googleapis.com/gmail/v1/users/me/messages?q=${encodeURIComponent(query)}&maxResults=20`,
      { headers: { Authorization: `Bearer ${accessToken}` } }
    );
    const searchData = await searchRes.json();
    const messages = searchData.messages || [];
    if (messages.length === 0) {
      return res.status(200).json({ emails: [] });
    }
    // 3. Obtener detalles de cada mensaje (incluyendo su ID único — se usa
    // en el front para marcar un correo puntual como "gestionado". Un
    // mensaje nuevo en la misma cadena tiene un ID distinto, así que
    // reaparece solo cuando corresponde.)
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
        const date = headers.find(h => h.name === 'Date')?.value || null;
        const snippet = msgData.snippet || '';
        return { id: msg.id, threadId: msg.threadId, from, subject, date, snippet };
      })
    );
    // Más reciente primero
    details.sort((a, b) => new Date(b.date || 0) - new Date(a.date || 0));
    // 4. Pedir a Claude un resumen de 1-2 líneas POR correo (no un párrafo
    // único) — necesario para mostrar el resumen dentro de cada item de la
    // lista, en vez del extracto crudo de Gmail.
    let summaries = [];
    try {
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
          system: 'Devuelve SOLO un array JSON válido (sin texto adicional, sin backticks, sin markdown) con un resumen de 1 a 2 líneas en español para cada correo que se te entregue, en el mismo orden y con exactamente la misma cantidad de elementos que correos recibidos. Sé concreto sobre el contenido o la solicitud de cada correo. Formato exacto: ["resumen del correo 1", "resumen del correo 2"]',
          messages: [{
            role: 'user',
            content: details.map((d, i) =>
              `${i + 1}. De: ${d.from}\nAsunto: ${d.subject}\nContenido: ${d.snippet}`
            ).join('\n\n')
          }]
        })
      });
      const claudeData = await claudeRes.json();
      const text = claudeData.content?.find(b => b.type === 'text')?.text || '[]';
      const parsed = JSON.parse(text.replace(/```json|```/g, '').trim());
      if (Array.isArray(parsed) && parsed.length === details.length) summaries = parsed;
    } catch (e) {
      console.error('Error generando resúmenes por correo:', e.message);
      // sigue con summaries = [] → cada correo cae al fallback (su snippet)
    }
    const emailsWithSummary = details.map((d, i) => ({
      ...d,
      summary: summaries[i] || d.snippet,
    }));
    return res.status(200).json({ emails: emailsWithSummary });
  } catch (e) {
    return res.status(500).json({ error: e.message });
  }
}
