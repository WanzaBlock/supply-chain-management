import express from 'express';
import { accessControl } from '../lib/contract.js';
import { supabase }       from '../lib/supabase.js';
import { requireRole }    from '../middleware/auth.js';

const router = express.Router();

// ── POST /api/users/register ──────────────────────────────────────────────────
router.post('/register', async (req, res) => {
  try {
    const { wallet, role, name } = req.body;
    if (!wallet || !role) return res.status(400).json({ error: 'wallet and role required' });
    const { error } = await supabase.from('users').upsert({
      wallet: wallet.toLowerCase(), role, name: name || '',
    }, { onConflict: 'wallet' });
    if (error) throw new Error(error.message);
    res.json({ success: true });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// ── GET /api/users/:wallet/role ───────────────────────────────────────────────
router.get('/:wallet/role', async (req, res) => {
  try {
    const role = await accessControl.getRole(req.params.wallet);
    res.json({ wallet: req.params.wallet, role });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// ── POST /api/users/assign-role ───────────────────────────────────────────────
// Backend signs with deployer key — only REGULATOR can call this endpoint
router.post('/assign-role', requireRole('REGULATOR'), async (req, res) => {
  try {
    const { wallet, role, name } = req.body;
    if (!wallet || !role) return res.status(400).json({ error: 'wallet and role required' });
    const ROLES = {
      MANUFACTURER: await accessControl.MANUFACTURER(),
      DISTRIBUTOR:  await accessControl.DISTRIBUTOR(),
      REGULATOR:    await accessControl.REGULATOR(),
      CONSUMER:     await accessControl.CONSUMER(),
    };
    if (!ROLES[role]) return res.status(400).json({ error: 'Unknown role' });
    const tx      = await accessControl.assignRole(wallet, ROLES[role]);
    const receipt = await tx.wait();
    await supabase.from('users').upsert({
      wallet: wallet.toLowerCase(), role, name: name || '',
    }, { onConflict: 'wallet' });
    res.json({ success: true, txHash: receipt.hash });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

export default router;
