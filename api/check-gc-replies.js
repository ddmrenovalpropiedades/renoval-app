import { google } from 'googleapis';

const GMAIL_USER = 'gcrenovalpropiedades@gmail.com';

function getGmailClient() {
  const oauth2Client = new google.auth.OAuth2(
    process.env.GMAIL_CLIENT_ID,
    process.env.GMAIL_CLIENT_SECRET,
    'https://developers.google.com/oauthplayground'
  );
  oauth2Client.setCredentials({
    refresh_token: process.env.GMAIL_GC_REFRESH_TOKEN,
  });
  return google.gmail({ version: 'v1', auth: oauth2Client });
}

function decodePart(data) {
  return Buffer.from(data.replace(/-/g, '+').replace(/_/g, '/'), 'base64').toString('utf-8');
}

function getTextBody(payload) {
  if (!payload) return '';
  if (payload.mimeType === 'text/plain' && payload.body?.data) return decodePart(payload.body.data);
  if (payload.parts) {
    for (const part of payload.parts) {
      const text = getTextBody(part);
      if (text) return text;
    }
  }
  return '';
}

async function getPdfAttachments(gmail, messageId, payload) {
  const pdfs = [];
  const parts = payload.parts || [];
  for (const part of parts) {
    if (part.filename?.toLowerCase().endsWith('.pdf') && part.body?.attachmentId) {
      try {
        const att = await gmail.users.messages.attachments.get({
          userId: GMAIL_USER, messageId, id: part.body.attachmentId,
        });
        pdfs.push({ filename: part.filename, data: att.data.data });
      } catch (e) { console.error('Error getting attachment:', e.message); }
    }
    if (part.parts) pdfs.push(...await getPdfAttachments(gmail, messageId, part));
  }
  return pdfs;
}

async function extractGCFromPdf(pdfBase64, propiedad) {
  try {
    const cleanBase64 = pdfBase64.replace(/-/g, '+').replace(/_/g, '/');
    const response = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-api-key': process.env.ANTHROPIC_API_KEY,
        'anthropic-version': '2023-06-01',
        'anthropic-beta': 'pdfs-2024-09-25',
      },
      body: JSON.stringify({
        model: 'claude-sonnet-4-6',
        max_tokens: 500,
        messages: [{
          role: 'user',
          content: [
            {
              type: 'document',
              source: {
                type: 'base64',
                media_type: 'application/pdf',
                data: cleanBase64,
              },
            },
            {
              type: 'text',
              text: `Este PDF es un estado de cuenta de gasto común para la propiedad "${propiedad}". Extrae el monto total a pagar del gasto común. Responde ÚNICAMENTE con el número en formato chileno, por ejemplo: $85.430. Si no puedes encontrar el valor, responde: NO_ENCONTRADO`,
            },
          ],
        }],
      }),
    });
    const rawText = await response.text();
    console.log('PDF extraction status:', response.status);
    console.log('PDF extraction raw:', rawText.substring(0, 500));
    let data;
    try { data = JSON.parse(rawText); } catch (e) { return null; }
    const text = data.content?.[0]?.text?.trim() || 'NO_ENCONTRADO';
    return text === 'NO_ENCONTRADO' ? null : text;
  } catch (e) {
    console.error('extractGCFromPdf error:', e.message);
    return null;
  }
}

// Normaliza texto para comparación: minúsculas, sin tildes, sin caracteres especiales
function normalizeStr(str) {
  return String(str)
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-z0-9\s]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

// Extrae palabras significativas de un nombre de propiedad
function getSignificantWords(prop) {
  const normalized = normalizeStr(prop);
  const stopWords = new Set(['departamento', 'depto', 'dpto', 'casa', 'oficina', 'local', 'bodega', 'piso', 'apt', 'apto']);
  return normalized
    .split(/\s+/)
    .filter(w => w.length > 2 && !stopWords.has(w));
}

// Calcula un score de coincidencia entre el contenido del mail y el nombre de la propiedad
function matchScore(content, propiedad) {
  const normalizedContent = normalizeStr(content);
  const words = getSignificantWords(propiedad);
  if (!words.length) return 0;

  let matched = 0;
  for (const w of words) {
    if (normalizedContent.includes(w)) matched++;
  }
  return matched / words.length;
}

export default async function handler(req, res) {
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });

  const authHeader = req.headers['authorization'];
  if (authHeader !== `Bearer ${process.env.CRON_SECRET}`) {
    return res.status(401).json({ error: 'Unauthorized' });
  }

  const { mes, propiedades, enviado_desde, ya_resueltas } = req.body;
  if (!mes) return res.status(400).json({ error: 'Missing mes' });

  // Propiedades que ya tienen gc_valor extraído para este mes: no hace falta
  // volver a procesarlas (evita llamadas innecesarias a la API de Claude)
  const resueltasSet = new Set(ya_resueltas || []);
  const propiedadesPendientes = (propiedades || []).filter(p => !resueltasSet.has(p));

  console.log(`Propiedades totales: ${(propiedades || []).length}, ya resueltas: ${resueltasSet.size}, pendientes: ${propiedadesPendientes.length}`);

  if (propiedadesPendientes.length === 0) {
    console.log('Todas las propiedades ya tienen valor GC extraído, no hay nada que revisar.');
    return res.status(200).json({ replies: [], debug: [], total_emails_checked: 0, skipped_all_resolved: true });
  }

  try {
    const gmail = getGmailClient();

    // Fecha de corte: desde cuando buscamos respuestas
    // Si no hay enviado_desde, buscamos desde el inicio del mes
    let afterDate;
    if (enviado_desde) {
      afterDate = new Date(enviado_desde);
      // Validar que la fecha sea válida
      if (isNaN(afterDate.getTime())) {
        afterDate = new Date(`${mes}-01T00:00:00Z`);
      }
    } else {
      afterDate = new Date(`${mes}-01T00:00:00Z`);
    }
    const afterTimestamp = Math.floor(afterDate.getTime() / 1000);

    console.log('Buscando respuestas desde:', afterDate.toISOString(), '(timestamp:', afterTimestamp, ')');

    // Búsqueda amplia: cualquier email recibido después de la fecha de envío
    // Incluye con y sin adjunto PDF para no perder respuestas sin PDF
    const queries = [
      `in:inbox has:attachment filename:pdf after:${afterTimestamp}`,
      `in:inbox after:${afterTimestamp} -from:gcrenovalpropiedades@gmail.com`,
    ];

    const allMessageIds = new Set();
    for (const query of queries) {
      console.log('Gmail query:', query);
      try {
        const listRes = await gmail.users.messages.list({
          userId: GMAIL_USER,
          q: query,
          maxResults: 100,
        });
        (listRes.data.messages || []).forEach(m => allMessageIds.add(m.id));
      } catch (e) {
        console.error('Error listing messages for query:', query, e.message);
      }
    }

    console.log(`Total mensajes únicos encontrados: ${allMessageIds.size}`);

    const replies = [];
    const debug = [];

    for (const msgId of allMessageIds) {
      const full = await gmail.users.messages.get({
        userId: GMAIL_USER, id: msgId, format: 'full',
      });

      const headers = full.data.payload.headers || [];
      const subject = headers.find(h => h.name === 'Subject')?.value || '';
      const from = headers.find(h => h.name === 'From')?.value || '';
      const date = headers.find(h => h.name === 'Date')?.value || '';
      const receivedAt = new Date(date).toISOString();

      // Saltar emails enviados por nosotros mismos
      if (from.includes('gcrenovalpropiedades@gmail.com')) continue;

      const body = getTextBody(full.data.payload);
      const combined = subject + ' ' + body;

      // Buscar la propiedad con mejor match
      let matchedProp = null;
      let bestScore = 0;

      if (propiedadesPendientes?.length) {
        for (const prop of propiedadesPendientes) {
          const score = matchScore(combined, prop);
          console.log(`  "${prop}" → score: ${score.toFixed(2)} en "${subject}"`);
          if (score > bestScore) {
            bestScore = score;
            matchedProp = prop;
          }
        }
      }

      // Umbral mínimo de coincidencia: al menos 40% de las palabras clave
      const MATCH_THRESHOLD = 0.4;

      const msgDebug = {
        id: msgId,
        subject,
        from,
        date: receivedAt,
        matchedProp: bestScore >= MATCH_THRESHOLD ? matchedProp : null,
        bestScore: Math.round(bestScore * 100) + '%',
      };
      debug.push(msgDebug);

      if (bestScore < MATCH_THRESHOLD) {
        console.log(`No match suficiente para "${subject}" (mejor: ${matchedProp} @ ${bestScore.toFixed(2)})`);
        continue;
      }

      console.log(`✓ Match: "${matchedProp}" (score: ${bestScore.toFixed(2)}) para "${subject}"`);

      // Intentar extraer valor GC del PDF si hay adjunto
      const pdfs = await getPdfAttachments(gmail, msgId, full.data.payload);
      msgDebug.pdfsFound = pdfs.map(p => p.filename);

      let gcValor = null;
      if (pdfs.length > 0) {
        gcValor = await extractGCFromPdf(pdfs[0].data, matchedProp);
        console.log(`GC valor para ${matchedProp}: ${gcValor}`);
        if (pdfs.length > 1) {
          // El correo trae más de un PDF (típico cuando la misma
          // administración envía varias propiedades del mismo edificio en un
          // solo correo, ej. dos departamentos del mismo edificio). Solo
          // podemos extraer con confianza del primero, así que dejamos
          // marcada la ambigüedad para revisión manual en vez de asumir que
          // el valor es correcto en silencio.
          console.log(`⚠ El correo para "${matchedProp}" trae ${pdfs.length} PDFs adjuntos (${pdfs.map(p => p.filename).join(', ')}). Se usó el primero — queda marcado para revisión.`);
        }
      } else {
        console.log(`Sin PDF adjunto en respuesta para ${matchedProp}`);
      }

      // Evitar duplicados: si ya hay un reply para esta propiedad con mejor info, no reemplazar
      const existing = replies.find(r => r.propiedad === matchedProp);
      if (existing) {
        // Preferir el que tiene gc_valor
        if (!existing.gc_valor && gcValor) {
          existing.gc_valor = gcValor;
          existing.respondido_at = receivedAt;
          existing.gmail_message_id = msgId;
          existing.pdf_adjuntos = pdfs.length > 1 ? pdfs.length : null;
        }
      } else {
        replies.push({
          propiedad: matchedProp,
          gc_valor: gcValor,
          respondido_at: receivedAt,
          gmail_message_id: msgId,
          // Cantidad de PDFs adjuntos en el correo. Se guarda solo cuando es
          // >1, para que el frontend pueda marcar la propiedad como "a
          // revisar" en vez de dar el valor extraído por bueno de forma
          // silenciosa.
          pdf_adjuntos: pdfs.length > 1 ? pdfs.length : null,
        });
      }
    }

    console.log(`Respuestas detectadas: ${replies.length}`);
    return res.status(200).json({ replies, debug, total_emails_checked: allMessageIds.size });

  } catch (err) {
    console.error('check-gc-replies error:', err);
    return res.status(500).json({ error: err.message, replies: [] });
  }
}
