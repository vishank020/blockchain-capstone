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
    ]) {
      assert.ok(names.has(fn), `ABI has function ${fn}`);
    }
    for (const ev of [
      "TournamentCreated",
      "PlayerRegistered",
      "PrizeDistributed",
      "TournamentCancelled",
    ]) {
      assert.ok(names.has(ev), `ABI has event ${ev}`);
    }
  });

  it("App covers wallet, tournaments, balances, rewards, and live events", () => {
    const app = read(path.join(srcDir, "App.jsx"));
    for (const marker of [
      "Connect Wallet",
      "BrowserProvider", // ethers v6 API (not v5 Web3Provider)
      "/api/tournaments",
      "/api/balance/",
      "/api/notifications/",
      "distribute-prize",
      "Claim prize",
      "TournamentCreated",
      "PrizeDistributed",
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

  it(".env.example documents required env vars", () => {
    const envPath = path.join(rootDir, ".env.example");
    assert.ok(existsSync(envPath), "frontend/.env.example exists");
    const env = read(envPath);
    for (const key of [
      "VITE_BACKEND_URL",
      "VITE_CONTRACT_ADDRESS",
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
