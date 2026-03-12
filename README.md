# Blockchain Supply Chain System

Full-stack blockchain supply chain tracking system built with Solidity/Foundry,
Node.js, ethers.js v6, Supabase, and vanilla JS frontends.

**Target chain:** Base (Ethereum L2)

---

## Project Structure

```
supply-chain/
├── contracts/                  Solidity contracts + Foundry tests
│   ├── src/
│   │   ├── SupplyChainAccess.sol   Role management
│   │   ├── SupplyChain.sol         Core registry
│   │   └── interfaces/
│   ├── test/
│   │   ├── AccessControl.t.sol
│   │   └── SupplyChain.t.sol
│   └── script/Deploy.s.sol
├── backend/                    Node.js API
│   ├── server.js               Express entry point
│   ├── routes/
│   │   ├── products.js
│   │   ├── users.js
│   │   └── audit.js
│   ├── listeners/              On-chain event indexer
│   ├── iot/                    MQTT bridge + simulator
│   ├── lib/                    Contract + Supabase clients
│   ├── middleware/auth.js
│   ├── abi/                    Contract ABIs
│   └── .env.example
├── frontend/
│   ├── shared/                 Shared CSS + JS API client
│   ├── manufacturer/index.html
│   ├── distributor/index.html
│   ├── regulator/index.html
│   └── consumer/index.html
└── supabase_schema.sql
```

---

## Step 1 — Contracts

### Prerequisites
```bash
# Install Foundry
curl -L https://foundry.paradigm.xyz | bash
foundryup
```

### Setup and test
```bash
cd contracts

# Install forge-std
forge install foundry-rs/forge-std --no-commit

# Run tests
forge test -vvv

# Start local node
anvil
```

### Deploy to Anvil (local)
```bash
# In a new terminal (Anvil must be running)
export PRIVATE_KEY=0xac0974bec39a17e36ba4a6b4d238ff944bacb478cbed5efcae784d7bf4f2ff80

forge script script/Deploy.s.sol \
  --rpc-url http://localhost:8545 \
  --private-key $PRIVATE_KEY \
  --broadcast
```

Copy the printed contract addresses into `backend/.env`.

### Deploy to Base Sepolia
```bash
forge script script/Deploy.s.sol \
  --rpc-url https://sepolia.base.org \
  --private-key $PRIVATE_KEY \
  --broadcast \
  --verify \
  --etherscan-api-key $BASESCAN_KEY
```

### Export ABIs (after compile)
```bash
# Foundry compiles to contracts/out/
# Copy ABIs to backend
cp out/SupplyChain.sol/SupplyChain.json        ../backend/abi/SupplyChain.json
cp out/SupplyChainAccess.sol/SupplyChainAccess.json ../backend/abi/SupplyChainAccess.json
```

> The repo includes pre-written ABI files. Replace them with Foundry output after compiling.

---

## Step 2 — Supabase

1. Create a project at [supabase.com](https://supabase.com)
2. Go to SQL Editor and run `supabase_schema.sql`
3. Copy your project URL and anon key into `backend/.env`

---

## Step 3 — Backend

```bash
cd backend
cp .env.example .env
# Edit .env — add RPC_URL, PRIVATE_KEY, contract addresses, Supabase creds

npm install
npm run dev          # API server on port 3000
```

In a separate terminal:
```bash
npm run listen       # Event indexer (indexes chain events to Supabase)
```

Optional (IoT testing):
```bash
npm run iot          # MQTT bridge (requires Mosquitto broker)
node iot/simulator.js  # Fake sensor data for testing
```

Install Mosquitto for MQTT testing:
```bash
# Ubuntu / WSL
sudo apt install mosquitto mosquitto-clients
sudo systemctl start mosquitto
```

---

## Step 4 — Assign Roles

After deploying, assign roles using the API or directly via cast:

```bash
# Using cast (Foundry)
cast send $ACCESS_CONTRACT_ADDRESS \
  "assignRole(address,bytes32)" \
  0xYOUR_MANUFACTURER_WALLET \
  $(cast keccak "MANUFACTURER") \
  --rpc-url http://localhost:8545 \
  --private-key $PRIVATE_KEY
```

Or via API (dev mode):
```bash
curl -X POST http://localhost:3000/api/users/assign-role \
  -H "Content-Type: application/json" \
  -d '{"wallet":"0x...","role":"MANUFACTURER","name":"Zambia Seeds Ltd"}'
```

---

## Step 5 — Frontend

The frontends are plain HTML/JS. Open them with a local server (not file://).

```bash
# Install live-server (one-time)
npm install -g live-server

# Serve from project root
cd supply-chain
live-server --port=5500
```

Then open:
- `http://localhost:5500/frontend/manufacturer/` — Manufacturer
- `http://localhost:5500/frontend/distributor/`  — Distributor
- `http://localhost:5500/frontend/regulator/`    — Regulator
- `http://localhost:5500/frontend/consumer/`     — Consumer (QR scan)

Connect MetaMask to localhost:8545 (chainId 31337 for Anvil) or Base Sepolia.

---

## API Reference

| Method | Endpoint | Auth | Description |
|--------|----------|------|-------------|
| POST | /api/products/register | MANUFACTURER | Register a product batch |
| GET  | /api/products/:code | — | Get product + history |
| POST | /api/products/:code/transfer | MANUFACTURER or DISTRIBUTOR | Record a transfer |
| GET  | /api/products/:code/history | — | Get indexed event history |
| POST | /api/products/:code/deactivate | REGULATOR | Deactivate a product |
| GET  | /api/products | — | List all products |
| POST | /api/users/assign-role | (owner only) | Assign role on-chain + sync |
| GET  | /api/users/:wallet/role | — | Get on-chain role |
| GET  | /api/audit/events | REGULATOR | Full event log |
| GET  | /api/audit/flags | REGULATOR | Flagged products |
| GET  | /api/audit/summary | REGULATOR | Stats summary |
| POST | /api/audit/flags/:id/resolve | REGULATOR | Resolve a flag |

Auth is via `x-wallet-address` header. The backend looks up the wallet in Supabase users table.

---

## Security Checklist (before mainnet)

- [ ] Run `slither contracts/src/` and fix findings
- [ ] Run `forge test --fuzz-runs 10000`
- [ ] Verify all state-changing functions check roles before writing
- [ ] Check no function can be re-entered
- [ ] Verify contracts on Basescan after deployment
- [ ] Switch backend to use Supabase service role key (not anon key) for writes
- [ ] Add rate limiting to the API (express-rate-limit)
- [ ] Enable Supabase RLS for production

---

## Moving to Mainnet

1. Change `RPC_URL` in `.env` to `https://mainnet.base.org`
2. Change MetaMask network to Base Mainnet (chainId 8453)
3. Re-run the deploy script with your mainnet private key
4. Update contract addresses in `.env`
5. Verify contracts on Basescan

```bash
forge script script/Deploy.s.sol \
  --rpc-url https://mainnet.base.org \
  --private-key $PRIVATE_KEY \
  --broadcast \
  --verify \
  --etherscan-api-key $BASESCAN_KEY
```
