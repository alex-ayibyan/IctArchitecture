import express, { json } from 'express';
import cors from 'cors';
import { connect, Schema, model } from 'mongoose';

const app = express();
const port = process.env.PORT || 3000;

app.use(cors());
app.use(json());

const mongoUri = process.env.MONGODB_URI || 'mongodb://mongo-svc:27017/gameportal';
console.log('MongoDB URI:', mongoUri);

connect(mongoUri, {
  useNewUrlParser: true,
  useUnifiedTopology: true,
}).then(() => {
  console.log('Connected to MongoDB');
  initializeSampleData();
}).catch(err => {
  console.error('MongoDB connection error:', err);
});

const GameSchema = new Schema({
  _id: { type: String, required: true },
  title: { type: String, required: true },
  platforms: [String],
  genres: [String],
  releaseDate: String,
  price: Number
});

const PriceSchema = new Schema({
  gameId: { type: String, required: true },
  store: { type: String, required: true },
  price: { type: Number, required: true },
  currency: { type: String, default: 'EUR' },
  discount: { type: Boolean, default: false },
  originalPrice: Number,
  lastUpdated: { type: Date, default: Date.now }
});

const Game = model('Game', GameSchema);
const Price = model('Price', PriceSchema);

async function initializeSampleData() {
  try {
    const gameCount = await Game.countDocuments();
    if (gameCount > 0) {
      console.log('Sample data already exists');
      return;
    }

    const sampleGames = [
      {
        _id: "1",
        title: "The Witcher 3: Wild Hunt",
        platforms: ["PC", "PS4", "Xbox One", "Switch"],
        genres: ["RPG", "Action"],
        releaseDate: "2015-05-19",
        price: 39.99
      },
      {
        _id: "2",
        title: "Zelda: Breath of the Wild",
        platforms: ["Switch", "Wii U"],
        genres: ["Adventure", "Action", "RPG"],
        releaseDate: "2017-03-03",
        price: 59.99
      },
      {
        _id: "3",
        title: "God of War",
        platforms: ["PS4", "PS5"],
        genres: ["Action", "Adventure"],
        releaseDate: "2018-04-20",
        price: 49.99
      },
      {
        _id: "4",
        title: "Halo Infinite",
        platforms: ["Xbox Series X", "Xbox One", "PC"],
        genres: ["Shooter", "Sci-Fi"],
        releaseDate: "2021-12-08",
        price: 59.99
      }
    ];

    const samplePrices = [
      { gameId: "1", store: "steam", price: 29.99, discount: false },
      { gameId: "1", store: "gog", price: 24.99, discount: true, originalPrice: 39.99 },
      { gameId: "1", store: "epic", price: 19.99, discount: true, originalPrice: 39.99 },
      
      { gameId: "2", store: "nintendo", price: 59.99, discount: false },
      
      { gameId: "3", store: "steam", price: 49.99, discount: false },
      { gameId: "3", store: "playstation", price: 39.99, discount: true, originalPrice: 59.99 },
      
      { gameId: "4", store: "xbox", price: 59.99, discount: false },
      { gameId: "4", store: "steam", price: 59.99, discount: false }
    ];

    await Game.insertMany(sampleGames);
    await Price.insertMany(samplePrices);
    
    console.log('Sample data initialized successfully');
  } catch (error) {
    console.error('Error initializing sample data:', error);
  }
}

app.get('/prices/health', (req, res) => {
  res.status(200).send('OK');
});

app.get('/prices/ready', (req, res) => {
  res.status(200).send('Ready');
});

app.get('/prices/:gameId', async (req, res) => {
  try {
    const { gameId } = req.params;
    const { stores } = req.query;
    
    console.log(`Fetching prices for game ID: ${gameId}`);
    
    let query = { gameId: gameId };
    
    if (stores) {
      const storeList = stores.split(',');
      query.store = { $in: storeList };
    }
    
    const prices = await Price.find(query);
    console.log(`Found ${prices.length} prices for game ${gameId}`);
    
    const response = {
      gameId,
      prices: prices.map(price => ({
        store: price.store,
        price: price.price,
        currency: price.currency,
        discount: price.discount,
        originalPrice: price.originalPrice
      }))
    };
    
    res.json(response);
  } catch (error) {
    console.error('Error fetching prices:', error);
    res.status(500).json({ error: 'Failed to fetch prices' });
  }
});

app.get('/best-price/:gameId', async (req, res) => {
  try {
    const { gameId } = req.params;
    
    const prices = await Price.find({ gameId: gameId });
    
    if (!prices || prices.length === 0) {
      return res.status(404).json({ error: "No prices found for this game" });
    }
    
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
    console.error('Error finding best price:', error);
    res.status(500).json({ error: 'Failed to find best price' });
  }
});

app.get('/price-history/:gameId', (req, res) => {
  const { gameId } = req.params;
  const { store } = req.query;
  
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

app.get('/sales', async (req, res) => {
  try {
    const discountedPrices = await Price.find({ discount: true }).populate('gameId');
    
    const mockSales = [
      {
        id: "spring-sale",
        store: "steam",
        name: "Spring Sale 2025",
        startDate: "2025-04-01",
        endDate: "2025-04-15",
        games: discountedPrices
          .filter(p => p.store === 'steam')
          .map(price => ({
            gameId: price.gameId,
            title: "Game Title",
            discount: `${Math.round((1 - price.price / price.originalPrice) * 100)}%`,
            originalPrice: price.originalPrice,
            discountedPrice: price.price
          }))
      }
    ];
    
    res.json(mockSales);
  } catch (error) {
    console.error('Error fetching sales:', error);
    res.status(500).json({ error: 'Failed to fetch sales' });
  }
});

app.listen(port, () => {
  console.log(`Price comparison service running on port ${port}`);
});