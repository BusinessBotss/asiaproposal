"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
require("dotenv/config");
const express_1 = __importDefault(require("express"));
const cors_1 = __importDefault(require("cors"));
const zod_1 = require("zod");
const jsonwebtoken_1 = __importDefault(require("jsonwebtoken"));
const pg_1 = require("pg");
const uuid_1 = require("uuid");
const firebase_admin_1 = __importDefault(require("firebase-admin"));
const app = (0, express_1.default)();
app.use((0, cors_1.default)());
app.use(express_1.default.json());
const pool = new pg_1.Pool({ connectionString: process.env.DATABASE_URL });
const JWT_SECRET = process.env.JWT_SECRET || 'changeme';
// Firebase Admin init
if (!firebase_admin_1.default.apps.length) {
    try {
        firebase_admin_1.default.initializeApp({
            credential: firebase_admin_1.default.credential.cert({
                projectId: process.env.FIREBASE_PROJECT_ID,
                clientEmail: process.env.FIREBASE_CLIENT_EMAIL,
                privateKey: (process.env.FIREBASE_PRIVATE_KEY || '').replace(/\\n/g, '\n'),
            })
        });
    }
    catch (e) {
        // eslint-disable-next-line no-console
        console.warn('Firebase Admin not initialized. Check env vars.');
    }
}
function authenticateJWT(req, res, next) {
    const authHeader = req.headers['authorization'];
    if (!authHeader)
        return res.status(401).json({ error: 'No token' });
    const token = authHeader.split(' ')[1];
    try {
        const decoded = jsonwebtoken_1.default.verify(token, JWT_SECRET);
        req.user = decoded;
        next();
    }
    catch (err) {
        return res.status(401).json({ error: 'Invalid token' });
    }
}
function authorizeRoles(allowed) {
    return (req, res, next) => {
        const user = req.user;
        if (!user || !allowed.includes(user.role)) {
            return res.status(403).json({ error: 'Forbidden' });
        }
        next();
    };
}
const COMMAND_SYNONYMS = {
    chef: 'chef',
    cocinero: 'cocinero',
    kitchen: 'kitchen'
};
const commandSchema = zod_1.z.object({
    input: zod_1.z.string().min(3),
});
function parseCommand(input) {
    // Syntax: /chef[restaurante-id]: mensaje
    const match = input.match(/^\/(\w+?)\[(.+?)\]:\s*(.+)$/i);
    if (!match)
        return null;
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
    const schema = zod_1.z.object({ idToken: zod_1.z.string() });
    const parse = schema.safeParse(req.body);
    if (!parse.success)
        return res.status(400).json({ error: 'Invalid payload' });
    try {
        const decoded = await firebase_admin_1.default.auth().verifyIdToken(parse.data.idToken);
        const uid = decoded.uid;
        const result = await pool.query('SELECT uid, role, restaurants FROM users WHERE uid = $1', [uid]);
        if (result.rowCount === 0)
            return res.status(403).json({ error: 'User not provisioned' });
        const user = {
            uid,
            role: result.rows[0].role,
            restaurants: result.rows[0].restaurants || []
        };
        const token = jsonwebtoken_1.default.sign(user, JWT_SECRET, { expiresIn: '8h' });
        res.json({ token, user });
    }
    catch (e) {
        res.status(401).json({ error: 'Invalid Firebase token' });
    }
});
app.post('/api/commands', authenticateJWT, authorizeRoles(['GM', 'SuperAdmin']), async (req, res) => {
    const parse = commandSchema.safeParse(req.body);
    if (!parse.success)
        return res.status(400).json({ error: 'Invalid payload' });
    const { input } = parse.data;
    const parsed = parseCommand(input);
    if (!parsed)
        return res.status(400).json({ error: 'Invalid command syntax' });
    const { target, restaurantId, message } = parsed;
    const id = (0, uuid_1.v4)();
    const status = 'enviado';
    try {
        await pool.query('INSERT INTO command_logs (id, restaurant_id, role, target, message, status, created_at) VALUES ($1,$2,$3,$4,$5,$6, NOW())', [id, restaurantId, req.user.role, target, message, status]);
    }
    catch (e) {
        return res.status(500).json({ error: 'DB error' });
    }
    // Notify bot service
    try {
        await fetch(`${process.env.BOT_URL || 'http://bot:4500'}/dispatch`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ id, restaurantId, target, message })
        });
    }
    catch (_) { }
    return res.json({ id, target, restaurantId, message, status });
});
app.get('/api/logs', authenticateJWT, authorizeRoles(['GM', 'Staff', 'SuperAdmin']), async (req, res) => {
    const { restaurantId, from, to, role, status } = req.query;
    const conditions = [];
    const values = [];
    if (restaurantId) {
        values.push(restaurantId);
        conditions.push(`restaurant_id = $${values.length}`);
    }
    if (role) {
        values.push(role);
        conditions.push(`role = $${values.length}`);
    }
    if (status) {
        values.push(status);
        conditions.push(`status = $${values.length}`);
    }
    if (from) {
        values.push(from);
        conditions.push(`created_at >= $${values.length}`);
    }
    if (to) {
        values.push(to);
        conditions.push(`created_at <= $${values.length}`);
    }
    const where = conditions.length ? `WHERE ${conditions.join(' AND ')}` : '';
    try {
        const result = await pool.query(`SELECT * FROM command_logs ${where} ORDER BY created_at DESC LIMIT 500`, values);
        res.json(result.rows);
    }
    catch (e) {
        res.status(500).json({ error: 'DB error' });
    }
});
app.get('/api/logs/export', authenticateJWT, authorizeRoles(['GM', 'SuperAdmin']), async (req, res) => {
    const result = await pool.query('SELECT * FROM command_logs ORDER BY created_at DESC LIMIT 2000');
    const rows = result.rows;
    const header = ['id', 'restaurant_id', 'role', 'target', 'message', 'status', 'error_message', 'created_at', 'updated_at'];
    const csv = [header.join(',')].concat(rows.map((r) => header.map(h => JSON.stringify(r[h] ?? '')).join(','))).join('\n');
    res.setHeader('Content-Type', 'text/csv');
    res.setHeader('Content-Disposition', 'attachment; filename="logs.csv"');
    res.send(csv);
});
app.post('/api/restaurants', authenticateJWT, authorizeRoles(['SuperAdmin']), async (req, res) => {
    const schema = zod_1.z.object({ id: zod_1.z.string(), name: zod_1.z.string(), locale: zod_1.z.string().default('es') });
    const parse = schema.safeParse(req.body);
    if (!parse.success)
        return res.status(400).json({ error: 'Invalid body' });
    try {
        await pool.query('INSERT INTO restaurants (id, name, locale) VALUES ($1,$2,$3) ON CONFLICT (id) DO UPDATE SET name = EXCLUDED.name, locale = EXCLUDED.locale', [parse.data.id, parse.data.name, parse.data.locale]);
        res.json({ ok: true });
    }
    catch (e) {
        res.status(500).json({ error: 'DB error' });
    }
});
app.post('/api/users', authenticateJWT, authorizeRoles(['SuperAdmin']), async (req, res) => {
    const schema = zod_1.z.object({ uid: zod_1.z.string(), role: zod_1.z.enum(['GM', 'Staff', 'SuperAdmin']), restaurants: zod_1.z.array(zod_1.z.string()) });
    const parse = schema.safeParse(req.body);
    if (!parse.success)
        return res.status(400).json({ error: 'Invalid body' });
    try {
        await pool.query('INSERT INTO users (uid, role, restaurants) VALUES ($1,$2,$3) ON CONFLICT (uid) DO UPDATE SET role=EXCLUDED.role, restaurants=EXCLUDED.restaurants', [parse.data.uid, parse.data.role, parse.data.restaurants]);
        res.json({ ok: true });
    }
    catch (e) {
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
