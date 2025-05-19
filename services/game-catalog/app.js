import express from 'express';
import promClient from 'prom-client';
const app = express();
const port = 3000;

// Create a Registry to register metrics
const register = new promClient.Registry();

// Add default metrics (CPU, memory, etc.)
promClient.collectDefaultMetrics({ register });

// Create custom metrics
const httpRequestDurationMicroseconds = new promClient.Histogram({
  name: 'http_request_duration_seconds',
  help: 'Duration of HTTP requests in seconds',
  labelNames: ['method', 'route', 'status_code'],
  buckets: [0.1, 0.5, 1, 2, 5]
});

const httpRequestsTotal = new promClient.Counter({
  name: 'http_requests_total',
  help: 'Total number of HTTP requests',
  labelNames: ['method', 'route', 'status_code']
});

// Register custom metrics
register.registerMetric(httpRequestDurationMicroseconds);
register.registerMetric(httpRequestsTotal);

// Metrics middleware
app.use((req, res, next) => {
  const start = Date.now();
  res.on('finish', () => {
    const duration = Date.now() - start;
    const route = req.route ? req.route.path : req.path;
    httpRequestDurationMicroseconds
      .labels(req.method, route, res.statusCode.toString())
      .observe(duration / 1000);
    httpRequestsTotal
      .labels(req.method, route, res.statusCode.toString())
      .inc();
  });
  next();
});

// Metrics endpoint
app.get('/metrics', async (req, res) => {
  res.set('Content-Type', register.contentType);
  res.end(await register.metrics());
});

// Mock data
const games = [
  {
    id: "1",
    title: "The Legend of Zelda: Breath of the Wild",
    platforms: ["Switch", "Wii U"],
    price: 59.99,
    releaseDate: "2017-03-03",
    genres: ["Adventure", "Action", "RPG"]
  },
  {
    id: "2",
    title: "Super Mario Odyssey",
    platforms: ["Switch"],
    price: 59.99,
    releaseDate: "2017-10-27",
    genres: ["Adventure", "Platformer"]
  },
  {
    id: "3",
    title: "God of War Ragnarök",
    platforms: ["PS5", "PS4"],
    price: 69.99,
    releaseDate: "2022-11-09",
    genres: ["Action", "Adventure"]
  },
  {
    id: "4",
    title: "Halo Infinite",
    platforms: ["Xbox Series X", "Xbox One", "PC"],
    price: 59.99,
    releaseDate: "2021-12-08",
    genres: ["Shooter", "Sci-Fi"]
  },
  {
    id: "5",
    title: "Elden Ring",
    platforms: ["PS5", "PS4", "Xbox Series X", "Xbox One", "PC"],
    price: 59.99,
    releaseDate: "2022-02-25",
    genres: ["RPG", "Fantasy", "Action"]
  },
  {
    id: "6",
    title: "Hades",
    platforms: ["PC", "Switch", "PS4", "PS5", "Xbox One", "Xbox Series X"],
    price: 24.99,
    releaseDate: "2020-09-17",
    genres: ["Rogue-like", "Action", "Indie"]
  },
  {
    id: "7",
    title: "Red Dead Redemption 2",
    platforms: ["PS4", "Xbox One", "PC"],
    price: 59.99,
    releaseDate: "2018-10-26",
    genres: ["Action", "Adventure", "RPG"]
  },
  {
    id: "8",
    title: "The Witcher 3: Wild Hunt",
    platforms: ["PS4", "Xbox One", "PC", "Switch"],
    price: 39.99,
    releaseDate: "2015-05-19",
    genres: ["RPG", "Action"]
  },
  {
    id: "9",
    title: "Spider-Man: Miles Morales",
    platforms: ["PS5", "PS4"],
    price: 49.99,
    releaseDate: "2020-11-12",
    genres: ["Action", "Adventure"]
  },
  {
    id: "10",
    title: "Minecraft",
    platforms: ["PC", "PS4", "Xbox One", "Switch"],
    price: 26.95,
    releaseDate: "2011-11-18",
    genres: ["Sandbox", "Survival"]
  },
  {
    id: "11",
    title: "Fortnite",
    platforms: ["PC", "PS5", "PS4", "Xbox Series X", "Switch", "Mobile"],
    price: 0.00,
    releaseDate: "2017-07-25",
    genres: ["Battle Royale", "Shooter"]
  },
  {
    id: "12",
    title: "Call of Duty: Modern Warfare II",
    platforms: ["PS5", "PS4", "Xbox Series X", "Xbox One", "PC"],
    price: 69.99,
    releaseDate: "2022-10-28",
    genres: ["Shooter", "Action"]
  },
  {
    id: "13",
    title: "Among Us",
    platforms: ["PC", "Mobile", "Switch"],
    price: 5.00,
    releaseDate: "2018-06-15",
    genres: ["Party", "Multiplayer", "Social Deduction"]
  },
  {
    id: "14",
    title: "Apex Legends",
    platforms: ["PC", "PS5", "PS4", "Xbox Series X", "Xbox One"],
    price: 0.00,
    releaseDate: "2019-02-04",
    genres: ["Battle Royale", "Shooter"]
  },
  {
    id: "15",
    title: "Animal Crossing: New Horizons",
    platforms: ["Switch"],
    price: 59.99,
    releaseDate: "2020-03-20",
    genres: ["Simulation", "Social"]
  },
  {
    id: "16",
    title: "Cyberpunk 2077",
    platforms: ["PS5", "PS4", "Xbox Series X", "Xbox One", "PC"],
    price: 59.99,
    releaseDate: "2020-12-10",
    genres: ["RPG", "Action"]
  },
  {
    id: "17",
    title: "Ghost of Tsushima",
    platforms: ["PS4", "PS5"],
    price: 59.99,
    releaseDate: "2020-07-17",
    genres: ["Action", "Adventure"]
  },
  {
    id: "18",
    title: "Death Stranding",
    platforms: ["PS4", "PC"],
    price: 59.99,
    releaseDate: "2019-11-08",
    genres: ["Action", "Adventure"]
  },
  {
    id: "19",
    title: "Overwatch 2",
    platforms: ["PC", "PS5", "PS4", "Xbox Series X", "Xbox One"],
    price: 0.00,
    releaseDate: "2022-10-04",
    genres: ["Shooter", "Multiplayer"]
  },
  {
    id: "20",
    title: "Gran Turismo 7",
    platforms: ["PS5", "PS4"],
    price: 59.99,
    releaseDate: "2022-03-04",
    genres: ["Racing", "Simulation"]
  }
];

// Health check
app.get('/health', (req, res) => {
  res.status(200).send('OK');
});

// Ready check
app.get('/ready', (req, res) => {
  res.status(200).send('Ready');
});

// API endpoints
app.get('/games', (req, res) => {
  res.json(games);
});

app.get('/games/:id', (req, res) => {
  const game = games.find(g => g.id === req.params.id);
  if (game) {
    res.json(game);
  } else {
    res.status(404).json({ error: 'Game not found' });
  }
});

app.listen(port, () => {
  console.log(`Game catalog service running on port ${port}`);
});