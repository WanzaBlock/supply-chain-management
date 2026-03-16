// contract.js — Frontend contract interactions via MetaMask
import { BrowserProvider, Contract, id as ethId, keccak256, toUtf8Bytes } from 'https://cdn.jsdelivr.net/npm/ethers@6.13.0/+esm';

const SUPPLY_CHAIN_ADDRESS = '0x759030681d74Aae64b0632073444B08e1Ddc77F6';
const CHAIN_ID = '0x14a34'; // Base Sepolia 84532

async function loadABI() {
  const res = await fetch('/shared/SupplyChain.json');
  const json = await res.json();
  return json.abi || json;
}

async function getSigner() {
  if (!window.ethereum) throw new Error('MetaMask not found. Please install MetaMask.');
  const chainId = await window.ethereum.request({ method: 'eth_chainId' });
  if (chainId !== CHAIN_ID) {
    try {
      await window.ethereum.request({
        method: 'wallet_switchEthereumChain',
        params: [{ chainId: CHAIN_ID }],
      });
    } catch {
      throw new Error('Please switch MetaMask to Base Sepolia (Chain ID: 84532)');
    }
  }
  const provider = new BrowserProvider(window.ethereum);
  return provider.getSigner();
}

async function getContract() {
  const [abi, signer] = await Promise.all([loadABI(), getSigner()]);
  return new Contract(SUPPLY_CHAIN_ADDRESS, abi, signer);
}

export async function registerProductOnChain(productCode, metadataHash) {
  const contract  = await getContract();
  const productId = ethId(productCode);
  const tx        = await contract.registerProduct(productId, metadataHash);
  const receipt   = await tx.wait();
  return { txHash: receipt.hash, blockNumber: Number(receipt.blockNumber) };
}

export async function recordTransferOnChain(productCode, toAddress, location, condition, notes) {
  const contract      = await getContract();
  const productId     = ethId(productCode);
  const locationHash  = keccak256(toUtf8Bytes(JSON.stringify(location  || {})));
  const conditionHash = keccak256(toUtf8Bytes(JSON.stringify(condition || {})));
  const tx            = await contract.recordTransfer(productId, toAddress, locationHash, conditionHash, notes || '');
  const receipt       = await tx.wait();
  return { txHash: receipt.hash, blockNumber: Number(receipt.blockNumber) };
}

export async function deactivateProductOnChain(productCode) {
  const contract  = await getContract();
  const productId = ethId(productCode);
  const tx        = await contract.deactivateProduct(productId);
  const receipt   = await tx.wait();
  return { txHash: receipt.hash, blockNumber: Number(receipt.blockNumber) };
}
