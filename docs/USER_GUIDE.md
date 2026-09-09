# Player Guide — Tournament DApp

## What you can do
- Connect MetaMask, browse tournaments, join, check balances, claim prizes, and watch live on-chain events.

## Setup
1. Install the MetaMask browser extension and create/import a wallet.
2. Add the Hardhat local network (ask the dev team for the RPC URL if it changed):
   - Network: Hardhat Local, RPC `http://127.0.0.1:8545`, Chain ID `31337`, Currency `ETH`.
3. Import a test account private key from the local node if you need funds (never use real keys).
4. Start the backend (`npm run start:backend` in the repo root) and the frontend (`npm run dev` in `frontend/`).
5. Open the frontend URL (default `http://localhost:5173`).

## Walkthrough
1. **Connect Wallet** — click Connect Wallet, approve in MetaMask. Your truncated address appears as a green pill.
2. **Backend card** — green `healthy` means the API is reachable. Use Recheck health if you just started the backend.
3. **Wallet card** — shows backend balance plus live chain ETH balance and your TRT reward-token balance (via `balanceOf`).
4. **Tournaments card** — Refresh pulls `GET /api/tournaments`. Each row shows status, players, prize, and fee.
5. **Join** — click Join (wallet must be connected). Failures show the reason: already joined, full, or not open.
6. **Rewards card** — My tournaments lists only events you joined. Click **Claim prize** to request payout via `POST /api/tournaments/:id/distribute-prize`. Notifications list your reward receipts.
7. **Live events card** — `Listening` means the app is subscribed to `TournamentCreated`, `TokenTournamentCreated`, `PlayerRegistered`, `PrizeDistributed`, `TokenPrizeDistributed`, and `TournamentCancelled`. Lists refresh automatically.

## Troubleshooting
| Symptom | Fix |
|---|---|
| "MetaMask not detected" | Install/enable MetaMask, reload the page |
| Backend `unreachable` | Start backend on port 4000; check `VITE_BACKEND_URL` in `frontend/.env` |
| "User rejected request" | You cancelled in MetaMask — retry and approve |
| Join fails "already joined" | You are already registered for that tournament |
| Join fails "full" / "not open" | Tournament reached `maxPlayers` or is Completed/Cancelled |
| Claim fails "must be a registered participant" | Claims only work from a participant address |
| Claim shows "Claimed" | Prize was already distributed — check Notifications |
| Wrong network in MetaMask | Switch to Chain ID 31337 for local dev |
