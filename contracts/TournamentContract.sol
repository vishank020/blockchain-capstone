// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

/**
 * @title TournamentContract
 * @dev Decentralized tournament reward and management contract for esports.
 * Implements tournament creation, player registration, prize pool management,
 * and secure winner prize distribution with role-based access control.
 */
contract TournamentContract {
    // --- State Variables ---
    address public admin;
    address public oracle;
    uint256 public totalTournaments;

    enum TournamentStatus { Open, InProgress, Completed, Cancelled }

    struct Tournament {
        uint256 id;
        string title;
        string ipfsMetadataHash;
        uint256 prizePool;
        uint256 entryFee;
        uint256 maxPlayers;
        uint256 currentPlayers;
        TournamentStatus status;
        address winner;
        bool prizeDistributed;
    }

    // Mappings
    mapping(uint256 => Tournament) public tournaments;
    mapping(uint256 => mapping(address => bool)) public isPlayerRegistered;
    mapping(uint256 => address[]) public tournamentPlayers;
    mapping(address => bool) public registeredPlayers; // Global player registration check

    // Reentrancy lock
    bool private _locked;

    // --- Events ---
    event TournamentCreated(
        uint256 indexed tournamentId,
        string title,
        uint256 prizePool,
        uint256 entryFee,
        uint256 maxPlayers,
        string ipfsMetadataHash
    );
    event PlayerRegistered(uint256 indexed tournamentId, address indexed player);
    event GlobalPlayerRegistered(address indexed player);
    event PrizeDistributed(uint256 indexed tournamentId, address indexed winner, uint256 amount);
    event TournamentCancelled(uint256 indexed tournamentId);
    event AdminTransferred(address indexed previousAdmin, address indexed newAdmin);
    event OracleUpdated(address indexed previousOracle, address indexed newOracle);

    // --- Modifiers ---
    modifier onlyAdmin() {
        require(msg.sender == admin, "Only admin can perform this action");
        _;
    }

    modifier onlyAdminOrOracle() {
        require(msg.sender == admin || msg.sender == oracle, "Only admin or oracle can perform this action");
        _;
    }

    modifier nonReentrant() {
        require(!_locked, "ReentrancyGuard: reentrant call");
        _locked = true;
        _;
        _locked = false;
    }

    constructor() {
        admin = msg.sender;
        oracle = msg.sender;
    }

    // --- Admin Management ---
    function setAdmin(address _newAdmin) external onlyAdmin {
        require(_newAdmin != address(0), "Invalid new admin address");
        emit AdminTransferred(admin, _newAdmin);
        admin = _newAdmin;
    }

    function setOracle(address _newOracle) external onlyAdmin {
        require(_newOracle != address(0), "Invalid oracle address");
        emit OracleUpdated(oracle, _newOracle);
        oracle = _newOracle;
    }

    // --- Player Global Registration ---
    function registerPlayer() external {
        require(!registeredPlayers[msg.sender], "Player already registered");
        registeredPlayers[msg.sender] = true;
        emit GlobalPlayerRegistered(msg.sender);
    }

    // --- Tournament Management ---
    /**
     * @notice Create a tournament with an initial prize pool (admin funded or preset).
     * @param _title Name of the tournament
     * @param _ipfsMetadataHash IPFS hash containing tournament rules, brackets, etc.
     * @param _entryFee Entry fee in wei required per player
     * @param _maxPlayers Maximum allowed participants
     */
    function createTournament(
        string calldata _title,
        string calldata _ipfsMetadataHash,
        uint256 _entryFee,
        uint256 _maxPlayers
    ) external payable onlyAdmin returns (uint256) {
        require(_maxPlayers > 1, "Tournament must allow at least 2 players");

        totalTournaments++;
        uint256 tournamentId = totalTournaments;

        tournaments[tournamentId] = Tournament({
            id: tournamentId,
            title: _title,
            ipfsMetadataHash: _ipfsMetadataHash,
            prizePool: msg.value,
            entryFee: _entryFee,
            maxPlayers: _maxPlayers,
            currentPlayers: 0,
            status: TournamentStatus.Open,
            winner: address(0),
            prizeDistributed: false
        });

        emit TournamentCreated(
            tournamentId,
            _title,
            msg.value,
            _entryFee,
            _maxPlayers,
            _ipfsMetadataHash
        );

        return tournamentId;
    }

    /**
     * @notice Register for a specific tournament, transferring required entry fee into prize pool.
     * @param _tournamentId ID of tournament to join
     */
    function joinTournament(uint256 _tournamentId) external payable nonReentrant {
        Tournament storage t = tournaments[_tournamentId];
        require(t.id == _tournamentId && _tournamentId > 0, "Tournament does not exist");
        require(t.status == TournamentStatus.Open, "Tournament is not open for registration");
        require(t.currentPlayers < t.maxPlayers, "Tournament is full");
        require(!isPlayerRegistered[_tournamentId][msg.sender], "Already registered for this tournament");
        require(msg.value == t.entryFee, "Incorrect entry fee sent");

        isPlayerRegistered[_tournamentId][msg.sender] = true;
        tournamentPlayers[_tournamentId].push(msg.sender);
        t.currentPlayers++;
        t.prizePool += msg.value;

        if (!registeredPlayers[msg.sender]) {
            registeredPlayers[msg.sender] = true;
            emit GlobalPlayerRegistered(msg.sender);
        }

        emit PlayerRegistered(_tournamentId, msg.sender);

        if (t.currentPlayers == t.maxPlayers) {
            t.status = TournamentStatus.InProgress;
        }
    }

    /**
     * @notice Distribute the tournament prize pool to the verified winner.
     * @param _tournamentId ID of the completed tournament
     * @param _winner Address of the winning player
     */
    function distributePrize(uint256 _tournamentId, address payable _winner)
        external
        onlyAdminOrOracle
        nonReentrant
    {
        Tournament storage t = tournaments[_tournamentId];
        require(t.id == _tournamentId && _tournamentId > 0, "Tournament does not exist");
        require(!t.prizeDistributed, "Prize already distributed");
        require(t.status != TournamentStatus.Cancelled, "Tournament was cancelled");
        require(_winner != address(0), "Invalid winner address");
        require(isPlayerRegistered[_tournamentId][_winner], "Winner must be a registered participant");

        uint256 payout = t.prizePool;
        require(payout > 0, "Prize pool is zero");
        require(address(this).balance >= payout, "Contract balance insufficient");

        t.winner = _winner;
        t.status = TournamentStatus.Completed;
        t.prizeDistributed = true;

        (bool success, ) = _winner.call{value: payout}("");
        require(success, "Prize transfer failed");

        emit PrizeDistributed(_tournamentId, _winner, payout);
    }

    /**
     * @notice Cancel tournament and allow admin to refund players or close tournament.
     * @param _tournamentId ID of tournament to cancel
     */
    function cancelTournament(uint256 _tournamentId) external onlyAdmin {
        Tournament storage t = tournaments[_tournamentId];
        require(t.id == _tournamentId && _tournamentId > 0, "Tournament does not exist");
        require(t.status != TournamentStatus.Completed, "Cannot cancel completed tournament");
        require(!t.prizeDistributed, "Prize already distributed");

        t.status = TournamentStatus.Cancelled;
        emit TournamentCancelled(_tournamentId);
    }

    // --- View Functions ---
    function getTournament(uint256 _tournamentId)
        external
        view
        returns (
            uint256 id,
            string memory title,
            string memory ipfsMetadataHash,
            uint256 prizePool,
            uint256 entryFee,
            uint256 maxPlayers,
            uint256 currentPlayers,
            TournamentStatus status,
            address winner,
            bool prizeDistributed
        )
    {
        Tournament storage t = tournaments[_tournamentId];
        return (
            t.id,
            t.title,
            t.ipfsMetadataHash,
            t.prizePool,
            t.entryFee,
            t.maxPlayers,
            t.currentPlayers,
            t.status,
            t.winner,
            t.prizeDistributed
        );
    }

    function getTournamentPlayers(uint256 _tournamentId)
        external
        view
        returns (address[] memory)
    {
        return tournamentPlayers[_tournamentId];
    }

    function getContractBalance() external view returns (uint256) {
        return address(this).balance;
    }

    // Support receiving funds directly to prize pool escrow
    receive() external payable {}
}
