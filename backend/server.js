require('dotenv').config();
const express = require('express');
const cors = require('cors');
const axios = require('axios');
const mongoose = require('mongoose');
const jwt = require('jsonwebtoken');

const app = express();
app.use(cors());
app.use(express.json());

const MONGODB_URI = process.env.MONGODB_URI;
if (MONGODB_URI) {
  mongoose
    .connect(MONGODB_URI)
    .then(() => console.log('Mongo connected'))
    .catch((error) => console.error('Mongo error', error.message));
}

const authenticateJWT = (req, res, next) => {
  const authHeader = req.headers.authorization;
  if (!authHeader) {
    return res.sendStatus(401);
  }
  const token = authHeader.split(' ')[1];
  jwt.verify(token, process.env.JWT_SECRET || 'dev_secret', (err, user) => {
    if (err) return res.sendStatus(403);
    req.user = user;
    next();
  });
};

const mockCrm = [
  {
    location: 'NY',
    role: 'Manager',
    name: 'Site A',
    address: '1 Main St',
    workers: [{ name: 'Alice', phone: '+11234567890' }],
  },
  {
    location: 'SF',
    role: 'Worker',
    name: 'Site B',
    address: '2 Market St',
    workers: [{ name: 'Bob', phone: '+19998887777' }],
  },
];

app.get('/api/crm', async (req, res) => {
  const { location, role } = req.query;
  if (!location || !role) {
    return res.status(400).json({ error: 'location and role required' });
  }

  try {
    let data = null;
    if (mongoose.connection.readyState === 1) {
      const Crm = require('./models/Crm');
      data = await Crm.findOne({ location, role }).lean();
    }
    if (!data) {
      data =
        mockCrm.find((c) => c.location === location && c.role === role) ||
        { name: 'Unknown', address: '', workers: [] };
    }
    res.json(data);
  } catch (error) {
    res.status(500).json({ error: 'server_error' });
  }
});

async function sendWhatsAppMessage(recipients, text) {
  const token = process.env.WHATSAPP_TOKEN;
  const phoneId = process.env.WHATSAPP_PHONE_NUMBER_ID;
  if (!(token && phoneId)) {
    return { status: 'mock', sent: recipients.length };
  }

  const url = `https://graph.facebook.com/v19.0/${phoneId}/messages`;
  const results = [];
  for (const recipient of recipients) {
    try {
      const response = await axios.post(
        url,
        {
          messaging_product: 'whatsapp',
          to: recipient,
          type: 'text',
          text: { body: text },
        },
        {
          headers: {
            Authorization: `Bearer ${token}`,
            'Content-Type': 'application/json',
          },
        }
      );
      results.push({ to: recipient, id: response.data.messages?.[0]?.id || null });
    } catch (error) {
      results.push({ to: recipient, error: error.response?.data || error.message });
    }
  }
  return { status: 'ok', results };
}

// app.post('/api/send', authenticateJWT, async (req, res) => {
app.post('/api/send', async (req, res) => {
  const { message, recipients } = req.body;
  if (!message || !Array.isArray(recipients)) {
    return res.status(400).json({ error: 'invalid_payload' });
  }
  const outcome = await sendWhatsAppMessage(recipients, message);
  res.json(outcome);
});

const port = process.env.PORT || 5000;
app.listen(port, () => console.log('Server running on', port));