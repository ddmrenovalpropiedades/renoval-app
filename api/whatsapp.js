export default async function handler(req, res) {
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

  if (req.method === 'POST') {
    console.log('=== MENSAJE RECIBIDO ===');
    console.log(JSON.stringify(req.body, null, 2));
    console.log('=======================');
    return res.status(200).json({ status: 'ok' });
  }

  res.status(405).end();
}
