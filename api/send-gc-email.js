import nodemailer from 'nodemailer';
import { createClient } from '@supabase/supabase-js';

// Ajusta el nombre de esta env var si en tu proyecto el cliente admin
// de Supabase usa otro nombre (ej. si en create-mirror-task.js está
// como algo distinto a SUPABASE_URL, iguálalo aquí).
const supabaseAdmin = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

// ── Remitentes disponibles para el módulo Mailing (OAuth) ───────
// Cada uno necesita su propio refresh token con scope
// https://www.googleapis.com/auth/gmail.send (independiente del
// refresh token de solo-lectura que ya usa gmail-proxy.js, para no
// tocar esa funcionalidad). AM todavía no tiene cuenta configurada:
// cuando la tenga, se agrega su entrada acá y la variable de entorno
// GMAIL_SEND_REFRESH_TOKEN_AM en Vercel.
const MAILING_SENDERS = {
  DD: { email: 'ddm@renovalpropiedades.com', refreshToken: process.env.GMAIL_SEND_REFRESH_TOKEN_DD },
  FD: { email: 'fdm@renovalpropiedades.com', refreshToken: process.env.GMAIL_SEND_REFRESH_TOKEN_FD },
  EA: { email: 'edith@renovalpropiedades.com', refreshToken: process.env.GMAIL_SEND_REFRESH_TOKEN_EA },
  FG: { email: 'fernanda@renovalpropiedades.com', refreshToken: process.env.GMAIL_SEND_REFRESH_TOKEN_FG },
};

// Cuentas habilitadas para disparar mailings masivos (mismo criterio
// que profile.isOwner en el front: DD y FD).
const MAILING_ADMIN_EMAILS = ['ddm@renovalpropiedades.com', 'fdm@renovalpropiedades.com'];

const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

// ── Helpers OAuth / Gmail API (mismo patrón que gmail-proxy.js) ──
async function getAccessToken(refreshToken) {
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
    throw new Error(`No se pudo obtener access token: ${JSON.stringify(tokenData)}`);
  }
  return tokenData.access_token;
}

function encodeSubject(subject) {
  return `=?UTF-8?B?${Buffer.from(subject || '', 'utf-8').toString('base64')}?=`;
}

function buildRawMessage({ fromEmail, to, cc, subject, text }) {
  const headers = [
    `From: "Renoval Propiedades" <${fromEmail}>`,
    `To: ${to.join(', ')}`,
  ];
  if (cc && cc.length > 0) headers.push(`Cc: ${cc.join(', ')}`);
  headers.push(`Subject: ${encodeSubject(subject)}`);
  headers.push('MIME-Version: 1.0');
  headers.push('Content-Type: text/plain; charset="UTF-8"');
  headers.push('Content-Transfer-Encoding: base64');

  const body = Buffer.from(text || '', 'utf-8').toString('base64');
  const raw = `${headers.join('\r\n')}\r\n\r\n${body}`;

  return Buffer.from(raw)
    .toString('base64')
    .replace(/\+/g, '-')
    .replace(/\//g, '_')
    .replace(/=+$/, '');
}

async function sendViaGmailApi(refreshToken, { fromEmail, to, cc, subject, text }) {
  const accessToken = await getAccessToken(refreshToken);
  const raw = buildRawMessage({ fromEmail, to, cc, subject, text });

  const res = await fetch('https://gmail.googleapis.com/gmail/v1/users/me/messages/send', {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${accessToken}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({ raw }),
  });
  const data = await res.json();
  if (!res.ok) {
    throw new Error(data.error?.message || `Error enviando con Gmail API (HTTP ${res.status})`);
  }
  return data;
}

export default async function handler(req, res) {
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });

  const authHeader = req.headers['authorization'];
  if (authHeader !== `Bearer ${process.env.CRON_SECRET}`) {
    return res.status(401).json({ error: 'Unauthorized' });
  }

  const { mode } = req.body || {};

  if (mode === 'mailing') {
    return handleMailing(req, res);
  }

  return handleGcEmail(req, res);
}

// ── Consulta GC (comportamiento original — sin cambios) ─────────
async function handleGcEmail(req, res) {
  const { propiedad, mailAdmin, mesLabel, isTest } = req.body;
  if (!propiedad || !mailAdmin) return res.status(400).json({ error: 'Missing fields' });

  const transporter = nodemailer.createTransport({
    service: 'gmail',
    auth: {
      user: 'gcrenovalpropiedades@gmail.com',
      pass: process.env.GMAIL_APP_PASSWORD,
    },
  });

  const asunto = `${isTest ? '[PRUEBA] ' : ''}Consulta Gasto Común ${mesLabel}`;
  const cuerpo = `Buenos días,

Junto con saludar, quería solicitar el saldo de gasto común de la siguiente propiedad:
${propiedad}

Quedo atento a su respuesta,

Saludos`;

  try {
    await transporter.sendMail({
      from: '"Renoval Propiedades" <gcrenovalpropiedades@gmail.com>',
      to: mailAdmin,
      cc: 'edith@renovalpropiedades.com',
      subject: asunto,
      text: cuerpo,
    });
    return res.status(200).json({ ok: true });
  } catch (err) {
    console.error('Error sending email:', err);
    return res.status(500).json({ error: err.message });
  }
}

// ── Mailing masivo (módulo Mailing) — envía vía Gmail API/OAuth ──
// El frontend divide el envío en lotes (para no exceder el tiempo
// máximo de ejecución de la función serverless) y llama a este
// endpoint una vez por lote, todas con el mismo campaignId. El
// primer lote (isFirstBatch) crea la fila en mailing_log; los
// siguientes la van completando.
//
// Payload esperado por lote:
// {
//   mode: 'mailing',
//   triggeredBy: 'ddm@renovalpropiedades.com',
//   campaignId: 'uuid-generado-en-el-front',
//   isFirstBatch: true/false,
//   destino: 'propietarios' | 'administraciones' | 'ambos',
//   remitenteModo: 'fijo' | 'e1' | 'e2',
//   remitenteFijo: 'DD' | 'FD' | 'EA' | 'FG' | null,
//   cc: ['correo@ejemplo.com', ...],
//   asuntoTemplate: '...',   // se guarda tal cual en el historial
//   cuerpoTemplate: '...',   // se guarda tal cual en el historial
//   jobs: [
//     { to: ['correo@x.com'], from: 'DD', subject: '...', text: '...', propiedad: '...', propietario: '...' },
//     ...
//   ]
// }
async function handleMailing(req, res) {
  const {
    triggeredBy,
    campaignId,
    isFirstBatch,
    destino,
    remitenteModo,
    remitenteFijo,
    cc,
    asuntoTemplate,
    cuerpoTemplate,
    jobs,
  } = req.body || {};

  if (!MAILING_ADMIN_EMAILS.includes(triggeredBy)) {
    return res.status(403).json({ error: 'No autorizado para enviar mailings masivos.' });
  }
  if (!campaignId) {
    return res.status(400).json({ error: 'Falta campaignId.' });
  }
  if (!Array.isArray(jobs) || jobs.length === 0) {
    return res.status(400).json({ error: 'No hay destinatarios para enviar en este lote.' });
  }

  const results = [];

  for (const job of jobs) {
    const { to, from, subject, text, propiedad, propietario } = job || {};

    if (!Array.isArray(to) || to.length === 0) {
      results.push({ propiedad, propietario, from, ok: false, error: 'Sin destinatario' });
      continue;
    }

    const sender = MAILING_SENDERS[from];
    if (!sender || !sender.refreshToken) {
      results.push({ propiedad, propietario, from, ok: false, error: `Remitente ${from} no configurado` });
      continue;
    }

    try {
      await sendViaGmailApi(sender.refreshToken, {
        fromEmail: sender.email,
        to,
        cc,
        subject,
        text,
      });
      results.push({ propiedad, propietario, from: sender.email, to, ok: true });
    } catch (err) {
      results.push({ propiedad, propietario, from: sender.email, to, ok: false, error: err.message });
    }

    // Pausa breve entre envíos para no gatillar límites de Gmail
    await sleep(200);
  }

  const totalEnviados = results.filter((r) => r.ok).length;
  const totalFallidos = results.filter((r) => !r.ok).length;

  try {
    if (isFirstBatch) {
      await supabaseAdmin.from('mailing_log').insert({
        id: campaignId,
        created_by: triggeredBy,
        destino: destino || null,
        remitente_modo: remitenteModo || null,
        remitente_fijo: remitenteFijo || null,
        asunto: asuntoTemplate || null,
        cuerpo: cuerpoTemplate || null,
        cc: cc || [],
        total_enviados: totalEnviados,
        total_fallidos: totalFallidos,
        destinatarios: results,
      });
    } else {
      const { data: existing } = await supabaseAdmin
        .from('mailing_log')
        .select('destinatarios, total_enviados, total_fallidos')
        .eq('id', campaignId)
        .single();
      const prevDestinatarios = existing?.destinatarios || [];
      await supabaseAdmin
        .from('mailing_log')
        .update({
          destinatarios: [...prevDestinatarios, ...results],
          total_enviados: (existing?.total_enviados || 0) + totalEnviados,
          total_fallidos: (existing?.total_fallidos || 0) + totalFallidos,
        })
        .eq('id', campaignId);
    }
  } catch (logErr) {
    console.error('No se pudo actualizar el historial de mailing:', logErr);
  }

  return res.status(200).json({ results, totalEnviados, totalFallidos });
}
