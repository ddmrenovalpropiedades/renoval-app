const VERIFY_TOKEN = process.env.WHATSAPP_VERIFY_TOKEN;
const ACCESS_TOKEN = process.env.WHATSAPP_ACCESS_TOKEN;
const PHONE_NUMBER_ID = process.env.WHATSAPP_PHONE_NUMBER_ID;

const PORTAL_TRIGGER = 'preguntas sobre departamento';

const normalize = (str) =>
  String(str).toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '');

async function sendMessage(to, body) {
  await fetch(`https://graph.facebook.com/v20.0/${PHONE_NUMBER_ID}/messages`, {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${ACCESS_TOKEN}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      messaging_product: 'whatsapp',
      to,
      type: 'text',
      text: { body },
    }),
  });
}

async function sendMenu(to) {
  const mensaje =
    `¡Hola! 👋 Gracias por contactar a *Renoval Propiedades*.\n\n` +
    `Para ayudarte mejor, selecciona una opción:\n\n` +
    `1️⃣ Agendar visita\n` +
    `2️⃣ Más información de la propiedad\n` +
    `3️⃣ Hablar con un ejecutivo\n\n` +
    `Responde con el número de tu opción.`;
  await sendMessage(to, mensaje);
}

async function handleMessage(message, contact) {
  const from = message.from;
  const text = message.text?.body || '';
  const textNorm = normalize(text);

  // Primera interacción desde el portal
  if (textNorm.includes(normalize(PORTAL_TRIGGER))) {
    await sendMenu(from);
    return;
  }

  // Respuestas al menú
  const trimmed = text.trim();
  if (trimmed === '1') {
    await sendMessage(from,
      `📅 *Agendar visita*\n\nPor favor indícanos:\n- Tu nombre\n- Días y horarios de preferencia\n\nUn ejecutivo confirmará la visita a la brevedad.`
    );
    return;
  }
  if (trimmed === '2') {
    await sendMessage(from,
      `🏠 *Más información*\n\nCon gusto te enviamos más detalles de la propiedad. Un ejecutivo se pondrá en contacto contigo pronto.`
    );
    return;
  }
  if (trimmed === '3') {
    await sendMessage(from,
      `👤 *Conectando con ejecutivo...*\n\nEn breve uno de nuestros ejecutivos continuará esta conversación. ¡Gracias por tu paciencia!`
    );
    return;
  }
}

export default async function handler(req, res) {
  if (req.method === 'GET') {
    const mode      = req.query['hub.mode'];
    const token     = req.query['hub.verify_token'];
    const challenge = req.query['hub.challenge'];
    if (mode === 'subscribe' && token === VERIFY_TOKEN) {
      return res.status(200).send(challenge);
    }
    return res.status(403).end();
  }

  if (req.method === 'POST') {
    const body = req.body;
    const entry = body?.entry?.[0];
    const changes = entry?.changes?.[0];
    const value = changes?.value;
    const messages = value?.messages;
    const contacts = value?.contacts;

    if (messages && messages.length > 0) {
      const message = messages[0];
      const contact = contacts?.[0];
      if (message.type === 'text') {
        await handleMessage(message, contact);
      }
    }

    return res.status(200).json({ status: 'ok' });
  }

  res.status(405).end();
}
