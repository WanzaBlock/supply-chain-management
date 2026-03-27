// v3 — no tx.wait()
import { BrowserProvider, Contract, id as ethId, keccak256, toUtf8Bytes } from 'https://cdn.jsdelivr.net/npm/ethers@6.13.0/+esm';

const SUPPLY_CHAIN_ADDRESS = '0x759030681d74Aae64b0632073444B08e1Ddc77F6';
const CHAIN_ID = '0x14a34';

async function loadABI() {
  const res = await fetch('/shared/SupplyChain.json');
  const json = await res.json();
  return json.abi || json;
}

async function getSigner() {
  if (!window.ethereum) throw new Error('MetaMask not found.');
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

async function getContract() {
  const [abi, signer] = await Promise.all([loadABI(), getSigner()]);
  return new Contract(SUPPLY_CHAIN_ADDRESS, abi, signer);
}

async function sendTx(txPromise) {
  const tx = await txPromise;
  // Poll for receipt using public RPC to get block number
  const rpc = 'https://sepolia.base.org';
  let blockNumber = 0;
  for (let i = 0; i < 20; i++) {
    await new Promise(r => setTimeout(r, 3000));
    const res = await fetch(rpc, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ jsonrpc: '2.0', method: 'eth_getTransactionReceipt', params: [tx.hash], id: 1 })
    });
    const data = await res.json();
    if (data.result && data.result.blockNumber) {
      blockNumber = parseInt(data.result.blockNumber, 16);
      break;
    }
  }
  return { txHash: tx.hash, blockNumber };
}

export async function registerProductOnChain(productCode, metadataHash) {
  const contract  = await getContract();
  const productId = ethId(productCode);
  return sendTx(contract.registerProduct(productId, metadataHash));
}

export async function recordTransferOnChain(productCode, toAddress, location, condition, notes) {
  const contract      = await getContract();
  const productId     = ethId(productCode);
  const locationHash  = keccak256(toUtf8Bytes(JSON.stringify(location  || {})));
  const conditionHash = keccak256(toUtf8Bytes(JSON.stringify(condition || {})));
  return sendTx(contract.recordTransfer(productId, toAddress, locationHash, conditionHash, notes || ''));
}

export async function deactivateProductOnChain(productCode) {
  const contract  = await getContract();
  const productId = ethId(productCode);
  return sendTx(contract.deactivateProduct(productId));
}
