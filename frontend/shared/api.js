/**
 * shared/api.js — Shared API client and wallet helpers
 * Used by all three dashboards.
 */

const API = 'https://supply-chain-backend-a4y7.onrender.com/api';

// ── Wallet connection ─────────────────────────────────────────────────────────

export async function connectWallet() {
  if (!window.ethereum) throw new Error('MetaMask not found. Please install it.');
  const accounts = await window.ethereum.request({ method: 'eth_requestAccounts' });
  return accounts[0];
}

export async function getWallet() {
  if (!window.ethereum) return null;
  const accounts = await window.ethereum.request({ method: 'eth_accounts' });
  return accounts[0] || null;
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
