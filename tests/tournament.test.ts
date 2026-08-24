import { expect } from "chai";
import { ethers } from "hardhat";

describe("TournamentContract", function () {
  let tournamentContract: any;
  let admin: any;
  let oracle: any;
  let player1: any;
  let player2: any;
  let player3: any;

  beforeEach(async function () {
    [admin, oracle, player1, player2, player3] = await ethers.getSigners();

    const TournamentContract = await ethers.getContractFactory("TournamentContract");
    tournamentContract = await TournamentContract.deploy();
    await tournamentContract.waitForDeployment();

    // Set dedicated oracle
    await tournamentContract.setOracle(oracle.address);
  });

  describe("1. Deployment & Roles", function () {
    it("Should set deployer as initial admin", async function () {
      const contractAdmin = await tournamentContract.admin();
      expect(contractAdmin).to.equal(admin.address);
    });

    it("Should allow admin to update oracle address", async function () {
      const currentOracle = await tournamentContract.oracle();
      expect(currentOracle).to.equal(oracle.address);
    });

    it("Should revert if non-admin tries to change admin or oracle", async function () {
      await expect(
        tournamentContract.connect(player1).setAdmin(player1.address)
      ).to.be.revertedWith("Only admin can perform this action");

      await expect(
        tournamentContract.connect(player1).setOracle(player1.address)
      ).to.be.revertedWith("Only admin can perform this action");
    });
  });

  describe("2. Global Player Registration", function () {
    it("Should allow a player to register globally", async function () {
      await tournamentContract.connect(player1).registerPlayer();
      const isRegistered = await tournamentContract.registeredPlayers(player1.address);
      expect(isRegistered).to.be.true;
    });

    it("Should reject duplicate global registration", async function () {
      await tournamentContract.connect(player1).registerPlayer();
      await expect(
        tournamentContract.connect(player1).registerPlayer()
      ).to.be.revertedWith("Player already registered");
    });
  });

  describe("3. Tournament Creation", function () {
    it("Should allow admin to create tournament with prize pool", async function () {
      const prizePool = ethers.parseEther("1.0");
      const entryFee = ethers.parseEther("0.1");

      const tx = await tournamentContract.createTournament(
        "CS:GO Spring Championship",
        "QmXoypizjW3WknFiJnKLwHCnL72vedxjQkDDP1mXWo6uco",
        entryFee,
        2,
        { value: prizePool }
      );

      await expect(tx)
        .to.emit(tournamentContract, "TournamentCreated")
        .withArgs(
          1,
          "CS:GO Spring Championship",
          prizePool,
          entryFee,
          2,
          "QmXoypizjW3WknFiJnKLwHCnL72vedxjQkDDP1mXWo6uco"
        );

      const tournament = await tournamentContract.getTournament(1);
      expect(tournament.id).to.equal(1);
      expect(tournament.title).to.equal("CS:GO Spring Championship");
      expect(tournament.prizePool).to.equal(prizePool);
      expect(tournament.entryFee).to.equal(entryFee);
      expect(tournament.maxPlayers).to.equal(2);
      expect(tournament.status).to.equal(0); // Open
    });

    it("Should reject tournament creation by non-admin", async function () {
      await expect(
        tournamentContract
          .connect(player1)
          .createTournament("Illegal Cup", "QmHash", ethers.parseEther("0.1"), 4)
      ).to.be.revertedWith("Only admin can perform this action");
    });

    it("Should reject tournament creation with less than 2 max players", async function () {
      await expect(
        tournamentContract.createTournament("Solo Cup", "QmHash", 0, 1)
      ).to.be.revertedWith("Tournament must allow at least 2 players");
    });
  });

  describe("4. Joining Tournaments", function () {
    const entryFee = ethers.parseEther("0.05");

    beforeEach(async function () {
      await tournamentContract.createTournament(
        "Valorant Duos",
        "QmHash123",
        entryFee,
        2,
        { value: ethers.parseEther("0.5") }
      );
    });

    it("Should allow player to join with exact entry fee", async function () {
      await tournamentContract.connect(player1).joinTournament(1, { value: entryFee });
      const isReg = await tournamentContract.isPlayerRegistered(1, player1.address);
      expect(isReg).to.be.true;

      const players = await tournamentContract.getTournamentPlayers(1);
      expect(players).to.deep.equal([player1.address]);
    });

    it("Should reject player joining with insufficient fee", async function () {
      await expect(
        tournamentContract.connect(player1).joinTournament(1, { value: ethers.parseEther("0.01") })
      ).to.be.revertedWith("Incorrect entry fee sent");
    });

    it("Should transition tournament to InProgress when max players reached", async function () {
      await tournamentContract.connect(player1).joinTournament(1, { value: entryFee });
      await tournamentContract.connect(player2).joinTournament(1, { value: entryFee });

      const tournament = await tournamentContract.getTournament(1);
      expect(tournament.status).to.equal(1); // InProgress
      expect(tournament.currentPlayers).to.equal(2);
    });

    it("Should reject duplicate join by same player", async function () {
      await tournamentContract.connect(player1).joinTournament(1, { value: entryFee });
      await expect(
        tournamentContract.connect(player1).joinTournament(1, { value: entryFee })
      ).to.be.revertedWith("Already registered for this tournament");
    });
  });

  describe("5. Prize Distribution & Winner Payout", function () {
    const initialPrize = ethers.parseEther("1.0");
    const entryFee = ethers.parseEther("0.1");

    beforeEach(async function () {
      await tournamentContract.createTournament(
        "Dota 2 Grand Finals",
        "QmDotaHash",
        entryFee,
        2,
        { value: initialPrize }
      );

      await tournamentContract.connect(player1).joinTournament(1, { value: entryFee });
      await tournamentContract.connect(player2).joinTournament(1, { value: entryFee });
    });

    it("Should distribute prize pool to winner when called by admin or oracle", async function () {
      const initialWinnerBalance = await ethers.provider.getBalance(player1.address);
      const expectedTotalPrize = initialPrize + entryFee * 2n;

      const tx = await tournamentContract.connect(oracle).distributePrize(1, player1.address);
      await expect(tx)
        .to.emit(tournamentContract, "PrizeDistributed")
        .withArgs(1, player1.address, expectedTotalPrize);

      const finalWinnerBalance = await ethers.provider.getBalance(player1.address);
      expect(finalWinnerBalance).to.equal(initialWinnerBalance + expectedTotalPrize);

      const tournament = await tournamentContract.getTournament(1);
      expect(tournament.status).to.equal(2); // Completed
      expect(tournament.winner).to.equal(player1.address);
      expect(tournament.prizeDistributed).to.be.true;
    });

    it("Should reject prize distribution to unregistered participant", async function () {
      await expect(
        tournamentContract.distributePrize(1, player3.address)
      ).to.be.revertedWith("Winner must be a registered participant");
    });

    it("Should reject prize distribution by unauthorized account", async function () {
      await expect(
        tournamentContract.connect(player1).distributePrize(1, player1.address)
      ).to.be.revertedWith("Only admin or oracle can perform this action");
    });

    it("Should reject duplicate prize distribution", async function () {
      await tournamentContract.distributePrize(1, player1.address);
      await expect(
        tournamentContract.distributePrize(1, player1.address)
      ).to.be.revertedWith("Prize already distributed");
    });
  });

  describe("6. Tournament Cancellation", function () {
    it("Should allow admin to cancel an open tournament", async function () {
      await tournamentContract.createTournament("Cancelled Tournament", "QmHash", 0, 4);
      await tournamentContract.cancelTournament(1);

      const tournament = await tournamentContract.getTournament(1);
      expect(tournament.status).to.equal(3); // Cancelled
    });
  });
});
