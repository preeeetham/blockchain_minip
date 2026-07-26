// Vercel Serverless Function — wraps the Express API for /api/* routes.
// Vercel injects env vars automatically; dotenv is only needed locally.
if (!process.env.VERCEL) {
  require('dotenv').config({ path: require('path').join(__dirname, '..', 'backend', '.env') });
}

const express = require('express');
const cors = require('cors');
const datasetRoutes = require('../backend/routes/datasets');
const { pool } = require('../backend/services/pg');
const { initDb } = require('../backend/services/db');

const app = express();

// ─── CORS ───────────────────────────────────────────────────────────────────
app.use(cors({
  origin: [
    'http://localhost:5173',
    'http://localhost:3000',
    /\.vercel\.app$/,
  ],
  methods: ['GET', 'POST', 'PUT', 'DELETE'],
  credentials: true,
}));

app.use(express.json({ limit: '10mb' }));

// ─── Cold-start DB init (runs once per instance) ────────────────────────────
let initialized = false;
const initPromise = initDb()
  .then(() => { initialized = true; })
  .catch((err) => console.error('DB init failed:', err.message));

app.use(async (_req, _res, next) => {
  if (!initialized) await initPromise;
  next();
});

// ─── Routes ─────────────────────────────────────────────────────────────────
app.use('/api/datasets', datasetRoutes);

app.get('/api/health', async (_req, res) => {
  let database = 'disconnected';
  try {
    await pool.query('SELECT 1');
    database = 'connected';
  } catch {
    database = 'disconnected';
  }
  res.json({
    status: 'ok',
    service: 'Research Provenance API',
    network: 'Solana Devnet',
    database,
    timestamp: new Date().toISOString(),
  });
});

module.exports = app;
