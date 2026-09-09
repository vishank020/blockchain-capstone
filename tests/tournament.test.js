import { describe, it } from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

describe("TournamentContract Verification & ABI Test Suite", () => {
  const artifactPath = path.join(
    __dirname,
    "../artifacts/contracts/TournamentContract.sol/TournamentContract.json"
  );

  it("1. Should find compiled contract artifact", () => {
    assert.ok(fs.existsSync(artifactPath), "Artifact file should exist");
  });

  const artifact = JSON.parse(fs.readFileSync(artifactPath, "utf8"));

  it("2. Should verify contract metadata and compilation targets", () => {
    assert.equal(artifact.contractName, "TournamentContract");
    assert.ok(artifact.bytecode.length > 100, "Bytecode should be generated and non-empty");
  });

  it("3. Should have all required Core Functions in ABI", () => {
    const functionNames = artifact.abi
      .filter((item) => item.type === "function")
      .map((item) => item.name);

    const requiredFunctions = [
      "admin",
      "oracle",
      "totalTournaments",
      "setAdmin",
      "setOracle",
      "registerPlayer",
      "createTournament",
      "joinTournament",
      "distributePrize",
      "cancelTournament",
      "getTournament",
      "getTournamentPlayers",
      "getContractBalance",
      "registeredPlayers",
      "isPlayerRegistered",
    ];

    for (const reqFunc of requiredFunctions) {
      assert.ok(
        functionNames.includes(reqFunc),
        `ABI should include function: ${reqFunc}`
      );
    }
  });

  it("4. Should have all required Events in ABI", () => {
    const eventNames = artifact.abi
      .filter((item) => item.type === "event")
      .map((item) => item.name);

    const requiredEvents = [
      "TournamentCreated",
      "PlayerRegistered",
      "GlobalPlayerRegistered",
      "PrizeDistributed",
      "TournamentCancelled",
      "AdminTransferred",
      "OracleUpdated",
    ];

    for (const reqEvent of requiredEvents) {
      assert.ok(
        eventNames.includes(reqEvent),
        `ABI should include event: ${reqEvent}`
      );
    }
  });

  it("5. Should verify createTournament parameters and payable state mutability", () => {
    const createFn = artifact.abi.find(
      (item) => item.type === "function" && item.name === "createTournament"
    );
    assert.ok(createFn, "createTournament function should exist");
    assert.equal(createFn.stateMutability, "payable", "createTournament must be payable");
    assert.equal(createFn.inputs.length, 4, "createTournament should accept 4 arguments");
    assert.equal(createFn.inputs[0].name, "_title");
    assert.equal(createFn.inputs[1].name, "_ipfsMetadataHash");
    assert.equal(createFn.inputs[2].name, "_entryFee");
    assert.equal(createFn.inputs[3].name, "_maxPlayers");
  });

  it("6. Should verify joinTournament parameters and payable state mutability", () => {
    const joinFn = artifact.abi.find(
      (item) => item.type === "function" && item.name === "joinTournament"
    );
    assert.ok(joinFn, "joinTournament function should exist");
    assert.equal(joinFn.stateMutability, "payable", "joinTournament must be payable");
    assert.equal(joinFn.inputs[0].name, "_tournamentId");
  });

  it("7. Should verify distributePrize role-restricted payout function", () => {
    const distFn = artifact.abi.find(
      (item) => item.type === "function" && item.name === "distributePrize"
    );
    assert.ok(distFn, "distributePrize function should exist");
    assert.equal(distFn.stateMutability, "nonpayable");
    assert.equal(distFn.inputs.length, 2);
    assert.equal(distFn.inputs[0].name, "_tournamentId");
    assert.equal(distFn.inputs[1].name, "_winner");
  });
});
