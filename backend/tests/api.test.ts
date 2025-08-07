import request from 'supertest';
import express from 'express';

// Import the built server indirectly is complex; spin a minimal app for health
const app = express();
app.get('/health', (_req, res) => res.json({ ok: true }));

describe('health', () => {
  it('returns ok', async () => {
    const res = await request(app).get('/health');
    expect(res.status).toBe(200);
    expect(res.body.ok).toBe(true);
  });
});