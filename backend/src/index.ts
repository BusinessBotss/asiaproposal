import 'dotenv/config';
import express from 'express';
import cors from 'cors';
import { z } from 'zod';
import jwt from 'jsonwebtoken';
import { Pool } from 'pg';
import { v4 as uuidv4 } from 'uuid';
import type { CommandLog, UserRole } from './types';
import admin from 'firebase-admin';

const app = express();
app.use(cors());
app.use(express.json());

const pool = new Pool({ connectionString: process.env.DATABASE_URL });

const JWT_SECRET = process.env.JWT_SECRET || 'changeme';

// Firebase Admin init
if (!admin.apps.length) {
  try {
    admin.initializeApp({
      credential: admin.credential.cert({
        projectId: process.env.FIREBASE_PROJECT_ID as string,
        clientEmail: process.env.FIREBASE_CLIENT_EMAIL as string,
        privateKey: (process.env.FIREBASE_PRIVATE_KEY || '').replace(/\\n/g, '\n'),
      })
    });
  } catch (e) {
    // eslint-disable-next-line no-console
    console.warn('Firebase Admin not initialized. Check env vars.');
  }
}

interface AuthUser {
  uid: string;
  role: UserRole;
  restaurants: string[];
}

interface AuthedRequest extends express.Request { user?: AuthUser }
function authenticateJWT(req: AuthedRequest, res: express.Response, next: express.NextFunction) {
  const authHeader = req.headers['authorization'];
  if (!authHeader) return res.status(401).json({ error: 'No token' });
  const token = authHeader.split(' ')[1];
  try {
    const decoded = jwt.verify(token, JWT_SECRET) as AuthUser;
    req.user = decoded;
    next();
  } catch (err) {
    return res.status(401).json({ error: 'Invalid token' });
  }
}

function authorizeRoles(allowed: UserRole[]) {
  return (req: AuthedRequest, res: express.Response, next: express.NextFunction) => {
    const user = req.user as AuthUser;
    if (!user || !allowed.includes(user.role)) {
      return res.status(403).json({ error: 'Forbidden' });
    }
    next();
  };
}

const COMMAND_SYNONYMS: Record<string, string> = {
  chef: 'chef',
  cocinero: 'cocinero',
  kitchen: 'kitchen'
};

const commandSchema = z.object({
  input: z.string().min(3),
});

function parseCommand(input: string) {
  // Syntax: /chef[restaurante-id]: mensaje
  const match = input.match(/^\/(\w+?)\[(.+?)\]:\s*(.+)$/i);
  if (!match) return null;
  const [, rawTarget, restaurantId, message] = match;
  const lower = rawTarget.toLowerCase();
  const target = COMMAND_SYNONYMS[lower] ?? lower;
  return { target, restaurantId, message };
}

async function ensureTables() {
  await pool.query(`CREATE TABLE IF NOT EXISTS restaurants (
    id TEXT PRIMARY KEY,
    name TEXT NOT NULL,
    locale TEXT NOT NULL DEFAULT 'es'
  );`);
  await pool.query(`CREATE TABLE IF NOT EXISTS users (
    uid TEXT PRIMARY KEY,
    role TEXT NOT NULL,
    restaurants TEXT[] NOT NULL DEFAULT '{}'::text[]
  );`);
  await pool.query(`CREATE TABLE IF NOT EXISTS command_logs (
    id UUID PRIMARY KEY,
    restaurant_id TEXT NOT NULL REFERENCES restaurants(id) ON DELETE CASCADE,
    role TEXT NOT NULL,
    target TEXT NOT NULL,
    message TEXT NOT NULL,
    status TEXT NOT NULL,
    error_message TEXT,
    created_at TIMESTAMP NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMP
  );`);
}

app.get('/health', (_req, res) => res.json({ ok: true }));

// Exchange Firebase ID token for backend JWT with roles
app.post('/api/auth/exchange', async (req, res) => {
  const schema = z.object({ idToken: z.string() });
  const parse = schema.safeParse(req.body);
  if (!parse.success) return res.status(400).json({ error: 'Invalid payload' });
  try {
    const decoded = await admin.auth().verifyIdToken(parse.data.idToken);
    const uid = decoded.uid;
    const result = await pool.query('SELECT uid, role, restaurants FROM users WHERE uid = $1', [uid]);
    if (result.rowCount === 0) return res.status(403).json({ error: 'User not provisioned' });
    const user: AuthUser = {
      uid,
      role: result.rows[0].role,
      restaurants: result.rows[0].restaurants || []
    };
    const token = jwt.sign(user, JWT_SECRET, { expiresIn: '8h' });
    res.json({ token, user });
  } catch (e) {
    res.status(401).json({ error: 'Invalid Firebase token' });
  }
});

app.post('/api/commands', authenticateJWT, authorizeRoles(['GM', 'SuperAdmin']), async (req: AuthedRequest, res) => {
  const parse = commandSchema.safeParse(req.body);
  if (!parse.success) return res.status(400).json({ error: 'Invalid payload' });
  const { input } = parse.data;
  const parsed = parseCommand(input);
  if (!parsed) return res.status(400).json({ error: 'Invalid command syntax' });

  const { target, restaurantId, message } = parsed;
  const id = uuidv4();
  const status: CommandLog['status'] = 'enviado';
  try {
    await pool.query(
      'INSERT INTO command_logs (id, restaurant_id, role, target, message, status, created_at) VALUES ($1,$2,$3,$4,$5,$6, NOW())',
      [id, restaurantId, (req.user as AuthUser).role, target, message, status]
    );
  } catch (e) {
    return res.status(500).json({ error: 'DB error' });
  }

  // Notify bot service
  try {
    await fetch(`${process.env.BOT_URL || 'http://bot:4500'}/dispatch`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ id, restaurantId, target, message })
    });
  } catch (_) {}

  return res.json({ id, target, restaurantId, message, status });
});

app.get('/api/logs', authenticateJWT, authorizeRoles(['GM', 'Staff', 'SuperAdmin']), async (req, res) => {
  const { restaurantId, from, to, role, status } = req.query as any;
  const conditions: string[] = [];
  const values: any[] = [];
  if (restaurantId) { values.push(restaurantId); conditions.push(`restaurant_id = $${values.length}`); }
  if (role) { values.push(role); conditions.push(`role = $${values.length}`); }
  if (status) { values.push(status); conditions.push(`status = $${values.length}`); }
  if (from) { values.push(from); conditions.push(`created_at >= $${values.length}`); }
  if (to) { values.push(to); conditions.push(`created_at <= $${values.length}`); }
  const where = conditions.length ? `WHERE ${conditions.join(' AND ')}` : '';
  try {
    const result = await pool.query(`SELECT * FROM command_logs ${where} ORDER BY created_at DESC LIMIT 500`, values);
    res.json(result.rows);
  } catch (e) {
    res.status(500).json({ error: 'DB error' });
  }
});

app.get('/api/logs/export', authenticateJWT, authorizeRoles(['GM', 'SuperAdmin']), async (req, res) => {
  const result = await pool.query('SELECT * FROM command_logs ORDER BY created_at DESC LIMIT 2000');
  const rows = result.rows;
  const header = ['id','restaurant_id','role','target','message','status','error_message','created_at','updated_at'];
  const csv = [header.join(',')].concat(rows.map((r: any) => header.map(h => JSON.stringify((r as any)[h] ?? '')).join(','))).join('\n');
  res.setHeader('Content-Type', 'text/csv');
  res.setHeader('Content-Disposition', 'attachment; filename="logs.csv"');
  res.send(csv);
});

app.post('/api/restaurants', authenticateJWT, authorizeRoles(['SuperAdmin']), async (req, res) => {
  const schema = z.object({ id: z.string(), name: z.string(), locale: z.string().default('es') });
  const parse = schema.safeParse(req.body);
  if (!parse.success) return res.status(400).json({ error: 'Invalid body' });
  try {
    await pool.query('INSERT INTO restaurants (id, name, locale) VALUES ($1,$2,$3) ON CONFLICT (id) DO UPDATE SET name = EXCLUDED.name, locale = EXCLUDED.locale',
      [parse.data.id, parse.data.name, parse.data.locale]);
    res.json({ ok: true });
  } catch (e) {
    res.status(500).json({ error: 'DB error' });
  }
});

app.post('/api/users', authenticateJWT, authorizeRoles(['SuperAdmin']), async (req, res) => {
  const schema = z.object({ uid: z.string(), role: z.enum(['GM', 'Staff', 'SuperAdmin']), restaurants: z.array(z.string()) });
  const parse = schema.safeParse(req.body);
  if (!parse.success) return res.status(400).json({ error: 'Invalid body' });
  try {
    await pool.query('INSERT INTO users (uid, role, restaurants) VALUES ($1,$2,$3) ON CONFLICT (uid) DO UPDATE SET role=EXCLUDED.role, restaurants=EXCLUDED.restaurants',
      [parse.data.uid, parse.data.role, parse.data.restaurants]);
    res.json({ ok: true });
  } catch (e) {
    res.status(500).json({ error: 'DB error' });
  }
});

app.post('/api/roles', authenticateJWT, authorizeRoles(['SuperAdmin']), async (_req, res) => {
  res.json({ ok: true });
});

const port = Number(process.env.PORT || 4000);
ensureTables().then(() => {
  app.listen(port, () => {
    // eslint-disable-next-line no-console
    console.log(`Backend listening on ${port}`);
  });
}).catch((e) => {
  // eslint-disable-next-line no-console
  console.error('Failed to ensure tables', e);
  process.exit(1);
});