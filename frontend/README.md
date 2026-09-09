# Frontend — Tournament DApp

React + Vite + ethers v6 UI for the decentralized esports tournament system.

## What it does
- MetaMask wallet connection (`ethers.BrowserProvider`, no page reloads)
- Tournament list from `GET /api/tournaments`, join via `POST /api/tournaments/:id/join`
- Wallet card: backend ETH balance, live chain ETH balance, TRT balance (`balanceOf`)
- Rewards card: my tournaments with prize claiming (`POST /api/tournaments/:id/distribute-prize`) + reward notifications
- Live events card: subscribes to `TournamentCreated`, `TokenTournamentCreated`, `PlayerRegistered`, `PrizeDistributed`, `TokenPrizeDistributed`, `TournamentCancelled` with auto-refresh
- Contract revert reasons surfaced verbatim in the status bar

## Setup
```bash
npm install
cp .env.example .env   # VITE_BACKEND_URL, VITE_CONTRACT_ADDRESS, VITE_REWARD_TOKEN_ADDRESS, VITE_CHAIN_ID
npm run dev            # default http://localhost:5173
```

## Verify
```bash
npm run build   # must pass; produces dist/
npm test        # 6/6 smoke tests (node:test, no browser)
npm run lint    # oxlint
```

## Key files
- `src/config.js` — backend URL, contract + token addresses, ABIs (env with local defaults)
- `src/TournamentContract.json`, `src/RewardToken.json` — bundled ABI copies; re-copy from `../artifacts/` after every `npm run compile` at the repo root
- `src/App.jsx` — all UI sections; `src/App.css` — plain CSS, responsive at 640px
