import artifact from "./TournamentContract.json";
import rewardTokenArtifact from "./RewardToken.json";
import deployedContracts from "./contracts.json";

// Vite exposes env vars prefixed with VITE_ via import.meta.env.
export const BACKEND_URL =
  import.meta.env.VITE_BACKEND_URL || "http://localhost:4000";

export const CONTRACT_ADDRESS =
  import.meta.env.VITE_CONTRACT_ADDRESS ||
  deployedContracts.tournamentAddress;

export const CHAIN_ID = Number(
  import.meta.env.VITE_CHAIN_ID || deployedContracts.chainId || 31337
);

// Hardhat artifact shape: { abi: [...] }. Deployment file shape: { abi: [...] }.
export const CONTRACT_ABI = artifact.abi || artifact;

// TRT reward-token contract used for token prize pools.
export const REWARD_TOKEN_ADDRESS =
  import.meta.env.VITE_REWARD_TOKEN_ADDRESS ||
  deployedContracts.rewardTokenAddress;

export const REWARD_TOKEN_ABI =
  rewardTokenArtifact.abi || rewardTokenArtifact;

