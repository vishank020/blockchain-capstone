// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

contract TournamentContract {
    address public admin;
    uint256 public tournamentFee;
    mapping(address => bool) public registeredPlayers;
    uint256 public totalTournaments;
    
    event TournamentCreated(address indexed player, uint256 indexed tournamentId, uint256 prizePool);
    event PlayerRegistered(address indexed player, bool registered);
    
    constructor() {
        admin = msg.sender;
        tournamentFee = 100; // 100 wei base fee
    }
    
    function registerPlayer() external {
        require(!registeredPlayers[msg.sender], "Player already registered");
        registeredPlayers[msg.sender] = true;
        emit PlayerRegistered(msg.sender, true);
    }
    
    function createTournament(uint256 _prizePool) external {
        require(msg.sender == admin, "Only admin can create tournaments");
        totalTournaments++;
        emit TournamentCreated(msg.sender, totalTournaments, _prizePool);
    }
    
    function distributePrize(uint256 _tournamentId, address _winner) external {
        require(msg.sender == admin, "Only admin can distribute prizes");
        // Simple prize distribution logic
        (bool success, ) = _winner.call{value: tournamentFee}("");
        require(success, "Failed to send prize");
    }
}