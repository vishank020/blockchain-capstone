const hre = require("hardhat");

async function main() {
  const tournamentContract = await hre.deployments.deploy("TournamentContract", {
    from: (await ethers.getSigners())[0].address,
    args: [],
    log: true,
  });

  console.log("TournamentContract deployed to:", tournamentContract.address);
}

main()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error(error);
    process.exit(1);
  });