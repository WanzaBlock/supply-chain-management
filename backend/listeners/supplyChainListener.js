/**
 * supplyChainListener.js
 *
 * Listens to on-chain events from SupplyChain.sol and indexes them into Supabase.
 * Run with:  node listeners/supplyChainListener.js
 *
 * This process should run alongside the API server (separate process).
 */

import 'dotenv/config';
import { supplyChain, provider } from '../lib/contract.js';
import { supabase }               from '../lib/supabase.js';

console.log('Supply chain event listener starting...');
console.log('Contract:', process.env.SUPPLY_CHAIN_ADDRESS);
console.log('RPC:     ', process.env.RPC_URL);

// ── ProductRegistered ─────────────────────────────────────────────────────────
supplyChain.on('ProductRegistered', async (productId, manufacturer, metadataHash, event) => {
  console.log(`[ProductRegistered] ${productId} by ${manufacturer}`);

  const { error } = await supabase.from('chain_events').insert({
    event_type:          'ProductRegistered',
    product_id:          productId,
    from_addr:           manufacturer,
    to_addr:             null,
    tx_hash:             event.log.transactionHash,
    block_number:        event.log.blockNumber,
    raw_args:            JSON.stringify({ productId, manufacturer, metadataHash }),
  });

  if (error) console.error('Supabase error (ProductRegistered):', error.message);
});

// ── TransferRecorded ──────────────────────────────────────────────────────────
supplyChain.on('TransferRecorded', async (productId, from, to, event) => {
  console.log(`[TransferRecorded] ${productId} | ${from} -> ${to}`);

  const { error } = await supabase.from('chain_events').insert({
    event_type:   'TransferRecorded',
    product_id:   productId,
    from_addr:    from,
    to_addr:      to,
    tx_hash:      event.log.transactionHash,
    block_number: event.log.blockNumber,
    raw_args:     JSON.stringify({ productId, from, to }),
  });

  if (error) console.error('Supabase error (TransferRecorded):', error.message);
});

// ── ProductDeactivated ────────────────────────────────────────────────────────
supplyChain.on('ProductDeactivated', async (productId, event) => {
  console.log(`[ProductDeactivated] ${productId}`);

  // Update product status in Supabase
  await supabase
    .from('products')
    .update({ is_active: false, deactivated_at: new Date().toISOString() })
    .eq('product_id', productId);

  await supabase.from('chain_events').insert({
    event_type:   'ProductDeactivated',
    product_id:   productId,
    from_addr:    null,
    to_addr:      null,
    tx_hash:      event.log.transactionHash,
    block_number: event.log.blockNumber,
    raw_args:     JSON.stringify({ productId }),
  });
});

// ── Keep alive + reconnect ────────────────────────────────────────────────────
provider.on('error', (err) => {
  console.error('Provider error:', err.message);
});

provider.on('network', (newNetwork, oldNetwork) => {
  if (oldNetwork) {
    console.log(`Network changed: ${oldNetwork.chainId} -> ${newNetwork.chainId}`);
    process.exit(1); // Let PM2 or Docker restart the process
  }
});

console.log('Listening for events...');
