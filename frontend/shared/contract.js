import { BrowserProvider, Contract, id as ethId, keccak256, toUtf8Bytes } from "https://esm.sh/ethers@6";

const SUPPLY_CHAIN_ADDRESS = "0x759030681d74Aae64b0632073444B08e1Ddc77F6";

async function getABI() {
  const res = await fetch("/shared/SupplyChain.json");
  const json = await res.json();
  return json.abi;
}

export async function registerProduct(productCode, metadataHash) {
  const abi      = await getABI();
  const provider = new BrowserProvider(window.ethereum);
  const signer   = await provider.getSigner();
  const contract = new Contract(SUPPLY_CHAIN_ADDRESS, abi, signer);
  const productId = ethId(productCode);
  const tx = await contract.registerProduct(productId, metadataHash);
  return await tx.wait();
}

export async function recordTransfer(productCode, toAddress, location, condition, notes) {
  const abi      = await getABI();
  const provider = new BrowserProvider(window.ethereum);
  const signer   = await provider.getSigner();
  const contract = new Contract(SUPPLY_CHAIN_ADDRESS, abi, signer);
  const productId     = ethId(productCode);
  const locationHash  = keccak256(toUtf8Bytes(JSON.stringify(location || {})));
  const conditionHash = keccak256(toUtf8Bytes(JSON.stringify(condition || {})));
  const tx = await contract.recordTransfer(productId, toAddress, locationHash, conditionHash, notes || "");
  return await tx.wait();
}

export async function deactivateProduct(productCode) {
  const abi      = await getABI();
  const provider = new BrowserProvider(window.ethereum);
  const signer   = await provider.getSigner();
  const contract = new Contract(SUPPLY_CHAIN_ADDRESS, abi, signer);
  const productId = ethId(productCode);
  const tx = await contract.deactivateProduct(productId);
  return await tx.wait();
}
