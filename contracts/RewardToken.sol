// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

/**
 * @title RewardToken
 * @dev Minimal ERC-20 reward token (TRT) for the decentralised esports
 * tournament system. Prize pools can be funded and paid out in TRT instead
 * of native ETH. New tokens are minted only by the owner (tournament admin),
 * so supply stays auditable. Self-contained (no external dependencies) to
 * keep the capstone build reproducible.
 */
contract RewardToken {
    string public constant name = "Tournament Reward Token";
    string public constant symbol = "TRT";
    uint8 public constant decimals = 18;

    uint256 public totalSupply;
    address public owner;

    mapping(address => uint256) public balanceOf;
    mapping(address => mapping(address => uint256)) public allowance;

    event Transfer(address indexed from, address indexed to, uint256 value);
    event Approval(address indexed owner, address indexed spender, uint256 value);
    event OwnershipTransferred(address indexed previousOwner, address indexed newOwner);

    modifier onlyOwner() {
        require(msg.sender == owner, "Only owner can perform this action");
        _;
    }

    constructor(uint256 _initialSupply) {
        require(_initialSupply > 0, "Initial supply must be positive");
        owner = msg.sender;
        totalSupply = _initialSupply;
        balanceOf[msg.sender] = _initialSupply;
        emit Transfer(address(0), msg.sender, _initialSupply);
    }

    function transferOwnership(address _newOwner) external onlyOwner {
        require(_newOwner != address(0), "Invalid new owner address");
        emit OwnershipTransferred(owner, _newOwner);
        owner = _newOwner;
    }

    function mint(address _to, uint256 _amount) external onlyOwner returns (bool) {
        require(_to != address(0), "Cannot mint to zero address");
        require(_amount > 0, "Mint amount must be positive");
        totalSupply += _amount;
        balanceOf[_to] += _amount;
        emit Transfer(address(0), _to, _amount);
        return true;
    }

    function approve(address _spender, uint256 _amount) external returns (bool) {
        allowance[msg.sender][_spender] = _amount;
        emit Approval(msg.sender, _spender, _amount);
        return true;
    }

    function transfer(address _to, uint256 _amount) external returns (bool) {
        _transfer(msg.sender, _to, _amount);
        return true;
    }

    function transferFrom(address _from, address _to, uint256 _amount) external returns (bool) {
        uint256 allowed = allowance[_from][msg.sender];
        require(allowed >= _amount, "ERC20: transfer amount exceeds allowance");
        unchecked {
            allowance[_from][msg.sender] = allowed - _amount;
        }
        _transfer(_from, _to, _amount);
        return true;
    }

    function _transfer(address _from, address _to, uint256 _amount) internal {
        require(_to != address(0), "ERC20: transfer to zero address");
        require(balanceOf[_from] >= _amount, "ERC20: transfer amount exceeds balance");
        unchecked {
            balanceOf[_from] -= _amount;
            balanceOf[_to] += _amount;
        }
        emit Transfer(_from, _to, _amount);
    }
}
