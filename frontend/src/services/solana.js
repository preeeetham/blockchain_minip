import {
  Connection,
  PublicKey,
  Transaction,
  TransactionInstruction,
  SystemProgram,
  clusterApiUrl,
} from '@solana/web3.js';

export const PROGRAM_ID = new PublicKey('F2PY8AKbNuTe36RuVHpgnxunkQWqwWy2MEnSMsNX2VqD');
export const connection = new Connection(clusterApiUrl('devnet'), 'confirmed');

// ── Helpers ────────────────────────────────────────────────────────────────

/**
 * Compute the 8-byte Anchor instruction discriminator.
 * Anchor uses sha256("global:<snake_case_name>")[0..8]
 */
async function getDiscriminator(instructionName) {
  const msg = new TextEncoder().encode(`global:${instructionName}`);
  const hashBuffer = await crypto.subtle.digest('SHA-256', msg);
  return Buffer.from(new Uint8Array(hashBuffer).slice(0, 8));
}

/** Borsh-encode a string: 4-byte LE length prefix + UTF-8 bytes */
function borshString(str) {
  const bytes = Buffer.from(str, 'utf-8');
  const lenBuf = Buffer.alloc(4);
  lenBuf.writeUInt32LE(bytes.length, 0);
  return Buffer.concat([lenBuf, bytes]);
}

/** Borsh-encode a u32 (little-endian) */
function borshU32(num) {
  const buf = Buffer.alloc(4);
  buf.writeUInt32LE(num, 0);
  return buf;
}

/** Borsh-encode a Pubkey (32 raw bytes) */
function borshPubkey(pubkey) {
  return pubkey.toBuffer();
}

// ── PDA Derivation ─────────────────────────────────────────────────────────

export function getDatasetPda(datasetId) {
  return PublicKey.findProgramAddressSync(
    [Buffer.from("dataset"), Buffer.from(datasetId)],
    PROGRAM_ID
  )[0];
}

export function getVersionPda(datasetId, versionNumber) {
  const buf = Buffer.alloc(4);
  buf.writeUInt32LE(versionNumber, 0);
  return PublicKey.findProgramAddressSync(
    [Buffer.from("version"), Buffer.from(datasetId), buf],
    PROGRAM_ID
  )[0];
}

// ── Transaction Builder ────────────────────────────────────────────────────

/**
 * Build, sign via wallet, send, and confirm a transaction.
 */
async function buildAndSend(walletAdapter, walletPubkey, instruction) {
  const tx = new Transaction().add(instruction);
  tx.feePayer = walletPubkey;
  const { blockhash, lastValidBlockHeight } = await connection.getLatestBlockhash('confirmed');
  tx.recentBlockhash = blockhash;

  const signed = await walletAdapter.signTransaction(tx);
  const rawTx = signed.serialize();
  const sig = await connection.sendRawTransaction(rawTx, { skipPreflight: false });
  await connection.confirmTransaction({ signature: sig, blockhash, lastValidBlockHeight }, 'confirmed');

  return sig;
}

// ── Instructions ───────────────────────────────────────────────────────────

/**
 * Register a dataset on-chain
 */
export async function registerDatasetOnChain(walletAdapter, publicKeyStr, payload) {
  const walletPubkey = new PublicKey(publicKeyStr);
  const datasetPda = getDatasetPda(payload.datasetId);

  const disc = await getDiscriminator('register_dataset');
  const data = Buffer.concat([
    disc,
    borshString(payload.datasetId),
    borshString(payload.name),
    borshString(payload.description || ''),
    borshString(payload.fileHash),
    borshString(payload.ipfsCid || ''),
    borshString(payload.metadataUri || ''),
  ]);

  const ix = new TransactionInstruction({
    keys: [
      { pubkey: datasetPda, isSigner: false, isWritable: true },
      { pubkey: walletPubkey, isSigner: true, isWritable: true },
      { pubkey: SystemProgram.programId, isSigner: false, isWritable: false },
    ],
    programId: PROGRAM_ID,
    data,
  });

  const sig = await buildAndSend(walletAdapter, walletPubkey, ix);
  return { signature: sig };
}

/**
 * Update a dataset version on-chain
 */
export async function updateDatasetOnChain(walletAdapter, publicKeyStr, updatePayload) {
  const walletPubkey = new PublicKey(publicKeyStr);
  const datasetPda = getDatasetPda(updatePayload.datasetId);
  const versionPda = getVersionPda(updatePayload.datasetId, updatePayload.versionNumber);

  const disc = await getDiscriminator('update_dataset');
  const data = Buffer.concat([
    disc,
    borshString(updatePayload.datasetId),
    borshU32(updatePayload.versionNumber),
    borshString(updatePayload.newFileHash),
    borshString(updatePayload.changeDescription || 'Version update'),
    borshString(updatePayload.ipfsCid || ''),
  ]);

  const ix = new TransactionInstruction({
    keys: [
      { pubkey: datasetPda, isSigner: false, isWritable: true },
      { pubkey: versionPda, isSigner: false, isWritable: true },
      { pubkey: walletPubkey, isSigner: true, isWritable: true },
      { pubkey: SystemProgram.programId, isSigner: false, isWritable: false },
    ],
    programId: PROGRAM_ID,
    data,
  });

  const sig = await buildAndSend(walletAdapter, walletPubkey, ix);
  return { signature: sig };
}

/**
 * Transfer ownership of a dataset on-chain
 */
export async function transferOwnershipOnChain(walletAdapter, publicKeyStr, payload) {
  const walletPubkey = new PublicKey(publicKeyStr);
  const datasetPda = getDatasetPda(payload.datasetId);
  const versionPda = getVersionPda(payload.datasetId, payload.versionNumber);
  const newAuthorityKey = new PublicKey(payload.newAuthority);

  const disc = await getDiscriminator('transfer_ownership');
  const data = Buffer.concat([
    disc,
    borshString(payload.datasetId),
    borshU32(payload.versionNumber),
    borshPubkey(newAuthorityKey),
  ]);

  const ix = new TransactionInstruction({
    keys: [
      { pubkey: datasetPda, isSigner: false, isWritable: true },
      { pubkey: versionPda, isSigner: false, isWritable: true },
      { pubkey: walletPubkey, isSigner: true, isWritable: true },
      { pubkey: SystemProgram.programId, isSigner: false, isWritable: false },
    ],
    programId: PROGRAM_ID,
    data,
  });

  const sig = await buildAndSend(walletAdapter, walletPubkey, ix);
  return { signature: sig };
}

/**
 * Deactivate a dataset on-chain
 */
export async function deactivateDatasetOnChain(walletAdapter, publicKeyStr, payload) {
  const walletPubkey = new PublicKey(publicKeyStr);
  const datasetPda = getDatasetPda(payload.datasetId);

  const disc = await getDiscriminator('deactivate_dataset');
  const data = Buffer.concat([
    disc,
    borshString(payload.datasetId),
  ]);

  const ix = new TransactionInstruction({
    keys: [
      { pubkey: datasetPda, isSigner: false, isWritable: true },
      { pubkey: walletPubkey, isSigner: true, isWritable: true },
    ],
    programId: PROGRAM_ID,
    data,
  });

  const sig = await buildAndSend(walletAdapter, walletPubkey, ix);
  return { signature: sig };
}

export function getExplorerUrl(signature, cluster = 'devnet') {
  return `https://explorer.solana.com/tx/${signature}?cluster=${cluster}`;
}
