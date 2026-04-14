const express = require('express');
const router = express.Router();
const db = require('../services/db');
const { computeHash, isValidHash } = require('../utils/hash');

// ─── GET /api/datasets ──────────────────────────────────────
router.get('/', async (req, res) => {
  try {
    const datasets = await db.getAllDatasets();
    res.json({ success: true, count: datasets.length, data: datasets });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

// ─── GET /api/datasets/stats ────────────────────────────────
// NOTE: Must be declared BEFORE /:id to avoid route shadowing
router.get('/stats', async (req, res) => {
  try {
    const stats = await db.getStats();
    res.json({ success: true, data: stats });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

// ─── GET /api/datasets/search?q=query ───────────────────────
router.get('/search', async (req, res) => {
  try {
    const { q } = req.query;
    if (!q) return res.json({ success: true, count: 0, data: [] });
    const results = await db.searchDatasets(q);
    res.json({ success: true, count: results.length, data: results });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

// ─── GET /api/datasets/verify/:hash ─────────────────────────
router.get('/verify/:hash', async (req, res) => {
  try {
    const { hash } = req.params;
    if (!isValidHash(hash)) {
      return res.status(400).json({ success: false, error: 'Invalid SHA-256 hash format (must be 64 hex chars)' });
    }
    const result = await db.verifyHash(hash);
    res.json({ success: true, ...result });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

// ─── POST /api/datasets/register ────────────────────────────
router.post('/register', async (req, res) => {
  try {
    const { name, description, fileHash, ipfsCid, metadataUri, authority } = req.body;

    if (!name || !fileHash) {
      return res.status(400).json({ success: false, error: 'name and fileHash are required' });
    }
    if (!isValidHash(fileHash)) {
      return res.status(400).json({ success: false, error: 'Invalid SHA-256 hash (must be 64 hex chars)' });
    }

    const result = await db.registerDataset({
      name,
      description: description || '',
      fileHash,
      ipfsCid: ipfsCid || '',
      metadataUri: metadataUri || '',
      authority: authority || ('DemoWallet' + Date.now()),
    });

    res.status(201).json({
      success: true,
      message: 'Dataset registered successfully',
      ...result,
    });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

// ─── POST /api/datasets/update ──────────────────────────────
router.post('/update', async (req, res) => {
  try {
    const { datasetId, newFileHash, changeDescription, ipfsCid, authority } = req.body;

    if (!datasetId || !newFileHash) {
      return res.status(400).json({ success: false, error: 'datasetId and newFileHash are required' });
    }
    if (!isValidHash(newFileHash)) {
      return res.status(400).json({ success: false, error: 'Invalid SHA-256 hash (must be 64 hex chars)' });
    }

    const result = await db.updateDataset({
      datasetId,
      newFileHash,
      changeDescription: changeDescription || 'Version update',
      ipfsCid: ipfsCid || '',
      authority: authority || '',
    });

    res.json({
      success: true,
      message: 'Dataset version updated successfully',
      ...result,
    });
  } catch (err) {
    res.status(400).json({ success: false, error: err.message });
  }
});

// ─── POST /api/datasets/hash ────────────────────────────────
router.post('/hash', (req, res) => {
  try {
    const { content } = req.body;
    if (!content) {
      return res.status(400).json({ success: false, error: 'content is required' });
    }
    const hash = computeHash(content);
    res.json({ success: true, hash });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

// ─── GET /api/datasets/:id ──────────────────────────────────
router.get('/:id', async (req, res) => {
  try {
    const dataset = await db.getDataset(req.params.id);
    if (!dataset) {
      return res.status(404).json({ success: false, error: 'Dataset not found' });
    }
    res.json({ success: true, data: dataset });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

// ─── GET /api/datasets/:id/versions ─────────────────────────
router.get('/:id/versions', async (req, res) => {
  try {
    const dataset = await db.getDataset(req.params.id);
    if (!dataset) {
      return res.status(404).json({ success: false, error: 'Dataset not found' });
    }
    const versions = await db.getVersions(req.params.id);
    res.json({
      success: true,
      datasetName: dataset.name,
      count: versions.length,
      data: versions,
    });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

module.exports = router;
