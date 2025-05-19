const express = require('express');
const cors = require('cors');
const axios = require('axios');
require('dotenv').config();

const app = express();
const PORT = process.env.PORT || 3002;

// Middleware
app.use(cors());
app.use(express.json());

// Dummy price database
const prices = {
  1: { // The Witcher 3
    steam: 29.99,
    gog: 27.99,
    epic: 29.99,
    psn: 34.99,
    xbox: 34.99,
    nintendo: 39.99
  },
  2: { // Red Dead Redemption 2
    steam: 59.99,
    epic: 59.99,
    psn: 59.99,
    xbox: 59.99
  }
};

// Circuit breaker state
const circuitBreaker = {
  failures: 0,
  lastFailureTime: null,
  isOpen: false,
  threshold: 5,
  resetTimeout: 30000 // 30 seconds
};

// Routes
app.get('/prices/:gameId', async (req, res) => {
  try {
    const gameId = parseInt(req.params.gameId);
    
    if (!prices[gameId]) {
      return res.status(404).json({ message: 'Game prices not found' });
    }

    // Simulate external store API calls with circuit breaker
    if (circuitBreaker.isOpen) {
      const timeSinceLastFailure = Date.now() - circuitBreaker.lastFailureTime;
      if (timeSinceLastFailure > circuitBreaker.resetTimeout) {
        circuitBreaker.isOpen = false;
        circuitBreaker.failures = 0;
      } else {
        return res.status(503).json({ 
          message: 'Service temporarily unavailable',
          retryAfter: Math.ceil((circuitBreaker.resetTimeout - timeSinceLastFailure) / 1000)
        });
      }
    }

    // Simulate occasional store API failures
    if (Math.random() < 0.1) { // 10% chance of failure
      circuitBreaker.failures++;
      circuitBreaker.lastFailureTime = Date.now();
      
      if (circuitBreaker.failures >= circuitBreaker.threshold) {
        circuitBreaker.isOpen = true;
      }
      
      throw new Error('Store API temporarily unavailable');
    }

    res.json(prices[gameId]);
  } catch (error) {
    res.status(500).json({ 
      message: 'Error fetching prices',
      error: error.message
    });
  }
});

// Health check endpoint
app.get('/health', (req, res) => {
  res.json({ 
    status: 'healthy',
    circuitBreaker: {
      isOpen: circuitBreaker.isOpen,
      failures: circuitBreaker.failures
    }
  });
});

app.listen(PORT, () => {
  console.log(`Price comparison service listening on port ${PORT}`);
}); 