import {
  Connection,
  PublicKey,
  clusterApiUrl,
  SystemProgram,
} from '@solana/web3.js';
import { Program, AnchorProvider } from '@coral-xyz/anchor';
import idl from '../idl/research_provenance.json';

export const PROGRAM_ID = new PublicKey('FkZMTjPTBGEWUE2dRbdjLBjMPE4gwt1ME5G3qg3xbXwK');
export const connection = new Connection(clusterApiUrl('devnet'), 'confirmed');

function getProvider(walletAdapter, publicKeyStr) {
  const safeWallet = {
    publicKey: new PublicKey(publicKeyStr),
    signTransaction: walletAdapter.signTransaction.bind(walletAdapter),
    signAllTransactions: walletAdapter.signAllTransactions.bind(walletAdapter)
  };
  const provider = new AnchorProvider(connection, safeWallet, { preflightCommitment: 'confirmed' });
  return provider;
}

function getProgram(walletAdapter, publicKeyStr) {
  const provider = getProvider(walletAdapter, publicKeyStr);
  return new Program(idl, PROGRAM_ID, provider);
}

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

/**
 * Register a dataset on-chain
 */
export async function registerDatasetOnChain(walletAdapter, publicKeyStr, datasetPayload) {
  const walletPublicKey = new PublicKey(publicKeyStr);
  const program = getProgram(walletAdapter, publicKeyStr);
  
  const datasetPda = getDatasetPda(datasetPayload.datasetId);
  
  console.log("DEBUG: datasetPda =", datasetPda);
  console.log("DEBUG: walletPublicKey =", walletPublicKey);
  console.log("DEBUG: SystemProgram.programId =", SystemProgram.programId);
  console.log("DEBUG: DatasetPayload =", datasetPayload);

  const tx = await program.methods
    .registerDataset(
      datasetPayload.datasetId,
      datasetPayload.name,
      datasetPayload.description || "",
      datasetPayload.fileHash,
      datasetPayload.ipfsCid || "",
      datasetPayload.metadataUri || ""
    )
    .accounts({
      datasetRecord: datasetPda,
      authority: walletPublicKey,
      systemProgram: SystemProgram.programId,
    })
    .rpc();

  return { signature: tx };
}

/**
 * Update a dataset version on-chain
 */
export async function updateDatasetOnChain(walletAdapter, publicKeyStr, updatePayload) {
  const walletPublicKey = new PublicKey(publicKeyStr);
  const program = getProgram(walletAdapter, publicKeyStr);

  const datasetPda = getDatasetPda(updatePayload.datasetId);
  const versionPda = getVersionPda(updatePayload.datasetId, updatePayload.versionNumber);

  const tx = await program.methods
    .updateDataset(
      updatePayload.datasetId,
      updatePayload.versionNumber,
      updatePayload.newFileHash,
      updatePayload.changeDescription || "Version update",
      updatePayload.ipfsCid || ""
    )
    .accounts({
      datasetRecord: datasetPda,
      versionRecord: versionPda,
      authority: walletPublicKey,
      systemProgram: SystemProgram.programId,
    })
    .rpc();

  return { signature: tx };
}

/**
 * Transfer ownership of a dataset on-chain
 */
export async function transferOwnershipOnChain(walletAdapter, publicKeyStr, payload) {
  const walletPublicKey = new PublicKey(publicKeyStr);
  const program = getProgram(walletAdapter, publicKeyStr);

  const datasetPda = getDatasetPda(payload.datasetId);
  const versionPda = getVersionPda(payload.datasetId, payload.versionNumber);
  const newAuthorityKey = new PublicKey(payload.newAuthority);

  const tx = await program.methods
    .transferOwnership(payload.datasetId, payload.versionNumber, newAuthorityKey)
    .accounts({
      datasetRecord: datasetPda,
      versionRecord: versionPda,
      authority: walletPublicKey,
      systemProgram: SystemProgram.programId,
    })
    .rpc();

  return { signature: tx };
}

/**
 * Deactivate a dataset on-chain
 */
export async function deactivateDatasetOnChain(walletAdapter, publicKeyStr, payload) {
  const walletPublicKey = new PublicKey(publicKeyStr);
  const program = getProgram(walletAdapter, publicKeyStr);

  const datasetPda = getDatasetPda(payload.datasetId);

  const tx = await program.methods
    .deactivateDataset(payload.datasetId)
    .accounts({
      datasetRecord: datasetPda,
      authority: walletPublicKey,
    })
    .rpc();

  return { signature: tx };
}

export function getExplorerUrl(signature, cluster = 'devnet') {
  return `https://explorer.solana.com/tx/${signature}?cluster=${cluster}`;
}
