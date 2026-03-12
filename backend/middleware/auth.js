import { supabase } from '../lib/supabase.js';

/// requireRole('MANUFACTURER') — returns middleware that checks wallet address
/// against the users table in Supabase.
///
/// Frontend must send:  x-wallet-address: 0x...
export function requireRole(role) {
  return async (req, res, next) => {
    const wallet = req.headers['x-wallet-address'];
    if (!wallet) {
      return res.status(401).json({ error: 'Missing x-wallet-address header' });
    }

    const { data, error } = await supabase
      .from('users')
      .select('role, name')
      .eq('wallet', wallet.toLowerCase())
      .single();

    if (error || !data) {
      return res.status(401).json({ error: 'Wallet not registered' });
    }
    if (data.role !== role) {
      return res.status(403).json({
        error: `Requires role ${role}, got ${data.role}`
      });
    }

    req.user = { wallet: wallet.toLowerCase(), role: data.role, name: data.name };
    next();
  };
}

/// requireAnyRole(['MANUFACTURER', 'DISTRIBUTOR'])
export function requireAnyRole(roles) {
  return async (req, res, next) => {
    const wallet = req.headers['x-wallet-address'];
    if (!wallet) {
      return res.status(401).json({ error: 'Missing x-wallet-address header' });
    }

    const { data, error } = await supabase
      .from('users')
      .select('role, name')
      .eq('wallet', wallet.toLowerCase())
      .single();

    if (error || !data) {
      return res.status(401).json({ error: 'Wallet not registered' });
    }
    if (!roles.includes(data.role)) {
      return res.status(403).json({
        error: `Requires one of ${roles.join(', ')}, got ${data.role}`
      });
    }

    req.user = { wallet: wallet.toLowerCase(), role: data.role, name: data.name };
    next();
  };
}
