# Vishank's Task Assignment

## Area of Responsibility: Smart Contracts + Backend API

### Smart Contracts (Solidity) ✅ PROGRESS: 1/6 complete

- [x] **Deploy Tournament contract** - Compiled `TournamentContract.sol` with Hardhat v3.14.0
- [ ] Token distribution logic - Define prize pool allocation and reward mechanisms
- [ ] Prize pool management - Implement tournament creation and fee structure
- [ ] Player registration & verification - Complete `registerPlayer()` function logic
- [ ] Winner payout system - Implement `distributePrize()` with admin-only access
- [ ] Role-based access control (admin vs player) - Admin-only tournament creation and prize distribution

### Backend API (Node.js/Express) ⏳ PENDING

- [ ] API routes for tournament creation
- [ ] IPFS integration for storing tournament data
- [ ] Oracle service integration (for match results)
- [ ] Authentication & authorization
- [ ] Notification system for rewards
- [ ] Token balance monitoring

### Development Environment ✅ COMPLETE

- [x] **Hardhat/Truffle setup for contract testing** - Hardhat v3.14.0 initialized
- [x] **Local blockchain network** - Configurable Hardhat network (chainId: 31337)
- [ ] TypeScript config for backend
- [x] **Environment variables** - `.env` pattern ready for keys/URLs

### Deliverables ✅ PARTIALLY COMPLETE

- [x] **Solidity contracts in `contracts/`** - `TournamentContract.sol` created and compiled
- [ ] Migration scripts in `scripts/`
- [ ] Backend API in `backend/`
- [ ] Test scripts in `tests/`

### Integration Points with Shubham's Work

- [x] **Contract ABI generation** - Hardhat compiles to `hardhat-artifacts/`
- [ ] API endpoints that frontend will call ⏳ Pending backend setup
- [ ] Event logs that frontend listens to - `TournamentCreated`, `PlayerRegistered` events defined
- [ ] Token addresses and contract addresses for wallet connection - To be deployed and shared

### Current Smart Contract Details

**File**: `contracts/TournamentContract.sol`

**Key Functions**:
- `registerPlayer()` - Register as tournament player (no duplicate registration)
- `createTournament(uint256 _prizePool)` - Admin creates tournament with prize pool
- `distributePrize(uint256 _tournamentId, address _winner)` - Admin distributes prize to winner

**Compilation**: Successfully compiled with Solidity 0.8.24 (evm target: shanghai)

### Next Steps

1. Write test scripts in `tests/` for contract functionality
2. Create migration scripts in `scripts/`
3. Set up Backend API in `backend/` (Node.js/Express)
4. Implement IPFS integration for tournament data storage
5. Oracle service for match result verification
6. Generate ABI for Shubham's frontend consumption