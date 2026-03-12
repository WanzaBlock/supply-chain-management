/**
 * bridge.js — IoT to Blockchain Bridge
 *
 * Subscribes to MQTT topics published by IoT sensors (temperature, GPS, RFID).
 * Hashes each sensor payload and records a transfer event on-chain.
 * Full payload is stored in Supabase for audit trails.
 *
 * MQTT topic format:
 *   sensors/{productCode}/temperature
 *   sensors/{productCode}/gps
 *   sensors/{productCode}/rfid
 *
 * Payload JSON:
 *   { productCode, nextHolder, temperature, humidity, gps, timestamp }
 *
 * Run with:  node iot/bridge.js
 */

import 'dotenv/config';
import mqtt           from 'mqtt';
import { keccak256, toUtf8Bytes, id as ethId } from 'ethers';
import { supplyChain } from '../lib/contract.js';
import { supabase }    from '../lib/supabase.js';

const client = mqtt.connect(process.env.MQTT_BROKER);

client.on('connect', () => {
  console.log('IoT bridge connected to MQTT broker:', process.env.MQTT_BROKER);
  client.subscribe('sensors/#', (err) => {
    if (err) console.error('Subscribe error:', err.message);
    else     console.log('Subscribed to sensors/#');
  });
});

client.on('error', (err) => {
  console.error('MQTT error:', err.message);
});

client.on('message', async (topic, payloadBuffer) => {
  let data;
  try {
    data = JSON.parse(payloadBuffer.toString());
  } catch {
    console.warn('Invalid JSON on topic:', topic);
    return;
  }

  const { productCode, nextHolder, temperature, humidity, gps, timestamp } = data;

  if (!productCode || !nextHolder) {
    console.warn('Missing productCode or nextHolder in payload:', data);
    return;
  }

  try {
    const productId = ethId(productCode);

    // Build location and condition hashes
    const locationPayload  = JSON.stringify({ gps, timestamp });
    const conditionPayload = JSON.stringify({ temperature, humidity });
    const locationHash     = keccak256(toUtf8Bytes(locationPayload));
    const conditionHash    = keccak256(toUtf8Bytes(conditionPayload));

    // Record on-chain
    const tx = await supplyChain.recordTransfer(
      productId,
      nextHolder,
      locationHash,
      conditionHash,
      `IoT: ${topic}`
    );
    const receipt = await tx.wait();
    console.log(`[${topic}] Transfer recorded. TxHash: ${receipt.hash}`);

    // Store full payload off-chain
    await supabase.from('sensor_logs').insert({
      product_id:     productId,
      topic,
      temperature,
      humidity,
      gps_lat:        gps?.lat,
      gps_lng:        gps?.lng,
      location_hash:  locationHash,
      condition_hash: conditionHash,
      tx_hash:        receipt.hash,
      recorded_at:    timestamp || new Date().toISOString(),
    });

  } catch (err) {
    console.error(`[${topic}] Error recording IoT event:`, err.message);
  }
});

console.log('IoT bridge starting...');
