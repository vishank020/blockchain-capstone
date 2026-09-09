import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { readFileSync, existsSync } from "node:fs";
import { fileURLToPath } from "node:url";
import path from "node:path";

const here = path.dirname(fileURLToPath(import.meta.url));
const srcDir = path.resolve(here, "../src");
const rootDir = path.resolve(here, "..");

const read = (p) => readFileSync(p, "utf8");

describe("Frontend smoke tests (no browser needed)", () => {
  it("config wires backend URL, contract address, and ABI", () => {
    const configPath = path.join(srcDir, "config.js");
    assert.ok(existsSync(configPath), "frontend/src/config.js exists");
    const config = read(configPath);
    assert.ok(config.includes("VITE_BACKEND_URL"), "reads VITE_BACKEND_URL");
    assert.ok(config.includes("VITE_CONTRACT_ADDRESS"), "reads VITE_CONTRACT_ADDRESS");
    assert.ok(config.includes("CONTRACT_ABI"), "exports CONTRACT_ABI");
    assert.ok(
      config.includes("0x5FbDB2315678afecb367f032d93F642f64180aa3"),
      "defaults to local deployment address"
    );
  });

  it("bundled ABI exposes the contract surface the UI depends on", () => {
    const abiPath = path.join(srcDir, "TournamentContract.json");
    assert.ok(existsSync(abiPath), "bundled ABI exists");
    const artifact = JSON.parse(read(abiPath));
    const abi = artifact.abi || artifact;
    const names = new Set(abi.map((e) => e.name).filter(Boolean));
    for (const fn of [
      "totalTournaments",
      "getTournament",
      "registerPlayer",
      "joinTournament",
      "createTournament",
      "distributePrize",
      "createTokenTournament",
      "joinTokenTournament",
      "distributeTokenPrize",
    ]) {
      assert.ok(names.has(fn), `ABI has function ${fn}`);
    }
    for (const ev of [
      "TournamentCreated",
      "PlayerRegistered",
      "PrizeDistributed",
      "TournamentCancelled",
      "TokenTournamentCreated",
      "TokenPrizeDistributed",
    ]) {
      assert.ok(names.has(ev), `ABI has event ${ev}`);
    }
  });

  it("bundled TRT ABI exposes the ERC-20 surface the wallet card needs", () => {
    const tokenPath = path.join(srcDir, "RewardToken.json");
    assert.ok(existsSync(tokenPath), "bundled TRT ABI exists");
    const artifact = JSON.parse(read(tokenPath));
    const abi = artifact.abi || artifact;
    const names = new Set(abi.map((e) => e.name).filter(Boolean));
    for (const fn of ["balanceOf", "transfer", "approve", "transferFrom", "mint"]) {
      assert.ok(names.has(fn), `TRT ABI has function ${fn}`);
    }
  });

  it("App covers wallet, tournaments, balances, rewards, and live events", () => {
    const app = read(path.join(srcDir, "App.jsx"));
    for (const marker of [
      "Connect Wallet",
      "BrowserProvider", // ethers v6 API
      "/api/tournaments",
      "Create tournament",
      "Admin",
      "Delete",
      "maxPlayers",
      "/api/balance/",
      "/api/notifications/",
      "distribute-prize",
      "Claim prize",
      "TournamentCreated",
      "PrizeDistributed",
      "TokenPrizeDistributed",
      "balanceOf",
      "REWARD_TOKEN_ADDRESS",
      "removeAllListeners", // listener cleanup
      "getErrorMessage", // revert reasons surfaced
    ]) {
      assert.ok(app.includes(marker), `App.jsx contains: ${marker}`);
    }
    assert.ok(!app.includes("Web3Provider"), "no ethers v5 Web3Provider usage");
    assert.ok(
      !app.includes("0xYourContractAddressHere"),
      "no placeholder contract address"
    );
  });

  it("App declares callbacks before the live-events effect (no TDZ crash)", () => {
    const app = read(path.join(srcDir, "App.jsx"));
    const declared = (name) => {
      const i = app.indexOf(`const ${name} = useCallback`);
      assert.ok(i >= 0, `${name} is declared with useCallback`);
      return i;
    };
    const effectAt = app.indexOf("Live contract-event subscription");
    assert.ok(effectAt >= 0, "live-events effect exists");
    for (const name of ["fetchNotifications", "fetchChainBalance", "fetchTournaments"]) {
      assert.ok(
        declared(name) < effectAt,
        `${name} must be declared before the live-events effect`
      );
    }
  });

  it("App handles backend string statuses and shows a provider banner", () => {
    const app = read(path.join(srcDir, "App.jsx"));
    assert.ok(
      app.includes("STATUS_LABELS.includes(status)"),
      "formatStatus accepts string labels from the backend"
    );
    assert.ok(
      app.includes("metamask.io/download"),
      "missing-provider banner links to MetaMask"
    );
    assert.ok(
      app.includes("hasProvider"),
      "provider detection drives wallet UX"
    );
  });

  it(".env.example documents required env vars", () => {
    const envPath = path.join(rootDir, ".env.example");
    assert.ok(existsSync(envPath), "frontend/.env.example exists");
    const env = read(envPath);
    for (const key of [
      "VITE_BACKEND_URL",
      "VITE_CONTRACT_ADDRESS",
      "VITE_REWARD_TOKEN_ADDRESS",
      "VITE_CHAIN_ID",
    ]) {
      assert.ok(env.includes(key), `.env.example documents ${key}`);
    }
  });

  it("production build output exists", () => {
    assert.ok(
      existsSync(path.join(rootDir, "dist", "index.html")),
      "run `npm run build` in frontend/ before testing"
    );
  });
});
