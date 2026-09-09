import { useCallback, useEffect, useState } from "react";
import { ethers } from "ethers";
import { BACKEND_URL, CONTRACT_ABI, CONTRACT_ADDRESS, REWARD_TOKEN_ABI, REWARD_TOKEN_ADDRESS } from "./config.js";
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
  const [backendBalance, setBackendBalance] = useState(null);
  const [chainBalance, setChainBalance] = useState(null);
  const [trtBalance, setTrtBalance] = useState(null);
  const [balanceLoading, setBalanceLoading] = useState(false);
  const [notifications, setNotifications] = useState([]);
  const [claimingId, setClaimingId] = useState(null);
  const [liveEvents, setLiveEvents] = useState([]);
  const [liveConnected, setLiveConnected] = useState(false);

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

  // Live contract-event subscription: auto-refreshes on-chain activity.
  useEffect(() => {
    if (!window.ethereum) {
      setLiveConnected(false);
      return undefined;
    }
    let contract = null;
    let cancelled = false;
    const pushEvent = (type, message) => {
      setLiveEvents((prev) =>
        [{ type, message, time: new Date().toLocaleTimeString() }, ...prev].slice(0, 10)
      );
    };
    try {
      const provider = new ethers.BrowserProvider(window.ethereum);
      contract = new ethers.Contract(CONTRACT_ADDRESS, CONTRACT_ABI, provider);
      contract.on("TournamentCreated", (tournamentId, title) => {
        if (cancelled) return;
        pushEvent("TournamentCreated", `#${tournamentId.toString()} ${title}`);
        fetchTournaments();
      });
      contract.on("TokenTournamentCreated", (tournamentId, title) => {
        if (cancelled) return;
        pushEvent("TokenTournamentCreated", `#${tournamentId.toString()} ${title} (TRT)`);
        fetchTournaments();
      });
      contract.on("PlayerRegistered", (tournamentId, player) => {
        if (cancelled) return;
        pushEvent(
          "PlayerRegistered",
          `#${tournamentId.toString()} ${player.slice(0, 6)}...`
        );
        fetchTournaments();
      });
      contract.on("PrizeDistributed", (tournamentId, winner, amount) => {
        if (cancelled) return;
        pushEvent(
          "PrizeDistributed",
          `#${tournamentId.toString()} ${ethers.formatEther(amount)} ETH`
        );
        fetchTournaments();
        if (address) fetchNotifications(address);
      });
      contract.on("TokenPrizeDistributed", (tournamentId, winner, amount) => {
        if (cancelled) return;
        pushEvent(
          "TokenPrizeDistributed",
          `#${tournamentId.toString()} ${ethers.formatEther(amount)} TRT`
        );
        fetchTournaments();
        if (address) {
          fetchNotifications(address);
          fetchChainBalance();
        }
      });
      contract.on("TournamentCancelled", (tournamentId) => {
        if (cancelled) return;
        pushEvent("TournamentCancelled", `#${tournamentId.toString()}`);
        fetchTournaments();
      });
      setLiveConnected(true);
    } catch {
      setLiveConnected(false);
    }
    return () => {
      cancelled = true;
      if (contract) contract.removeAllListeners();
      setLiveConnected(false);
    };
  }, [fetchTournaments, fetchNotifications, fetchChainBalance, address]);

  const fetchBalance = useCallback(async (walletAddress) => {
    if (!walletAddress) return;
    setBalanceLoading(true);
    try {
      const res = await fetch(`${BACKEND_URL}/api/balance/${walletAddress}`);
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      setBackendBalance(await res.json());
    } catch (error) {
      setBackendBalance({ error: getErrorMessage(error) });
    } finally {
      setBalanceLoading(false);
    }
  }, []);

  const fetchNotifications = useCallback(async (walletAddress) => {
    if (!walletAddress) {
      setNotifications([]);
      return;
    }
    try {
      const res = await fetch(
        `${BACKEND_URL}/api/notifications/${walletAddress}`
      );
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const data = await res.json();
      setNotifications(data.notifications || []);
    } catch {
      setNotifications([]);
    }
  }, []);

  const fetchChainBalance = useCallback(async () => {
    if (!window.ethereum || !address) return;
    try {
      const provider = new ethers.BrowserProvider(window.ethereum);
      const wei = await provider.getBalance(address);
      setChainBalance(ethers.formatEther(wei));
    } catch {
      setChainBalance(null);
    }
    try {
      const provider = new ethers.BrowserProvider(window.ethereum);
      const token = new ethers.Contract(
        REWARD_TOKEN_ADDRESS,
        REWARD_TOKEN_ABI,
        provider
      );
      const raw = await token.balanceOf(address);
      setTrtBalance(ethers.formatEther(raw));
    } catch {
      setTrtBalance(null);
    }
  }, [address]);

  useEffect(() => {
    if (address) {
      fetchBalance(address);
      fetchNotifications(address);
      fetchChainBalance();
    } else {
      setBackendBalance(null);
      setChainBalance(null);
      setTrtBalance(null);
      setNotifications([]);
    }
  }, [address, fetchBalance, fetchNotifications, fetchChainBalance]);

  const connectWallet = async () => {
    if (!window.ethereum) {
      setStatus("MetaMask not detected. Please install MetaMask.");
      return;
    }
    try {
      // ethers v6: BrowserProvider replaces the legacy v5 provider class
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

  const claimPrize = async (tournament) => {
    if (!address) {
      setStatus("Please connect wallet first");
      return;
    }
    setClaimingId(tournament.id);
    try {
      const res = await fetch(
        `${BACKEND_URL}/api/tournaments/${tournament.id}/distribute-prize`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ winnerAddress: address }),
        }
      );
      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.error || `HTTP ${res.status}`);
      }
      setStatus(`Prize claimed for tournament #${tournament.id}`);
      await fetchTournaments();
      await fetchNotifications(address);
    } catch (error) {
      // Backend rejects non-participants and already-distributed prizes
      setStatus(`Claim failed: ${getErrorMessage(error)}`);
    } finally {
      setClaimingId(null);
    }
  };

  const myTournaments = address
    ? tournaments.filter((t) =>
        (t.players || []).some(
          (p) => p.toLowerCase() === address.toLowerCase()
        )
      )
    : [];

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
          <h2>Wallet</h2>
          {address ? (
            <button
              className="btn"
              onClick={() => {
                fetchBalance(address);
                fetchChainBalance();
              }}
              disabled={balanceLoading}
            >
              {balanceLoading ? "Loading..." : "Refresh balance"}
            </button>
          ) : null}
        </div>
        {!address ? (
          <p className="muted">Connect wallet to see balances.</p>
        ) : backendBalance?.error ? (
          <p className="bad">Balance error: {backendBalance.error}</p>
        ) : (
          <p>
            Backend:{" "}
            <strong>{backendBalance?.formattedBalance || "..."}</strong>{" "}
            <span className="muted small">
              ({backendBalance?.network || "Hardhat Local"})
            </span>
            {chainBalance !== null ? (
              <span className="muted small"> · Chain: {chainBalance} ETH</span>
            ) : null}
            {trtBalance !== null ? (
              <span className="muted small"> · TRT: {trtBalance}</span>
            ) : null}
          </p>
        )}
      </section>

      <section className="card">
        <div className="row row-spread">
          <h2>Rewards</h2>
          {address ? (
            <button className="btn" onClick={() => fetchNotifications(address)}>
              Refresh rewards
            </button>
          ) : null}
        </div>
        {!address ? (
          <p className="muted">Connect wallet to see your tournaments and rewards.</p>
        ) : (
          <>
            <h3 className="subheading">
              My tournaments ({myTournaments.length})
            </h3>
            {myTournaments.length === 0 ? (
              <p className="muted">You have not joined any tournament yet.</p>
            ) : (
              <ul className="tournament-list">
                {myTournaments.map((tournament) => (
                  <li key={tournament.id} className="tournament-item">
                    <div>
                      <strong>
                        #{tournament.id} {tournament.title}
                      </strong>
                      <div className="muted small">
                        {formatStatus(tournament.status)} · Prize{" "}
                        {tournament.prizePool}
                        {tournament.prizeDistributed ? " · Distributed" : ""}
                        {tournament.winner ? ` · Winner ${tournament.winner.slice(0, 6)}...` : ""}
                      </div>
                    </div>
                    <button
                      className="btn btn-primary"
                      disabled={
                        claimingId === tournament.id ||
                        tournament.prizeDistributed
                      }
                      title={
                        tournament.prizeDistributed
                          ? "Prize already distributed"
                          : "Claim prize via backend API"
                      }
                      onClick={() => claimPrize(tournament)}
                    >
                      {claimingId === tournament.id
                        ? "Claiming..."
                        : tournament.prizeDistributed
                          ? "Claimed"
                          : "Claim prize"}
                    </button>
                  </li>
                ))}
              </ul>
            )}
            <h3 className="subheading">
              Notifications ({notifications.length})
            </h3>
            {notifications.length === 0 ? (
              <p className="muted">No reward notifications yet.</p>
            ) : (
              <ul className="tournament-list">
                {notifications.map((notif) => (
                  <li key={notif.id} className="tournament-item">
                    <div>
                      <strong>{notif.prizeAmount}</strong>
                      <div className="muted small">{notif.message}</div>
                    </div>
                    <span className="pill pill-connected">{notif.status}</span>
                  </li>
                ))}
              </ul>
            )}
          </>
        )}
      </section>

      <section className="card">
        <div className="row row-spread">
          <h2>
            Live events{" "}
            <span
              className={liveConnected ? "pill pill-connected" : "pill"}
            >
              {liveConnected ? "Listening" : "Not connected"}
            </span>
          </h2>
        </div>
        {!window.ethereum ? (
          <p className="muted">
            Install MetaMask to receive live contract events. The list below
            still refreshes via the Refresh buttons.
          </p>
        ) : liveEvents.length === 0 ? (
          <p className="muted">
            Listening for TournamentCreated, TokenTournamentCreated,
            PlayerRegistered, PrizeDistributed, TokenPrizeDistributed,
            TournamentCancelled — new events appear here and
            auto-refresh the lists.
          </p>
        ) : (
          <ul className="tournament-list">
            {liveEvents.map((event, index) => (
              <li key={`${event.time}-${index}`} className="tournament-item">
                <div>
                  <strong>{event.type}</strong>
                  <div className="muted small">{event.message}</div>
                </div>
                <span className="muted small">{event.time}</span>
              </li>
            ))}
          </ul>
        )}
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
