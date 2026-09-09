# Developer Guide — Tournament DApp

## Architecture
- `contracts/TournamentContract.sol` — tournaments, registration, prize escrow, `onlyAdmin` / `onlyAdminOrOracle` access.
- `contracts/RewardToken.sol` — TRT ERC-20 (owner-minted) for token prize pools; wired via `setRewardToken()`, used by `createTokenTournament()` / `joinTokenTournament()` / `distributeTokenPrize()`.
- `backend/server.js` (Express, port 4000) — tournament indexing, IPFS pinning (mock), oracle verification (HMAC), JWT auth, notifications, balances, `GET /api/token` (TRT metadata).
- `frontend/src/` — React + Vite + ethers v6. No framework CSS; plain `App.css`.
  - `config.js` — `BACKEND_URL`, `CONTRACT_ADDRESS`, `CONTRACT_ABI` (reads `VITE_*` env with local defaults).
  - `TournamentContract.json` + `RewardToken.json` — bundled ABI copies. Re-copy both after every `npm run compile`.
  - `App.jsx` — wallet, backend health, wallet balances, rewards, live events, tournaments, status bar.

## Local setup (3 terminals, repo tree: `contracts/`, `backend/`, `frontend/`, `scripts/`, `tests/`, `deployments/`)
```bash
# terminal 1 — local chain (repo root; leave running)
npx hardhat node       # http://127.0.0.1:8545, Chain ID 31337

# terminal 2 — contracts + backend (repo root)
npm install
npm run compile
npm test            # 25/25 expected (13 backend + 7 tournament-ABI + 5 token)
npm run deploy      # exports deployments/hardhat-local_deployment.json (metadata only)
npm run start:backend   # Express on http://localhost:4000

# terminal 3 — frontend
cd frontend
npm install
cp .env.example .env   # adjust VITE_BACKEND_URL / VITE_CONTRACT_ADDRESS / VITE_REWARD_TOKEN_ADDRESS
npm run dev            # default http://localhost:5173
```
Backend alternatives from inside `backend/`: `npm start` (run), `npm run dev` (watch), `npm test` (9/9). Root install already provides its deps.

## Key integration points
| Concern | Details |
|---|---|
| Contract ABI | `artifacts/contracts/TournamentContract.sol/TournamentContract.json` → copy to `frontend/src/TournamentContract.json` |
| Contract address | `deployments/hardhat-local_deployment.json` → `VITE_CONTRACT_ADDRESS` (default `0x5FbD...aa3`) |
| Reward token | `RewardToken` (TRT) → `VITE_REWARD_TOKEN_ADDRESS`; call `setRewardToken()` as admin, then `approve()` TRT before `createTokenTournament()` / `joinTokenTournament()` |
| Backend base URL | `VITE_BACKEND_URL` (default `http://localhost:4000`) |
| On-chain reads | `totalTournaments()` via `ethers.BrowserProvider`; events via `contract.on(...)` with `removeAllListeners()` cleanup |
| Backend writes | `POST /api/tournaments/:id/join` (`{playerAddress}`), `POST /api/tournaments/:id/distribute-prize` (`{winnerAddress}`) |
| Error UX | `getErrorMessage()` unwraps `reason` / `shortMessage` / nested oracle info; contract reverts display verbatim |

## Conventions
- ethers v6 only (`BrowserProvider`, `formatEther`). Do not reintroduce v5 `Web3Provider`.
- No new CSS framework without team agreement; keep 640px responsive breakpoint.
- Frontend tests: `npm test` in `frontend/` runs `test/smoke.test.js` (`node:test`, no browser). Rebuild (`npm run build`) before testing since one test asserts `dist/index.html` exists.
- After changing any contract: `npm run compile` → re-copy both ABIs into `frontend/src/` → `npm test` (root) → `npm run build` + `npm test` (frontend).
