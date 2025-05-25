const express = require('express');
const cors = require('cors');
const mongoose = require('mongoose');

const app = express();
const port = process.env.PORT || 3003;

app.use(cors());
app.use(express.json());

const mongoUri = process.env.MONGODB_URI || 'mongodb://mongo-svc:27017/gameportal';
console.log('MongoDB URI:', mongoUri);

mongoose.connect(mongoUri, {
  useNewUrlParser: true,
  useUnifiedTopology: true,
}).then(() => {
  console.log('Connected to MongoDB');
  initializeSampleCollections();
}).catch(err => {
  console.error('MongoDB connection error:', err);
});

const CollectionItemSchema = new mongoose.Schema({
  userId: { type: String, required: true },
  gameId: { type: String, required: true },
  title: { type: String, required: true },
  platform: { type: String, required: true },
  store: { type: String, required: true },
  status: { 
    type: String, 
    enum: ['wishlist', 'in-progress', 'completed', 'backlog'],
    default: 'wishlist'
  },
  playtime: { type: Number, default: 0 },
  addedDate: { type: Date, default: Date.now },
  completedDate: { type: Date },
  rating: { type: Number, min: 1, max: 5 }
});

CollectionItemSchema.index({ userId: 1 });
CollectionItemSchema.index({ userId: 1, gameId: 1 }, { unique: true });

const CollectionItem = mongoose.model('CollectionItem', CollectionItemSchema);

async function initializeSampleCollections() {
  try {
    const existingItems = await CollectionItem.countDocuments();
    if (existingItems > 0) {
      console.log('Sample collection data already exists');
      return;
    }

    const sampleCollections = [
      {
        userId: "user1",
        gameId: "1",
        title: "The Witcher 3",
        platform: "PC",
        store: "Steam",
        status: "completed",
        playtime: 120,
        rating: 5
      },
      {
        userId: "user1",
        gameId: "2",
        title: "Zelda: Breath of the Wild",
        platform: "Switch",
        store: "Nintendo eShop",
        status: "in-progress",
        playtime: 45
      },
      {
        userId: "user1",
        gameId: "3",
        title: "God of War",
        platform: "PS5",
        store: "PlayStation Store",
        status: "wishlist",
        playtime: 0
      }
    ];

    await CollectionItem.insertMany(sampleCollections);
    console.log('Sample collection data initialized');
  } catch (error) {
    console.error('Error initializing sample collections:', error);
  }
}

app.get('/collection/health', (req, res) => {
  res.status(200).json({ status: 'healthy' });
});

app.get('/collection/:userId', async (req, res) => {
  try {
    const { userId } = req.params;
    const { status, platform } = req.query;
    
    let query = { userId };
    if (status) query.status = status;
    if (platform) query.platform = platform;
    
    const games = await CollectionItem.find(query).sort({ addedDate: -1 });
    
    res.json({
      userId,
      games: games.map(game => ({
        id: game.gameId,
        title: game.title,
        platform: game.platform,
        store: game.store,
        status: game.status,
        playtime: game.playtime,
        addedDate: game.addedDate.toISOString().split('T')[0],
        completedDate: game.completedDate ? game.completedDate.toISOString().split('T')[0] : null,
        rating: game.rating
      }))
    });
  } catch (error) {
    console.error('Error fetching collection:', error);
    res.status(500).json({ error: 'Failed to fetch collection' });
  }
});

app.post('/collection/:userId/games', async (req, res) => {
  try {
    const { userId } = req.params;
    const gameData = {
      userId,
      ...req.body,
      addedDate: new Date()
    };
    
    const existingItem = await CollectionItem.findOne({
      userId,
      gameId: gameData.gameId
    });
    
    if (existingItem) {
      return res.status(409).json({ error: 'Game already in collection' });
    }
    
    const collectionItem = new CollectionItem(gameData);
    await collectionItem.save();
    
    res.status(201).json({
      id: collectionItem.gameId,
      title: collectionItem.title,
      platform: collectionItem.platform,
      store: collectionItem.store,
      status: collectionItem.status,
      playtime: collectionItem.playtime,
      addedDate: collectionItem.addedDate.toISOString().split('T')[0],
      rating: collectionItem.rating
    });
  } catch (error) {
    console.error('Error adding game to collection:', error);
    if (error.code === 11000) {
      res.status(409).json({ error: 'Game already in collection' });
    } else {
      res.status(500).json({ error: 'Failed to add game to collection' });
    }
  }
});

app.delete('/collection/:userId/games/:gameId', async (req, res) => {
  try {
    const { userId, gameId } = req.params;
    
    const result = await CollectionItem.deleteOne({ userId, gameId });
    
    if (result.deletedCount === 0) {
      return res.status(404).json({ error: 'Game not found in collection' });
    }
    
    res.status(204).send();
  } catch (error) {
    console.error('Error removing game from collection:', error);
    res.status(500).json({ error: 'Failed to remove game from collection' });
  }
});

app.patch('/collection/:userId/games/:gameId', async (req, res) => {
  try {
    const { userId, gameId } = req.params;
    const updates = req.body;
    
    if (updates.status === 'completed' && !updates.completedDate) {
      updates.completedDate = new Date();
    }
    
    const updatedItem = await CollectionItem.findOneAndUpdate(
      { userId, gameId },
      updates,
      { new: true, runValidators: true }
    );
    
    if (!updatedItem) {
      return res.status(404).json({ error: 'Game not found in collection' });
    }
    
    res.json({
      id: updatedItem.gameId,
      title: updatedItem.title,
      platform: updatedItem.platform,
      store: updatedItem.store,
      status: updatedItem.status,
      playtime: updatedItem.playtime,
      addedDate: updatedItem.addedDate.toISOString().split('T')[0],
      completedDate: updatedItem.completedDate ? updatedItem.completedDate.toISOString().split('T')[0] : null,
      rating: updatedItem.rating
    });
  } catch (error) {
    console.error('Error updating game in collection:', error);
    res.status(500).json({ error: 'Failed to update game in collection' });
  }
});

app.get('/collection/:userId/stats', async (req, res) => {
  try {
    const { userId } = req.params;
    
    const items = await CollectionItem.find({ userId });
    
    const stats = {
      totalGames: items.length,
      totalPlaytime: items.reduce((sum, item) => sum + (item.playtime || 0), 0),
      byPlatform: {},
      byStatus: {},
      averageRating: 0
    };
    
    items.forEach(item => {
      stats.byPlatform[item.platform] = (stats.byPlatform[item.platform] || 0) + 1;
      stats.byStatus[item.status] = (stats.byStatus[item.status] || 0) + 1;
    });
    
    const ratedGames = items.filter(item => item.rating);
    if (ratedGames.length > 0) {
      stats.averageRating = ratedGames.reduce((sum, item) => sum + item.rating, 0) / ratedGames.length;
      stats.averageRating = Math.round(stats.averageRating * 10) / 10;
    }
    
    res.json(stats);
  } catch (error) {
    console.error('Error fetching collection stats:', error);
    res.status(500).json({ error: 'Failed to fetch collection statistics' });
  }
});

app.listen(port, () => {
  console.log(`Collection management service listening on port ${port}`);
});