import nodemailer from 'nodemailer';

export default async function handler(req, res) {
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });

  const authHeader = req.headers['authorization'];
  if (authHeader !== `Bearer ${process.env.CRON_SECRET}`) {
    return res.status(401).json({ error: 'Unauthorized' });
  }

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
