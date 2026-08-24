import { ethers, upgrades } from "hardhat";

describe("TournamentContract", function () {
  let tournamentContract: any;
  let admin: any;
  let player1: any;
  let player2: any;

  beforeEach(async function () {
    [admin, player1, player2] = await ethers.getSigners();

    const TournamentContract = await ethers.getContractFactory("TournamentContract");
    tournamentContract = await TournamentContract.deploy();
    await tournamentContract.waitForDeployment();
  });

  describe("Deployment", function () {
    it("Should set the right admin", async function () {
      const contractAdmin = await tournamentContract.admin();
      expect(contractAdmin).to.equal(admin.address);
    });

    it("Should have correct tournament fee", async function () {
      const fee = await tournamentContract.tournamentFee();
      expect(fee).to.equal(ethers.parseEther("100"));
    });
  });

  describe("registerPlayer", function () {
    it("Should register a player", async function () {
      await tournamentContract.connect(player1).registerPlayer();
      const isRegistered = await tournamentContract.registeredPlayers(player1.address);
      expect(isRegistered).to.be true;
    });

    it("Should not allow double registration", async function () {
      await tournamentContract.connect(player1).registerPlayer();
      await expect(tournamentContract.connect(player1).registerPlayer())
        .to.be.revertedWith("Player already registered");
    });
  });

  describe("createTournament", function () {
    it("Should allow admin to create tournament", async function () {
      await tournamentContract.createTournament(ethers.parseEther("1000"));
      const tournamentCount = await tournamentContract.totalTournaments();
      expect(tournamentCount).to.equal(1);
    });

    it("Should not allow non-admin to create tournament", async function () {
      await expect(
        tournamentContract.connect(player1).createTournament(ethers.parseEther("1000"))
      ).to.be.revertedWith("Only admin can create tournaments");
    });
  });

  describe("distributePrize", function () {
    it("Should allow admin to distribute prize", async function () {
      await tournamentContract.createTournament(ethers.parseEther("1000"));
      await tournamentContract.distributePrize(1, player1.address);
      const balance = await ethers.provider.getBalance(player1.address);
      expect(balance).to.be.gt(0);
    });

    it("Should not allow non-admin to distribute prize", async function () {
      await tournamentContract.createTournament(ethers.parseEther("1000"));
      await expect(
        tournamentContract.connect(player1).distributePrize(1, player2.address)
      ).to.be.revertedWith("Only admin can distribute prizes");
    });
  });
});