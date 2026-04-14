const express = require('express');
const cors = require('cors');
const mongoose = require('mongoose');
const datasetRoutes = require('./routes/datasets');
const { seedDemoData } = require('./services/db');

const app = express();
const PORT = process.env.PORT || 3001;
const MONGO_URI = process.env.MONGO_URI || 'mongodb://localhost:27017/dataprove';

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
app.get('/api/health', (req, res) => {
  res.json({
    status: 'ok',
    service: 'Research Provenance API',
    network: 'Solana Devnet (Simulated)',
    database: mongoose.connection.readyState === 1 ? 'connected' : 'disconnected',
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

// ─── Connect to MongoDB then start server ───────────────────────────────────
async function start() {
  try {
    await mongoose.connect(MONGO_URI);
    console.log(`✅ MongoDB connected → ${MONGO_URI}`);

    // Seed demo data on first run (no-op if data already exists)
    await seedDemoData();

    app.listen(PORT, () => {
      console.log(`\n🔬 Research Data Provenance API`);
      console.log(`   Server: http://localhost:${PORT}`);
      console.log(`   DB:     ${MONGO_URI}`);
      console.log(`   Network: Solana Devnet (Simulated Mode)\n`);
    });
  } catch (err) {
    console.error('❌ Failed to connect to MongoDB:', err.message);
    console.error('   Make sure Docker is running: docker compose up -d');
    process.exit(1);
  }
}

start();
