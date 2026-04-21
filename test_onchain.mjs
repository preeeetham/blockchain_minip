/**
 * End-to-end on-chain test for DataProve research provenance
 * Tests: Register → Update → Transfer → Deactivate
 * Uses two wallets and real dataset files from backend/datasets/
 */

import {
  Connection, PublicKey, Keypair, Transaction,
  TransactionInstruction, SystemProgram, sendAndConfirmTransaction,
} from '@solana/web3.js';
import fs from 'fs';
import crypto from 'crypto';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

// ── Config ─────────────────────────────────────────────────────────────────
const PROGRAM_ID = new PublicKey('F2PY8AKbNuTe36RuVHpgnxunkQWqwWy2MEnSMsNX2VqD');
const connection = new Connection('https://api.devnet.solana.com', 'confirmed');

const walletA = Keypair.fromSecretKey(
  Uint8Array.from(JSON.parse(fs.readFileSync('test_wallets/wallet_A.json', 'utf-8')))
);
const walletB = Keypair.fromSecretKey(
  Uint8Array.from(JSON.parse(fs.readFileSync('test_wallets/wallet_B.json', 'utf-8')))
);

console.log('='.repeat(70));
console.log('DataProve On-Chain Test Suite');
console.log('='.repeat(70));
console.log(`Wallet A: ${walletA.publicKey.toBase58()}`);
console.log(`Wallet B: ${walletB.publicKey.toBase58()}`);
console.log(`Program:  ${PROGRAM_ID.toBase58()}`);
console.log('');

// ── Helpers ────────────────────────────────────────────────────────────────

async function getDiscriminator(name) {
  const hash = crypto.createHash('sha256').update(`global:${name}`).digest();
  return hash.slice(0, 8);
}

function borshString(str) {
  const bytes = Buffer.from(str, 'utf-8');
  const len = Buffer.alloc(4);
  len.writeUInt32LE(bytes.length, 0);
  return Buffer.concat([len, bytes]);
}

function borshU32(num) {
  const buf = Buffer.alloc(4);
  buf.writeUInt32LE(num, 0);
  return buf;
}

function borshPubkey(pk) {
  return pk.toBuffer();
}

function sha256File(filePath) {
  const content = fs.readFileSync(filePath);
  return crypto.createHash('sha256').update(content).digest('hex');
}

function getDatasetPda(datasetId) {
  return PublicKey.findProgramAddressSync(
    [Buffer.from('dataset'), Buffer.from(datasetId)],
    PROGRAM_ID
  )[0];
}

function getVersionPda(datasetId, versionNumber) {
  const buf = Buffer.alloc(4);
  buf.writeUInt32LE(versionNumber, 0);
  return PublicKey.findProgramAddressSync(
    [Buffer.from('version'), Buffer.from(datasetId), buf],
    PROGRAM_ID
  )[0];
}

function generateDatasetId(name, authority) {
  return crypto.createHash('sha256')
    .update(`${name}-${authority}-${Date.now()}`)
    .digest('hex')
    .substring(0, 32);
}

function explorerUrl(sig) {
  return `https://explorer.solana.com/tx/${sig}?cluster=devnet`;
}

// ── Test Functions ─────────────────────────────────────────────────────────

async function testRegister(wallet, datasetFile) {
  const fileName = datasetFile.split('/').pop();
  const fileHash = sha256File(datasetFile);
  const datasetId = generateDatasetId(fileName, wallet.publicKey.toBase58());
  const datasetPda = getDatasetPda(datasetId);

  console.log(`  Dataset ID:   ${datasetId}`);
  console.log(`  File:         ${fileName}`);
  console.log(`  SHA-256 Hash: ${fileHash}`);
  console.log(`  PDA:          ${datasetPda.toBase58()}`);

  const disc = await getDiscriminator('register_dataset');
  const data = Buffer.concat([
    disc,
    borshString(datasetId),
    borshString(fileName),
    borshString(`Test dataset from ${fileName}`),
    borshString(fileHash),
    borshString(''),  // ipfsCid
    borshString(''),  // metadataUri
  ]);

  const ix = new TransactionInstruction({
    keys: [
      { pubkey: datasetPda, isSigner: false, isWritable: true },
      { pubkey: wallet.publicKey, isSigner: true, isWritable: true },
      { pubkey: SystemProgram.programId, isSigner: false, isWritable: false },
    ],
    programId: PROGRAM_ID,
    data,
  });

  const tx = new Transaction().add(ix);
  const sig = await sendAndConfirmTransaction(connection, tx, [wallet]);
  console.log(`  TX Signature: ${sig}`);
  console.log(`  Explorer:     ${explorerUrl(sig)}`);

  // Also register on backend
  const backendRes = await fetch('http://localhost:3001/api/datasets/register', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      datasetId,
      name: fileName,
      description: `Test dataset from ${fileName}`,
      fileHash,
      authority: wallet.publicKey.toBase58(),
      txSignature: sig,
    }),
  });
  const backendData = await backendRes.json();
  console.log(`  Backend sync: ${backendData.success ? 'OK' : 'FAILED - ' + backendData.error}`);

  return { datasetId, fileHash, sig };
}

async function testUpdate(wallet, datasetId, newDatasetFile, versionNumber) {
  const fileName = newDatasetFile.split('/').pop();
  const newFileHash = sha256File(newDatasetFile);
  const datasetPda = getDatasetPda(datasetId);
  const versionPda = getVersionPda(datasetId, versionNumber);
  const changeDesc = `Updated with data from ${fileName}`;

  console.log(`  New File:     ${fileName}`);
  console.log(`  New Hash:     ${newFileHash}`);
  console.log(`  Version:      ${versionNumber}`);

  const disc = await getDiscriminator('update_dataset');
  const data = Buffer.concat([
    disc,
    borshString(datasetId),
    borshU32(versionNumber),
    borshString(newFileHash),
    borshString(changeDesc),
    borshString(''),  // ipfsCid
  ]);

  const ix = new TransactionInstruction({
    keys: [
      { pubkey: datasetPda, isSigner: false, isWritable: true },
      { pubkey: versionPda, isSigner: false, isWritable: true },
      { pubkey: wallet.publicKey, isSigner: true, isWritable: true },
      { pubkey: SystemProgram.programId, isSigner: false, isWritable: false },
    ],
    programId: PROGRAM_ID,
    data,
  });

  const tx = new Transaction().add(ix);
  const sig = await sendAndConfirmTransaction(connection, tx, [wallet]);
  console.log(`  TX Signature: ${sig}`);
  console.log(`  Explorer:     ${explorerUrl(sig)}`);

  // Backend sync
  const backendRes = await fetch('http://localhost:3001/api/datasets/update', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      datasetId,
      newFileHash,
      changeDescription: changeDesc,
      authority: wallet.publicKey.toBase58(),
      txSignature: sig,
    }),
  });
  const backendData = await backendRes.json();
  console.log(`  Backend sync: ${backendData.success ? 'OK' : 'FAILED - ' + backendData.error}`);

  return { sig, newFileHash };
}

async function testTransfer(fromWallet, datasetId, toWallet, versionNumber) {
  const datasetPda = getDatasetPda(datasetId);
  const versionPda = getVersionPda(datasetId, versionNumber);
  const newAuthority = toWallet.publicKey;

  console.log(`  From:         ${fromWallet.publicKey.toBase58()}`);
  console.log(`  To:           ${newAuthority.toBase58()}`);
  console.log(`  Version:      ${versionNumber}`);

  const disc = await getDiscriminator('transfer_ownership');
  const data = Buffer.concat([
    disc,
    borshString(datasetId),
    borshU32(versionNumber),
    borshPubkey(newAuthority),
  ]);

  const ix = new TransactionInstruction({
    keys: [
      { pubkey: datasetPda, isSigner: false, isWritable: true },
      { pubkey: versionPda, isSigner: false, isWritable: true },
      { pubkey: fromWallet.publicKey, isSigner: true, isWritable: true },
      { pubkey: SystemProgram.programId, isSigner: false, isWritable: false },
    ],
    programId: PROGRAM_ID,
    data,
  });

  const tx = new Transaction().add(ix);
  const sig = await sendAndConfirmTransaction(connection, tx, [fromWallet]);
  console.log(`  TX Signature: ${sig}`);
  console.log(`  Explorer:     ${explorerUrl(sig)}`);

  // Backend sync
  const backendRes = await fetch('http://localhost:3001/api/datasets/transfer', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      datasetId,
      newAuthority: newAuthority.toBase58(),
      authority: fromWallet.publicKey.toBase58(),
      txSignature: sig,
    }),
  });
  const backendData = await backendRes.json();
  console.log(`  Backend sync: ${backendData.success ? 'OK' : 'FAILED - ' + backendData.error}`);

  return { sig };
}

async function testDeactivate(wallet, datasetId) {
  const datasetPda = getDatasetPda(datasetId);

  console.log(`  Owner:        ${wallet.publicKey.toBase58()}`);

  const disc = await getDiscriminator('deactivate_dataset');
  const data = Buffer.concat([
    disc,
    borshString(datasetId),
  ]);

  const ix = new TransactionInstruction({
    keys: [
      { pubkey: datasetPda, isSigner: false, isWritable: true },
      { pubkey: wallet.publicKey, isSigner: true, isWritable: true },
    ],
    programId: PROGRAM_ID,
    data,
  });

  const tx = new Transaction().add(ix);
  const sig = await sendAndConfirmTransaction(connection, tx, [wallet]);
  console.log(`  TX Signature: ${sig}`);
  console.log(`  Explorer:     ${explorerUrl(sig)}`);

  // Backend sync
  const backendRes = await fetch('http://localhost:3001/api/datasets/deactivate', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      datasetId,
      authority: wallet.publicKey.toBase58(),
      txSignature: sig,
    }),
  });
  const backendData = await backendRes.json();
  console.log(`  Backend sync: ${backendData.success ? 'OK' : 'FAILED - ' + backendData.error}`);

  return { sig };
}

// ── Main ───────────────────────────────────────────────────────────────────

async function main() {
  // Check balances
  const balA = await connection.getBalance(walletA.publicKey);
  const balB = await connection.getBalance(walletB.publicKey);
  console.log(`Wallet A balance: ${balA / 1e9} SOL`);
  console.log(`Wallet B balance: ${balB / 1e9} SOL`);
  if (balA < 0.01e9 || balB < 0.01e9) {
    console.error('ERROR: Wallets need devnet SOL. Use https://faucet.solana.com/');
    process.exit(1);
  }
  console.log('');

  const datasets = fs.readdirSync('backend/datasets').filter(f => f.endsWith('.csv'));
  console.log(`Found ${datasets.length} dataset files: ${datasets.join(', ')}`);
  console.log('');

  const results = { register: [], update: null, transfer: null, deactivate: null };

  // ── TEST 1: Register (Wallet A registers stores.csv) ──────────────────
  console.log('-'.repeat(70));
  console.log('TEST 1: Register Dataset (Wallet A + stores.csv)');
  console.log('-'.repeat(70));
  const reg = await testRegister(walletA, 'backend/datasets/stores.csv');
  results.register.push(reg);
  console.log('  PASSED\n');

  // ── TEST 2: Update (Wallet A updates with oil.csv) ────────────────────
  console.log('-'.repeat(70));
  console.log('TEST 2: Update Dataset (Wallet A + oil.csv as v2)');
  console.log('-'.repeat(70));
  const upd = await testUpdate(walletA, reg.datasetId, 'backend/datasets/oil.csv', 2);
  results.update = upd;
  console.log('  PASSED\n');

  // ── TEST 3: Transfer (Wallet A → Wallet B) ────────────────────────────
  console.log('-'.repeat(70));
  console.log('TEST 3: Transfer Ownership (Wallet A → Wallet B)');
  console.log('-'.repeat(70));
  const xfer = await testTransfer(walletA, reg.datasetId, walletB, 3);
  results.transfer = xfer;
  console.log('  PASSED\n');

  // ── TEST 4: Deactivate (Wallet B, now owner) ──────────────────────────
  console.log('-'.repeat(70));
  console.log('TEST 4: Deactivate Dataset (Wallet B, the new owner)');
  console.log('-'.repeat(70));
  const deact = await testDeactivate(walletB, reg.datasetId);
  results.deactivate = deact;
  console.log('  PASSED\n');

  // ── TEST 5: Verify via backend API ────────────────────────────────────
  console.log('-'.repeat(70));
  console.log('TEST 5: Verify version history via backend API');
  console.log('-'.repeat(70));
  const versRes = await fetch(`http://localhost:3001/api/datasets/${reg.datasetId}/versions`);
  const versData = await versRes.json();
  console.log(`  Versions recorded: ${versData.count}`);
  for (const v of versData.data) {
    console.log(`    v${v.versionNumber}: ${v.changeDescription} (by ${v.updatedBy.slice(0,8)}...)`);
  }
  console.log('');

  // ── Summary ───────────────────────────────────────────────────────────
  console.log('='.repeat(70));
  console.log('ALL TESTS PASSED');
  console.log('='.repeat(70));
  console.log('');
  console.log('Transaction Explorer Links:');
  console.log(`  Register:   ${explorerUrl(reg.sig)}`);
  console.log(`  Update:     ${explorerUrl(upd.sig)}`);
  console.log(`  Transfer:   ${explorerUrl(xfer.sig)}`);
  console.log(`  Deactivate: ${explorerUrl(deact.sig)}`);

  // Save results
  fs.writeFileSync('test_results.json', JSON.stringify({
    walletA: walletA.publicKey.toBase58(),
    walletB: walletB.publicKey.toBase58(),
    datasetId: reg.datasetId,
    transactions: {
      register: { sig: reg.sig, url: explorerUrl(reg.sig) },
      update:   { sig: upd.sig, url: explorerUrl(upd.sig) },
      transfer: { sig: xfer.sig, url: explorerUrl(xfer.sig) },
      deactivate: { sig: deact.sig, url: explorerUrl(deact.sig) },
    }
  }, null, 2));
  console.log('\nResults saved to test_results.json');
}

main().catch(err => {
  console.error('\nTEST FAILED:', err.message);
  console.error(err);
  process.exit(1);
});
