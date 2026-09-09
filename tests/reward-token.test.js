import { describe, it } from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

describe("RewardToken & Token-Tournament Test Suite", () => {
  const tokenArtifactPath = path.join(
    __dirname,
    "../artifacts/contracts/RewardToken.sol/RewardToken.json"
  );
  const tournamentArtifactPath = path.join(
    __dirname,
    "../artifacts/contracts/TournamentContract.sol/TournamentContract.json"
  );

  it("1. Should find the compiled RewardToken artifact", () => {
    assert.ok(fs.existsSync(tokenArtifactPath), "RewardToken artifact should exist");
  });

  const tokenArtifact = JSON.parse(fs.readFileSync(tokenArtifactPath, "utf8"));
  const tournamentArtifact = JSON.parse(
    fs.readFileSync(tournamentArtifactPath, "utf8")
  );

  it("2. Should expose standard ERC-20 surface with owner minting", () => {
    assert.equal(tokenArtifact.contractName, "RewardToken");
    const names = tokenArtifact.abi
      .filter((item) => item.type === "function")
      .map((item) => item.name);
    for (const fn of [
      "name",
      "symbol",
      "decimals",
      "totalSupply",
      "balanceOf",
      "allowance",
      "transfer",
      "approve",
      "transferFrom",
      "mint",
      "transferOwnership",
    ]) {
      assert.ok(names.includes(fn), `RewardToken ABI should include: ${fn}`);
    }
  });

  it("3. TournamentContract should expose the token-tournament path", () => {
    const names = tournamentArtifact.abi
      .filter((item) => item.type === "function")
      .map((item) => item.name);
    for (const fn of [
      "rewardToken",
      "setRewardToken",
      "createTokenTournament",
      "joinTokenTournament",
      "distributeTokenPrize",
      "tokenPrizePools",
      "isTokenTournament",
    ]) {
      assert.ok(names.includes(fn), `TournamentContract ABI should include: ${fn}`);
    }
  });

  it("4. TournamentContract should emit token lifecycle events", () => {
    const events = tournamentArtifact.abi
      .filter((item) => item.type === "event")
      .map((item) => item.name);
    for (const ev of [
      "RewardTokenUpdated",
      "TokenTournamentCreated",
      "TokenPrizeDistributed",
    ]) {
      assert.ok(events.includes(ev), `ABI should include event: ${ev}`);
    }
  });

  it("5. Legacy ETH functions must keep their exact signatures", () => {
    const byName = (name) =>
      tournamentArtifact.abi.find(
        (item) => item.type === "function" && item.name === name
      );
    assert.equal(byName("createTournament").stateMutability, "payable");
    assert.equal(byName("createTournament").inputs.length, 4);
    assert.equal(byName("joinTournament").stateMutability, "payable");
    assert.equal(byName("distributePrize").stateMutability, "nonpayable");
    const createToken = byName("createTokenTournament");
    assert.equal(createToken.stateMutability, "nonpayable");
    assert.equal(createToken.inputs.length, 5);
    assert.equal(createToken.inputs[4].name, "_prizeTokens");
  });
});
