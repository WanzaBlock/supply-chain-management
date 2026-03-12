/**
 * simulator.js — IoT Sensor Simulator (dev only)
 *
 * Publishes fake sensor data to the MQTT broker every few seconds.
 * Use this to test the IoT bridge without real hardware.
 *
 * Run with:  node iot/simulator.js
 * Requires:  Mosquitto or another MQTT broker running on localhost:1883
 */

import 'dotenv/config';
import mqtt from 'mqtt';

const PRODUCT_CODES = ['SEED-BATCH-001', 'PHARMA-BATCH-002', 'AGRO-BATCH-003'];
const NEXT_HOLDER   = '0x70997970C51812dc3A010C7d01b50e0d17dc79C8'; // Anvil account 1

const client = mqtt.connect(process.env.MQTT_BROKER || 'mqtt://localhost:1883');

client.on('connect', () => {
  console.log('Simulator connected to MQTT broker');

  setInterval(() => {
    const productCode = PRODUCT_CODES[Math.floor(Math.random() * PRODUCT_CODES.length)];
    const topic       = `sensors/${productCode}/temperature`;

    const payload = JSON.stringify({
      productCode,
      nextHolder:  NEXT_HOLDER,
      temperature: (20 + Math.random() * 10).toFixed(2),
      humidity:    (40 + Math.random() * 30).toFixed(2),
      gps: {
        lat: (-15.416 + Math.random() * 0.01).toFixed(6),
        lng: ( 28.283 + Math.random() * 0.01).toFixed(6),
      },
      timestamp: new Date().toISOString(),
    });

    client.publish(topic, payload);
    console.log(`Published to ${topic}:`, JSON.parse(payload));
  }, 5000);
});

client.on('error', (err) => {
  console.error('Simulator MQTT error:', err.message);
});
