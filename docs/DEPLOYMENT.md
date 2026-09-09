# Deployment Guide — Tournament DApp

## 1. Contracts (Hardhat local)
```bash
npm install
npm run compile
npm test
npm run deploy
```
- Note the deployed addresses from `deployments/hardhat-local_deployment.json` (tournament + `rewardToken`).
- Keep the local node (`npx hardhat node`) running on `http://127.0.0.1:8545` (Chain ID 31337).
- As admin, call `setRewardToken(<TRT address>)`, then `approve()` TRT to the tournament contract before `createTokenTournament()`.

## 2. Backend (Express)
```bash
npm run start:backend   # PORT from env, default 4000
curl http://localhost:4000/health   # expect {"status":"healthy",...}
```
- Env: copy `backend/.env.example` to `backend/.env` and set `PORT`, `JWT_SECRET`.
- The backend is currently in-memory; restarting resets tournaments/notifications.

## 3. Frontend (Vite)
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
1. Backend healthy (`/health`).
2. Frontend Backend card shows `healthy`.
3. Connect MetaMask (Chain ID 31337), Refresh tournaments, Join one, Claim it, confirm a notification appears.
4. Live events card shows `Listening`; trigger a join and watch the `PlayerRegistered` event arrive.

## 5. Merge checklist (`shubham/frontend` → `main`)
- `npm test` (root): 15/15.
- `npm run build` + `npm test` (frontend): build clean, smoke tests pass.
- `TournamentContract.json` in frontend matches freshly compiled artifact.
- `Shubham_task.md` boxes reflect shipped scope.
- No secrets committed (`.env` files stay local; only `.env.example` is tracked).
