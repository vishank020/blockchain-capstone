import dotenv from "dotenv";
dotenv.config();

import express from "express";
import cors from "cors";
import helmet from "helmet";
import morgan from "morgan";
import crypto from "crypto";
import path from "path";
import { fileURLToPath } from "url";

const app = express();
const PORT = process.env.PORT || 4000;
const JWT_SECRET = process.env.JWT_SECRET || "capstone_esports_jwt_secret_key_2026";

// --- Middleware ---
app.use(helmet());
app.use(cors());
app.use(morgan("dev"));
app.use(express.json());

// --- In-Memory State & DB simulation for fast indexing ---
const inMemoryStore = {
  tournaments: [
    {
      id: 1,
      title: "Valorant Masters Grand Final",
      ipfsMetadataHash: "QmZtmD2qt8fJpq3CLDHvdzsKfLjqjCDypUADBr8u7i28e9",
      prizePool: "1.0",
      entryFee: "0.05",
      maxPlayers: 8,
      currentPlayers: 2,
      status: "Open",
      players: ["0x70997970C51812dc3A010C7d01b50e0d17dc79C8", "0x3C44CdDdB6a900fa2b585dd299e03d12FA4293BC"],
      winner: null,
      prizeDistributed: false,
      createdAt: new Date().toISOString(),
    }
  ],
  players: new Set(["0x70997970C51812dc3A010C7d01b50e0d17dc79C8"]),
  notifications: [],
  matchResults: new Map(),
  ipfsStorage: new Map(),
};

// --- Helper Functions & Services ---

// 1. Simple JWT Generator & Verifier (HMAC-SHA256)
function generateToken(payload, expiresInSeconds = 86400) {
  const header = Buffer.from(JSON.stringify({ alg: "HS256", typ: "JWT" })).toString("base64url");
  const exp = Math.floor(Date.now() / 1000) + expiresInSeconds;
  const body = Buffer.from(JSON.stringify({ ...payload, exp })).toString("base64url");
  const signature = crypto
    .createHmac("sha256", JWT_SECRET)
    .update(`${header}.${body}`)
    .digest("base64url");
  return `${header}.${body}.${signature}`;
}

function verifyToken(token) {
  try {
    const parts = token.split(".");
    if (parts.length !== 3) return null;
    const [header, body, signature] = parts;
    const expectedSig = crypto
      .createHmac("sha256", JWT_SECRET)
      .update(`${header}.${body}`)
      .digest("base64url");
    if (signature !== expectedSig) return null;
    const payload = JSON.parse(Buffer.from(body, "base64url").toString());
    if (payload.exp && payload.exp < Math.floor(Date.now() / 1000)) return null;
    return payload;
  } catch {
    return null;
  }
}

// Authentication Middleware
function authMiddleware(req, res, next) {
  const authHeader = req.headers.authorization;
  if (!authHeader || !authHeader.startsWith("Bearer ")) {
    return res.status(401).json({ error: "Missing or invalid Authorization header" });
  }
  const token = authHeader.split(" ")[1];
  const decoded = verifyToken(token);
  if (!decoded) {
    return res.status(401).json({ error: "Invalid or expired token" });
  }
  req.user = decoded;
  next();
}

// 2. IPFS Storage Service Helper
function pinToIPFS(data) {
  const dataString = JSON.stringify(data);
  const hash = "Qm" + crypto.createHash("sha256").update(dataString).digest("hex").slice(0, 44);
  inMemoryStore.ipfsStorage.set(hash, {
    data,
    pinnedAt: new Date().toISOString(),
    sizeBytes: Buffer.byteLength(dataString),
  });
  return hash;
}

// 3. Oracle Match Result Verification Service
function verifyMatchWithOracle(matchId, gameTitle, winnerAddress, score) {
  const signature = crypto
    .createHmac("sha256", JWT_SECRET)
    .update(`${matchId}:${winnerAddress}:${score}`)
    .digest("hex");

  const verifiedResult = {
    matchId,
    gameTitle,
    winnerAddress,
    score,
    verified: true,
    oracleSignature: "0x" + signature,
    timestamp: new Date().toISOString(),
  };

  inMemoryStore.matchResults.set(matchId, verifiedResult);
  return verifiedResult;
}

// 4. Notification Service Helper
function sendRewardNotification(recipientAddress, tournamentId, prizeAmount) {
  const notification = {
    id: `notif_${Date.now()}_${Math.floor(Math.random() * 1000)}`,
    recipient: recipientAddress,
    tournamentId,
    prizeAmount: `${prizeAmount} ETH`,
    message: `Congratulations! You won Tournament #${tournamentId}. Prize of ${prizeAmount} ETH has been transferred to your wallet.`,
    status: "Delivered",
    deliveredAt: new Date().toISOString(),
  };
  inMemoryStore.notifications.push(notification);
  return notification;
}

// --- API Endpoints ---

// API index
app.get("/", (req, res) => {
  res.json({
    service: "Blockchain Tournament Backend API",
    health: "/health",
    docs: "See docs/USER_GUIDE.md, docs/DEVELOPER_GUIDE.md, docs/DEPLOYMENT.md",
    endpoints: [
      "GET /health",
      "GET /api/token",
      "POST /api/auth/login",
      "GET /api/tournaments",
      "POST /api/tournaments",
      "GET /api/tournaments/:id",
      "POST /api/tournaments/:id/join",
      "POST /api/tournaments/:id/distribute-prize",
      "POST /api/players/register",
      "GET /api/notifications/:address",
      "POST /api/oracle/verify-match",
      "POST /api/ipfs/upload",
      "GET /api/ipfs/:hash",
      "GET /api/balance/:address",
    ],
  });
});

// Health Check
app.get("/health", (req, res) => {
  res.json({
    status: "healthy",
    service: "Blockchain Tournament Backend API",
    uptimeSeconds: Math.floor(process.uptime()),
    timestamp: new Date().toISOString(),
  });
});

// Authentication Endpoint
app.post("/api/auth/login", (req, res) => {
  const { address, role } = req.body;
  if (!address) {
    return res.status(400).json({ error: "Address is required" });
  }
  const userRole = role === "admin" ? "admin" : "player";
  const token = generateToken({ address, role: userRole });
  res.json({ token, address, role: userRole });
});

// IPFS Pinning Endpoint
app.post("/api/ipfs/upload", (req, res) => {
  try {
    const { title, rules, game, bannerUrl } = req.body;
    if (!title) {
      return res.status(400).json({ error: "Tournament metadata must include a title" });
    }
    const ipfsHash = pinToIPFS({ title, rules, game, bannerUrl, timestamp: Date.now() });
    res.json({
      success: true,
      ipfsHash,
      ipfsGatewayUrl: `https://ipfs.io/ipfs/${ipfsHash}`,
    });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Get IPFS Data
app.get("/api/ipfs/:hash", (req, res) => {
  const entry = inMemoryStore.ipfsStorage.get(req.params.hash);
  if (!entry) {
    return res.status(404).json({ error: "IPFS record not found" });
  }
  res.json(entry);
});

// Tournament Routes
app.get("/api/tournaments", (req, res) => {
  res.json({
    count: inMemoryStore.tournaments.length,
    tournaments: inMemoryStore.tournaments,
  });
});

app.get("/api/tournaments/:id", (req, res) => {
  const tournament = inMemoryStore.tournaments.find((t) => t.id === parseInt(req.params.id, 10));
  if (!tournament) {
    return res.status(404).json({ error: "Tournament not found" });
  }
  res.json(tournament);
});

app.post("/api/tournaments", (req, res) => {
  try {
    const { title, prizePool, entryFee, maxPlayers, rules, game } = req.body;
    if (!title || !maxPlayers) {
      return res.status(400).json({ error: "Title and maxPlayers are required" });
    }

    // Auto pin metadata to IPFS
    const ipfsHash = pinToIPFS({ title, rules: rules || "Standard rules", game: game || "Esports" });

    const newTournament = {
      id: inMemoryStore.tournaments.length + 1,
      title,
      ipfsMetadataHash: ipfsHash,
      prizePool: prizePool || "0.0",
      entryFee: entryFee || "0.0",
      maxPlayers: parseInt(maxPlayers, 10),
      currentPlayers: 0,
      status: "Open",
      players: [],
      winner: null,
      prizeDistributed: false,
      createdAt: new Date().toISOString(),
    };

    inMemoryStore.tournaments.push(newTournament);
    res.status(201).json({ success: true, tournament: newTournament });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Delete Tournament Route (admin; backend mock store only — on-chain
// cancellation is separate via cancelTournament and keeps funds escrowed)
app.delete("/api/tournaments/:id", (req, res) => {
  const tournamentId = parseInt(req.params.id, 10);
  const index = inMemoryStore.tournaments.findIndex((t) => t.id === tournamentId);
  if (index === -1) {
    return res.status(404).json({ error: "Tournament not found" });
  }
  const tournament = inMemoryStore.tournaments[index];
  if (tournament.prizeDistributed) {
    return res.status(400).json({
      error: "Prize already distributed — record kept for audit and cannot be deleted",
    });
  }
  const [removed] = inMemoryStore.tournaments.splice(index, 1);
  res.json({ success: true, tournament: removed });
});

// Player Registration
app.post("/api/players/register", (req, res) => {
  const { address } = req.body;
  if (!address) {
    return res.status(400).json({ error: "Player address is required" });
  }
  if (inMemoryStore.players.has(address)) {
    return res.status(409).json({ error: "Player already registered" });
  }
  inMemoryStore.players.add(address);
  res.json({ success: true, message: "Player registered successfully", address });
});

// Join Tournament Route
app.post("/api/tournaments/:id/join", (req, res) => {
  const tournamentId = parseInt(req.params.id, 10);
  const tournament = inMemoryStore.tournaments.find((t) => t.id === tournamentId);
  const { playerAddress } = req.body;

  if (!tournament) {
    return res.status(404).json({ error: "Tournament not found" });
  }
  if (tournament.status !== "Open") {
    return res.status(400).json({ error: "Tournament is not open for registration" });
  }
  if (tournament.players.includes(playerAddress)) {
    return res.status(409).json({ error: "Player already joined this tournament" });
  }
  if (tournament.players.length >= tournament.maxPlayers) {
    return res.status(400).json({ error: "Tournament is full" });
  }

  tournament.players.push(playerAddress);
  tournament.currentPlayers = tournament.players.length;
  if (tournament.currentPlayers === tournament.maxPlayers) {
    tournament.status = "InProgress";
  }

  res.json({ success: true, message: "Joined tournament successfully", tournament });
});

// Oracle Match Result Verification Route
app.post("/api/oracle/verify-match", (req, res) => {
  const { matchId, gameTitle, winnerAddress, score } = req.body;
  if (!matchId || !winnerAddress) {
    return res.status(400).json({ error: "matchId and winnerAddress are required" });
  }
  const result = verifyMatchWithOracle(matchId, gameTitle || "Tournament Match", winnerAddress, score || "2-0");
  res.json({ success: true, result });
});

// Prize Distribution Route
app.post("/api/tournaments/:id/distribute-prize", (req, res) => {
  const tournamentId = parseInt(req.params.id, 10);
  const tournament = inMemoryStore.tournaments.find((t) => t.id === tournamentId);
  const { winnerAddress } = req.body;

  if (!tournament) {
    return res.status(404).json({ error: "Tournament not found" });
  }
  if (tournament.prizeDistributed) {
    return res.status(400).json({ error: "Prize already distributed" });
  }
  if (!tournament.players.includes(winnerAddress)) {
    return res.status(400).json({ error: "Winner must be a registered participant" });
  }

  tournament.winner = winnerAddress;
  tournament.status = "Completed";
  tournament.prizeDistributed = true;

  // Trigger notification
  const notification = sendRewardNotification(winnerAddress, tournamentId, tournament.prizePool);

  res.json({
    success: true,
    message: "Prize successfully distributed to winner",
    tournament,
    notification,
  });
});

// Notification Routes
app.get("/api/notifications/:address", (req, res) => {
  const userNotifs = inMemoryStore.notifications.filter(
    (n) => n.recipient.toLowerCase() === req.params.address.toLowerCase()
  );
  res.json({ notifications: userNotifs });
});

// Wallet / Token Balance Route
app.get("/api/balance/:address", (req, res) => {
  const { address } = req.params;
  res.json({
    address,
    network: "Hardhat Local (ChainId: 31337)",
    tokenSymbol: "ETH",
    formattedBalance: "100.0 ETH",
    weiBalance: "100000000000000000000",
  });
});

// Reward Token (TRT) Metadata Route — ERC-20 used for token prize pools
app.get("/api/token", (req, res) => {
  res.json({
    name: "Tournament Reward Token",
    symbol: "TRT",
    decimals: 18,
    address:
      process.env.REWARD_TOKEN_ADDRESS ||
      "0xe7f1725E7734CE288F8367e1Bb143E90bb3F0512",
    network: "Hardhat Local (ChainId: 31337)",
    initialSupply: "1000000 TRT",
    usage:
      "Approve TRT to TournamentContract, then createTokenTournament / joinTokenTournament / distributeTokenPrize",
  });
});

// Start Server if directly invoked
if (process.argv[1] && fileURLToPath(import.meta.url) === path.resolve(process.argv[1])) {
  app.listen(PORT, () => {
    console.log(`🚀 Tournament Backend API running at http://localhost:${PORT}`);
    console.log(`📡 Health Check: http://localhost:${PORT}/health`);
  });
}

export default app;
