import { JsonRpcProvider, Wallet, Contract } from 'ethers';
import { readFileSync } from 'fs';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';

const __dirname = dirname(fileURLToPath(import.meta.url));

// Load ABIs from Foundry output
function loadABI(contractName) {
  const abiPath = join(__dirname, '..', 'abi', `${contractName}.json`);
  return JSON.parse(readFileSync(abiPath, 'utf8'));
}

const provider = new JsonRpcProvider(process.env.RPC_URL);
const signer   = new Wallet(process.env.PRIVATE_KEY, provider);

export const supplyChain = new Contract(
  process.env.SUPPLY_CHAIN_ADDRESS,
  loadABI('SupplyChain'),
  signer
);

export const accessControl = new Contract(
  process.env.ACCESS_CONTRACT_ADDRESS,
  loadABI('SupplyChainAccess'),
  signer
);

export { provider, signer };
