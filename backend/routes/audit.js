import express from 'express';
import { supabase }   from '../lib/supabase.js';
import { requireRole } from '../middleware/auth.js';

const router = express.Router();

// ── GET /api/audit/events ─────────────────────────────────────────────────────
// Full event list for regulators. Supports date range and product filters.
router.get('/events', requireRole('REGULATOR'), async (req, res) => {
  try {
    const { from, to, product_id, limit = 100, offset = 0 } = req.query;

    let query = supabase
      .from('events')
      .select('*, products(name, batch_number, origin)', { count: 'exact' })
      .range(Number(offset), Number(offset) + Number(limit) - 1)
      .order('recorded_at', { ascending: false });

    if (from)       query = query.gte('recorded_at', from);
    if (to)         query = query.lte('recorded_at', to);
    if (product_id) query = query.eq('product_id', product_id);

    const { data, count, error } = await query;
    if (error) throw new Error(error.message);

    res.json({ events: data, total: count });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// ── GET /api/audit/flags ──────────────────────────────────────────────────────
// Flagged / deactivated products.
router.get('/flags', requireRole('REGULATOR'), async (req, res) => {
  try {
    const { data, error } = await supabase
      .from('flags')
      .select('*, products(name, batch_number, manufacturer_wallet)')
      .order('created_at', { ascending: false });

    if (error) throw new Error(error.message);
    res.json({ flags: data });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// ── GET /api/audit/summary ────────────────────────────────────────────────────
// High-level stats for the regulator dashboard.
router.get('/summary', requireRole('REGULATOR'), async (req, res) => {
  try {
    const [products, events, flags] = await Promise.all([
      supabase.from('products').select('*', { count: 'exact', head: true }),
      supabase.from('events').select('*',   { count: 'exact', head: true }),
      supabase.from('flags').select('*',    { count: 'exact', head: true }).eq('resolved', false),
    ]);

    res.json({
      totalProducts:   products.count,
      totalTransfers:  events.count,
      openFlags:       flags.count,
    });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// ── POST /api/audit/flags/:id/resolve ────────────────────────────────────────
// Mark a flag as resolved.
router.post('/flags/:id/resolve', requireRole('REGULATOR'), async (req, res) => {
  try {
    const { error } = await supabase
      .from('flags')
      .update({ resolved: true, resolved_by: req.user.wallet, resolved_at: new Date().toISOString() })
      .eq('id', req.params.id);

    if (error) throw new Error(error.message);
    res.json({ success: true });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

export default router;
