# DataProve — Research Data Provenance on Solana

> Immutable, blockchain-backed provenance tracking for scientific research datasets — powered by a native Anchor smart contract on Solana Devnet.

DataProve lets researchers register their dataset's SHA-256 hash on the **Solana blockchain** via a custom on-chain Anchor program, track every version with linked hash chains, transfer ownership between wallets, and allow anyone to independently verify data authenticity — no trust required.

---

## Features

| Feature | Description |
|---|---|
| 📝 **Register** | Compute SHA-256 of a file locally → record hash + metadata on-chain |
| 📊 **Version Tracking** | Every update creates a new on-chain version PDA linked to the dataset |
| 🔄 **Transfer Ownership** | Transfer dataset authority to another wallet — recorded on-chain |
| 🚫 **Deactivate** | Owner can permanently deactivate a dataset on-chain |
| ✅ **Verify** | Check any SHA-256 hash against registered datasets (current or historical) |
| 🔍 **Browse** | Dashboard with search, stats, and dataset cards |
| 🔗 **Solana Devnet** | Transactions signed with real keypairs against the deployed Anchor program |
| 🗄️ **MongoDB** | Persistent off-chain index via Docker — synced after each on-chain tx |

---

## Tech Stack

| Layer | Technology |
|---|---|
| **Smart Contract** | Anchor 0.30.1 — Rust / SBF (deployed on Solana Devnet) |
| **Frontend** | React 18 + Vite, Framer Motion, React Router v6 |
| **Backend** | Node.js 23 + Express |
| **Database** | MongoDB 7 (Docker) + Mongoose ODM |
| **Blockchain SDK** | `@solana/web3.js` |
| **Wallet (browser)** | Phantom / Solflare / Backpack (browser extension) |
| **Wallet (CLI)** | Raw `Keypair.fromSecretKey` from `test_wallets/` JSON files |
| **Hashing** | SHA-256 via Node.js `crypto` module (CLI) / Web Crypto API (browser) |

---

## Deployed Program

| | |
|---|---|
| **Program ID** | `F2PY8AKbNuTe36RuVHpgnxunkQWqwWy2MEnSMsNX2VqD` |
| **Network** | Solana Devnet |
| **Explorer** | [View on Solana Explorer](https://explorer.solana.com/address/F2PY8AKbNuTe36RuVHpgnxunkQWqwWy2MEnSMsNX2VqD?cluster=devnet) |
| **Deploy Slot** | 457082125 |
| **IDL** | `idl/research_provenance.json` |

### On-Chain Instructions

| Instruction | Discriminator Preimage | Signers |
|---|---|---|
| `register_dataset` | `global:register_dataset` | authority (owner) |
| `update_dataset` | `global:update_dataset` | authority |
| `transfer_ownership` | `global:transfer_ownership` | current authority |
| `deactivate_dataset` | `global:deactivate_dataset` | authority |

### PDAs (Program Derived Addresses)

```
Dataset PDA: seeds = ["dataset", <datasetId>]
Version PDA: seeds = ["version", <datasetId>, <versionNumber as u32 LE>]
```

---

## Architecture

```
test_onchain.mjs  (CLI e2e test)
    │
    ├── Register  → builds instruction → signs with Wallet A → sends to Devnet
    │               → POST /api/datasets/register  (backend sync)
    │
    ├── Update    → version PDA created on-chain → signs with Wallet A
    │               → POST /api/datasets/update
    │
    ├── Transfer  → new_authority = Wallet B → signs with Wallet A
    │               → POST /api/datasets/transfer
    │
    └── Deactivate → signs with Wallet B (new owner)
                    → POST /api/datasets/deactivate

Express API (:3001)
    └── MongoDB (Docker :27017)
            ├── datasets collection
            └── versions collection
```

---

## Prerequisites

| Tool | Version | Notes |
|---|---|---|
| Node.js | ≥ 18 (tested on v23.3.0) | Install from [nodejs.org](https://nodejs.org/) |
| Docker Desktop | Any recent | For MongoDB — [docker.com](https://www.docker.com/products/docker-desktop/) |
| Solana CLI | ≥ 1.18 (tested on v3.1.13) | See install below |
| Rust + cargo-build-sbf | ≥ 1.75 | Comes with Solana tools |

> **PATH note (macOS):** If commands are not found, add these to your `~/.zshrc`:
> ```bash
> export PATH="/usr/local/bin:$HOME/.local/share/solana/install/active_release/bin:/Applications/Docker.app/Contents/Resources/bin:$PATH"
> ```

### Install Solana CLI (if needed)

```bash
sh -c "$(curl -sSfL https://release.anza.xyz/stable/install)"
```

---

## Getting Started

### 1. Clone & install dependencies

```bash
git clone https://github.com/preeeetham/blockchain_minip.git
cd blockchain_minip

# Root-level deps (web3.js for the test script)
npm install

# Backend
cd backend && npm install && cd ..

# Frontend
cd frontend && npm install && cd ..
```

### 2. Start MongoDB

```bash
docker compose up -d
```

Starts MongoDB 7 on port `27017` with a named volume. Demo data is auto-seeded on first run.

### 3. Start the backend API

```bash
cd backend && node server.js
```

Expected output:
```
✅ MongoDB connected → mongodb://localhost:27017/dataprove
🔬 Research Data Provenance API
   Server: http://localhost:3001
   DB:     mongodb://localhost:27017/dataprove
```

Health check:
```bash
curl http://localhost:3001/api/health
```

### 4. (Optional) Start the frontend

```bash
cd frontend && npm run dev
```

Open **http://localhost:5173** in your browser.

---

## Building & Deploying the Smart Contract

> Skip this section if the program is already deployed at the ID above. Only needed after contract code changes.

### Build

```bash
cd programs/research_provenance
~/.local/share/solana/install/active_release/bin/cargo-build-sbf
```

Output binary: `programs/research_provenance/target/deploy/research_provenance.so`

### Deploy to Devnet

You need a funded Solana wallet as the **deployer/payer** (separate from the test wallets). The default payer is `~/.config/solana/id.json`.

```bash
# Fund deployer if needed
solana airdrop 2 --url devnet

# Deploy (uses existing program keypair to keep same Program ID)
solana program deploy \
  programs/research_provenance/target/deploy/research_provenance.so \
  --program-id target/deploy/research_provenance-keypair.json \
  --url devnet
```

Verify deployment:
```bash
solana program show F2PY8AKbNuTe36RuVHpgnxunkQWqwWy2MEnSMsNX2VqD --url devnet
```

> **Note:** First-time deploy costs ~1.7 SOL in rent for the program data account. Re-deploys (upgrades) cost much less.

---

## Test Wallets

Two pre-funded test wallets are included for running the end-to-end test suite:

| Wallet | File | Public Key | Balance |
|---|---|---|---|
| Wallet A | `test_wallets/wallet_A.json` | `ByFMqcz8JctQaUkNFJHeQ2gWeARJtRgJZbZdY4qkWoF6` | 2 SOL |
| Wallet B | `test_wallets/wallet_B.json` | `GwUUmJPAhPUYP9RzhxTdmcCQf4jib5ZJuC2mCoxvp4qF` | 2 SOL |

If balances are low, top them up from the [Solana Devnet Faucet](https://faucet.solana.com/):
```bash
solana airdrop 2 ByFMqcz8JctQaUkNFJHeQ2gWeARJtRgJZbZdY4qkWoF6 --url devnet
solana airdrop 2 GwUUmJPAhPUYP9RzhxTdmcCQf4jib5ZJuC2mCoxvp4qF --url devnet
```

---

## Running the End-to-End Test Suite

The test script `test_onchain.mjs` exercises all 4 on-chain instructions against real Devnet transactions using the test wallets and the CSV files in `backend/datasets/`.

**Prerequisites:** Backend running on `:3001`, both wallets funded, program deployed.

```bash
node test_onchain.mjs
```

### What the test does

| Step | Action | Wallet | Dataset File |
|---|---|---|---|
| Test 1 | `register_dataset` | Wallet A | `stores.csv` |
| Test 2 | `update_dataset` (v2) | Wallet A | `oil.csv` |
| Test 3 | `transfer_ownership` (A → B) | Wallet A | — |
| Test 4 | `deactivate_dataset` | Wallet B (new owner) | — |
| Test 5 | Verify version history via backend API | — | — |

### Example output (successful run)

```
======================================================================
DataProve On-Chain Test Suite
======================================================================
Wallet A: ByFMqcz8JctQaUkNFJHeQ2gWeARJtRgJZbZdY4qkWoF6
Wallet B: GwUUmJPAhPUYP9RzhxTdmcCQf4jib5ZJuC2mCoxvp4qF
Program:  F2PY8AKbNuTe36RuVHpgnxunkQWqwWy2MEnSMsNX2VqD

Wallet A balance: 2 SOL
Wallet B balance: 2 SOL

Found 7 dataset files: holidays_events.csv, oil.csv, ...

TEST 1: Register Dataset (Wallet A + stores.csv)   ✅ PASSED
TEST 2: Update Dataset (Wallet A + oil.csv as v2)  ✅ PASSED
TEST 3: Transfer Ownership (Wallet A → Wallet B)   ✅ PASSED
TEST 4: Deactivate Dataset (Wallet B, new owner)   ✅ PASSED
TEST 5: Verify version history via backend API     ✅ 3 versions recorded

ALL TESTS PASSED
Results saved to test_results.json
```

Results (tx signatures + explorer links) are saved to `test_results.json` after each run.

### Verified Test Run (2026-04-21)

| Operation | TX Signature | Explorer |
|---|---|---|
| Register | `4tZobHXi...` | [View](https://explorer.solana.com/tx/4tZobHXiPnXeFBJA11QmJKz3L6HRapxiTd52qigJwtPkyUdUPwidxM3VhRkW1UuVF6wND7qCoV8UN1bcfNeUXy2g?cluster=devnet) |
| Update | `1jkHU22Q...` | [View](https://explorer.solana.com/tx/1jkHU22Qp3t6QUwk6SsY5swssYJZfAgWuNGdgCN8dz7sXnGFGzzDsmaDcNouWJfj21YnbhivDJicPMUZqCh82Bc?cluster=devnet) |
| Transfer | `4HVERJiu...` | [View](https://explorer.solana.com/tx/4HVERJiuZZJeJgEqtfgyTepRSbw5kvvryX5cAYmH2JGut8WE2UpvTRPmy1UMK4BjkMFomRMCgfftex8VibT78Tf9?cluster=devnet) |
| Deactivate | `62zMBaMq...` | [View](https://explorer.solana.com/tx/62zMBaMqhrKFSeLgPmzEUwEKWTNwh2qPAAbPcmyBL8fXFVNvJVyeDtMZq1nX8sBshKcNcR3fU1HznbFPVYSWvkeh?cluster=devnet) |

---

## Available Datasets

Seven CSV files are included in `backend/datasets/` for testing:

| File | Size | Use in test |
|---|---|---|
| `stores.csv` | 1.4 KB | Register (Test 1) |
| `oil.csv` | 20 KB | Update / v2 (Test 2) |
| `holidays_events.csv` | 22 KB | Available |
| `transactions.csv` | 1.5 MB | Available |
| `test.csv` | 1.0 MB | Available |
| `sample_submission.csv` | 342 KB | Available |
| `train.csv` | 116 MB | Available (large) |

---

## API Endpoints

| Method | Endpoint | Description |
|---|---|---|
| `GET` | `/api/health` | Health check — confirms DB connection |
| `GET` | `/api/datasets` | List all active datasets |
| `GET` | `/api/datasets/stats` | Aggregate stats |
| `GET` | `/api/datasets/search?q=` | Search by name or description |
| `GET` | `/api/datasets/:id` | Get a single dataset by ID |
| `GET` | `/api/datasets/:id/versions` | Full version history |
| `GET` | `/api/datasets/verify/:hash` | Verify a SHA-256 hash |
| `POST` | `/api/datasets/register` | Register a new dataset (backend sync after on-chain tx) |
| `POST` | `/api/datasets/update` | Publish a new version |
| `POST` | `/api/datasets/transfer` | Record ownership transfer |
| `POST` | `/api/datasets/deactivate` | Record deactivation |
| `POST` | `/api/datasets/hash` | Compute SHA-256 of a string server-side |

### Register payload
```json
{
  "datasetId": "<32-char hex ID>",
  "name": "stores.csv",
  "description": "Test dataset from stores.csv",
  "fileHash": "<64-char SHA-256 hex>",
  "authority": "<wallet public key>",
  "txSignature": "<Solana tx signature>"
}
```

### Update payload
```json
{
  "datasetId": "<existing dataset ID>",
  "newFileHash": "<64-char SHA-256 of updated file>",
  "changeDescription": "What changed in this version",
  "authority": "<wallet public key>",
  "txSignature": "<Solana tx signature>"
}
```

---

## Project Structure

```
blockchain_minip/
├── Anchor.toml                     # Anchor config (cluster = devnet, program ID)
├── docker-compose.yml              # MongoDB 7 container
├── package.json                    # Root — @solana/web3.js for test script
├── test_onchain.mjs                # End-to-end CLI test (Register/Update/Transfer/Deactivate)
├── test_results.json               # Generated after test run — tx signatures + explorer links
│
├── test_wallets/
│   ├── wallet_A.json               # Wallet A keypair (owner / sender)
│   └── wallet_B.json               # Wallet B keypair (recipient of transfer)
│
├── programs/
│   └── research_provenance/
│       ├── Cargo.toml              # Anchor 0.30.1 dependency
│       └── src/
│           └── lib.rs              # Smart contract — all 4 instructions
│
├── target/
│   └── deploy/
│       └── research_provenance-keypair.json   # Program upgrade keypair (keep secret!)
│
├── idl/
│   └── research_provenance.json    # Anchor IDL — use for client-side encoding
│
├── backend/
│   ├── server.js                   # Express entry point + MongoDB connect
│   ├── routes/datasets.js          # All API route handlers
│   ├── services/db.js              # Mongoose service layer + seed logic
│   ├── models/                     # Dataset.js + Version.js Mongoose schemas
│   ├── utils/hash.js               # SHA-256, validation, ID generation
│   └── datasets/                   # CSV test files (7 files)
│
└── frontend/
    ├── vite.config.js
    └── src/
        ├── App.jsx                 # Routes
        ├── context/WalletContext.jsx
        ├── services/solana.js      # On-chain instruction builder
        └── pages/                  # Home, Dashboard, Register, DatasetDetail, Verify
```

---

## Data Model

### Dataset (MongoDB)
```
datasetId      String   — 32-char hex (SHA-256 of name+authority+timestamp)
name           String
description    String
currentHash    String   — SHA-256 of the latest version's file
versionCount   Number
authority      String   — current owner's wallet public key
txSignature    String   — most recent on-chain tx signature
isActive       Boolean
createdAt / updatedAt  — Unix timestamps
```

### Version (MongoDB)
```
datasetId          String   — references parent Dataset
versionNumber      Number   — monotonically increasing (1, 2, 3...)
previousHash       String   — SHA-256 of prior version (empty for v1)
fileHash           String   — SHA-256 of this version's file
changeDescription  String
updatedBy          String   — wallet public key
txSignature        String   — on-chain tx signature for this version
timestamp          Number
```

---

## Known Issues & Limitations

| Issue | Details |
|---|---|
| `node` / `solana` not in PATH (macOS) | Add tool directories to `~/.zshrc` — see Prerequisites |
| No root `Cargo.toml` workspace | `cargo-build-sbf` must be run from `programs/research_provenance/` |
| Anchor CLI not included | Program can be built/deployed with raw `cargo-build-sbf` + `solana program deploy` |
| `punycode` deprecation warning | Non-breaking; comes from `@solana/web3.js` v1 on Node ≥ 21 |
| Devnet faucet rate limits | If airdrop fails, use [faucet.solana.com](https://faucet.solana.com/) manually |

---

## License

MIT
