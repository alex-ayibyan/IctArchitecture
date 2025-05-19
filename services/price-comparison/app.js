const express = require('express');
const axios = require('axios');
const NodeCache = require('node-cache');
const app = express();
const port = 3000;

// Cache voor prijzen, TTL 1 uur (3600 seconden)
const priceCache = new NodeCache({ stdTTL: 3600 });

// Mock data voor prijzen uit verschillende winkels
const mockPrices = {
  "1": { // The Witcher 3
    "steam": { price: 29.99, currency: "EUR", discount: false },
    "gog": { price: 24.99, currency: "EUR", discount: true, originalPrice: 39.99 },
    "epic": { price: 19.99, currency: "EUR", discount: true, originalPrice: 39.99 }
  },
  "2": { // Zelda: Breath of the Wild
    "nintendo": { price: 59.99, currency: "EUR", discount: false }
  },
  "3": { // God of War
    "steam": { price: 49.99, currency: "EUR", discount: false },
    "playstation": { price: 39.99, currency: "EUR", discount: true, originalPrice: 59.99 }
  },
  "4": { // Halo Infinite
    "xbox": { price: 59.99, currency: "EUR", discount: false },
    "steam": { price: 59.99, currency: "EUR", discount: false }
  }
};

// Simuleer externe API calls en resilience
async function fetchPriceFromStore(gameId, store) {
  // Simuleer een willekeurige fout (voor resilience demonstratie)
  if (Math.random() < 0.2) {
    throw new Error(`Failed to fetch price from ${store}`);
  }
  
  // Simuleer latency
  await new Promise(resolve => setTimeout(resolve, 100 + Math.random() * 300));
  
  if (mockPrices[gameId] && mockPrices[gameId][store]) {
    return mockPrices[gameId][store];
  }
  
  return null;
}

// Health check endpoint
app.get('/health', (req, res) => {
  res.status(200).send('OK');
});

// Ready check endpoint
app.get('/ready', (req, res) => {
  res.status(200).send('Ready');
});

// Krijg prijzen voor een specifieke game
app.get('/prices/:gameId', async (req, res) => {
  const { gameId } = req.params;
  const { stores } = req.query;
  
  // Check cache first
  const cacheKey = `prices-${gameId}-${stores || 'all'}`;
  const cachedData = priceCache.get(cacheKey);
  
  if (cachedData) {
    // Send header to indicate cached data
    res.set('X-Data-Source', 'cache');
    return res.json(cachedData);
  }
  
  try {
    const storeList = stores ? stores.split(',') : ["steam", "gog", "epic", "playstation", "xbox", "nintendo"];
    const results = [];
    const errors = [];
    
    // Parallel prijsopvragingen met resilience
    await Promise.all(storeList.map(async (store) => {
      try {
        const priceData = await fetchPriceFromStore(gameId, store);
        if (priceData) {
          results.push({
            store,
            ...priceData
          });
        }
      } catch (error) {
        console.error(`Error fetching price from ${store}:`, error.message);
        errors.push({ store, error: error.message });
      }
    }));
    
    const response = {
      gameId,
      prices: results,
      errors: errors.length > 0 ? errors : undefined
    };
    
    // Cache the result
    priceCache.set(cacheKey, response);
    
    // Respond with results
    res.json(response);
  } catch (error) {
    console.error("Failed to process price comparison:", error);
    res.status(500).json({ error: "Failed to process price comparison" });
  }
});

// Haal de beste prijs voor een game
app.get('/best-price/:gameId', async (req, res) => {
  const { gameId } = req.params;
  
  try {
    // Reuse the /prices endpoint
    const response = await axios.get(`http://localhost:${port}/prices/${gameId}`);
    const prices = response.data.prices;
    
    if (!prices || prices.length === 0) {
      return res.status(404).json({ error: "No prices found for this game" });
    }
    
    // Find the best price
    const bestPrice = prices.reduce((best, current) => {
      return current.price < best.price ? current : best;
    }, prices[0]);
    
    res.json({
      gameId,
      bestPrice: {
        store: bestPrice.store,
        price: bestPrice.price,
        currency: bestPrice.currency,
        discount: bestPrice.discount,
        originalPrice: bestPrice.originalPrice
      }
    });
  } catch (error) {
    console.error("Failed to find best price:", error);
    res.status(500).json({ error: "Failed to find best price" });
  }
});

// Haal prijsgeschiedenis van een game
app.get('/price-history/:gameId', (req, res) => {
  const { gameId } = req.params;
  const { store } = req.query;
  
  // Mock price history data
  const mockHistory = [
    { date: "2025-01-01", price: 59.99 },
    { date: "2025-02-15", price: 49.99 },
    { date: "2025-03-01", price: 39.99 },
    { date: "2025-04-01", price: 29.99 },
    { date: "2025-04-15", price: 19.99 }
  ];
  
  res.json({
    gameId,
    store: store || "steam",
    history: mockHistory
  });
});

// Haal huidige sales / promoties
app.get('/sales', (req, res) => {
  // Mock sales data
  const mockSales = [
    {
      id: "spring-sale",
      store: "steam",
      name: "Spring Sale 2025",
      startDate: "2025-04-01",
      endDate: "2025-04-15",
      games: [
        { gameId: "1", title: "The Witcher 3", discount: "50%", originalPrice: 39.99, discountedPrice: 19.99 },
        { gameId: "3", title: "God of War", discount: "33%", originalPrice: 59.99, discountedPrice: 39.99 }
      ]
    },
    {
      id: "golden-week",
      store: "playstation",
      name: "Golden Week Sale",
      startDate: "2025-04-10",
      endDate: "2025-04-20",
      games: [
        { gameId: "3", title: "God of War", discount: "33%", originalPrice: 59.99, discountedPrice: 39.99 },
        { gameId: "5", title: "Ghost of Tsushima", discount: "40%", originalPrice: 69.99, discountedPrice: 41.99 }
      ]
    }
  ];
  
  res.json(mockSales);
});

app.listen(port, () => {
  console.log(`Price comparison service running on port ${port}`);
});