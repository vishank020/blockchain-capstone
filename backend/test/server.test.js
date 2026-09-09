import { describe, it, before, after } from "node:test";
import assert from "node:assert/strict";
import http from "http";
import app from "../server.js";

describe("Backend API Full Integration Test Suite", () => {
  let server;
  let baseUrl;

  before(async () => {
    await new Promise((resolve) => {
      server = http.createServer(app);
      server.listen(0, "127.0.0.1", () => {
        const port = server.address().port;
        baseUrl = `http://127.0.0.1:${port}`;
        resolve();
      });
    });
  });

  after(async () => {
    await new Promise((resolve) => server.close(resolve));
  });
  it("1. Health check should return status healthy", async () => {
    const res = await fetch(`${baseUrl}/health`);
    const data = await res.json();
    assert.equal(res.status, 200);
    assert.equal(data.status, "healthy");
  });

  it("1b. API index should list available endpoints", async () => {
    const res = await fetch(`${baseUrl}/`);
    const data = await res.json();
    assert.equal(res.status, 200);
    assert.ok(Array.isArray(data.endpoints));
    assert.ok(data.endpoints.includes("GET /health"));
    assert.ok(data.endpoints.includes("GET /api/token"));
  });

  it("2. Auth login should generate valid JWT token", async () => {
    const res = await fetch(`${baseUrl}/api/auth/login`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        address: "0x1234567890123456789012345678901234567890",
        role: "admin",
      }),
    });
    const data = await res.json();
    assert.equal(res.status, 200);
    assert.ok(data.token);
    assert.equal(data.role, "admin");
  });

  it("3. IPFS upload should pin metadata and return hash", async () => {
    const res = await fetch(`${baseUrl}/api/ipfs/upload`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        title: "Apex Legends Showdown",
        rules: "Best of 3 matches",
        game: "Apex Legends",
      }),
    });
    const data = await res.json();
    assert.equal(res.status, 200);
    assert.ok(data.ipfsHash.startsWith("Qm"));
    assert.ok(data.ipfsGatewayUrl.includes("ipfs.io"));
  });

  it("4. Tournament list should return available tournaments", async () => {
    const res = await fetch(`${baseUrl}/api/tournaments`);
    const data = await res.json();
    assert.equal(res.status, 200);
    assert.ok(Array.isArray(data.tournaments));
    assert.ok(data.count >= 1);
  });

  it("5. Player registration should register new address", async () => {
    const playerAddr = "0x999999cf1046e68e36E1aA2E0E07105eDDD1f08E";
    const res = await fetch(`${baseUrl}/api/players/register`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ address: playerAddr }),
    });
    const data = await res.json();
    assert.equal(res.status, 200);
    assert.equal(data.success, true);
  });

  it("6. Oracle verify-match should sign verified outcome", async () => {
    const res = await fetch(`${baseUrl}/api/oracle/verify-match`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        matchId: "match_101",
        gameTitle: "Valorant",
        winnerAddress: "0x70997970C51812dc3A010C7d01b50e0d17dc79C8",
        score: "13-7",
      }),
    });
    const data = await res.json();
    assert.equal(res.status, 200);
    assert.ok(data.result.verified);
    assert.ok(data.result.oracleSignature.startsWith("0x"));
  });

  it("7. Distribute prize should complete tournament and trigger notification", async () => {
    const res = await fetch(`${baseUrl}/api/tournaments/1/distribute-prize`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        winnerAddress: "0x70997970C51812dc3A010C7d01b50e0d17dc79C8",
      }),
    });
    const data = await res.json();
    assert.equal(res.status, 200);
    assert.equal(data.tournament.status, "Completed");
    assert.ok(data.notification);
    assert.equal(data.notification.recipient, "0x70997970C51812dc3A010C7d01b50e0d17dc79C8");
  });

  it("8. Balance endpoint should return formatted balance", async () => {
    const res = await fetch(`${baseUrl}/api/balance/0x70997970C51812dc3A010C7d01b50e0d17dc79C8`);
    const data = await res.json();
    assert.equal(res.status, 200);
    assert.equal(data.tokenSymbol, "ETH");
  });

  it("9. Token endpoint should return TRT metadata", async () => {
    const res = await fetch(`${baseUrl}/api/token`);
    const data = await res.json();
    assert.equal(res.status, 200);
    assert.equal(data.symbol, "TRT");
    assert.equal(data.name, "Tournament Reward Token");
    assert.equal(data.decimals, 18);
    assert.ok(data.address.startsWith("0x"));
  });

  it("10. Admin can create then delete a tournament", async () => {
    const created = await (
      await fetch(`${baseUrl}/api/tournaments`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          title: "Disposable Cup",
          prizePool: "0.1",
          entryFee: "0.01",
          maxPlayers: 4,
        }),
      })
    ).json();
    assert.ok(created.tournament.id);

    const del = await fetch(`${baseUrl}/api/tournaments/${created.tournament.id}`, {
      method: "DELETE",
    });
    const delData = await del.json();
    assert.equal(del.status, 200);
    assert.equal(delData.tournament.id, created.tournament.id);

    const gone = await fetch(`${baseUrl}/api/tournaments/${created.tournament.id}`);
    assert.equal(gone.status, 404);
  });

  it("11. Deleting a missing tournament returns 404", async () => {
    const res = await fetch(`${baseUrl}/api/tournaments/99999`, {
      method: "DELETE",
    });
    assert.equal(res.status, 404);
  });

  it("12. Distributed-prize tournaments are kept for audit", async () => {
    // Tournament #1 had its prize distributed in test 7
    const res = await fetch(`${baseUrl}/api/tournaments/1`, {
      method: "DELETE",
    });
    assert.equal(res.status, 400);
    const stillThere = await fetch(`${baseUrl}/api/tournaments/1`);
    assert.equal(stillThere.status, 200);
  });
});
