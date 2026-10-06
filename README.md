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

## ⚠️ Important: What to do when you restart the Hardhat Node

Whenever you restart the Hardhat node (`npx hardhat node`), your local blockchain starts completely fresh from block zero. **All previous contract deployments, transactions, and balances are wiped out.**

To get your app working again after a restart, follow this checklist:

### 1. Re-deploy your Smart Contracts
You need to deploy your smart contracts onto the newly created local chain. Run this in the root folder:
```bash
npm run deploy:live
```

### 2. Update your Configuration Files
Take the new contract addresses from the deployment output and replace the old ones in your environment files:
- `frontend/.env` (Update `VITE_CONTRACT_ADDRESS` and `VITE_REWARD_TOKEN_ADDRESS`)
- `backend/.env` (Update `CONTRACT_ADDRESS` and `REWARD_TOKEN_ADDRESS`)
- `frontend/src/config.js` (Update the fallback addresses if needed)

### 3. Seed your Blockchain (Optional)
To have some sample tournaments readily available on the frontend, populate your local chain:
```bash
node scripts/seed_onchain.js
```

### 4. Restart your Servers
Your servers need to load the newly pasted contract addresses.
- **Frontend:** Kill the running `npm run dev` and start it again.
- **Backend:** Kill your backend server script and start it again.

### 5. Reset your MetaMask Account
Because the blockchain reset, MetaMask will get confused about your transaction history. 
- Open MetaMask
- Go to **Settings > Advanced**
- Click **Clear activity tab data** (or **Reset Account** depending on your version)
*(This simply clears the transaction history so MetaMask syncs properly with the fresh network).*
