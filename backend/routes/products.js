import express from 'express';
import { id as ethId, keccak256, toUtf8Bytes } from 'ethers';
import { supplyChain } from '../lib/contract.js';
import { supabase }     from '../lib/supabase.js';
import { requireRole, requireAnyRole } from '../middleware/auth.js';

const router = express.Router();

// ── POST /api/products/register ───────────────────────────────────────────────
router.post(
  '/register',
  requireRole('MANUFACTURER'),
  async (req, res) => {
    try {
      const { productCode, name, origin, batchNumber, expiryDate, description, metadataHash, txHash, blockNumber } = req.body;
      if (!productCode || !metadataHash) return res.status(400).json({ error: 'productCode and metadataHash are required' });
      if (!txHash) return res.status(400).json({ error: 'txHash is required' });
      const productId = ethId(productCode);
      const { error } = await supabase.from('products').insert({
        product_id:          productId,
        product_code:        productCode,
        name,
        origin,
        batch_number:        batchNumber,
        expiry_date:         expiryDate,
        description,
        metadata_hash:       metadataHash,
        manufacturer_wallet: req.user.wallet,
        tx_hash:             txHash,
        block_number:        blockNumber,
      });
      if (error) console.error('Supabase insert error:', error.message);
      res.json({ success: true, productId, txHash, block: blockNumber });
    } catch (err) {
      console.error('Register error:', err.message);
      res.status(500).json({ error: err.message });
    }
  }
);

// ── GET /api/products/:code ───────────────────────────────────────────────────
router.get('/:code', async (req, res) => {
  try {
    const productId = ethId(req.params.code);
    const { data: meta } = await supabase.from('products').select('*').eq('product_id', productId).single();
    let events = [];
    try {
      const history = await supplyChain.getHistory(productId);
      events = history.map(e => ({
        from:          e.from,
        to:            e.to,
        timestamp:     Number(e.timestamp),
        locationHash:  e.locationHash,
        conditionHash: e.conditionHash,
        notes:         e.notes,
      }));
    } catch {}
    res.json({ product: meta, history: events });
  } catch (err) {
    console.error('Get product error:', err.message);
    res.status(500).json({ error: err.message });
  }
});

// ── POST /api/products/:code/transfer ─────────────────────────────────────────
router.post(
  '/:code/transfer',
  requireAnyRole(['MANUFACTURER', 'DISTRIBUTOR']),
  async (req, res) => {
    try {
      const { toAddress, location, condition, notes, sensorPayload, txHash, blockNumber } = req.body;
      if (!txHash) return res.status(400).json({ error: 'txHash is required' });
      const productId     = ethId(req.params.code);
      const locationHash  = keccak256(toUtf8Bytes(JSON.stringify(location || {})));
      const conditionHash = keccak256(toUtf8Bytes(JSON.stringify(condition || {})));
      await supabase.from('events').insert({
        product_id:     productId,
        from_addr:      req.user.wallet,
        to_addr:        toAddress.toLowerCase(),
        location_hash:  locationHash,
        condition_hash: conditionHash,
        notes,
        tx_hash:        txHash,
        block_number:   blockNumber,
      });
      if (sensorPayload) {
        await supabase.from('sensor_logs').insert({
          product_id:   productId,
          payload:      sensorPayload,
          payload_hash: conditionHash,
          recorded_at:  new Date().toISOString(),
        });
      }
      res.json({ success: true, txHash, block: blockNumber });
    } catch (err) {
      console.error('Transfer error:', err.message);
      res.status(500).json({ error: err.message });
    }
  }
);

// ── GET /api/products/:code/history ──────────────────────────────────────────
router.get('/:code/history', async (req, res) => {
  try {
    const productId = ethId(req.params.code);
    const { data, error } = await supabase.from('events').select('*').eq('product_id', productId).order('recorded_at', { ascending: true });
    if (error) throw new Error(error.message);
    res.json({ history: data });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// ── POST /api/products/:code/deactivate ──────────────────────────────────────
router.post(
  '/:code/deactivate',
  requireRole('REGULATOR'),
  async (req, res) => {
    try {
      const { txHash, blockNumber } = req.body;
      if (!txHash) return res.status(400).json({ error: 'txHash is required' });
      const productId = ethId(req.params.code);
      await supabase.from('flags').insert({
        product_id: productId,
        reason:     req.body.reason || 'Deactivated by regulator',
        flagged_by: req.user.wallet,
        tx_hash:    txHash,
      });
      await supabase.from('products').update({ is_active: false, deactivated_at: new Date().toISOString() }).eq('product_id', productId);
      res.json({ success: true, txHash });
    } catch (err) {
      res.status(500).json({ error: err.message });
    }
  }
);

// ── GET /api/products ─────────────────────────────────────────────────────────
router.get('/', async (req, res) => {
  try {
    const { manufacturer, limit = 50, offset = 0 } = req.query;
    let query = supabase.from('products').select('*', { count: 'exact' }).range(Number(offset), Number(offset) + Number(limit) - 1).order('created_at', { ascending: false });
    if (manufacturer) query = query.eq('manufacturer_wallet', manufacturer.toLowerCase());
    const { data, count, error } = await query;
    if (error) throw new Error(error.message);
    res.json({ products: data, total: count, limit: Number(limit), offset: Number(offset) });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

export default router;
