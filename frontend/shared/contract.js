// contract.js — Frontend contract interactions via MetaMask
// Uses window.ethereum as signer — no private key on frontend

import { BrowserProvider, Contract, id as ethId, keccak256, toUtf8Bytes } from
  'https://esm.sh/ethers@6.13.0';

const SUPPLY_CHAIN_ADDRESS = '0x4a698d6a6988Fd84BA101c07Ad36E7Da4a7ab666';
const CHAIN_ID = '0x14a34'; // Base Sepolia 84532

// ── Load ABI ──────────────────────────────────────────────────────────────────
async function loadABI() {
  const res = await fetch('/shared/SupplyChain.json');
  const json = await res.json();
  return json.abi || json;
}

// ── Get signer from MetaMask ──────────────────────────────────────────────────
async function getSigner() {
  if (!window.ethereum) throw new Error('MetaMask not found');
  // Ensure correct network
  const chainId = await window.ethereum.request({ method: 'eth_chainId' });
  if (chainId !== CHAIN_ID) {
    await window.ethereum.request({
      method: 'wallet_switchEthereumChain',
      params: [{ chainId: CHAIN_ID }],
    });
  }
  const provider = new BrowserProvider(window.ethereum);
  return provider.getSigner();
}

// ── Get contract instance ─────────────────────────────────────────────────────
async function getContract() {
  const [abi, signer] = await Promise.all([loadABI(), getSigner()]);
  return new Contract(SUPPLY_CHAIN_ADDRESS, abi, signer);
}

// ── registerProduct ───────────────────────────────────────────────────────────
// MetaMask signs: registerProduct(bytes32 productId, string metadataHash)
export async function registerProductOnChain(productCode, metadataHash) {
  const contract   = await getContract();
  const productId  = ethId(productCode);
  const tx         = await contract.registerProduct(productId, metadataHash);
  const receipt    = await tx.wait();
  return { txHash: receipt.hash, blockNumber: Number(receipt.blockNumber) };
}

// ── recordTransfer ────────────────────────────────────────────────────────────
// MetaMask signs: recordTransfer(bytes32, address, string, string, string)
export async function recordTransferOnChain(productCode, toAddress, location, condition, notes) {
  const contract      = await getContract();
  const productId     = ethId(productCode);
  const locationHash  = keccak256(toUtf8Bytes(JSON.stringify(location  || {})));
  const conditionHash = keccak256(toUtf8Bytes(JSON.stringify(condition || {})));
  const tx            = await contract.recordTransfer(productId, toAddress, locationHash, conditionHash, notes || '');
  const receipt       = await tx.wait();
  return { txHash: receipt.hash, blockNumber: Number(receipt.blockNumber) };
}

// ── deactivateProduct ─────────────────────────────────────────────────────────
// MetaMask signs: deactivateProduct(bytes32 productId)
export async function deactivateProductOnChain(productCode) {
  const contract  = await getContract();
  const productId = ethId(productCode);
  const tx        = await contract.deactivateProduct(productId);
  const receipt   = await tx.wait();
  return { txHash: receipt.hash, blockNumber: Number(receipt.blockNumber) };
}
