import { JsonRpcProvider, Wallet, Contract } from 'ethers';
import { createRequire } from 'module';

const require = createRequire(import.meta.url || 'file:///');

function loadABI(contractName) {
  return require(`../abi/${contractName}.json`).abi;
}

const provider = new JsonRpcProvider(process.env.ANVIL_RPC_URL);
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
