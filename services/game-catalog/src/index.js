const express = require('express');
const cors = require('cors');
const promClient = require('prom-client');
require('dotenv').config();

const app = express();
const PORT = process.env.PORT || 3001;

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

// Middleware
app.use(cors());
app.use(express.json());

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

// Dummy game database
const games = [
  {
    id: 1,
    title: "The Witcher 3: Wild Hunt",
    platforms: ["PC", "PlayStation", "Xbox", "Nintendo Switch"],
    releaseDate: "2015-05-19",
    developer: "CD Projekt Red",
    publisher: "CD Projekt",
    genres: ["RPG", "Open World", "Action"],
    rating: 9.3,
    price: 29.99
  },
  {
    id: 2,
    title: "Red Dead Redemption 2",
    platforms: ["PC", "PlayStation", "Xbox"],
    releaseDate: "2018-10-26",
    developer: "Rockstar Games",
    publisher: "Rockstar Games",
    genres: ["Action", "Adventure", "Western"],
    rating: 9.5,
    price: 59.99
  }
];

// Routes
app.get('/games', (req, res) => {
  res.json(games);
});

app.get('/games/:id', (req, res) => {
  const game = games.find(g => g.id === parseInt(req.params.id));
  if (!game) {
    return res.status(404).json({ message: 'Game not found' });
  }
  res.json(game);
});

// Health check endpoint
app.get('/health', (req, res) => {
  res.json({ status: 'healthy' });
});

app.listen(PORT, () => {
  console.log(`Game catalog service listening on port ${PORT}`);
}); 