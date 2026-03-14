import { JsonRpcProvider, Wallet, Contract } from 'ethers';
import { createRequire } from 'module';
const require = createRequire(import.meta.url);
const supplyChainABI = require('../abi/SupplyChain.json');
const accessControlABI = require('../abi/SupplyChainAccess.json');

const provider = new JsonRpcProvider(process.env.ANVIL_RPC_URL);
const signer   = new Wallet(process.env.PRIVATE_KEY, provider);

export const supplyChain = new Contract(
  process.env.SUPPLY_CHAIN_ADDRESS,
  supplyChainABI.abi,
  signer
);

export const accessControl = new Contract(
  process.env.ACCESS_CONTRACT_ADDRESS,
  accessControlABI.abi,
  signer
);

export { provider, signer };
