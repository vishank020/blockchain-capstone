require('dotenv').config();

const express = require('express');
const cors = require('cors');
const helmet = require('helmet');
const morgan = require('morgan');

const app = express();
const PORT = process.env.PORT || 3000;

// Middleware
app.use(helmet());
app.use(cors());
app.use(morgan('combined'));
app.use(express.json());

// Health check route
app.get('/health', (req, res) => {
  res.json({ status: 'ok', message: 'Backend API is running' });
});

// Tournament routes (will integrate with smart contracts)
app.get('/api/tournaments', async (req, res) => {
  try {
    // TODO: Integrate with Hardhat contract reads
    res.json({ message: 'Tournaments endpoint - connect to contract later' });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

app.post('/api/tournaments', async (req, res) => {
  try {
    // TODO: Integrate with Hardhat contract writes
    const { prizePool } = req.body;
    res.json({ message: 'Create tournament endpoint - will integrate with contract' });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Prize distribution route
app.post('/api/distribute-prize', async (req, res) => {
  try {
    // TODO: Integrate with Hardhat contract prize distribution
    const { tournamentId, winnerAddress } = req.body;
    res.json({ message: 'Distribute prize endpoint - will integrate with contract' });
  } catch (error) {
    res.status(500).json({ error: error.message });
  });
});

// Player registration route
app.post('/api/players', async (req, res) => {
  try {
    // TODO: Integrate with smart contract player registration
    const { playerAddress } = req.body;
    res.json({ message: 'Player registration endpoint - will integrate with contract' });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Token balance route
app.get('/api/balance/:address', async (req, res) => {
  try {
    // TODO: Integrate with token contract balance reads
    const { address } = req.params;
    res.json({ message: 'Token balance endpoint - will integrate with contract' });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

app.listen(PORT, () => {
  console.log(`🚀 Backend API running on http://localhost:${PORT}`);
});

module.exports = app;