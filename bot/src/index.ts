import 'dotenv/config';
import express from 'express';
import cors from 'cors';

const app = express();
app.use(cors());
app.use(express.json());

const VERIFY_TOKEN = process.env.WHATSAPP_VERIFY_TOKEN || 'verify';
const PHONE_NUMBER_ID = process.env.WHATSAPP_PHONE_NUMBER_ID || '';
const TOKEN = process.env.WHATSAPP_TOKEN || '';

async function sendWhatsAppMessage(to: string, text: string) {
  const url = `https://graph.facebook.com/v21.0/${PHONE_NUMBER_ID}/messages`;
  const res = await fetch(url, {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${TOKEN}`,
      'Content-Type': 'application/json'
    },
    body: JSON.stringify({
      messaging_product: 'whatsapp',
      to,
      type: 'text',
      text: { body: text }
    })
  });
  if (!res.ok) {
    const body = await res.text();
    throw new Error(`WhatsApp API error: ${res.status} ${body}`);
  }
}

app.get('/webhook', (req, res) => {
  const mode = req.query['hub.mode'];
  const token = req.query['hub.verify_token'];
  const challenge = req.query['hub.challenge'];
  if (mode === 'subscribe' && token === VERIFY_TOKEN) {
    res.status(200).send(challenge);
  } else {
    res.sendStatus(403);
  }
});

app.post('/webhook', async (req, res) => {
  // Incoming messages/events handler placeholder
  res.sendStatus(200);
});

app.post('/dispatch', async (req, res) => {
  const { id, restaurantId, target, message } = req.body || {};
  if (!message) return res.status(400).json({ error: 'Missing message' });
  // In real-world, resolve destination numbers by restaurant/target
  const recipients = ['15551234567'];

  const maxRetries = 3;
  for (const to of recipients) {
    let attempt = 0;
    while (attempt < maxRetries) {
      try {
        await sendWhatsAppMessage(to, message);
        break;
      } catch (err) {
        attempt += 1;
        if (attempt >= maxRetries) {
          return res.status(500).json({ error: 'Failed to deliver', details: String(err) });
        }
        await new Promise((r) => setTimeout(r, Math.pow(2, attempt) * 500));
      }
    }
  }
  res.json({ ok: true, id, restaurantId, target });
});

const port = Number(process.env.PORT || 4500);
app.listen(port, () => {
  // eslint-disable-next-line no-console
  console.log(`Bot listening on ${port}`);
});