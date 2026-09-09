import artifact from "./TournamentContract.json";

// Vite exposes env vars prefixed with VITE_ via import.meta.env.
export const BACKEND_URL =
  import.meta.env.VITE_BACKEND_URL || "http://localhost:4000";

export const CONTRACT_ADDRESS =
  import.meta.env.VITE_CONTRACT_ADDRESS ||
  "0x5FbDB2315678afecb367f032d93F642f64180aa3";

export const CHAIN_ID = Number(import.meta.env.VITE_CHAIN_ID || 31337);

// Hardhat artifact shape: { abi: [...] }. Deployment file shape: { abi: [...] }.
export const CONTRACT_ABI = artifact.abi || artifact;
