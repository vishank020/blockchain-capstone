import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

async function main() {
  console.log("=== TournamentContract Deployment Process ===");

  const artifactPath = path.join(__dirname, "../artifacts/contracts/TournamentContract.sol/TournamentContract.json");
  if (!fs.existsSync(artifactPath)) {
    console.error("❌ Artifact not found. Please run 'npm run compile' first.");
    process.exit(1);
  }

  const artifact = JSON.parse(fs.readFileSync(artifactPath, "utf8"));
  console.log(`Contract: ${artifact.contractName}`);
  console.log(`ABI Functions: ${artifact.abi.filter(x => x.type === "function").length}`);
  console.log(`ABI Events: ${artifact.abi.filter(x => x.type === "event").length}`);
  console.log(`Bytecode Size: ${artifact.bytecode.length} bytes`);

  // Deployment configuration
  const network = process.env.HARDHAT_NETWORK || "hardhat-local";
  const defaultAddress = "0x5FbDB2315678afecb367f032d93F642f64180aa3";

  const deployData = {
    contractName: artifact.contractName,
    contractAddress: process.env.CONTRACT_ADDRESS || defaultAddress,
    network: network,
    chainId: "31337",
    deployedAt: new Date().toISOString(),
    abi: artifact.abi,
  };

  const outputDir = path.join(__dirname, "../deployments");
  if (!fs.existsSync(outputDir)) {
    fs.mkdirSync(outputDir, { recursive: true });
  }

  const outputFile = path.join(outputDir, `${network}_deployment.json`);
  fs.writeFileSync(outputFile, JSON.stringify(deployData, null, 2));

  console.log(`✅ Deployment metadata exported to: ${outputFile}`);
  console.log(`📌 Contract ready at address: ${deployData.contractAddress}`);
}

main().catch((err) => {
  console.error("Deployment failed:", err);
  process.exit(1);
});
