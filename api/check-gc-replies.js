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
  if (payload.mimeType === 'text/plain' && payload.body?.data) {
    return decodePart(payload.body.data);
  }
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
    if (part.filename && part.filename.toLowerCase().endsWith('.pdf') && part.body?.attachmentId) {
      try {
        const att = await gmail.users.messages.attachments.get({
          userId: GMAIL_USER,
          messageId,
          id: part.body.attachmentId,
        });
        pdfs.push({
          filename: part.filename,
          data: att.data.data, // base64
        });
      } catch(e) {
        console.error('Error getting attachment:', e.message);
      }
    }
    // Recurse into nested parts
    if (part.parts) {
      const nested = await getPdfAttachments(gmail, messageId, part);
      pdfs.push(...nested);
    }
  }
  return pdfs;
}

async function extractGCFromPdf(pdfBase64, propiedad) {
  // Use Anthropic API to extract GC value from PDF
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
  const text = data.content?.[0]?.text?.trim() || 'NO_ENCONTRADO';
  return text === 'NO_ENCONTRADO' ? null : text;
}

export default async function handler(req, res) {
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });

  const authHeader = req.headers['authorization'];
  if (authHeader !== `Bearer ${process.env.CRON_SECRET}`) {
    return res.status(401).json({ error: 'Unauthorized' });
  }

  const { mes, propiedades } = req.body;
  if (!mes) return res.status(400).json({ error: 'Missing mes' });

  try {
    const gmail = getGmailClient();

    // Search for replies in the last 60 days
    const query = 'in:inbox has:attachment filename:pdf';
    const listRes = await gmail.users.messages.list({
      userId: GMAIL_USER,
      q: query,
      maxResults: 50,
    });

    const messages = listRes.data.messages || [];
    const replies = [];

    for (const msg of messages) {
      const full = await gmail.users.messages.get({
        userId: GMAIL_USER,
        id: msg.id,
        format: 'full',
      });

      const headers = full.data.payload.headers || [];
      const subject = headers.find(h => h.name === 'Subject')?.value || '';
      const date = headers.find(h => h.name === 'Date')?.value || '';
      const receivedAt = new Date(date).toISOString();

      // Get PDF attachments
      const pdfs = await getPdfAttachments(gmail, msg.id, full.data.payload);
      if (!pdfs.length) continue;

      // Try to match with a propiedad from our config
      const body = getTextBody(full.data.payload);
      const combined = (subject + ' ' + body).toLowerCase();

      let matchedProp = null;
      if (propiedades && propiedades.length) {
        for (const prop of propiedades) {
          // Normalize and check if propiedad keywords appear in email
          const words = prop.toLowerCase().split(/\s+/).filter(w => w.length > 3);
          const matchCount = words.filter(w => combined.includes(w)).length;
          if (matchCount >= Math.ceil(words.length * 0.5)) {
            matchedProp = prop;
            break;
          }
        }
      }

      if (!matchedProp) continue;

      // Extract GC value from first PDF
      const gcValor = await extractGCFromPdf(pdfs[0].data, matchedProp);

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
