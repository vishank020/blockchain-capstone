import { useCallback, useEffect, useState } from "react";
import { ethers } from "ethers";
import { BACKEND_URL, CONTRACT_ABI, CONTRACT_ADDRESS } from "./config.js";
import "./App.css";

const STATUS_LABELS = ["Open", "InProgress", "Completed", "Cancelled"];

function formatStatus(status) {
  const index = Number(status);
  return STATUS_LABELS[index] || `Unknown (${String(status)})`;
}

function getErrorMessage(error) {
  if (!error) return "Unknown error";
  if (typeof error === "string") return error;
  // ethers v6 contract revert: error.reason, error.shortMessage, or nested info
  return (
    error.reason ||
    error.shortMessage ||
    error?.info?.error?.message ||
    error.message ||
    "Transaction failed"
  );
}

export default function App() {
  const [address, setAddress] = useState(null);
  const [status, setStatus] = useState("Connect wallet to begin");
  const [backendHealth, setBackendHealth] = useState(null);
  const [tournaments, setTournaments] = useState([]);
  const [tournamentsLoading, setTournamentsLoading] = useState(false);
  const [joiningId, setJoiningId] = useState(null);
  const [onChainCount, setOnChainCount] = useState(null);

  const fetchHealth = useCallback(async () => {
    try {
      const res = await fetch(`${BACKEND_URL}/health`);
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const data = await res.json();
      setBackendHealth(data);
    } catch (error) {
      setBackendHealth({ status: "unreachable", error: getErrorMessage(error) });
    }
  }, []);

  const fetchTournaments = useCallback(async () => {
    setTournamentsLoading(true);
    try {
      const res = await fetch(`${BACKEND_URL}/api/tournaments`);
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const data = await res.json();
      setTournaments(data.tournaments || []);
    } catch (error) {
      setStatus(`Failed to load tournaments: ${getErrorMessage(error)}`);
    } finally {
      setTournamentsLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchHealth();
    fetchTournaments();
  }, [fetchHealth, fetchTournaments]);

  const connectWallet = async () => {
    if (!window.ethereum) {
      setStatus("MetaMask not detected. Please install MetaMask.");
      return;
    }
    try {
      // ethers v6: BrowserProvider replaces Web3Provider
      const provider = new ethers.BrowserProvider(window.ethereum);
      const accounts = await provider.send("eth_requestAccounts", []);
      setAddress(accounts[0] || null);
      setStatus(
        accounts.length > 0
          ? `Wallet connected: ${accounts[0]}`
          : "No accounts returned by wallet"
      );
    } catch (error) {
      setStatus(`Wallet connection failed: ${getErrorMessage(error)}`);
    }
  };

  const readOnChainCount = async () => {
    if (!window.ethereum) {
      setStatus("MetaMask not detected. Please install MetaMask.");
      return;
    }
    try {
      const provider = new ethers.BrowserProvider(window.ethereum);
      const contract = new ethers.Contract(
        CONTRACT_ADDRESS,
        CONTRACT_ABI,
        provider
      );
      const count = await contract.totalTournaments();
      setOnChainCount(count.toString());
      setStatus(`On-chain tournament count: ${count.toString()}`);
    } catch (error) {
      setStatus(`On-chain read failed: ${getErrorMessage(error)}`);
    }
  };

  const joinTournament = async (tournament) => {
    if (!address) {
      setStatus("Please connect wallet first");
      return;
    }
    setJoiningId(tournament.id);
    try {
      const res = await fetch(
        `${BACKEND_URL}/api/tournaments/${tournament.id}/join`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ playerAddress: address }),
        }
      );
      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.error || `HTTP ${res.status}`);
      }
      setStatus(`Joined tournament #${tournament.id} successfully`);
      await fetchTournaments();
    } catch (error) {
      // Backend returns contract-style revert reasons (already joined, full, not open)
      setStatus(`Join failed: ${getErrorMessage(error)}`);
    } finally {
      setJoiningId(null);
    }
  };

  return (
    <div className="page">
      <header className="header">
        <div>
          <h1>Tournament DApp</h1>
          <p className="subtitle">
            MVP: wallet + tournament list + join + backend health
          </p>
        </div>
        <div className="wallet-box">
          {address ? (
            <span className="pill pill-connected" title={address}>
              {address.slice(0, 6)}...{address.slice(-4)}
            </span>
          ) : (
            <button className="btn btn-primary" onClick={connectWallet}>
              Connect Wallet
            </button>
          )}
        </div>
      </header>

      <section className="card">
        <h2>Backend</h2>
        {backendHealth ? (
          <p>
            Status:{" "}
            <strong
              className={
                backendHealth.status === "healthy" ? "ok" : "bad"
              }
            >
              {backendHealth.status}
            </strong>{" "}
            <span className="muted">({BACKEND_URL})</span>
            {backendHealth.error ? (
              <span className="muted"> — {backendHealth.error}</span>
            ) : null}
          </p>
        ) : (
          <p className="muted">Checking backend...</p>
        )}
        <div className="row">
          <button className="btn" onClick={fetchHealth}>
            Recheck health
          </button>
          <button className="btn" onClick={readOnChainCount}>
            Read on-chain count
          </button>
          {onChainCount !== null ? (
            <span className="muted">On-chain total: {onChainCount}</span>
          ) : null}
        </div>
        <p className="muted small">
          Contract: <code>{CONTRACT_ADDRESS}</code>
        </p>
      </section>

      <section className="card">
        <div className="row row-spread">
          <h2>Tournaments</h2>
          <button
            className="btn"
            onClick={fetchTournaments}
            disabled={tournamentsLoading}
          >
            {tournamentsLoading ? "Loading..." : "Refresh"}
          </button>
        </div>
        {tournaments.length === 0 && !tournamentsLoading ? (
          <p className="muted">No tournaments found. Start the backend.</p>
        ) : null}
        <ul className="tournament-list">
          {tournaments.map((tournament) => (
            <li key={tournament.id} className="tournament-item">
              <div>
                <strong>
                  #{tournament.id} {tournament.title}
                </strong>
                <div className="muted small">
                  {formatStatus(tournament.status)} ·{" "}
                  {tournament.currentPlayers}/{tournament.maxPlayers} players
                  · Prize {tournament.prizePool} · Fee {tournament.entryFee}
                </div>
              </div>
              <button
                className="btn btn-primary"
                disabled={joiningId === tournament.id || !address}
                title={!address ? "Connect wallet first" : "Join via backend API"}
                onClick={() => joinTournament(tournament)}
              >
                {joiningId === tournament.id ? "Joining..." : "Join"}
              </button>
            </li>
          ))}
        </ul>
      </section>

      <section className="card status-card">
        <h2>Status</h2>
        <p>{status}</p>
      </section>
    </div>
  );
}
