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
    required: [true, 'Title is required'],
    trim: true,
    minlength: [1, 'Title cannot be empty']
  },
  description: {
    type: String,
    default: '',
    trim: true
  },
  price: {
    type: Number,
    required: [true, 'Price is required'],
    min: [0.01, 'Price must be greater than 0']
  },
  releaseDate: {
    type: String,
    default: ''
  },
  platforms: {
    type: [String],
    required: [true, 'At least one platform is required'],
    validate: {
      validator: function(v) {
        return v && v.length > 0 && v.every(platform => platform.trim().length > 0);
      },
      message: 'At least one valid platform is required'
    }
  },
  genres: {
    type: [String],
    default: []
  },
  developer: {
    type: String,
    default: '',
    trim: true
  },
  publisher: {
    type: String,
    default: '',
    trim: true
  },
  imageUrl: {
    type: String,
    default: ''
  }
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
          releaseDate: "2015-05-19",
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
          releaseDate: "2020-12-10",
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
          releaseDate: "2011-11-18",
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
          releaseDate: "2013-09-17",
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
          releaseDate: "2018-06-15",
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
    console.log('Received game data:', req.body);
    
    if (!req.body.title || req.body.title.trim() === '') {
      return res.status(400).json({ error: 'Title is required and cannot be empty' });
    }
    
    const price = parseFloat(req.body.price);
    if (!price || price <= 0 || isNaN(price)) {
      return res.status(400).json({ error: 'Valid price greater than 0 is required' });
    }
    
    if (!req.body.platforms || !Array.isArray(req.body.platforms) || req.body.platforms.length === 0) {
      return res.status(400).json({ error: 'At least one platform is required' });
    }
    
    const count = await Game.countDocuments();
    let uniqueId = (count + 1).toString();
    
    let counter = 1;
    while (await Game.findById(uniqueId)) {
      uniqueId = `${count + 1}_${counter}`;
      counter++;
    }
    
    let platforms = req.body.platforms;
    let genres = req.body.genres || [];
    
    if (typeof platforms === 'string') {
      platforms = platforms.split(',').map(p => p.trim()).filter(p => p);
    }
    if (typeof genres === 'string') {
      genres = genres.split(',').map(g => g.trim()).filter(g => g);
    }
    
    const gameData = {
      _id: uniqueId,
      title: req.body.title.trim(),
      description: req.body.description ? req.body.description.trim() : '',
      price: price,
      releaseDate: req.body.releaseDate || '',
      platforms: platforms,
      genres: genres,
      developer: req.body.developer ? req.body.developer.trim() : '',
      publisher: req.body.publisher ? req.body.publisher.trim() : '',
      imageUrl: req.body.imageUrl || ''
    };
    
    console.log('Creating game with data:', gameData);
    
    const game = new Game(gameData);
    await game.save();
    
    console.log('Game saved successfully:', game._id);
    
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
    console.error('Error stack:', error.stack);
    
    if (error.name === 'ValidationError') {
      const validationErrors = Object.values(error.errors).map(err => err.message);
      return res.status(400).json({ 
        error: `Validation failed: ${validationErrors.join(', ')}`,
        details: error.errors
      });
    }
    
    if (error.code === 11000) {
      return res.status(409).json({ error: 'Game with this ID already exists' });
    }
    
    res.status(500).json({ 
      error: 'Failed to add game', 
      details: error.message,
      type: error.name 
    });
  }
});

app.put('/games/:id', async (req, res) => {
  try {
    const gameId = req.params.id;
    
    if (typeof req.body.platforms === 'string') {
      req.body.platforms = req.body.platforms.split(',').map(p => p.trim()).filter(p => p);
    }
    if (typeof req.body.genres === 'string') {
      req.body.genres = req.body.genres.split(',').map(g => g.trim()).filter(g => g);
    }
    
    const updatedGame = await Game.findByIdAndUpdate(
      gameId,
      {
        $set: {
          title: req.body.title,
          description: req.body.description,
          price: parseFloat(req.body.price),
          releaseDate: req.body.releaseDate,
          platforms: req.body.platforms,
          genres: req.body.genres,
          developer: req.body.developer,
          publisher: req.body.publisher,
          imageUrl: req.body.imageUrl
        }
      },
      { new: true, runValidators: true }
    );
    
    if (!updatedGame) {
      return res.status(404).json({ error: 'Game not found' });
    }
    
    res.json({
      message: 'Game updated successfully',
      game: {
        id: updatedGame._id,
        title: updatedGame.title,
        description: updatedGame.description,
        price: updatedGame.price,
        releaseDate: updatedGame.releaseDate,
        platforms: updatedGame.platforms,
        genres: updatedGame.genres,
        developer: updatedGame.developer,
        publisher: updatedGame.publisher,
        imageUrl: updatedGame.imageUrl
      }
    });
  } catch (error) {
    console.error('Error updating game:', error);
    if (error.name === 'ValidationError') {
      const validationErrors = Object.values(error.errors).map(err => err.message);
      return res.status(400).json({ error: `Validation failed: ${validationErrors.join(', ')}` });
    }
    res.status(500).json({ error: 'Failed to update game' });
  }
});

app.delete('/games/:id', async (req, res) => {
  console.log('DELETE request received for games/:id');
  console.log('Request params:', req.params);
  console.log('Full URL:', req.originalUrl);
  
  try {
    const gameId = req.params.id;
    console.log('Attempting to delete game with ID:', gameId);
    
    const existingGame = await Game.findById(gameId);
    console.log('Found existing game:', existingGame ? existingGame.title : 'Not found');
    
    if (!existingGame) {
      console.log('Game not found for deletion:', gameId);
      return res.status(404).json({ error: 'Game not found', gameId: gameId });
    }
    
    const deletedGame = await Game.findByIdAndDelete(gameId);
    console.log('Successfully deleted game:', deletedGame.title);
    
    res.json({ 
      message: 'Game deleted successfully',
      deletedGame: {
        id: deletedGame._id,
        title: deletedGame.title
      }
    });
  } catch (error) {
    console.error('Error deleting game:', error);
    res.status(500).json({ error: 'Failed to delete game', details: error.message });
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