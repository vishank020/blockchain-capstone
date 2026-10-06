import { useCallback, useEffect, useState } from "react";
import { ethers } from "ethers";
import {
  BACKEND_URL,
  CONTRACT_ABI,
  CONTRACT_ADDRESS,
  REWARD_TOKEN_ABI,
  REWARD_TOKEN_ADDRESS,
} from "./config.js";
import "./App.css";

const STATUS_LABELS = ["Open", "InProgress", "Completed", "Cancelled"];

function formatStatus(status) {
  // Backend serves string labels ("Open"); contracts use enum indexes (0-3).
  if (STATUS_LABELS.includes(status)) return status;
  const index = Number(status);
  return STATUS_LABELS[index] || `Unknown (${String(status)})`;
}

const STATUS_CLASSES = {
  Open: "st-open",
  InProgress: "st-progress",
  Completed: "st-done",
  Cancelled: "st-cancelled",
};

function statusBadge(status) {
  const key = STATUS_LABELS.includes(status)
    ? status
    : STATUS_LABELS[Number(status)] || "";
  return (
    <span className={`badge ${STATUS_CLASSES[key] || ""}`}>
      {formatStatus(status)}
    </span>
  );
}

const EVENT_DOT_CLASSES = {
  TournamentCreated: "ev-created",
  TokenTournamentCreated: "ev-created",
  PlayerRegistered: "ev-joined",
  PrizeDistributed: "ev-prize",
  TokenPrizeDistributed: "ev-prize",
  TournamentCancelled: "ev-cancelled",
};

function eventDot(type) {
  return <span className={`event-dot ${EVENT_DOT_CLASSES[type] || ""}`} />;
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
  const [hasProvider, setHasProvider] = useState(false);
  const [currentChainId, setCurrentChainId] = useState(null);
  const [creating, setCreating] = useState(false);
  const [deletingId, setDeletingId] = useState(null);
  const [faucetLoading, setFaucetLoading] = useState(false);
  const [isGloballyRegistered, setIsGloballyRegistered] = useState(false);
  const [registeringPlayer, setRegisteringPlayer] = useState(false);

  const [newTournament, setNewTournament] = useState({
    title: "",
    prizePool: "1.0",
    entryFee: "0.05",
    maxPlayers: "4",
    currency: "ETH", // "ETH" or "TRT"
  });

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
      const net = await provider.getNetwork();
      setCurrentChainId(Number(net.chainId));

      let readProvider = new ethers.JsonRpcProvider("http://127.0.0.1:8545");
      try {
        await readProvider.getBlockNumber();
      } catch {
        readProvider = provider;
      }

      const wei = await readProvider.getBalance(address);
      setChainBalance(ethers.formatEther(wei));

      const token = new ethers.Contract(
        REWARD_TOKEN_ADDRESS,
        REWARD_TOKEN_ABI,
        readProvider
      );
      const raw = await token.balanceOf(address);
      setTrtBalance(ethers.formatEther(raw));

      const tourContract = new ethers.Contract(
        CONTRACT_ADDRESS,
        CONTRACT_ABI,
        readProvider
      );
      const isReg = await tourContract.registeredPlayers(address);
      setIsGloballyRegistered(Boolean(isReg));
    } catch (err) {
      console.warn("fetchChainBalance error:", err);
      setChainBalance(null);
      setTrtBalance(null);
      setIsGloballyRegistered(false);
    }
  }, [address]);

  const fetchTournaments = useCallback(async () => {
    setTournamentsLoading(true);
    try {
      let combined = [];

      // 1. Try on-chain read using MetaMask (if on 31337) or direct fallback RPC
      let provider = null;
      if (typeof window !== "undefined" && window.ethereum) {
        try {
          const bp = new ethers.BrowserProvider(window.ethereum);
          const net = await bp.getNetwork();
          if (net.chainId === 31337n) {
            provider = bp;
          }
        } catch {
          // Fall through
        }
      }
      if (!provider) {
        try {
          provider = new ethers.JsonRpcProvider("http://127.0.0.1:8545");
        } catch {
          // Fall through
        }
      }

      if (provider) {
        try {
          const contract = new ethers.Contract(
            CONTRACT_ADDRESS,
            CONTRACT_ABI,
            provider
          );
          const total = await contract.totalTournaments();
          const totalNum = Number(total);
          setOnChainCount(total.toString());

          const onChainList = [];
          for (let i = 1; i <= totalNum; i++) {
            try {
              const t = await contract.getTournament(i);
              const players = await contract.getTournamentPlayers(i);
              const isToken = await contract.isTokenTournament(i);
              const tokenPrize = isToken
                ? await contract.tokenPrizePools(i)
                : 0n;

              onChainList.push({
                id: Number(t[0]),
                title: t[1],
                ipfsMetadataHash: t[2],
                prizePool: isToken
                  ? `${ethers.formatEther(tokenPrize)} TRT`
                  : `${ethers.formatEther(t[3])} ETH`,
                entryFee: isToken
                  ? `${ethers.formatEther(t[4])} TRT`
                  : `${ethers.formatEther(t[4])} ETH`,
                rawEntryFee: t[4],
                rawPrizePool: isToken ? tokenPrize : t[3],
                maxPlayers: Number(t[5]),
                currentPlayers: Number(t[6]),
                status: STATUS_LABELS[Number(t[7])] || "Open",
                winner:
                  t[8] === ethers.ZeroAddress || t[8] === null
                    ? null
                    : t[8],
                prizeDistributed: t[9],
                players: [...players],
                isTokenTournament: isToken,
                onChain: true,
              });
            } catch (err) {
              console.warn(`Could not read on-chain tournament #${i}:`, err);
            }
          }
          if (onChainList.length > 0) {
            combined = onChainList;
          }
        } catch (chainErr) {
          console.warn("On-chain fetch skipped:", chainErr);
        }
      }

      // 2. Fetch backend tournaments mirror
      try {
        const res = await fetch(`${BACKEND_URL}/api/tournaments`);
        if (res.ok) {
          const data = await res.json();
          const backendList = data.tournaments || [];
          if (combined.length === 0) {
            combined = backendList;
          } else {
            // Append any backend-only mock tournaments
            for (const bt of backendList) {
              if (!combined.some((ct) => ct.id === bt.id)) {
                combined.push(bt);
              }
            }
          }
        }
      } catch {
        // Backend offline, keep whatever we loaded
      }

      setTournaments(combined);
    } catch (error) {
      setStatus(`Failed to load tournaments: ${getErrorMessage(error)}`);
    } finally {
      setTournamentsLoading(false);
    }
  }, []);

  useEffect(() => {
    setHasProvider(typeof window !== "undefined" && !!window.ethereum);
    fetchHealth();
    fetchTournaments();
  }, [fetchHealth, fetchTournaments]);

  useEffect(() => {
    if (address) {
      fetchBalance(address);
      fetchNotifications(address);
      fetchChainBalance();
    } else {
      setBackendBalance(null);
      setChainBalance(null);
      setTrtBalance(null);
      setCurrentChainId(null);
      setNotifications([]);
    }
  }, [address, fetchBalance, fetchNotifications, fetchChainBalance]);

  // Live contract-event subscription: auto-refreshes on-chain activity.
  // Declared after all fetch callbacks to avoid TDZ access in the deps array.
  useEffect(() => {
    if (!window.ethereum) {
      setLiveConnected(false);
      return undefined;
    }
    let contract = null;
    let cancelled = false;
    const pushEvent = (type, message) => {
      setLiveEvents((prev) =>
        [
          { type, message, time: new Date().toLocaleTimeString() },
          ...prev,
        ].slice(0, 10)
      );
    };
    try {
      const provider = new ethers.BrowserProvider(window.ethereum);
      contract = new ethers.Contract(CONTRACT_ADDRESS, CONTRACT_ABI, provider);
      contract.on("TournamentCreated", (tournamentId, title) => {
        if (cancelled) return;
        pushEvent("TournamentCreated", `#${tournamentId.toString()} ${title}`);
        fetchTournaments();
        fetchChainBalance();
      });
      contract.on("TokenTournamentCreated", (tournamentId, title) => {
        if (cancelled) return;
        pushEvent(
          "TokenTournamentCreated",
          `#${tournamentId.toString()} ${title} (TRT)`
        );
        fetchTournaments();
        fetchChainBalance();
      });
      contract.on("PlayerRegistered", (tournamentId, player) => {
        if (cancelled) return;
        pushEvent(
          "PlayerRegistered",
          `#${tournamentId.toString()} ${player.slice(0, 6)}...`
        );
        fetchTournaments();
        fetchChainBalance();
      });
      contract.on("PrizeDistributed", (tournamentId, winner, amount) => {
        if (cancelled) return;
        pushEvent(
          "PrizeDistributed",
          `#${tournamentId.toString()} ${ethers.formatEther(amount)} ETH`
        );
        fetchTournaments();
        fetchChainBalance();
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

  const switchToHardhatNetwork = async () => {
    if (!window.ethereum) return;
    try {
      await window.ethereum.request({
        method: "wallet_switchEthereumChain",
        params: [{ chainId: "0x7a69" }], // 31337 in hex
      });
      setStatus("Switched to Hardhat Localhost (31337)");
      await fetchChainBalance();
    } catch (switchError) {
      if (switchError.code === 4902) {
        try {
          await window.ethereum.request({
            method: "wallet_addEthereumChain",
            params: [
              {
                chainId: "0x7a69",
                chainName: "Hardhat Localhost",
                rpcUrls: ["http://127.0.0.1:8545"],
                nativeCurrency: {
                  name: "ETH",
                  symbol: "ETH",
                  decimals: 18,
                },
              },
            ],
          });
          setStatus("Added and switched to Hardhat Localhost (31337)");
          await fetchChainBalance();
        } catch (addError) {
          setStatus(`Failed to add network: ${getErrorMessage(addError)}`);
        }
      } else {
        setStatus(`Failed to switch network: ${getErrorMessage(switchError)}`);
      }
    }
  };

  const connectWallet = async () => {
    if (!window.ethereum) {
      setStatus("MetaMask not detected. Please install MetaMask.");
      return;
    }
    try {
      // ethers v6: BrowserProvider replaces the legacy v5 provider class
      const provider = new ethers.BrowserProvider(window.ethereum);
      const net = await provider.getNetwork();
      setCurrentChainId(Number(net.chainId));

      const accounts = await provider.send("eth_requestAccounts", []);
      setAddress(accounts[0] || null);

      if (net.chainId !== 31337n) {
        setStatus(
          `Connected: ${accounts[0]?.slice(0, 6)}... (Note: MetaMask is on Chain ${net.chainId.toString()}. Switch to Hardhat 31337 for on-chain actions)`
        );
      } else {
        setStatus(
          accounts.length > 0
            ? `Wallet connected: ${accounts[0]}`
            : "No accounts returned by wallet"
        );
      }
    } catch (error) {
      setStatus(`Wallet connection failed: ${getErrorMessage(error)}`);
    }
  };

  const registerGlobalPlayer = async () => {
    if (!address || !window.ethereum) {
      setStatus("Please connect wallet first");
      return;
    }
    setRegisteringPlayer(true);
    try {
      const provider = new ethers.BrowserProvider(window.ethereum);
      const net = await provider.getNetwork();
      if (net.chainId !== 31337n) {
        await switchToHardhatNetwork();
      }

      setStatus("Registering player globally on-chain via MetaMask...");
      const signer = await provider.getSigner();
      const contract = new ethers.Contract(
        CONTRACT_ADDRESS,
        CONTRACT_ABI,
        signer
      );
      const tx = await contract.registerPlayer();
      setStatus(`Registration transaction submitted (${tx.hash.slice(0, 10)}...). Waiting for confirmation...`);
      await tx.wait();
      setStatus("Player registered globally on-chain!");
      setIsGloballyRegistered(true);
    } catch (error) {
      setStatus(`Registration failed: ${getErrorMessage(error)}`);
    } finally {
      setRegisteringPlayer(false);
    }
  };

  const claimFaucet = async () => {
    if (!address) {
      setStatus("Please connect wallet first");
      return;
    }
    setFaucetLoading(true);
    try {
      setStatus("Requesting 100 test TRT & gas ETH from faucet...");
      const res = await fetch(`${BACKEND_URL}/api/faucet`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ address }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || `HTTP ${res.status}`);
      setStatus(
        `Faucet sent 100 TRT tokens and test ETH to ${address.slice(0, 6)}...`
      );
      await fetchChainBalance();
    } catch (error) {
      setStatus(`Faucet failed: ${getErrorMessage(error)}`);
    } finally {
      setFaucetLoading(false);
    }
  };

  const readOnChainCount = async () => {
    try {
      let provider = null;
      if (window.ethereum) {
        try {
          const bp = new ethers.BrowserProvider(window.ethereum);
          const net = await bp.getNetwork();
          if (net.chainId === 31337n) {
            provider = bp;
          }
        } catch {
          // Fall through
        }
      }
      if (!provider) {
        provider = new ethers.JsonRpcProvider("http://127.0.0.1:8545");
      }

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

    // Check if player has joined this tournament
    const hasJoined = (tournament.players || []).some(
      (p) => p.toLowerCase() === address.toLowerCase()
    );
    if (!hasJoined) {
      setStatus(
        `Cannot claim: Address ${address.slice(0, 6)}... has not joined Tournament #${tournament.id}. Click 'Join tournament' first!`
      );
      return;
    }

    setClaimingId(tournament.id);
    try {
      let onChainDone = false;

      // 1. If caller is Admin/Oracle on-chain, prompt MetaMask directly
      if (tournament.onChain && window.ethereum) {
        try {
          const provider = new ethers.BrowserProvider(window.ethereum);
          const net = await provider.getNetwork();
          if (net.chainId === 31337n) {
            const signer = await provider.getSigner();
            const contract = new ethers.Contract(
              CONTRACT_ADDRESS,
              CONTRACT_ABI,
              signer
            );
            const adminAddr = await contract.admin();
            if (adminAddr.toLowerCase() === address.toLowerCase()) {
              setStatus(
                `MetaMask: Distribute prize for #${tournament.id} as admin...`
              );
              let tx;
              if (tournament.isTokenTournament) {
                tx = await contract.distributeTokenPrize(tournament.id, address);
              } else {
                tx = await contract.distributePrize(tournament.id, address);
              }
              await tx.wait();
              onChainDone = true;
            }
          }
        } catch (metamaskErr) {
          console.warn("Direct admin distribute skipped, using oracle relay:", metamaskErr);
        }
      }

      // 2. Request backend oracle relay to attest and distribute payout
      setStatus(
        `Oracle Attestation: Claiming prize for Tournament #${tournament.id}...`
      );
      const res = await fetch(
        `${BACKEND_URL}/api/tournaments/${tournament.id}/distribute-prize`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ winnerAddress: address }),
        }
      );
      const data = await res.json();
      if (!res.ok && !onChainDone) {
        throw new Error(data.error || `HTTP ${res.status}`);
      }

      setStatus(
        `Prize claimed and distributed successfully for Tournament #${tournament.id}! Check your updated balance.`
      );
      await fetchTournaments();
      await fetchNotifications(address);
      await fetchChainBalance();
    } catch (error) {
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

  const createTournament = async (event) => {
    event.preventDefault();
    if (!address) {
      setStatus("Please connect wallet first");
      return;
    }
    const maxPlayers = parseInt(newTournament.maxPlayers, 10);
    if (!newTournament.title.trim()) {
      setStatus("Creation failed: title is required");
      return;
    }
    if (!Number.isInteger(maxPlayers) || maxPlayers < 2) {
      setStatus("Creation failed: max players must be at least 2");
      return;
    }
    setCreating(true);
    try {
      const isTRT = newTournament.currency === "TRT";
      const ipfsHash =
        "Qm" +
        Math.random().toString(36).substring(2, 15) +
        Math.random().toString(36).substring(2, 15);

      if (window.ethereum) {
        const provider = new ethers.BrowserProvider(window.ethereum);
        const net = await provider.getNetwork();
        if (net.chainId !== 31337n) {
          await switchToHardhatNetwork();
        }

        setStatus(`Creating ${newTournament.currency} tournament on-chain via MetaMask...`);
        const signer = await provider.getSigner();
        const contract = new ethers.Contract(
          CONTRACT_ADDRESS,
          CONTRACT_ABI,
          signer
        );

        if (isTRT) {
          // Token Tournament: Approve TRT prize tokens, then create
          const token = new ethers.Contract(
            REWARD_TOKEN_ADDRESS,
            REWARD_TOKEN_ABI,
            signer
          );
          const prizeTokensWei = ethers.parseEther(newTournament.prizePool || "100");
          const entryFeeTokensWei = ethers.parseEther(newTournament.entryFee || "10");

          setStatus("MetaMask: Approve TRT tokens for tournament prize pool...");
          const approveTx = await token.approve(CONTRACT_ADDRESS, prizeTokensWei);
          await approveTx.wait();

          setStatus("MetaMask: Create token tournament on-chain...");
          const tx = await contract.createTokenTournament(
            newTournament.title.trim(),
            ipfsHash,
            entryFeeTokensWei,
            maxPlayers,
            prizeTokensWei
          );
          await tx.wait();
        } else {
          // ETH Tournament
          const prizePoolWei = ethers.parseEther(newTournament.prizePool || "0.5");
          const entryFeeWei = ethers.parseEther(newTournament.entryFee || "0.05");

          setStatus("MetaMask: Confirm on-chain tournament creation...");
          const tx = await contract.createTournament(
            newTournament.title.trim(),
            ipfsHash,
            entryFeeWei,
            maxPlayers,
            { value: prizePoolWei }
          );
          await tx.wait();
        }
        setStatus(`Tournament '${newTournament.title}' created on-chain!`);
      }

      // Sync backend mirror
      try {
        await fetch(`${BACKEND_URL}/api/tournaments`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            title: newTournament.title.trim(),
            prizePool: newTournament.prizePool || "0.0",
            entryFee: newTournament.entryFee || "0.0",
            maxPlayers,
          }),
        });
      } catch {
        // Backend sync non-blocking
      }

      setNewTournament({
        title: "",
        prizePool: "1.0",
        entryFee: "0.05",
        maxPlayers: "4",
        currency: "ETH",
      });
      await fetchTournaments();
      await fetchChainBalance();
    } catch (error) {
      setStatus(`Creation failed: ${getErrorMessage(error)}`);
    } finally {
      setCreating(false);
    }
  };

  const deleteTournament = async (tournament) => {
    if (!address) {
      setStatus("Please connect wallet first");
      return;
    }
    setDeletingId(tournament.id);
    try {
      if (tournament.prizeDistributed) {
        setStatus(
          `Cannot delete: Tournament #${tournament.id} is Completed with prize distributed. It is permanently recorded on-chain for audit.`
        );
        return;
      }

      // If on-chain and caller is admin, cancel via MetaMask
      let onChainDone = false;
      if (tournament.onChain && window.ethereum) {
        try {
          const provider = new ethers.BrowserProvider(window.ethereum);
          const net = await provider.getNetwork();
          if (net.chainId === 31337n) {
            const signer = await provider.getSigner();
            const contract = new ethers.Contract(
              CONTRACT_ADDRESS,
              CONTRACT_ABI,
              signer
            );
            const adminAddr = await contract.admin();
            if (adminAddr.toLowerCase() === address.toLowerCase()) {
              setStatus(
                `MetaMask: Cancelling tournament #${tournament.id} on-chain...`
              );
              const tx = await contract.cancelTournament(tournament.id);
              await tx.wait();
              onChainDone = true;
            }
          }
        } catch (metamaskErr) {
          console.warn("Direct admin cancel skipped, using backend relay:", metamaskErr);
        }
      }

      // Relay to backend to remove mirror and/or cancel on-chain
      const res = await fetch(
        `${BACKEND_URL}/api/tournaments/${tournament.id}`,
        { method: "DELETE" }
      );
      const data = await res.json();
      if (!res.ok && !onChainDone) {
        throw new Error(data.error || `HTTP ${res.status}`);
      }
      setStatus(`Tournament #${tournament.id} cancelled/deleted successfully.`);
      await fetchTournaments();
    } catch (error) {
      setStatus(`Delete/Cancel failed: ${getErrorMessage(error)}`);
    } finally {
      setDeletingId(null);
    }
  };

  const joinTournament = async (tournament) => {
    if (!address) {
      setStatus("Please connect wallet first");
      return;
    }
    setJoiningId(tournament.id);
    try {
      if (tournament.onChain && window.ethereum) {
        const provider = new ethers.BrowserProvider(window.ethereum);
        const net = await provider.getNetwork();
        if (net.chainId !== 31337n) {
          await switchToHardhatNetwork();
        }

        setStatus(`MetaMask: Preparing to join tournament #${tournament.id}...`);
        const signer = await provider.getSigner();
        const contract = new ethers.Contract(
          CONTRACT_ADDRESS,
          CONTRACT_ABI,
          signer
        );

        if (tournament.isTokenTournament) {
          // TRT tournament requires ERC-20 approval
          const token = new ethers.Contract(
            REWARD_TOKEN_ADDRESS,
            REWARD_TOKEN_ABI,
            signer
          );
          const feeWei =
            tournament.rawEntryFee ||
            ethers.parseEther(String(parseFloat(tournament.entryFee) || 0));

          // Check TRT token balance; auto-dispense from faucet if balance is low
          const balance = await token.balanceOf(address);
          if (balance < feeWei) {
            setStatus(
              `Notice: Your TRT balance (${ethers.formatEther(balance)}) is below entry fee (${ethers.formatEther(feeWei)} TRT). Claiming 100 free test TRT from faucet...`
            );
            try {
              const fRes = await fetch(`${BACKEND_URL}/api/faucet`, {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ address }),
              });
              if (fRes.ok) {
                await fetchChainBalance();
              }
            } catch {
              // Faucet fallback non-blocking
            }
          }

          setStatus("MetaMask: Approve TRT entry fee transfer...");
          const approveTx = await token.approve(CONTRACT_ADDRESS, feeWei);
          await approveTx.wait();

          setStatus("MetaMask: Join token tournament on-chain...");
          const tx = await contract.joinTokenTournament(tournament.id);
          await tx.wait();
        } else {
          // Native ETH tournament
          const feeWei =
            tournament.rawEntryFee ||
            ethers.parseEther(String(parseFloat(tournament.entryFee) || 0));

          setStatus("MetaMask: Pay entry fee to join tournament...");
          const tx = await contract.joinTournament(tournament.id, {
            value: feeWei,
          });
          await tx.wait();
        }
        setStatus(`Successfully joined tournament #${tournament.id} on-chain!`);
      } else {
        // Fallback for mock backend tournaments
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
      }

      await fetchTournaments();
      await fetchChainBalance();
    } catch (error) {
      setStatus(`Join failed: ${getErrorMessage(error)}`);
    } finally {
      setJoiningId(null);
    }
  };

  return (
    <div className="page">
      <header className="header">
        <div className="brand">
          <span className="monogram" aria-hidden="true">
            TR
          </span>
          <div>
            <p className="kicker">Capstone demo · Hardhat 31337</p>
            <h1>TourneyReward</h1>
            <p className="subtitle">
              Decentralized esports prize distribution & token rewards
            </p>
          </div>
        </div>
        <div className="wallet-box">
          {address ? (
            <span className="pill pill-connected" title={address}>
              {address.slice(0, 6)}...{address.slice(-4)}
            </span>
          ) : (
            <button
              className="btn btn-primary"
              onClick={connectWallet}
              title={
                hasProvider
                  ? "Connect via MetaMask"
                  : "MetaMask not detected — install it first"
              }
            >
              Connect Wallet
            </button>
          )}
        </div>
      </header>

      {!hasProvider ? (
        <div className="banner" role="alert">
          <strong>MetaMask not detected.</strong>{" "}
          <span className="muted">
            Install it to connect your wallet and receive live on-chain events —{" "}
            <a
              href="https://metamask.io/download/"
              target="_blank"
              rel="noreferrer"
            >
              metamask.io/download
            </a>
            . Browsing tournaments works without it.
          </span>
        </div>
      ) : null}

      {currentChainId && currentChainId !== 31337 ? (
        <div
          className="banner"
          style={{
            background: "rgba(217, 180, 92, 0.12)",
            borderColor: "rgba(217, 180, 92, 0.4)",
            color: "var(--accent)",
          }}
          role="alert"
        >
          <strong>Notice:</strong> MetaMask is on Chain ID <code>{currentChainId}</code> instead of Hardhat Localhost (<code>31337</code>).{" "}
          <button
            className="btn btn-primary"
            style={{ padding: "4px 12px", marginLeft: "12px", fontSize: "12px" }}
            onClick={switchToHardhatNetwork}
          >
            Switch MetaMask to Hardhat (31337)
          </button>
        </div>
      ) : null}

      <section className="card">
        <h2>Backend & Blockchain Node</h2>
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
          Tournament Contract: <code>{CONTRACT_ADDRESS}</code>
          <br />
          Reward Token (TRT): <code>{REWARD_TOKEN_ADDRESS}</code>
        </p>
      </section>

      <section className="card">
        <div className="row row-spread">
          <h2>Wallet & Balances</h2>
          {address ? (
            <div className="row">
              <button
                className="btn"
                onClick={claimFaucet}
                disabled={faucetLoading}
                title="Dispense 100 test TRT tokens and gas ETH"
              >
                {faucetLoading ? "Dispensing..." : "Claim 100 Test TRT (Faucet)"}
              </button>
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
            </div>
          ) : null}
        </div>
        {!address ? (
          <p className="muted">Connect wallet to see balances and player status.</p>
        ) : backendBalance?.error ? (
          <p className="bad">Balance error: {backendBalance.error}</p>
        ) : (
          <>
            <div className="stats">
              <div className="stat">
                <span className="stat-label">Chain ETH</span>
                <strong>{chainBalance !== null ? chainBalance : "..."}</strong>
                <span className="muted small">live on-chain balance</span>
              </div>
              <div className="stat">
                <span className="stat-label">Reward Token (TRT)</span>
                <strong>{trtBalance !== null ? `${trtBalance} TRT` : "..."}</strong>
                <span className="muted small">ERC-20 tournament token</span>
              </div>
              <div className="stat">
                <span className="stat-label">On-Chain Player</span>
                <strong>{isGloballyRegistered ? "Registered" : "Not Registered"}</strong>
                <span className="muted small">
                  {isGloballyRegistered ? (
                    <span className="ok">Verified on-chain</span>
                  ) : (
                    <button
                      className="btn btn-primary"
                      style={{ fontSize: "11px", padding: "3px 8px", marginTop: "4px" }}
                      onClick={registerGlobalPlayer}
                      disabled={registeringPlayer}
                    >
                      {registeringPlayer ? "Registering..." : "Register Now"}
                    </button>
                  )}
                </span>
              </div>
            </div>
          </>
        )}
      </section>

      <section className="card">
        <div className="row row-spread">
          <h2>Rewards & My Tournaments</h2>
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
                    <div className="tournament-main">
                      <div className="tournament-title">
                        #{tournament.id} {tournament.title}{" "}
                        {statusBadge(tournament.status)}
                        {tournament.isTokenTournament ? (
                          <span className="badge st-progress">TRT Token</span>
                        ) : (
                          <span className="badge st-open">ETH Escrow</span>
                        )}
                        {tournament.onChain ? (
                          <span className="badge st-done">On-Chain</span>
                        ) : null}
                      </div>
                      <div className="prize-line">
                        Prize <strong>{tournament.prizePool}</strong>
                        {tournament.prizeDistributed ? (
                          <span className="muted small"> · Distributed</span>
                        ) : null}
                        {tournament.winner ? (
                          ` · Winner ${tournament.winner.slice(0, 6)}...`
                        ) : (
                          ""
                        )}
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
                          : "Claim / Distribute prize"
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
        {!hasProvider ? (
          <p className="muted">
            Install MetaMask to receive live contract events. The list below
            still refreshes via the Refresh buttons.
          </p>
        ) : liveEvents.length === 0 ? (
          <p className="muted">
            Listening for TournamentCreated, TokenTournamentCreated,
            PlayerRegistered, PrizeDistributed, TokenPrizeDistributed,
            TournamentCancelled — new events appear here in real time.
          </p>
        ) : (
          <ul className="tournament-list">
            {liveEvents.map((event, index) => (
              <li
                key={`${event.time}-${index}`}
                className="tournament-item event-item"
              >
                <div className="tournament-main event-main">
                  {eventDot(event.type)}
                  <div>
                    <strong>{event.type}</strong>
                    <div className="muted small">{event.message}</div>
                  </div>
                </div>
                <span className="muted small">{event.time}</span>
              </li>
            ))}
          </ul>
        )}
      </section>

      <section className="card">
        <div className="row row-spread">
          <h2>Admin & Tournament Management</h2>
        </div>
        <p className="muted small">
          Create tournaments on-chain directly via MetaMask or manage backend mirrors.
        </p>
        {!address ? (
          <p className="muted">Connect wallet to manage tournaments.</p>
        ) : (
          <>
            <h3 className="subheading">Create tournament</h3>
            <form className="form-grid" onSubmit={createTournament}>
              <label className="field field-wide">
                <span>Title</span>
                <input
                  type="text"
                  placeholder="Apex Legends Invitational"
                  value={newTournament.title}
                  onChange={(e) =>
                    setNewTournament({
                      ...newTournament,
                      title: e.target.value,
                    })
                  }
                />
              </label>

              <label className="field">
                <span>Prize Currency</span>
                <select
                  value={newTournament.currency}
                  onChange={(e) =>
                    setNewTournament({
                      ...newTournament,
                      currency: e.target.value,
                    })
                  }
                  style={{
                    background: "var(--field)",
                    border: "1px solid var(--field-border)",
                    color: "var(--text)",
                    padding: "8px",
                    borderRadius: "6px",
                  }}
                >
                  <option value="ETH">ETH (Native Cryptocurency)</option>
                  <option value="TRT">TRT (Reward Token ERC-20)</option>
                </select>
              </label>

              <label className="field">
                <span>Prize pool ({newTournament.currency})</span>
                <input
                  type="text"
                  inputMode="decimal"
                  value={newTournament.prizePool}
                  onChange={(e) =>
                    setNewTournament({
                      ...newTournament,
                      prizePool: e.target.value,
                    })
                  }
                />
              </label>

              <label className="field">
                <span>Entry fee ({newTournament.currency})</span>
                <input
                  type="text"
                  inputMode="decimal"
                  value={newTournament.entryFee}
                  onChange={(e) =>
                    setNewTournament({
                      ...newTournament,
                      entryFee: e.target.value,
                    })
                  }
                />
              </label>

              <label className="field">
                <span>Max players</span>
                <input
                  type="number"
                  min="2"
                  value={newTournament.maxPlayers}
                  onChange={(e) =>
                    setNewTournament({
                      ...newTournament,
                      maxPlayers: e.target.value,
                    })
                  }
                />
              </label>

              <div className="field field-wide">
                <button
                  type="submit"
                  className="btn btn-primary"
                  disabled={creating}
                >
                  {creating
                    ? "Deploying on-chain..."
                    : `Create ${newTournament.currency} Tournament (MetaMask)`}
                </button>
              </div>
            </form>

            <h3 className="subheading">
              Manage tournaments ({tournaments.length})
            </h3>
            {tournaments.length === 0 ? (
              <p className="muted">No tournaments to manage.</p>
            ) : (
              <ul className="tournament-list">
                {tournaments.map((tournament) => (
                  <li key={tournament.id} className="tournament-item">
                    <div className="tournament-main">
                      <div className="tournament-title">
                        #{tournament.id} {tournament.title}{" "}
                        {statusBadge(tournament.status)}
                        {tournament.isTokenTournament ? (
                          <span className="badge st-progress">TRT</span>
                        ) : (
                          <span className="badge st-open">ETH</span>
                        )}
                        {tournament.onChain ? (
                          <span className="badge st-done">On-Chain</span>
                        ) : null}
                      </div>
                      <div className="muted small">
                        {tournament.currentPlayers}/{tournament.maxPlayers}{" "}
                        players · Prize {tournament.prizePool}
                      </div>
                    </div>
                    <button
                      className="btn btn-danger"
                      disabled={
                        deletingId === tournament.id ||
                        tournament.prizeDistributed
                      }
                      title={
                        tournament.prizeDistributed
                          ? "Prize distributed — kept for audit"
                          : "Delete from backend store"
                      }
                      onClick={() => deleteTournament(tournament)}
                    >
                      {deletingId === tournament.id ? "Deleting..." : "Delete"}
                    </button>
                  </li>
                ))}
              </ul>
            )}
          </>
        )}
      </section>

      <section className="card">
        <div className="row row-spread">
          <h2>Available Tournaments</h2>
          <button
            className="btn"
            onClick={fetchTournaments}
            disabled={tournamentsLoading}
          >
            {tournamentsLoading ? "Loading..." : "Refresh"}
          </button>
        </div>
        {tournaments.length === 0 && !tournamentsLoading ? (
          <p className="muted">No tournaments found. Create one above.</p>
        ) : null}
        <ul className="tournament-list">
          {tournaments.map((tournament) => {
            const pct =
              tournament.maxPlayers > 0
                ? Math.min(
                    100,
                    Math.round(
                      (tournament.currentPlayers / tournament.maxPlayers) * 100
                    )
                  )
                : 0;
            const alreadyJoined =
              address &&
              (tournament.players || []).some(
                (p) => p.toLowerCase() === address.toLowerCase()
              );

            return (
              <li key={tournament.id} className="tournament-item">
                <div className="tournament-main">
                  <div className="tournament-title">
                    #{tournament.id} {tournament.title}{" "}
                    {statusBadge(tournament.status)}
                    {tournament.isTokenTournament ? (
                      <span className="badge st-progress">TRT Token</span>
                    ) : (
                      <span className="badge st-open">ETH Escrow</span>
                    )}
                    {tournament.onChain ? (
                      <span className="badge st-done">On-Chain</span>
                    ) : null}
                  </div>
                  <div className="prize-line">
                    Prize <strong>{tournament.prizePool}</strong>
                    <span className="muted"> · Entry Fee {tournament.entryFee}</span>
                  </div>
                  <div className="progress" aria-hidden="true">
                    <div
                      className="progress-fill"
                      style={{ width: `${pct}%` }}
                    />
                  </div>
                  <div className="muted small">
                    {tournament.currentPlayers}/{tournament.maxPlayers} players
                    registered
                    {alreadyJoined ? (
                      <strong className="ok"> · You joined</strong>
                    ) : null}
                  </div>
                </div>
                <button
                  className="btn btn-primary"
                  disabled={
                    joiningId === tournament.id ||
                    !address ||
                    alreadyJoined ||
                    tournament.status !== "Open"
                  }
                  title={
                    !address
                      ? "Connect wallet first"
                      : alreadyJoined
                      ? "Already joined this tournament"
                      : "Join tournament on-chain"
                  }
                  onClick={() => joinTournament(tournament)}
                >
                  {joiningId === tournament.id
                    ? "Joining..."
                    : alreadyJoined
                    ? "Joined"
                    : tournament.status !== "Open"
                    ? tournament.status
                    : "Join tournament"}
                </button>
              </li>
            );
          })}
        </ul>
      </section>

      <section className="card status-card">
        <h2>Status</h2>
        <p>{status}</p>
      </section>

      <footer className="foot">
        Settlement in ETH or TRT · every step emitted as a contract event ·
        backend is an indexing mirror, the smart contract is the source of truth.
      </footer>
    </div>
  );
}
