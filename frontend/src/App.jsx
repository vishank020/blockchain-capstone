import { useState, useEffect } from "react";
import { ethers } from "ethers";
import TournamentAbi from "../hardhat-artifacts/contracts/TournamentContract.sol/TournamentContract.json";

// Set up contract address (will be updated after deployment)
const CONTRACT_ADDRESS = "0xYourContractAddressHere";

export default function App() {
  const [provider, setProvider] = useState<ethers.providers.Web3Provider | null>(null);
  const [signer, setSigner] = useState<ethers.Signer | null>(null);
  const [address, setAddress] = useState<string | null>(null);
  const [status, setStatus] = useState<string>("Connect wallet to begin");
  const [tournamentCount, setTournamentCount] = useState<number>(0);

  useEffect(() => {
    if (window.ethereum) {
      const ethersProvider = new ethers.providers.Web3Provider(window.ethereum, "any");
      setProvider(ethersProvider);

      ethersProvider.send("eth_requestAccounts", []).then((accounts) => {
        const acc = accounts[0];
        setAddress(acc);
        setSigner(ethersProvider.getSigner());
        
        // Connect to contract
        const contract = new ethers.Contract(CONTRACT_ADDRESS, TournamentAbi.abi, ethersProvider.getSigner());
        
        // Read tournament count
        contract.tournamentCount().then((count: number) => {
          setTournamentCount(count);
        });
      });
    }
  }, []);

  const connectWallet = async () => {
    if (!window.ethereum) {
      setStatus("MetaMask not detected. Please install MetaMask.");
      return;
    }
    
    try {
      await window.ethereum.request({ method: "eth_requestAccounts" });
      // Reload the component to get the new state
      window.location.reload();
    } catch (error) {
      setStatus("Wallet connection failed");
      console.error(error);
    }
  };

  const registerPlayer = async () => {
    if (!signer) {
      setStatus("Please connect wallet first");
      return;
    }
    
    try {
      const contract = new ethers.Contract(CONTRACT_ADDRESS, TournamentAbi.abi, signer);
      await contract.registerPlayer();
      setStatus("Player registered successfully!");
      window.location.reload();
    } catch (error) {
      setStatus("Registration failed: " + error);
      console.error(error);
    }
  };

  const createTournament = async () => {
    if (!signer) {
      setStatus("Please connect wallet first");
      return;
    }
    
    try {
      const contract = new ethers.Contract(CONTRACT_ADDRESS, TournamentAbi.abi, signer);
      await contract.createTournament(ethers.parseEther("100"));
      setStatus("Tournament created successfully!");
      window.location.reload();
    } catch (error) {
      setStatus("Tournament creation failed: " + error);
      console.error(error);
    }
  };

  const distributePrize = async () => {
    if (!signer) {
      setStatus("Please connect wallet first");
      return;
    }
    
    try {
      const contract = new ethers.Contract(CONTRACT_ADDRESS, TournamentAbi.abi, signer);
      // Assuming tournamentId 1 and some winner address
      await contract.distributePrize(1, address || "0x0000000000000000000000000000000000000000");
      setStatus("Prize distributed successfully!");
      window.location.reload();
    } catch (error) {
      setStatus("Prize distribution failed: " + error);
      console.error(error);
    }
  };

  return (
    <div style={{ maxWidth: '800px', margin: '0 auto', padding: '20px', fontFamily: 'Arial, sans-serif' }}>
      <h1>🎮 Esports Tournament Reward System</h1>
      
      <div style={{ marginBottom: '20px' }}>
        {address ? (
          <p>Connected wallet: {address}</p> : (
          <button onClick={connectWallet} style={{ padding: '10px 20px', fontSize: '16px' }}>
            Connect Wallet
          </button>
        )}
      </div>

      <div style={{ margin: '20px 0' }}>
        <h3>Tournament Stats</h3>
        <p>Total Tournaments: {tournamentCount}</p>
      </div>

      <div>
        <h3>Actions</h3>
        <button onClick={registerPlayer} style={{ marginRight: '10px', padding: '8px 16px', fontSize: '14px' }}>
          Register as Player
        </button>
        <button onClick={createTournament} style={{ padding: '8px 16px', fontSize: '14px' }}>
          Create Tournament (100 ETH)
        </button>
        <button onClick={distributePrize} style={{ padding: '8px 16px', fontSize: '14px', marginLeft: '10px' }}>
          Distribute Prize
        </button>
      </div>

      <div style={{ marginTop: '20px', padding: '10px', background: '#f5f5f5', borderRadius: '8px' }}>
        <p>{status}</p>
      </div>
    </div>
  );
}