export default async function handler(req, res) {
  // Verificación del webhook (GET) — Meta llama esto una vez para confirmar
  if (req.method === 'GET') {
    const mode      = req.query['hub.mode'];
    const token     = req.query['hub.verify_token'];
    const challenge = req.query['hub.challenge'];

    if (mode === 'subscribe' && token === process.env.WHATSAPP_VERIFY_TOKEN) {
      console.log('Webhook verificado');
      return res.status(200).send(challenge);
    }
    return res.status(403).end();
  }

  // Recepción de mensajes (POST) — aquí llega cada mensaje
  if (req.method === 'POST') {
    const body = req.body;
    console.log('Mensaje recibido:', JSON.stringify(body, null, 2));
    // Por ahora solo confirmamos recepción
    return res.status(200).json({ status: 'ok' });
  }

  res.status(405).end();
}
