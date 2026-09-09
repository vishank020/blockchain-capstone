import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";
import { ethers } from "ethers";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Deploys for real to a running local chain (default: `npx hardhat node`).
// Default key is Hardhat's well-known LOCAL test account #0 (also committed in
// backend/.env.example). LOCAL TESTING ONLY — never fund or reuse on mainnet.
const RPC_URL = process.env.LOCAL_RPC_URL || "http://127.0.0.1:8545";
const DEPLOYER_KEY =
  process.env.DEPLOYER_PRIVATE_KEY ||
  "0xac0974bec39a17e36ba4a6b4d238ff944bacb478cbed5efcae784d7bf4f2ff80";
const TRT_SUPPLY = ethers.parseEther("1000000"); // 1,000,000 TRT

function loadArtifact(name) {
  const p = path.join(__dirname, `../artifacts/contracts/${name}.sol/${name}.json`);
  if (!fs.existsSync(p)) {
    console.error(`Artifact not found: ${p}. Run 'npm run compile' first.`);
    process.exit(1);
  }
  return JSON.parse(fs.readFileSync(p, "utf8"));
}

async function main() {
  console.log(`Connecting to ${RPC_URL} ...`);
  const provider = new ethers.JsonRpcProvider(RPC_URL);
  const chainId = (await provider.getNetwork()).chainId;
  console.log(`Chain ID: ${chainId}`);
  if (chainId !== 31337n) {
    console.error("Refusing to deploy: expected local chain 31337.");
    process.exit(1);
  }

  const deployer = new ethers.Wallet(DEPLOYER_KEY, provider);
  console.log(`Deployer: ${deployer.address}`);
  console.log(
    `Balance: ${ethers.formatEther(await provider.getBalance(deployer.address))} ETH`
  );

  // Explicit nonce management: Hardhat automining can lag the pending-block
  // tracker, so back-to-back deploys may otherwise reuse a stale nonce.
  let nonce = await provider.getTransactionCount(deployer.address, "latest");
  console.log(`Starting nonce: ${nonce}`);

  // 1. RewardToken (TRT) — initial supply minted to the deployer
  const tokenArtifact = loadArtifact("RewardToken");
  const tokenFactory = new ethers.ContractFactory(
    tokenArtifact.abi,
    tokenArtifact.bytecode,
    deployer
  );
  console.log("Deploying RewardToken (TRT) ...");
  const token = await tokenFactory.deploy(TRT_SUPPLY, { nonce: nonce++ });
  await token.waitForDeployment();
  const tokenAddress = await token.getAddress();
  console.log(`RewardToken deployed at: ${tokenAddress}`);

  // 2. TournamentContract
  const tourArtifact = loadArtifact("TournamentContract");
  const tourFactory = new ethers.ContractFactory(
    tourArtifact.abi,
    tourArtifact.bytecode,
    deployer
  );
  console.log("Deploying TournamentContract ...");
  const tournament = await tourFactory.deploy({ nonce: nonce++ });
  await tournament.waitForDeployment();
  const tournamentAddress = await tournament.getAddress();
  console.log(`TournamentContract deployed at: ${tournamentAddress}`);

  // 3. Wire TRT into the tournament contract
  console.log("Calling setRewardToken ...");
  const tx = await tournament.setRewardToken(tokenAddress, { nonce: nonce++ });
  await tx.wait();
  console.log("Reward token wired.");

  // 4. Persist deployment metadata (real addresses replace the defaults)
  const deployData = {
    contractName: "TournamentContract",
    contractAddress: tournamentAddress,
    network: "hardhat-local",
    chainId: "31337",
    deployedAt: new Date().toISOString(),
    deployer: deployer.address,
    live: true,
    abi: tourArtifact.abi,
    rewardToken: {
      contractName: "RewardToken",
      contractAddress: tokenAddress,
      name: "Tournament Reward Token",
      symbol: "TRT",
      decimals: 18,
      initialSupply: "1000000 TRT",
    },
  };
  const outFile = path.join(__dirname, "../deployments/hardhat-local_deployment.json");
  fs.writeFileSync(outFile, JSON.stringify(deployData, null, 2));
  console.log(`Deployment metadata written to: ${outFile}`);

  console.log("\n=== Update frontend/.env ===");
  console.log(`VITE_BACKEND_URL=http://localhost:4000`);
  console.log(`VITE_CONTRACT_ADDRESS=${tournamentAddress}`);
  console.log(`VITE_REWARD_TOKEN_ADDRESS=${tokenAddress}`);
  console.log(`VITE_CHAIN_ID=31337`);
  console.log("\nVerify: call totalTournaments() and balanceOf(deployer) on the new addresses.");
}

main().catch((err) => {
  const reason =
    err.shortMessage || err?.info?.error?.message || err.message || err;
  console.error("Live deployment failed:", String(reason).slice(0, 300));
  if (String(reason).includes("nonce")) {
    console.error(
      "Hint: restart `npx hardhat node` for a clean chain, then re-run this script."
    );
  }
  process.exit(1);
});
