require('dotenv').config();
const express = require('express');
const cors = require('cors');
const datasetRoutes = require('./routes/datasets');
const { pool, DATABASE_URL } = require('./services/pg');
const { initDb } = require('./services/db');

const app = express();
const PORT = process.env.PORT || 3001;

// Middleware
app.use(cors({
  origin: ['http://localhost:5173', 'http://localhost:3000', 'http://127.0.0.1:5173'],
  methods: ['GET', 'POST', 'PUT', 'DELETE'],
  credentials: true,
}));
app.use(express.json({ limit: '10mb' }));

// Routes
app.use('/api/datasets', datasetRoutes);

// Health check
app.get('/api/health', async (req, res) => {
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

// Root — endpoint index
app.get('/', (req, res) => {
  res.json({
    name: 'Research Data Provenance System',
    version: '1.0.0',
    endpoints: [
      'GET  /api/health',
      'GET  /api/datasets',
      'GET  /api/datasets/stats',
      'GET  /api/datasets/search?q=query',
      'GET  /api/datasets/verify/:hash',
      'GET  /api/datasets/:id',
      'GET  /api/datasets/:id/versions',
      'POST /api/datasets/register',
      'POST /api/datasets/update',
      'POST /api/datasets/hash',
    ],
  });
});

// ─── Connect to Supabase Postgres then start server ─────────────────────────
async function start() {
  try {
    await pool.query('SELECT 1');
    const host = new URL(DATABASE_URL).host;
    console.log(`Supabase Postgres connected -> ${host}`);

    // Create tables (idempotent) and seed demo data on first run
    await initDb();

    app.listen(PORT, () => {
      console.log(`\nResearch Data Provenance API`);
      console.log(`   Server:  http://localhost:${PORT}`);
      console.log(`   DB:      Supabase Postgres (${host})`);
      console.log(`   Network: Solana Devnet\n`);
    });
  } catch (err) {
    console.error('Failed to connect to Supabase Postgres:', err.message);
    process.exit(1);
  }
}

start();
