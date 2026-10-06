import { ethers } from "ethers";
import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const deploymentPath = path.resolve(__dirname, "../deployments/hardhat-local_deployment.json");
let deploymentData = {};
if (fs.existsSync(deploymentPath)) {
  try {
    deploymentData = JSON.parse(fs.readFileSync(deploymentPath, "utf8"));
  } catch (e) {}
}

const RPC_URL = process.env.LOCAL_RPC_URL || "http://127.0.0.1:8545";
const ADMIN_KEY = process.env.ORACLE_PRIVATE_KEY || "0xac0974bec39a17e36ba4a6b4d238ff944bacb478cbed5efcae784d7bf4f2ff80";
const CONTRACT_ADDRESS =
  process.env.CONTRACT_ADDRESS ||
  deploymentData.contractAddress ||
  "0xDc64a140Aa3E981100a9becA4E685f962f0cF6C9";
const REWARD_TOKEN_ADDRESS =
  process.env.REWARD_TOKEN_ADDRESS ||
  (deploymentData.rewardToken && deploymentData.rewardToken.contractAddress) ||
  "0xCf7Ed3AccA5a467e9e704C703E8D87F634fB0Fc9";

async function main() {
  const provider = new ethers.JsonRpcProvider(RPC_URL);
  const admin = new ethers.Wallet(ADMIN_KEY, provider);

  const tourAbi = [
    "function totalTournaments() view returns (uint256)",
    "function createTournament(string calldata _title, string calldata _ipfsMetadataHash, uint256 _entryFee, uint256 _maxPlayers) external payable returns (uint256)",
    "function createTokenTournament(string calldata _title, string calldata _ipfsMetadataHash, uint256 _entryFeeTokens, uint256 _maxPlayers, uint256 _prizeTokens) external returns (uint256)",
    "function getTournament(uint256) view returns (uint256, string, string, uint256, uint256, uint256, uint256, uint8, address, bool)",
  ];
  const tokenAbi = [
    "function approve(address, uint256) external returns (bool)",
    "function balanceOf(address) view returns (uint256)",
    "function mint(address, uint256) external returns (bool)",
  ];

  const tournament = new ethers.Contract(CONTRACT_ADDRESS, tourAbi, admin);
  const token = new ethers.Contract(REWARD_TOKEN_ADDRESS, tokenAbi, admin);

  const count = await tournament.totalTournaments();
  console.log(`Current on-chain tournaments: ${count.toString()}`);

  if (Number(count) === 0) {
    let nonce = await provider.getTransactionCount(admin.address, "latest");
    console.log("Seeding sample tournament #1 (ETH)...");
    const tx1 = await tournament.createTournament(
      "Valorant Champions Grand Final",
      "QmZtmD2qt8fJpq3CLDHvdzsKfLjqjCDypUADBr8u7i28e9",
      ethers.parseEther("0.05"),
      4,
      { value: ethers.parseEther("1.0"), nonce: nonce++ }
    );
    await tx1.wait();
    console.log("Tournament #1 created!");

    console.log("Approving TRT and seeding tournament #2 (TRT Token)...");
    const approveTx = await token.approve(CONTRACT_ADDRESS, ethers.parseEther("5000"), { nonce: nonce++ });
    await approveTx.wait();

    const tx2 = await tournament.createTokenTournament(
      "CS2 Masters League (TRT)",
      "QmXoypizjW3WknFiJnKLwHCnL72vedxjQkDDP1mXWo6uco",
      ethers.parseEther("50"),
      4,
      ethers.parseEther("1000"),
      { nonce: nonce++ }
    );
    await tx2.wait();
    console.log("Tournament #2 (TRT) created!");
  } else if (Number(count) === 1) {
    let nonce = await provider.getTransactionCount(admin.address, "latest");
    console.log("Approving TRT and seeding tournament #2 (TRT Token)...");
    const approveTx = await token.approve(CONTRACT_ADDRESS, ethers.parseEther("5000"), { nonce: nonce++ });
    await approveTx.wait();

    const tx2 = await tournament.createTokenTournament(
      "CS2 Masters League (TRT)",
      "QmXoypizjW3WknFiJnKLwHCnL72vedxjQkDDP1mXWo6uco",
      ethers.parseEther("50"),
      4,
      ethers.parseEther("1000"),
      { nonce: nonce++ }
    );
    await tx2.wait();
    console.log("Tournament #2 (TRT) created!");
  }

  const finalCount = await tournament.totalTournaments();
  console.log(`Final on-chain tournaments count: ${finalCount.toString()}`);
}

main().catch((err) => {
  console.error("Seed error:", err);
  process.exit(1);
});
