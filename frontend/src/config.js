import artifact from "./TournamentContract.json";
import rewardTokenArtifact from "./RewardToken.json";

// Vite exposes env vars prefixed with VITE_ via import.meta.env.
export const BACKEND_URL =
  import.meta.env.VITE_BACKEND_URL || "http://localhost:4000";

export const CONTRACT_ADDRESS =
  import.meta.env.VITE_CONTRACT_ADDRESS ||
  "0x68B1D87F95878fE05B998F19b66F4baba5De1aed";

export const CHAIN_ID = Number(import.meta.env.VITE_CHAIN_ID || 31337);

// Hardhat artifact shape: { abi: [...] }. Deployment file shape: { abi: [...] }.
export const CONTRACT_ABI = artifact.abi || artifact;

// TRT reward-token contract used for token prize pools.
export const REWARD_TOKEN_ADDRESS =
  import.meta.env.VITE_REWARD_TOKEN_ADDRESS ||
  "0x9A9f2CCfdE556A7E9Ff0848998Aa4a0CFD8863AE";

export const REWARD_TOKEN_ABI =
  rewardTokenArtifact.abi || rewardTokenArtifact;
