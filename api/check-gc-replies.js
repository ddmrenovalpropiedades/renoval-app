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
      } catch(e) { console.error('Error getting attachment:', e.message); }
    }
    if (part.parts) pdfs.push(...await getPdfAttachments(gmail, messageId, part));
  }
  return pdfs;
}

async function extractGCFromPdf(pdfBase64, propiedad) {
  try {
    const response = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-api-key': process.env.ANTHROPIC_API_KEY,
        'anthropic-version': '2023-06-01',
      },
      body: JSON.stringify({
        model: 'claude-sonnet-4-20250514',
        max_tokens: 500,
        messages: [{
          role: 'user',
          content: [
            {
              type: 'document',
              source: {
                type: 'base64',
                media_type: 'application/pdf',
                data: pdfBase64.replace(/-/g, '+').replace(/_/g, '/'),
              },
            },
            {
              type: 'text',
              text: `Este PDF es un estado de cuenta de gasto común para la propiedad "${propiedad}". 
Extrae el monto total a pagar del gasto común. 
Responde ÚNICAMENTE con el número en formato chileno, por ejemplo: $85.430 
Si no puedes encontrar el valor, responde: NO_ENCONTRADO`,
            },
          ],
        }],
      }),
    });
    const data = await response.json();
    console.log('PDF extraction response:', JSON.stringify(data.content));
    const text = data.content?.[0]?.text?.trim() || 'NO_ENCONTRADO';
    return text === 'NO_ENCONTRADO' ? null : text;
  } catch(e) {
    console.error('extractGCFromPdf error:', e.message);
    return null;
  }
}

export default async function handler(req, res) {
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });

  const authHeader = req.headers['authorization'];
  if (authHeader !== `Bearer ${process.env.CRON_SECRET}`) {
    return res.status(401).json({ error: 'Unauthorized' });
  }

  const { mes, propiedades, enviado_desde } = req.body;
  if (!mes) return res.status(400).json({ error: 'Missing mes' });

  try {
    const gmail = getGmailClient();

    // Only look for emails received after the send date (or start of current month)
    const afterDate = enviado_desde
      ? new Date(enviado_desde)
      : new Date(`${mes}-01T00:00:00Z`);
    const afterTimestamp = Math.floor(afterDate.getTime() / 1000);

    // Search only emails received after send date, with PDF attachments
    const query = `in:inbox has:attachment filename:pdf after:${afterTimestamp}`;
    console.log('Gmail query:', query);

    const listRes = await gmail.users.messages.list({
      userId: GMAIL_USER,
      q: query,
      maxResults: 50,
    });

    const messages = listRes.data.messages || [];
    console.log(`Found ${messages.length} messages`);
    const replies = [];

    for (const msg of messages) {
      const full = await gmail.users.messages.get({
        userId: GMAIL_USER, id: msg.id, format: 'full',
      });

      const headers = full.data.payload.headers || [];
      const subject = headers.find(h => h.name === 'Subject')?.value || '';
      const date = headers.find(h => h.name === 'Date')?.value || '';
      const receivedAt = new Date(date).toISOString();

      // Debug: log payload structure
      console.log('Message ID:', msg.id, 'Subject:', subject);
      console.log('Payload mimeType:', full.data.payload.mimeType);
      console.log('Parts:', JSON.stringify((full.data.payload.parts || []).map(p => ({
        mimeType: p.mimeType,
        filename: p.filename,
        hasAttachmentId: !!p.body?.attachmentId,
        hasData: !!p.body?.data,
        partsCount: p.parts?.length || 0,
      }))));

      const pdfs = await getPdfAttachments(gmail, msg.id, full.data.payload);
      console.log('PDFs found:', pdfs.length, pdfs.map(p => p.filename));
      if (!pdfs.length) continue;

      const body = getTextBody(full.data.payload);
      const combined = (subject + ' ' + body).toLowerCase();
      console.log('Checking email subject:', subject);

      // Match against our propiedades list
      let matchedProp = null;
      let bestScore = 0;

      if (propiedades?.length) {
        for (const prop of propiedades) {
          const words = prop.toLowerCase()
            .split(/\s+/)
            .filter(w => w.length > 3 && !/^(departamento|depto|casa|oficina)$/i.test(w));
          const matchCount = words.filter(w => combined.includes(w)).length;
          const score = words.length > 0 ? matchCount / words.length : 0;
          if (score > bestScore && score >= 0.5) {
            bestScore = score;
            matchedProp = prop;
          }
        }
      }

      console.log(`Matched: ${matchedProp} (score: ${bestScore})`);
      if (!matchedProp) continue;

      // Extract GC value from first PDF
      const gcValor = await extractGCFromPdf(pdfs[0].data, matchedProp);
      console.log(`GC valor for ${matchedProp}: ${gcValor}`);

      replies.push({
        propiedad: matchedProp,
        gc_valor: gcValor,
        respondido_at: receivedAt,
        gmail_message_id: msg.id,
      });
    }

    return res.status(200).json({ replies });
  } catch (err) {
    console.error('check-gc-replies error:', err);
    return res.status(500).json({ error: err.message, replies: [] });
  }
}
