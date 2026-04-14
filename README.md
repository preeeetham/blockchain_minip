# DataProve — Research Data Provenance on Solana

> Immutable, blockchain-backed provenance tracking for scientific research datasets.

DataProve lets researchers register their dataset's SHA-256 hash on the **Solana blockchain** (via a signed Memo transaction), track every version with linked hash chains, and allow anyone to independently verify data authenticity — no trust required.

---

## Features

| Feature | Description |
|---|---|
| 📝 **Register** | Upload a file → browser computes SHA-256 locally → hash recorded on-chain |
| 📊 **Version Tracking** | Every update creates a new version linked to the previous hash |
| ✅ **Verify** | Paste any SHA-256 hash to check if it matches a registered dataset (current or historical) |
| 🔍 **Browse** | Dashboard with search, stats, and dataset cards |
| 🔗 **Solana Devnet** | Signed Memo transactions via Phantom / Solflare / Backpack wallet |
| 🗄️ **MongoDB** | Persistent storage via Docker — data survives server restarts |

---

## Tech Stack

| Layer | Technology |
|---|---|
| **Frontend** | React 18 + Vite, Framer Motion, React Router v6 |
| **Backend** | Node.js + Express |
| **Database** | MongoDB 7 (Docker) + Mongoose ODM |
| **Blockchain** | Solana Devnet — SPL Memo Program (no custom program needed) |
| **Wallet** | Phantom / Solflare / Backpack (browser extension) |
| **Hashing** | SHA-256 via Web Crypto API (browser-native) |

---

## Architecture

```
Browser (React/Vite :5173)
    │
    ├── /register  → drop file → SHA-256 computed locally (never uploaded)
    │                 → POST /api/datasets/register
    │                 → optional: wallet signs Solana Memo tx
    │
    ├── /dashboard → GET /api/datasets  (all datasets + stats)
    │
    ├── /dataset/:id → GET /api/datasets/:id + /versions
    │                  → ↑ Update Version panel (same flow as register)
    │
    └── /verify    → GET /api/datasets/verify/:hash
                     (matches current OR historical version hashes)

Express API (:3001)
    │
    └── MongoDB (Docker :27017) ── datasets collection
                                ── versions collection
```

---

## API Endpoints

| Method | Endpoint | Description |
|---|---|---|
| `GET` | `/api/health` | Health check — confirms DB connection |
| `GET` | `/api/datasets` | List all active datasets |
| `GET` | `/api/datasets/stats` | Aggregate stats (total datasets, versions, researchers, verifications) |
| `GET` | `/api/datasets/search?q=` | Search by name or description |
| `GET` | `/api/datasets/:id` | Get a single dataset by ID |
| `GET` | `/api/datasets/:id/versions` | Full version history for a dataset |
| `GET` | `/api/datasets/verify/:hash` | Verify a SHA-256 hash (current or historical) |
| `POST` | `/api/datasets/register` | Register a new dataset |
| `POST` | `/api/datasets/update` | Publish a new version of an existing dataset |
| `POST` | `/api/datasets/hash` | Compute SHA-256 of a string server-side |

### Register payload
```json
{
  "name": "My Research Dataset",
  "description": "Optional description",
  "fileHash": "<64-char SHA-256 hex>",
  "authority": "<wallet public key or demo string>",
  "ipfsCid": "Qm... (optional)",
  "metadataUri": "https://... (optional)"
}
```

### Update payload
```json
{
  "datasetId": "ds_abc123",
  "newFileHash": "<64-char SHA-256 hex of updated file>",
  "changeDescription": "What changed in this version",
  "authority": "<wallet public key>"
}
```

> **Note:** The API rejects updates where `newFileHash === currentHash` — same file = no real change.

---

## Getting Started

### Prerequisites

- [Node.js](https://nodejs.org/) ≥ 18
- [Docker Desktop](https://www.docker.com/products/docker-desktop/) (for MongoDB)
- A Solana browser wallet extension (optional — Phantom, Solflare, or Backpack) for on-chain signing

### 1. Clone & install

```bash
git clone https://github.com/preeeetham/blockchain_minip.git
cd blockchain_minip

# Install backend dependencies
cd backend && npm install && cd ..

# Install frontend dependencies
cd frontend && npm install && cd ..
```

### 2. Start MongoDB

```bash
docker compose up -d
```

This starts a MongoDB 7 container on port `27017` with a named volume for persistence. Demo data is auto-seeded on first run.

### 3. Start the backend

```bash
cd backend && npm start
```

You should see:
```
✅ MongoDB connected → mongodb://localhost:27017/dataprove
✅ Demo data seeded to MongoDB

🔬 Research Data Provenance API
   Server: http://localhost:3001
   DB:     mongodb://localhost:27017/dataprove
   Network: Solana Devnet (Simulated Mode)
```

### 4. Start the frontend

```bash
cd frontend && npm run dev
```

Open **http://localhost:5173** in your browser.

---

## How It Works

### Registering a Dataset

1. Go to **Register** page
2. Drop your dataset file — SHA-256 is computed in the browser (file never leaves your machine)
3. Fill in name, description, and optional IPFS CID
4. If a Solana wallet is connected → signs and broadcasts a Memo transaction to Devnet
5. Without a wallet → saves to MongoDB in demo mode
6. You're redirected to the dataset's detail page

### Updating a Dataset (New Version)

1. Open a dataset's detail page
2. Click **↑ Update Version**
3. Drop the modified file (must be different — same file = rejected)
4. Describe what changed
5. Submit → creates version N+1 with `previousHash` linked to the prior version

### Verifying a Hash

1. Go to **Verify** page
2. Paste a 64-char SHA-256 hash (or hash a file directly)
3. Click **Verify** — checks against current AND historical version hashes
4. Result shows: dataset name, version number, current vs historical status, researcher wallet, registration date

---

## Data Model

### Dataset
```
datasetId      String   — unique identifier (MD5 of name+authority)
name           String
description    String
currentHash    String   — SHA-256 of the latest version's file
versionCount   Number
authority      String   — researcher's wallet public key
ipfsCid        String   — optional IPFS content identifier
metadataUri    String   — optional link to full metadata
createdAt      Number   — Unix timestamp
updatedAt      Number   — Unix timestamp
isActive       Boolean
```

### Version
```
datasetId          String   — references parent Dataset
versionNumber      Number   — monotonically increasing
previousHash       String   — SHA-256 of the prior version (empty for v1)
fileHash           String   — SHA-256 of this version's file
changeDescription  String
updatedBy          String   — wallet public key of who published this version
timestamp          Number   — Unix timestamp
ipfsCid            String   — optional
```

---

## Demo Data

Five research datasets are seeded on first run with realistic multi-version histories:

| Dataset | Versions |
|---|---|
| Human Genome Variant Analysis Dataset | v3 |
| Global Climate Simulation Output v4.2 | v2 |
| fMRI Brain Connectivity Dataset | v1 |
| Protein Structure Prediction Benchmark | v5 |
| Quantum Computing Error Rate Dataset | v2 |

---

## Project Structure

```
blockchain_minip/
├── docker-compose.yml          # MongoDB container
├── backend/
│   ├── server.js               # Express entry point + MongoDB connect
│   ├── routes/
│   │   └── datasets.js         # All API route handlers
│   ├── services/
│   │   └── db.js               # Mongoose service layer + seed logic
│   ├── models/
│   │   ├── Dataset.js          # Mongoose Dataset schema
│   │   └── Version.js          # Mongoose Version schema
│   └── utils/
│       └── hash.js             # SHA-256, validation, ID generation
└── frontend/
    ├── vite.config.js          # Vite config with Node.js global polyfills
    └── src/
        ├── App.jsx             # Routes
        ├── context/
        │   └── WalletContext.jsx   # Phantom/Solflare/Backpack wallet state
        ├── services/
        │   └── solana.js          # Solana Memo tx builder (TextEncoder, not Buffer)
        └── pages/
            ├── Home.jsx           # Landing page
            ├── Dashboard.jsx      # Dataset grid + search + stats
            ├── DatasetDetail.jsx  # Detail view + Update Version panel
            ├── Register.jsx       # File drop + register form
            └── Verify.jsx         # Hash verification
```

---

## Known Behaviour

- **Demo mode**: Without a Solana wallet, all operations save to MongoDB only. The UI clearly shows this.
- **Duplicate hash rejection**: The API and frontend both block updates where the new file hash equals the current version hash.
- **Hash validation**: All SHA-256 inputs are validated to be exactly 64 lowercase hex characters before processing.
- **Persistence**: All data is stored in MongoDB via Docker named volume and persists across server restarts.

---

## License

MIT
