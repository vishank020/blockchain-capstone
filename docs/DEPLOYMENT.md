# Deployment Guide — Tournament DApp

## 0. Local chain (terminal 1, repo root — start first, leave running)
```bash
npx hardhat node
```
- Serves `http://127.0.0.1:8545`, Chain ID 31337 (`eth_chainId` → `0x7a69`), funded test accounts.
- The frontend's on-chain reads (`totalTournaments`, `balanceOf`, event feed) need this; they degrade gracefully when it is down.

## 1. Contracts (terminal 2, repo root)
```bash
npm install
npm run compile   # TournamentContract + RewardToken, solc 0.8.24
npm test          # 22/22 expected
npm run deploy    # exports deployments/hardhat-local_deployment.json — metadata only, not an on-chain deploy
```
- Note the addresses from `deployments/hardhat-local_deployment.json` (tournament + `rewardToken`).
- As admin, call `setRewardToken(<TRT address>)`, then `approve()` TRT to the tournament contract before `createTokenTournament()`.

## 2. Backend (Express, terminal 2 continued, repo root)
```bash
npm run start:backend   # PORT from env, default 4000
curl http://localhost:4000/health   # expect {"status":"healthy",...}
```
- Alternatives from inside `backend/`: `npm start` (run), `npm run dev` (watch), `npm test` (9/9).
- Env: copy `backend/.env.example` to `backend/.env` and set `PORT`, `JWT_SECRET`.
- The backend is currently in-memory; restarting resets tournaments/notifications.

## 3. Frontend (Vite, terminal 3)
```bash
cd frontend
npm install
cp .env.example .env
# set VITE_BACKEND_URL, VITE_CONTRACT_ADDRESS, VITE_REWARD_TOKEN_ADDRESS in .env
npm run build
npm test     # smoke tests, requires dist/ from the build step
npm run preview   # serves dist/ for verification
# or: npm run dev # live dev server, default http://localhost:5173
```

## 4. Integration check
1. Chain answers (`eth_chainId` → `0x7a69`) and backend healthy (`/health`).
2. Frontend Backend card shows `healthy`.
3. Connect MetaMask (Chain ID 31337), Refresh tournaments, Join one, Claim it, confirm a notification appears.
4. Live events card shows `Listening`; trigger a join and watch the `PlayerRegistered` event arrive.

## 5. Merge checklist (feature branch → `master`)
- `npm test` (root): 22/22.
- `npm run build` + `npm test` (frontend): build clean, smoke tests pass.
- `TournamentContract.json` and `RewardToken.json` in frontend match freshly compiled artifacts.
- `Shubham_task.md` boxes reflect shipped scope.
- No secrets committed (`.env` files stay local; only `.env.example` is tracked).

