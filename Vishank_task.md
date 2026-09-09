# Vishank's Task Assignment

## Area of Responsibility: Smart Contracts + Backend API

### Smart Contracts (Solidity) ✅ 100% COMPLETE (6/6 + TRT extension)

- [x] **Deploy Tournament contract** - `TournamentContract.sol` compiled with Solidity `0.8.24` on Hardhat
- [x] **Token & prize pool distribution logic** - Prize pool escrow with direct ETH winner payout mechanisms implemented
- [x] **Prize pool management** - Dynamic tournament creation with custom prize pools, entry fees, player capacities, and reentrancy protection
- [x] **Player registration & verification** - `registerPlayer()` and `joinTournament()` with duplicate prevention and fee validation
- [x] **Winner payout system** - `distributePrize()` with admin/oracle access control and secure Ether transfer
- [x] **Role-based access control (admin / oracle / player)** - `onlyAdmin` and `onlyAdminOrOracle` modifiers with ownership transfer (`setAdmin`, `setOracle`)
- [x] **ERC-20 reward token (TRT)** - `RewardToken.sol` (mintable by owner); token tournament path `createTokenTournament()` / `joinTokenTournament()` / `distributeTokenPrize()` with `TokenTournamentCreated` / `TokenPrizeDistributed` events; ETH flow untouched

---

### Backend API (Node.js/Express) ✅ 100% COMPLETE (6/6)

- [x] **API routes for tournament creation & indexing** - `backend/server.js` with `POST /api/tournaments`, `GET /api/tournaments`, `GET /api/tournaments/:id`
- [x] **IPFS integration for storing tournament data** - `POST /api/ipfs/upload` with cryptographic CID generation and gateway metadata URLs
- [x] **Oracle service integration (for match results)** - `POST /api/oracle/verify-match` with HMAC-SHA256 signature verification
- [x] **Authentication & authorization** - JWT issuance (`POST /api/auth/login`) and Bearer token verification middleware
- [x] **Notification system for rewards** - `POST /api/notifications/reward` and `GET /api/notifications/:address`
- [x] **Token & wallet balance monitoring** - `GET /api/balance/:address` for network and ETH balance inspection
- [x] **Reward token metadata** - `GET /api/token` returns TRT name/symbol/decimals/address/usage

---

### Development Environment & Tooling ✅ 100% COMPLETE

- [x] **Hardhat setup for contract compilation and testing** - Hardhat v3.14.0 with EVM target Shanghai
- [x] **Local blockchain network configuration** - Localhost / Hardhat network (chainId: `31337`, RPC: `http://127.0.0.1:8545`)
- [x] **TypeScript & ES Modules config** - `tsconfig.json`, `hardhat.config.ts`, and root `package.json`
- [x] **Environment variables** - `.env.example` and `backend/.env.example` configured with all keys/endpoints

---

### Deliverables on `vishank/contracts` Branch ✅ ALL COMPLETED

- [x] **Solidity contracts**: [`contracts/TournamentContract.sol`](file:///c:/Users/singh/OneDrive/Desktop/blockchain_capstone/blockchain-capstone/contracts/TournamentContract.sol)
- [x] **Migration & deployment scripts**: [`scripts/deploy_tournament.js`](file:///c:/Users/singh/OneDrive/Desktop/blockchain_capstone/blockchain-capstone/scripts/deploy_tournament.js)
- [x] **Test suites**: [`tests/tournament.test.js`](file:///c:/Users/singh/OneDrive/Desktop/blockchain_capstone/blockchain-capstone/tests/tournament.test.js), [`tests/reward-token.test.js`](file:///c:/Users/singh/OneDrive/Desktop/blockchain_capstone/blockchain-capstone/tests/reward-token.test.js) & [`backend/test/server.test.js`](file:///c:/Users/singh/OneDrive/Desktop/blockchain_capstone/blockchain-capstone/backend/test/server.test.js) (21/21 tests passing)
- [x] **Backend API**: [`backend/server.js`](file:///c:/Users/singh/OneDrive/Desktop/blockchain_capstone/blockchain-capstone/backend/server.js)
- [x] **Compiled Artifacts**: [`artifacts/contracts/TournamentContract.sol/TournamentContract.json`](file:///c:/Users/singh/OneDrive/Desktop/blockchain_capstone/blockchain-capstone/artifacts/contracts/TournamentContract.sol/TournamentContract.json)

---

### Integration Points for Shubham's Frontend

1. **Contract ABIs**:
    - `artifacts/contracts/TournamentContract.sol/TournamentContract.json`
    - `artifacts/contracts/RewardToken.sol/RewardToken.json` (TRT ERC-20)
    - Generated automatically with `npm run compile`.

2. **Default Local Contract Address**:
   - `0x5FbDB2315678afecb367f032d93F642f64180aa3` (exported in `deployments/hardhat-local_deployment.json`).

3. **Smart Contract Events for Frontend Listeners**:
    - `TournamentCreated(uint256 indexed tournamentId, string title, uint256 prizePool, uint256 entryFee, uint256 maxPlayers, string ipfsMetadataHash)`
    - `TokenTournamentCreated(uint256 indexed tournamentId, string title, uint256 prizeTokens, uint256 entryFeeTokens, uint256 maxPlayers, string ipfsMetadataHash)`
    - `PlayerRegistered(uint256 indexed tournamentId, address indexed player)`
    - `GlobalPlayerRegistered(address indexed player)`
    - `PrizeDistributed(uint256 indexed tournamentId, address indexed winner, uint256 amount)`
    - `TokenPrizeDistributed(uint256 indexed tournamentId, address indexed winner, uint256 amount)`
    - `TournamentCancelled(uint256 indexed tournamentId)`
    - `RewardTokenUpdated(address indexed previousToken, address indexed newToken)`

4. **Backend API Endpoints (Port 4000)**:
    - `GET /health` - Health check
    - `POST /api/auth/login` - Authenticate wallet address & retrieve JWT
    - `GET /api/tournaments` - List all tournaments
    - `POST /api/tournaments` - Create a tournament (returns metadata + IPFS CID)
    - `GET /api/tournaments/:id` - Fetch details of specific tournament
    - `POST /api/tournaments/:id/join` - Join tournament as a registered player
    - `POST /api/tournaments/:id/distribute-prize` - Distribute prize pool to winner
    - `POST /api/players/register` - Register a player address globally
    - `GET /api/notifications/:address` - List reward notifications for an address
    - `POST /api/oracle/verify-match` - Oracle verify match outcome
    - `POST /api/ipfs/upload` - Store metadata in IPFS
    - `GET /api/ipfs/:hash` - Retrieve pinned metadata
    - `GET /api/balance/:address` - Inspect wallet balance
    - `GET /api/token` - TRT reward-token metadata (name, symbol, decimals, address)

---

### Verification Commands

```bash
# 1. Compile smart contracts
npm run compile

# 2. Run Contract, Token, and Backend test suites (21 tests)
npm test

# 3. Deploy contract locally
npm run deploy

# 4. Start backend API server
npm run start:backend
```