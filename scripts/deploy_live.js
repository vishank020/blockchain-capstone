import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";
import { ethers } from "ethers";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

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

function updateEnvFile(filePath, updates) {
  if (!fs.existsSync(filePath)) {
    return;
  }
  let content = fs.readFileSync(filePath, "utf8");
  for (const [key, value] of Object.entries(updates)) {
    const regex = new RegExp(`^${key}=.*$`, "m");
    if (regex.test(content)) {
      content = content.replace(regex, `${key}=${value}`);
    } else {
      content += `\n${key}=${value}`;
    }
  }
  fs.writeFileSync(filePath, content, "utf8");
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

  let nonce = await provider.getTransactionCount(deployer.address, "latest");
  console.log(`Starting nonce: ${nonce}`);

  // 1. RewardToken (TRT)
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

  // 3. Wire TRT into TournamentContract
  console.log("Calling setRewardToken ...");
  const tx = await tournament.setRewardToken(tokenAddress, { nonce: nonce++ });
  await tx.wait();
  console.log("Reward token wired.");

  // 4. Save metadata to deployments/
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
  const outDir = path.join(__dirname, "../deployments");
  if (!fs.existsSync(outDir)) fs.mkdirSync(outDir, { recursive: true });
  fs.writeFileSync(
    path.join(outDir, "hardhat-local_deployment.json"),
    JSON.stringify(deployData, null, 2)
  );

  // 5. AUTO-SYNC: Write directly into frontend/src/contracts.json
  const frontendContractsPath = path.join(__dirname, "../frontend/src/contracts.json");
  fs.writeFileSync(
    frontendContractsPath,
    JSON.stringify(
      {
        tournamentAddress,
        rewardTokenAddress: tokenAddress,
        chainId: 31337,
        deployedAt: deployData.deployedAt,
      },
      null,
      2
    )
  );
  console.log(`[Auto-Sync] Written: ${frontendContractsPath}`);

  // 6. AUTO-SYNC: Update all .env files
  const rootEnv = path.join(__dirname, "../.env");
  const backendEnv = path.join(__dirname, "../backend/.env");
  const frontendEnv = path.join(__dirname, "../frontend/.env");

  updateEnvFile(rootEnv, {
    CONTRACT_ADDRESS: tournamentAddress,
    REWARD_TOKEN_ADDRESS: tokenAddress,
  });
  console.log(`[Auto-Sync] Updated: ${rootEnv}`);

  updateEnvFile(backendEnv, {
    CONTRACT_ADDRESS: tournamentAddress,
    REWARD_TOKEN_ADDRESS: tokenAddress,
  });
  console.log(`[Auto-Sync] Updated: ${backendEnv}`);

  updateEnvFile(frontendEnv, {
    VITE_CONTRACT_ADDRESS: tournamentAddress,
    VITE_REWARD_TOKEN_ADDRESS: tokenAddress,
  });
  console.log(`[Auto-Sync] Updated: ${frontendEnv}`);

  // 7. SEED: Automatically seed on-chain tournaments
  console.log("Seeding sample on-chain tournaments...");
  try {
    const tourAbi = [
      "function totalTournaments() view returns (uint256)",
      "function createTournament(string calldata, string calldata, uint256, uint256) external payable returns (uint256)",
      "function createTokenTournament(string calldata, string calldata, uint256, uint256, uint256) external returns (uint256)",
    ];
    const tokenAbi = ["function approve(address, uint256) external returns (bool)"];
    const tourInst = new ethers.Contract(tournamentAddress, tourAbi, deployer);
    const tokenInst = new ethers.Contract(tokenAddress, tokenAbi, deployer);

    const tx1 = await tourInst.createTournament(
      "Valorant Champions Grand Final",
      "QmZtmD2qt8fJpq3CLDHvdzsKfLjqjCDypUADBr8u7i28e9",
      ethers.parseEther("0.05"),
      4,
      { value: ethers.parseEther("1.0"), nonce: nonce++ }
    );
    await tx1.wait();

    const appTx = await tokenInst.approve(tournamentAddress, ethers.parseEther("5000"), { nonce: nonce++ });
    await appTx.wait();

    const tx2 = await tourInst.createTokenTournament(
      "CS2 Masters League (TRT)",
      "QmXoypizjW3WknFiJnKLwHCnL72vedxjQkDDP1mXWo6uco",
      ethers.parseEther("50"),
      4,
      ethers.parseEther("1000"),
      { nonce: nonce++ }
    );
    await tx2.wait();
    console.log("Sample tournaments seeded successfully.");
  } catch (seedErr) {
    console.warn("Seeding warning:", seedErr.message);
  }

  // 8. AUTO-MINE: Prevent MetaMask cached block tag issues
  console.log("Advancing local blocks past MetaMask cache threshold...");
  try {
    await provider.send("hardhat_mine", ["0x20"]); // 32 blocks
    const finalBlock = await provider.getBlockNumber();
    console.log(`Current block height is: ${finalBlock} (MetaMask cache safe).`);
  } catch (mineErr) {
    console.warn("Mining buffer warning:", mineErr.message);
  }

  console.log("\n Deployment & auto-sync complete!");
  console.log(` TournamentContract: ${tournamentAddress}`);
  console.log(` RewardToken:        ${tokenAddress}`);
}

main().catch((err) => {
  const reason =
    err.shortMessage || err?.info?.error?.message || err.message || err;
  console.error("Live deployment failed:", String(reason).slice(0, 300));
  process.exit(1);
});
