const express = require('express');
const cors = require('cors');
const mongoose = require('mongoose');

const app = express();
const port = 3000;

app.use(cors());
app.use(express.json());

const MONGODB_URI = process.env.MONGODB_URI || 'mongodb://mongo-svc:27017/gameportal';
mongoose.connect(MONGODB_URI)
  .then(() => console.log('Connected to MongoDB'))
  .catch(err => console.error('MongoDB connection error:', err));

const gameSchema = new mongoose.Schema({
  _id: {
    type: String,
    required: true
  },
  title: {
    type: String,
    required: true
  },
  description: String,
  price: Number,
  releaseDate: Date,
  platforms: [String],
  genres: [String],
  developer: String,
  publisher: String,
  imageUrl: String
}, {
  timestamps: true,
  _id: false
});

const Game = mongoose.model('Game', gameSchema);

async function initializeSampleData() {
  try {
    const count = await Game.countDocuments();
    if (count === 0) {
      const sampleGames = [
        {
          _id: "1",
          title: "The Witcher 3: Wild Hunt",
          description: "Award-winning open world RPG",
          price: 39.99,
          releaseDate: new Date("2015-05-19"),
          platforms: ["PC", "PS4", "PS5", "Xbox One", "Xbox Series X", "Switch"],
          genres: ["RPG", "Action", "Adventure"],
          developer: "CD Projekt Red",
          publisher: "CD Projekt"
        },
        {
          _id: "2",
          title: "Cyberpunk 2077",
          description: "Open-world action-adventure set in Night City",
          price: 59.99,
          releaseDate: new Date("2020-12-10"),
          platforms: ["PC", "PS4", "PS5", "Xbox One", "Xbox Series X"],
          genres: ["RPG", "Action", "Adventure"],
          developer: "CD Projekt Red",
          publisher: "CD Projekt"
        },
        {
          _id: "3",
          title: "Minecraft",
          description: "Sandbox game with infinite possibilities",
          price: 26.95,
          releaseDate: new Date("2011-11-18"),
          platforms: ["PC", "PS4", "Xbox One", "Switch", "Mobile"],
          genres: ["Sandbox", "Survival"],
          developer: "Mojang Studios",
          publisher: "Microsoft"
        },
        {
          _id: "4",
          title: "Grand Theft Auto V",
          description: "Open world action-adventure game",
          price: 29.99,
          releaseDate: new Date("2013-09-17"),
          platforms: ["PC", "PS4", "PS5", "Xbox One", "Xbox Series X"],
          genres: ["Action", "Adventure"],
          developer: "Rockstar North",
          publisher: "Rockstar Games"
        },
        {
          _id: "5",
          title: "Among Us",
          description: "Multiplayer social deduction game",
          price: 5.00,
          releaseDate: new Date("2018-06-15"),
          platforms: ["PC", "Mobile", "Switch"],
          genres: ["Party", "Multiplayer"],
          developer: "InnerSloth",
          publisher: "InnerSloth"
        }
      ];

      await Game.insertMany(sampleGames);
      console.log('Sample games inserted');
    }
  } catch (error) {
    console.error('Error initializing sample data:', error);
  }
}

app.get('/games/health', async (req, res) => {
  try {
    const dbState = mongoose.connection.readyState;
    if (dbState === 1) {
      await Game.findOne().limit(1);
      res.json({
        status: 'healthy',
        database: 'connected',
        timestamp: new Date().toISOString()
      });
    } else {
      throw new Error('Database not connected');
    }
  } catch (error) {
    res.status(503).json({
      status: 'unhealthy',
      database: 'disconnected',
      error: error.message
    });
  }
});

app.get('/games/ready', async (req, res) => {
  try {
    await Game.findOne().limit(1);
    res.json({ status: 'ready' });
  } catch (error) {
    res.status(503).json({ status: 'not ready', error: error.message });
  }
});

app.get('/games', async (req, res) => {
  try {
    const { page = 1, limit = 20, genre, platform, search } = req.query;
    const offset = (page - 1) * limit;
    
    let query = {};
    
    if (genre) {
      query.genres = { $in: [genre] };
    }
    
    if (platform) {
      query.platforms = { $in: [platform] };
    }
    
    if (search) {
      query.$or = [
        { title: { $regex: search, $options: 'i' } },
        { description: { $regex: search, $options: 'i' } }
      ];
    }
    
    const games = await Game.find(query)
      .skip(offset)
      .limit(parseInt(limit))
      .sort({ title: 1 });
    
    const totalGames = await Game.countDocuments(query);
    
    const formattedGames = games.map(game => ({
      id: game._id,
      title: game.title,
      description: game.description,
      price: game.price,
      releaseDate: game.releaseDate,
      platforms: game.platforms,
      genres: game.genres,
      developer: game.developer,
      publisher: game.publisher,
      imageUrl: game.imageUrl
    }));
    
    if (page == 1 && limit == 20 && !genre && !platform && !search) {
      res.json(formattedGames);
    } else {
      res.json({
        games: formattedGames,
        pagination: {
          currentPage: parseInt(page),
          totalPages: Math.ceil(totalGames / limit),
          totalGames
        }
      });
    }
  } catch (error) {
    console.error('Error fetching games:', error);
    res.status(500).json({ error: 'Failed to fetch games' });
  }
});

app.get('/games/:id', async (req, res) => {
  try {
    const gameId = req.params.id;
    const game = await Game.findById(gameId);
    
    if (!game) {
      return res.status(404).json({ error: 'Game not found' });
    }
    
    res.json({
      id: game._id,
      title: game.title,
      description: game.description,
      price: game.price,
      releaseDate: game.releaseDate,
      platforms: game.platforms,
      genres: game.genres,
      developer: game.developer,
      publisher: game.publisher,
      imageUrl: game.imageUrl
    });
  } catch (error) {
    console.error('Error fetching game:', error);
    res.status(500).json({ error: 'Failed to fetch game' });
  }
});

app.post('/games', async (req, res) => {
  try {
    if (!req.body._id && !req.body.id) {
      const count = await Game.countDocuments();
      req.body._id = (count + 1).toString();
    } else if (req.body.id && !req.body._id) {
      req.body._id = req.body.id;
    }
    
    const game = new Game(req.body);
    await game.save();
    
    res.status(201).json({
      message: 'Game added successfully',
      game: {
        id: game._id,
        title: game.title,
        description: game.description,
        price: game.price,
        releaseDate: game.releaseDate,
        platforms: game.platforms,
        genres: game.genres,
        developer: game.developer,
        publisher: game.publisher,
        imageUrl: game.imageUrl
      }
    });
  } catch (error) {
    console.error('Error adding game:', error);
    res.status(500).json({ error: 'Failed to add game' });
  }
});

app.get('/genres', async (req, res) => {
  try {
    const genres = await Game.distinct('genres');
    res.json(genres.sort());
  } catch (error) {
    console.error('Error fetching genres:', error);
    res.status(500).json({ error: 'Failed to fetch genres' });
  }
});

app.get('/platforms', async (req, res) => {
  try {
    const platforms = await Game.distinct('platforms');
    res.json(platforms.sort());
  } catch (error) {
    console.error('Error fetching platforms:', error);
    res.status(500).json({ error: 'Failed to fetch platforms' });
  }
});

process.on('SIGINT', async () => {
  console.log('Shutting down gracefully...');
  await mongoose.connection.close();
  process.exit(0);
});

process.on('SIGTERM', async () => {
  console.log('Shutting down gracefully...');
  await mongoose.connection.close();
  process.exit(0);
});

initializeSampleData().then(() => {
  app.listen(port, () => {
    console.log(`Game catalog service running on port ${port}`);
    console.log(`MongoDB URI: ${MONGODB_URI}`);
  });
}).catch(error => {
  console.error('Failed to initialize:', error);
  process.exit(1);
});