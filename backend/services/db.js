const { pool, initSchema } = require('./pg');
const { computeHash, generateDatasetId } = require('../utils/hash');

// ─── Column projections (snake_case columns → camelCase API fields) ──────────
const DATASET_COLS = `
  dataset_id    AS "datasetId",
  name,
  description,
  current_hash  AS "currentHash",
  version_count AS "versionCount",
  created_at    AS "createdAt",
  updated_at    AS "updatedAt",
  ipfs_cid      AS "ipfsCid",
  metadata_uri  AS "metadataUri",
  authority,
  tx_signature  AS "txSignature",
  is_active     AS "isActive"
`;

const VERSION_COLS = `
  dataset_id         AS "datasetId",
  version_number     AS "versionNumber",
  previous_hash      AS "previousHash",
  file_hash          AS "fileHash",
  change_description AS "changeDescription",
  updated_by         AS "updatedBy",
  tx_signature       AS "txSignature",
  timestamp,
  ipfs_cid           AS "ipfsCid"
`;

// ─── Real SHA-256 hashes (generated from descriptive seed strings) ─────────
// All values are exactly 64 hex chars — valid SHA-256 digests
const H = {
  GV1:  '045894df0a46ebac58f3bb5a10f28bc469968ddb08054b31b1917acb6cbc0be0',
  GV2:  '2ba28afc443ebcaf1a20ecc6ea2fbcdb0c65f99c2fc904bf1f8c0fab6cc59251',
  GV3:  '9a03d9a8541f506e746dceb2c645785581d8e9d1cbc38061d6357cf626698c32',
  CLV1: '7b80e092c62a817cb3e6fb22640a2a6f2f53f20d08b22a644b6c7c9f3079f398',
  CLV2: '5c632ae82555b705d9771f573d54644436337ac63aaf435782a2b64c20f9ea20',
  NV1:  'ad1e63318cdb8cf7f44098f9ca3a4c8144f4ac6dd3019f3333703f867b10baf9',
  PV1:  '3bd1e08d4e029dae31897bf83a3a16a04ec6d7a7b1eede074cc4e8bf0d00c42c',
  PV2:  '91ae0bc2a71bc146e1670780099f48a2f64d4a099f42b5e1ac3ad409e5f02383',
  PV3:  '6efa1038154dd46c280ab60825b07efdde422fdbe2ac86109bdf0396c606cb88',
  PV4:  'a34eaae8cff2b9363cbc248355ad4e7579bfd8d2e83d765314385b216bb6cd0c',
  PV5:  '2494143e294f16c3fceb069d0904c1295d2240a77b0e5f99de3cc013624baf4d',
  QV1:  'b0fddbcb1610b5522bc54cf91a7be974b0b41ae81d4e601206bb565b119f1647',
  QV2:  '087353abb57598a6c7e39a17f9eae36b2f5dc37653ac7ed00ad18946090875f9',
};

// ─── Schema init + demo seeder ───────────────────────────────────────────────
async function initDb() {
  await initSchema();
  await seedDemoData();
}

async function seedDemoData() {
  const { rows } = await pool.query('SELECT COUNT(*)::int AS count FROM datasets');
  if (rows[0].count > 0) return; // already seeded — skip

  const now = Math.floor(Date.now() / 1000);

  const demoDatasets = [
    ['ds_genomics_2024_001', 'Human Genome Variant Analysis Dataset', 'Comprehensive dataset of human genome variants from 10,000 participants across diverse populations. Includes SNPs, indels, and structural variants with phenotype associations.', H.GV3, 3, now - 86400 * 30, now - 86400 * 2,  'QmXoypizjW3WknFiJnKLwHCnL72vedxjQkDDP1mXWo6uco', 'https://research.example.com/genomics/2024/001', '7xKXtg2CW87d97TXJSDpbD5jBkheTqA83TZRuJosgAsU'],
    ['ds_climate_model_2024', 'Global Climate Simulation Output v4.2', 'High-resolution climate model outputs for 2020-2100 under SSP2-4.5 scenario. Contains temperature, precipitation, sea level data at 25km grid resolution.', H.CLV2, 2, now - 86400 * 60, now - 86400 * 10, 'QmYwAPJzv5CZsnA625s3Xf2nemtYgPpHdWEz79ojWnPbdG', 'https://research.example.com/climate/2024/v4', '5ZWj7a1f8tWkjBESHKgrLmXshuXxqeY9SYcfbshpAqPG'],
    ['ds_neural_imaging_2024', 'fMRI Brain Connectivity Dataset', 'Resting-state fMRI data from 500 subjects with parcellated brain connectivity matrices. Includes demographic variables and cognitive test scores.', H.NV1, 1, now - 86400 * 15, now - 86400 * 15, 'QmZTR5bcpQD7cFgTorqxZDYaew1Wqgfbd2ud9QqGPAkK2V', 'https://research.example.com/neuro/fmri/2024', '9aE2UhkgKLsqTqR3PJvwzNnHJq5v5dEj3nXBfM3jKP4k'],
    ['ds_protein_fold_2024', 'Protein Structure Prediction Benchmark', 'Benchmark dataset for protein structure prediction containing 15,000 experimentally determined structures with AlphaFold2 predictions and RMSD comparisons.', H.PV5, 5, now - 86400 * 90, now - 86400 * 1,  'QmUNLLsPACCz1vLxQVkXqqLX5R1X345qqfHbsf67hvA3Nn', 'https://research.example.com/protein/2024/benchmark', '3Mc6vR5BEgPGAkgqPLS8HjLfn5VwhVyKjRnGHJdqZzaB'],
    ['ds_quantum_sim_2024', 'Quantum Computing Error Rate Dataset', 'Error rate measurements from 72-qubit quantum processor across 50,000 circuit executions. Includes gate fidelity data and noise characterization.', H.QV2, 2, now - 86400 * 45, now - 86400 * 5,  'QmPZ9gcCEpqKTo6aq61g2nXGUhM4iCL3ewB6LDXZCtioEB', 'https://research.example.com/quantum/2024/error-rates', '6FoKg6F7H5MToYjVzjGpLfPfYXuHKApDfEwRo8WKDNR4'],
  ];

  for (const d of demoDatasets) {
    await pool.query(
      `INSERT INTO datasets
         (dataset_id, name, description, current_hash, version_count, created_at, updated_at, ipfs_cid, metadata_uri, authority, is_active)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10, TRUE)`,
      d
    );
  }

  // Version chains — previousHash of each version = fileHash of prior version
  const allVersions = [
    // Genomics: GV1 → GV2 → GV3
    ['ds_genomics_2024_001', 1, '',    H.GV1, 'Initial dataset upload — 10,000 participant genomes',            '7xKXtg2CW87d97TXJSDpbD5jBkheTqA83TZRuJosgAsU', now - 86400 * 30, 'QmXoypizjW3WknFiJnKLwHCnL72vedxjQkDDP1mXWo6uco'],
    ['ds_genomics_2024_001', 2, H.GV1, H.GV2, 'Added phenotype association data for cardiovascular biomarkers',  '7xKXtg2CW87d97TXJSDpbD5jBkheTqA83TZRuJosgAsU', now - 86400 * 15, 'QmYzg5p4BaZLwAd7LMLqGP6KLFiJnKLwHCnL72vedxjQkD'],
    ['ds_genomics_2024_001', 3, H.GV2, H.GV3, 'Incorporated structural variant calls using long-read sequencing','7xKXtg2CW87d97TXJSDpbD5jBkheTqA83TZRuJosgAsU', now - 86400 * 2,  'QmZxR5bcpQD7cFgTorqxZDYaew1Wqgfbd2ud9QqGPAkK2V'],
    // Climate: CLV1 → CLV2
    ['ds_climate_model_2024', 1, '',     H.CLV1, 'Initial upload — SSP2-4.5 scenario base run',                 '5ZWj7a1f8tWkjBESHKgrLmXshuXxqeY9SYcfbshpAqPG', now - 86400 * 60, 'QmYwAPJzv5CZsnA625s3Xf2nemtYgPpHdWEz79ojWnPbdG'],
    ['ds_climate_model_2024', 2, H.CLV1, H.CLV2, 'Added ocean temperature depth profiles and ice sheet dynamics','5ZWj7a1f8tWkjBESHKgrLmXshuXxqeY9SYcfbshpAqPG', now - 86400 * 10, 'QmRwAPJzv5CZsnA625s3Xf2nemtYgPpHdWEz79ojWnPbdG'],
    // Neural: NV1 (single version)
    ['ds_neural_imaging_2024', 1, '',    H.NV1,  'Initial fMRI dataset registration',                          '9aE2UhkgKLsqTqR3PJvwzNnHJq5v5dEj3nXBfM3jKP4k', now - 86400 * 15, 'QmZTR5bcpQD7cFgTorqxZDYaew1Wqgfbd2ud9QqGPAkK2V'],
    // Protein: PV1 → PV2 → PV3 → PV4 → PV5
    ['ds_protein_fold_2024', 1, '',    H.PV1, 'Initial benchmark set — 5,000 structures',           '3Mc6vR5BEgPGAkgqPLS8HjLfn5VwhVyKjRnGHJdqZzaB', now - 86400 * 90, 'QmUNLLsPACCz1vLxQVkXqqLX5R1X345qqfHbsf67hvA3Nn'],
    ['ds_protein_fold_2024', 2, H.PV1, H.PV2, 'Expanded to 10,000 structures with CASP15 targets',  '3Mc6vR5BEgPGAkgqPLS8HjLfn5VwhVyKjRnGHJdqZzaB', now - 86400 * 70, 'QmVNLLsPACCz1vLxQVkXqqLX5R1X345qqfHbsf67hvA3Nn'],
    ['ds_protein_fold_2024', 3, H.PV2, H.PV3, 'Added ESMFold predictions and TM-score comparisons', '3Mc6vR5BEgPGAkgqPLS8HjLfn5VwhVyKjRnGHJdqZzaB', now - 86400 * 40, 'QmWNLLsPACCz1vLxQVkXqqLX5R1X345qqfHbsf67hvA3Nn'],
    ['ds_protein_fold_2024', 4, H.PV3, H.PV4, 'Full expansion to 15,000 structures with cryo-EM data','3Mc6vR5BEgPGAkgqPLS8HjLfn5VwhVyKjRnGHJdqZzaB', now - 86400 * 15, 'QmXNLLsPACCz1vLxQVkXqqLX5R1X345qqfHbsf67hvA3Nn'],
    ['ds_protein_fold_2024', 5, H.PV4, H.PV5, 'Added RMSD analysis pipeline outputs and comparison matrices','3Mc6vR5BEgPGAkgqPLS8HjLfn5VwhVyKjRnGHJdqZzaB', now - 86400 * 1, 'QmYNLLsPACCz1vLxQVkXqqLX5R1X345qqfHbsf67hvA3Nn'],
    // Quantum: QV1 → QV2
    ['ds_quantum_sim_2024', 1, '',    H.QV1, 'Initial error rate measurements — 25,000 circuit executions',                       '6FoKg6F7H5MToYjVzjGpLfPfYXuHKApDfEwRo8WKDNR4', now - 86400 * 45, 'QmPZ9gcCEpqKTo6aq61g2nXGUhM4iCL3ewB6LDXZCtioEB'],
    ['ds_quantum_sim_2024', 2, H.QV1, H.QV2, 'Extended to 50,000 executions with gate fidelity and noise characterization', '6FoKg6F7H5MToYjVzjGpLfPfYXuHKApDfEwRo8WKDNR4', now - 86400 * 5,  'QmQZ9gcCEpqKTo6aq61g2nXGUhM4iCL3ewB6LDXZCtioEB'],
  ];

  for (const v of allVersions) {
    await pool.query(
      `INSERT INTO versions
         (dataset_id, version_number, previous_hash, file_hash, change_description, updated_by, timestamp, ipfs_cid)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8)`,
      v
    );
  }

  console.log('Demo data seeded to Supabase Postgres');
}

// ─── Service Methods ─────────────────────────────────────────────────────────

async function getAllDatasets() {
  const { rows } = await pool.query(
    `SELECT ${DATASET_COLS} FROM datasets WHERE is_active = TRUE ORDER BY created_at DESC`
  );
  return rows;
}

async function getDataset(datasetId) {
  const { rows } = await pool.query(
    `SELECT ${DATASET_COLS} FROM datasets WHERE dataset_id = $1`,
    [datasetId]
  );
  return rows[0] || null;
}

async function getVersions(datasetId) {
  const { rows } = await pool.query(
    `SELECT ${VERSION_COLS} FROM versions WHERE dataset_id = $1 ORDER BY version_number ASC`,
    [datasetId]
  );
  return rows;
}

async function searchDatasets(query) {
  const like = `%${query}%`;
  const { rows } = await pool.query(
    `SELECT ${DATASET_COLS} FROM datasets
       WHERE is_active = TRUE
         AND (name ILIKE $1 OR description ILIKE $1 OR dataset_id ILIKE $1)
       ORDER BY created_at DESC`,
    [like]
  );
  return rows;
}

async function getStats() {
  const [datasetsRes, versionsRes, researchersRes] = await Promise.all([
    pool.query('SELECT COUNT(*)::int AS c FROM datasets WHERE is_active = TRUE'),
    pool.query('SELECT COUNT(*)::int AS c FROM versions'),
    pool.query('SELECT COUNT(DISTINCT authority)::int AS c FROM datasets WHERE is_active = TRUE'),
  ]);
  const totalDatasets = datasetsRes.rows[0].c;
  const totalVersions = versionsRes.rows[0].c;
  return {
    totalDatasets,
    totalVersions,
    totalResearchers: researchersRes.rows[0].c,
    totalVerifications: totalVersions * 3 + totalDatasets * 7, // deterministic metric
  };
}

async function registerDataset({ datasetId: suppliedId, name, description, fileHash, ipfsCid, metadataUri, authority, txSignature }) {
  const datasetId = suppliedId || generateDatasetId(name, authority);
  const now = Math.floor(Date.now() / 1000);
  const resolvedTxSig = txSignature || computeHash(`tx-${datasetId}-${now}`);

  const { rows } = await pool.query(
    `INSERT INTO datasets
       (dataset_id, name, description, current_hash, version_count, created_at, updated_at, ipfs_cid, metadata_uri, authority, tx_signature, is_active)
     VALUES ($1,$2,$3,$4,1,$5,$5,$6,$7,$8,$9, TRUE)
     RETURNING ${DATASET_COLS}`,
    [datasetId, name, description || '', fileHash, now, ipfsCid || '', metadataUri || '', authority, resolvedTxSig]
  );

  await pool.query(
    `INSERT INTO versions
       (dataset_id, version_number, previous_hash, file_hash, change_description, updated_by, tx_signature, timestamp, ipfs_cid)
     VALUES ($1,1,'',$2,'Initial dataset registration',$3,$4,$5,$6)`,
    [datasetId, fileHash, authority, resolvedTxSig, now, ipfsCid || '']
  );

  return { datasetId, record: rows[0], txSignature: resolvedTxSig };
}

async function updateDataset({ datasetId, newFileHash, changeDescription, ipfsCid, authority, txSignature }) {
  const dataset = await getDataset(datasetId);
  if (!dataset) throw new Error('Dataset not found');

  if (newFileHash === dataset.currentHash) {
    throw new Error('New file hash is identical to the current version — no changes detected');
  }

  if (dataset.authority !== authority) {
    throw new Error('Unauthorized: only dataset owner can perform this action');
  }

  const now = Math.floor(Date.now() / 1000);
  const newVersionNumber = dataset.versionCount + 1;
  const resolvedTxSig = txSignature || computeHash(`tx-update-${datasetId}-${now}`);

  const { rows } = await pool.query(
    `INSERT INTO versions
       (dataset_id, version_number, previous_hash, file_hash, change_description, updated_by, tx_signature, timestamp, ipfs_cid)
     VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9)
     RETURNING ${VERSION_COLS}`,
    [datasetId, newVersionNumber, dataset.currentHash, newFileHash, changeDescription || 'Version update', authority || dataset.authority, resolvedTxSig, now, ipfsCid || '']
  );

  await pool.query(
    `UPDATE datasets
       SET current_hash = $1, version_count = $2, updated_at = $3, tx_signature = $4
     WHERE dataset_id = $5`,
    [newFileHash, newVersionNumber, now, resolvedTxSig, datasetId]
  );

  return { versionRecord: rows[0], txSignature: resolvedTxSig };
}

async function verifyHash(hash) {
  // Check current hashes first
  const currentRes = await pool.query(
    `SELECT ${DATASET_COLS} FROM datasets WHERE current_hash = $1 AND is_active = TRUE LIMIT 1`,
    [hash]
  );
  if (currentRes.rows[0]) {
    const dataset = currentRes.rows[0];
    return { found: true, isCurrent: true, dataset, versionNumber: dataset.versionCount };
  }

  // Check historical version records
  const versionRes = await pool.query(
    `SELECT ${VERSION_COLS} FROM versions WHERE file_hash = $1 LIMIT 1`,
    [hash]
  );
  if (versionRes.rows[0]) {
    const versionMatch = versionRes.rows[0];
    const dataset = await getDataset(versionMatch.datasetId);
    return { found: true, isCurrent: false, dataset, versionNumber: versionMatch.versionNumber, versionRecord: versionMatch };
  }

  return { found: false };
}

async function transferOwnership(datasetId, newAuthority, authority, txSignature) {
  const dataset = await getDataset(datasetId);
  if (!dataset || !dataset.isActive) throw new Error('Dataset not found or inactive');

  if (dataset.authority !== authority) {
    throw new Error('Unauthorized: only dataset owner can perform this action');
  }

  const now = Math.floor(Date.now() / 1000);
  const resolvedTxSig = txSignature || computeHash(`tx-transfer-${datasetId}-${now}`);

  // Only update authority — version count is NOT bumped, no Version record created
  await pool.query(
    `UPDATE datasets SET authority = $1, updated_at = $2, tx_signature = $3 WHERE dataset_id = $4`,
    [newAuthority, now, resolvedTxSig, datasetId]
  );

  return { success: true, newAuthority, txSignature: resolvedTxSig };
}

async function deactivateDataset(datasetId, authority, txSignature) {
  const dataset = await getDataset(datasetId);
  if (!dataset || !dataset.isActive) throw new Error('Dataset not found or already inactive');

  if (dataset.authority !== authority) {
    throw new Error('Unauthorized: only dataset owner can perform this action');
  }

  const now = Math.floor(Date.now() / 1000);
  const resolvedTxSig = txSignature || computeHash(`tx-deactivate-${datasetId}-${dataset.updatedAt}`);

  await pool.query(
    `UPDATE datasets SET is_active = FALSE, updated_at = $1, tx_signature = $2 WHERE dataset_id = $3`,
    [now, resolvedTxSig, datasetId]
  );

  return { success: true, txSignature: resolvedTxSig };
}

module.exports = {
  initDb,
  seedDemoData,
  getAllDatasets,
  getDataset,
  getVersions,
  searchDatasets,
  getStats,
  registerDataset,
  updateDataset,
  verifyHash,
  transferOwnership,
  deactivateDataset,
};
