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
    const { datasetId, name, description, fileHash, ipfsCid, metadataUri, authority, txSignature } = req.body;

    if (!name || !fileHash || !authority) {
      return res.status(400).json({ success: false, error: 'name, fileHash, and authority are required' });
    }
    if (!isValidHash(fileHash)) {
      return res.status(400).json({ success: false, error: 'Invalid SHA-256 hash (must be 64 hex chars)' });
    }

    const result = await db.registerDataset({
      datasetId,
      name,
      description: description || '',
      fileHash,
      ipfsCid: ipfsCid || '',
      metadataUri: metadataUri || '',
      authority,
      txSignature: txSignature || null,
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
    const { datasetId, newFileHash, changeDescription, ipfsCid, authority, txSignature } = req.body;

    if (!datasetId || !newFileHash || !authority) {
      return res.status(400).json({ success: false, error: 'datasetId, newFileHash, and authority are required' });
    }
    if (!isValidHash(newFileHash)) {
      return res.status(400).json({ success: false, error: 'Invalid SHA-256 hash (must be 64 hex chars)' });
    }

    const result = await db.updateDataset({
      datasetId,
      newFileHash,
      changeDescription: changeDescription || 'Version update',
      ipfsCid: ipfsCid || '',
      authority,
      txSignature: txSignature || null,
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
// ─── POST /api/datasets/transfer ────────────────────────────
router.post('/transfer', async (req, res) => {
  try {
    const { datasetId, newAuthority, authority, txSignature } = req.body;
    if (!datasetId || !newAuthority || !authority) {
      return res.status(400).json({ success: false, error: 'datasetId, newAuthority, and authority are required' });
    }

    const result = await db.transferOwnership(datasetId, newAuthority, authority, txSignature);
    res.json(result);
  } catch (err) {
    res.status(400).json({ success: false, error: err.message });
  }
});

// ─── POST /api/datasets/deactivate ──────────────────────────
router.post('/deactivate', async (req, res) => {
  try {
    const { datasetId, authority, txSignature } = req.body;
    if (!datasetId || !authority) {
      return res.status(400).json({ success: false, error: 'datasetId and authority are required' });
    }

    const result = await db.deactivateDataset(datasetId, authority, txSignature);
    res.json(result);
  } catch (err) {
    res.status(400).json({ success: false, error: err.message });
  }
});

module.exports = router;
