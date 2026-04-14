import {
  Connection,
  Transaction,
  TransactionInstruction,
  PublicKey,
  clusterApiUrl,
  SystemProgram,
} from '@solana/web3.js'

// SPL Memo Program — available on all Solana clusters, no deployment needed.
// It records any UTF-8 string as an on-chain memo signed by the wallet.
const MEMO_PROGRAM_ID = new PublicKey('MemoSq4gqABAXKb96qnH8TysNcWxMyWCqXgDLGmfcHr')

export const connection = new Connection(clusterApiUrl('devnet'), 'confirmed')

/**
 * Build a Memo instruction embedding dataset provenance data.
 * The memo is a compact JSON string containing the hash and key metadata.
 */
function buildMemoInstruction(walletPublicKey, memoPayload) {
  const memoString = JSON.stringify(memoPayload)
  return new TransactionInstruction({
    keys: [{ pubkey: walletPublicKey, isSigner: true, isWritable: false }],
    programId: MEMO_PROGRAM_ID,
    data: new TextEncoder().encode(memoString), // TextEncoder is browser-native (no Buffer needed)
  })
}

/**
 * Register a dataset on-chain via a signed Memo transaction.
 *
 * @param {object} walletAdapter  - connected wallet (window.phantom.solana, etc.)
 * @param {string} publicKeyStr   - wallet public key string
 * @param {object} datasetPayload - { name, fileHash, datasetId, version, timestamp }
 * @returns {{ signature: string }}
 */
export async function registerDatasetOnChain(walletAdapter, publicKeyStr, datasetPayload) {
  const walletPublicKey = new PublicKey(publicKeyStr)

  const memo = {
    app: 'DataProve',
    action: 'REGISTER_DATASET',
    datasetId: datasetPayload.datasetId,
    name: datasetPayload.name,
    hash: datasetPayload.fileHash,
    version: 1,
    ts: Math.floor(Date.now() / 1000),
  }

  const transaction = new Transaction()
  transaction.add(buildMemoInstruction(walletPublicKey, memo))
  transaction.feePayer = walletPublicKey

  // Get latest blockhash (required for transaction validity)
  const { blockhash, lastValidBlockHeight } = await connection.getLatestBlockhash('confirmed')
  transaction.recentBlockhash = blockhash

  // 🔑 This triggers the Phantom / Solflare / Backpack popup!
  const signedTx = await walletAdapter.signTransaction(transaction)

  // Broadcast to Solana devnet
  const rawTx = signedTx.serialize()
  const signature = await connection.sendRawTransaction(rawTx, {
    skipPreflight: false,
    preflightCommitment: 'confirmed',
  })

  // Wait for confirmation
  await connection.confirmTransaction(
    { signature, blockhash, lastValidBlockHeight },
    'confirmed'
  )

  return { signature }
}

/**
 * Update dataset version on-chain via signed Memo transaction.
 */
export async function updateDatasetOnChain(walletAdapter, publicKeyStr, updatePayload) {
  const walletPublicKey = new PublicKey(publicKeyStr)

  const memo = {
    app: 'DataProve',
    action: 'UPDATE_DATASET',
    datasetId: updatePayload.datasetId,
    newHash: updatePayload.newFileHash,
    version: updatePayload.versionNumber,
    ts: Math.floor(Date.now() / 1000),
  }

  const transaction = new Transaction()
  transaction.add(buildMemoInstruction(walletPublicKey, memo))
  transaction.feePayer = walletPublicKey

  const { blockhash, lastValidBlockHeight } = await connection.getLatestBlockhash('confirmed')
  transaction.recentBlockhash = blockhash

  const signedTx = await walletAdapter.signTransaction(transaction)
  const signature = await connection.sendRawTransaction(signedTx.serialize(), {
    skipPreflight: false,
    preflightCommitment: 'confirmed',
  })

  await connection.confirmTransaction(
    { signature, blockhash, lastValidBlockHeight },
    'confirmed'
  )

  return { signature }
}

/**
 * Get the Solana Explorer URL for a transaction signature.
 */
export function getExplorerUrl(signature, cluster = 'devnet') {
  return `https://explorer.solana.com/tx/${signature}?cluster=${cluster}`
}
