/**
 * shared/api.js — Shared API client and wallet helpers
 * Web3Modal + WalletConnect for mobile support
 */

const API = 'https://supply-chain-backend-a4y7.onrender.com/api';

// ── Web3Modal Setup ───────────────────────────────────────────────────────────

const PROJECT_ID = '37ceb3970a0d4c526cffe3d5f6693252';

const metadata = {
  name: 'WanzaBlock Supply Chain',
  description: 'Blockchain-powered supply chain management',
  url: 'https://wanzablocksupply.vercel.app',
  icons: ['https://wanzablocksupply.vercel.app/favicon.ico']
};

// Dynamically load Web3Modal
let modal = null;

async function getModal() {
  if (modal) return modal;

  const { createWeb3Modal, defaultConfig } = await import(
    'https://esm.sh/@web3modal/ethers@4.2.3'
  );

  const baseSepolia = {
    chainId: 84532,
    name: 'Base Sepolia',
    currency: 'ETH',
    explorerUrl: 'https://sepolia.basescan.org',
    rpcUrl: 'https://base-sepolia.g.alchemy.com/v2/BhFH8jdb7OWzKXhPKbPzL'
  };

  modal = createWeb3Modal({
    ethersConfig: defaultConfig({ metadata }),
    chains: [baseSepolia],
    projectId: PROJECT_ID,
    themeMode: 'light',
    themeVariables: {
      '--w3m-accent': '#1a3a5c',
    }
  });

  return modal;
}

// ── Wallet connection ─────────────────────────────────────────────────────────

export async function connectWallet() {
  const m = await getModal();
  await m.open();

  return new Promise((resolve, reject) => {
    const unsub = m.subscribeProvider(({ isConnected, address, chainId }) => {
      if (isConnected && address) {
        unsub();
        if (chainId !== 84532) {
          alert('Please switch to Base Sepolia network (Chain ID: 84532)');
        }
        resolve(address);
      }
    });
    // Timeout after 2 minutes
    setTimeout(() => { unsub(); reject(new Error('Connection timeout')); }, 120000);
  });
}

export async function getWallet() {
  try {
    const m = await getModal();
    const { isConnected, address } = m.getState();
    return isConnected ? address : null;
  } catch {
    // Fallback to window.ethereum
    if (!window.ethereum) return null;
    const accounts = await window.ethereum.request({ method: 'eth_accounts' });
    return accounts[0] || null;
  }
}

export async function disconnectWallet() {
  try {
    const m = await getModal();
    await m.disconnect();
  } catch {
    // fallback
  }
  window.location.reload();
}

export function shortenAddress(addr) {
  if (!addr) return '';
  return `${addr.slice(0, 6)}...${addr.slice(-4)}`;
}

// ── API helpers ───────────────────────────────────────────────────────────────

async function apiFetch(path, options = {}, wallet = null) {
  const headers = { 'Content-Type': 'application/json', ...options.headers };
  if (wallet) headers['x-wallet-address'] = wallet;
  const res  = await fetch(`${API}${path}`, { ...options, headers });
  const data = await res.json();
  if (!res.ok) throw new Error(data.error || 'API error');
  return data;
}

// ── Products ──────────────────────────────────────────────────────────────────

export const products = {
  register(body, wallet) {
    return apiFetch('/products/register', { method: 'POST', body: JSON.stringify(body) }, wallet);
  },
  get(productCode) {
    return apiFetch(`/products/${encodeURIComponent(productCode)}`);
  },
  history(productCode) {
    return apiFetch(`/products/${encodeURIComponent(productCode)}/history`);
  },
  transfer(productCode, body, wallet) {
    return apiFetch(`/products/${encodeURIComponent(productCode)}/transfer`, {
      method: 'POST', body: JSON.stringify(body)
    }, wallet);
  },
  deactivate(productCode, reason, wallet) {
    return apiFetch(`/products/${encodeURIComponent(productCode)}/deactivate`, {
      method: 'POST', body: JSON.stringify({ reason })
    }, wallet);
  },
  list(params = {}) {
    const qs = new URLSearchParams(params).toString();
    return apiFetch(`/products?${qs}`);
  },
};

// ── Audit ─────────────────────────────────────────────────────────────────────

export const audit = {
  events(params, wallet) {
    const qs = new URLSearchParams(params).toString();
    return apiFetch(`/audit/events?${qs}`, {}, wallet);
  },
  flags(wallet) {
    return apiFetch('/audit/flags', {}, wallet);
  },
  summary(wallet) {
    return apiFetch('/audit/summary', {}, wallet);
  },
  resolveFlag(id, wallet) {
    return apiFetch(`/audit/flags/${id}/resolve`, { method: 'POST' }, wallet);
  },
};

// ── Users ─────────────────────────────────────────────────────────────────────

export const users = {
  getRole(wallet) {
    return apiFetch(`/users/${wallet}/role`);
  },
};

// ── UI helpers ────────────────────────────────────────────────────────────────

export function formatTimestamp(ts) {
  if (!ts) return '—';
  return new Date(ts * 1000).toLocaleString();
}

export function setStatus(el, msg, type = 'info') {
  if (!el) return;
  el.textContent = msg;
  el.className   = `status ${type}`;
}
