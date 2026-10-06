# Blockchain-Based Decentralized Tournament Reward System

Decentralized platform for esports tournament rewards and digital token distribution enabling transparent prize distribution to players using blockchain technology.

## Technology Stack

- **Blockchain**: Ethereum, Solidity 0.8.24, Hardhat
- **Frontend**: React, Vite, Ethers.js v6, MetaMask
- **Backend**: Node.js, Express, IPFS (mock pinning)

## Setup and Start Commands

### 1. Install Dependencies

Run these commands in the root directory to install all necessary packages:

```bash
npm install            # Installs root + backend + contract tooling
cd frontend
npm install            # Installs frontend dependencies
cd ..
```

### 2. Start Local Blockchain

Open a terminal in the repo root and run:

```bash
npx hardhat node       # Starts local blockchain on http://127.0.0.1:8545 (Chain ID 31337)
```

*Leave this running in its own terminal window.*

### 3. Deploy Contracts and Seed Data

In a new terminal (repo root), deploy the smart contracts to the local chain and seed initial dummy tournaments:

```bash
npm run compile        # Compiles smart contracts
npm run deploy:live    # Deploys contracts to the running local chain
node scripts/seed_onchain.js # (Optional) Seeds initial tournaments
```

*Take note of the contract addresses printed in the terminal after deploying.*

### 4. Start the Backend

In the repo root, run:

```bash
npm run start:backend  # Starts the Express API on http://localhost:4000
```

### 5. Start the Frontend

In a new terminal, run:

```bash
cd frontend
npm run dev            # Starts the React app on http://localhost:5173
```

---

## ⚠️ What to do when you restart the Hardhat Node

Whenever you restart the Hardhat node (`npx hardhat node`), your local blockchain starts fresh from block zero.

Thanks to the automated deployment script, you **do not need to edit any files manually**!

Just run this **single command** in your terminal:

```bash
npm run deploy:live
```

This single command automatically:

1. Deploys fresh `TournamentContract` & `RewardToken (TRT)`.
2. Auto-syncs all `.env` files (`root`, `backend/.env`, and `frontend/.env`).
3. Auto-exports `frontend/src/contracts.json` directly to the frontend.
4. Auto-seeds sample tournaments on-chain.
5. Advances local blocks past MetaMask's cache threshold (eliminates `invalid block tag` errors).

### If your servers were already running:

- **Restart the Backend:** Stop `npm run start:backend` and start it again so it loads the new addresses.
- **Refresh the Frontend:** Refresh your browser tab (`Ctrl + F5`).
- **If MetaMask gets out of sync:** Switch network to Ethereum Mainnet and back to Localhost 31337 (or **Settings > Advanced > Clear activity tab data**).
