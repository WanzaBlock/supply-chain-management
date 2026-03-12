import 'dotenv/config';
import express    from 'express';
import cors       from 'cors';
import productsRouter from './routes/products.js';
import usersRouter    from './routes/users.js';
import auditRouter    from './routes/audit.js';

const app  = express();
const PORT = process.env.PORT || 3000;

// ── Middleware ────────────────────────────────────────────────────────────────
app.use(cors({ origin: process.env.FRONTEND_ORIGIN || '*' }));
app.use(express.json());

// ── Routes ────────────────────────────────────────────────────────────────────
app.use('/api/products', productsRouter);
app.use('/api/users',    usersRouter);
app.use('/api/audit',    auditRouter);

// ── Health check ──────────────────────────────────────────────────────────────
app.get('/health', (_, res) => res.json({ status: 'ok', ts: Date.now() }));

// ── Error handler ─────────────────────────────────────────────────────────────
app.use((err, req, res, _next) => {
  console.error('Unhandled error:', err.message);
  res.status(500).json({ error: 'Internal server error' });
});

app.listen(PORT, () => {
  console.log(`Supply chain API running on port ${PORT}`);
  console.log(`Chain:    ${process.env.RPC_URL}`);
  console.log(`Contract: ${process.env.SUPPLY_CHAIN_ADDRESS}`);
});
