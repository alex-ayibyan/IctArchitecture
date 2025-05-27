const express = require('express');
const cors = require('cors');
const mongoose = require('mongoose');

const app = express();
const port = process.env.PORT || 3004;
const client = require('prom-client');

app.use(cors());
app.use(express.json());

const register = new client.Registry();
client.collectDefaultMetrics({ register });

const serviceUp = new client.Gauge({
  name: 'notification_service_up',
  help: 'Notification service availability'
});

const totalNotifications = new client.Gauge({
  name: 'notification_total_count',
  help: 'Total notifications'
});

const totalPriceAlerts = new client.Gauge({
  name: 'notification_price_alerts_count',
  help: 'Total active price alerts'
});

register.registerMetric(serviceUp);
register.registerMetric(totalNotifications);
register.registerMetric(totalPriceAlerts);

app.get('/metrics', async (req, res) => {
  try {
    res.set('Content-Type', register.contentType);
    res.end(await register.metrics());
  } catch (error) {
    res.status(500).end(error);
  }
});

const mongoUri = process.env.MONGODB_URI || 'mongodb://mongo-svc:27017/gameportal';
console.log('MongoDB URI:', mongoUri);

mongoose.connect(mongoUri, {
  useNewUrlParser: true,
  useUnifiedTopology: true,
}).then(() => {
  console.log('Connected to MongoDB');
  serviceUp.set(1);
  initializeSampleNotifications();
}).catch(err => {
  console.error('MongoDB connection error:', err);
  serviceUp.set(0);
});

const NotificationSchema = new mongoose.Schema({
  userId: { type: String, required: true },
  type: { 
    type: String, 
    enum: ['price_alert', 'new_game', 'sale', 'recommendation'],
    required: true
  },
  title: { type: String, required: true },
  message: { type: String, required: true },
  gameId: { type: String },
  gameTitle: { type: String },
  priceThreshold: { type: Number },
  currentPrice: { type: Number },
  isRead: { type: Boolean, default: false },
  createdAt: { type: Date, default: Date.now },
  expiresAt: { type: Date }
});

NotificationSchema.index({ userId: 1, createdAt: -1 });
NotificationSchema.index({ expiresAt: 1 }, { expireAfterSeconds: 0 });

const Notification = mongoose.model('Notification', NotificationSchema);

const PriceAlertSchema = new mongoose.Schema({
  userId: { type: String, required: true },
  gameId: { type: String, required: true },
  gameTitle: { type: String, required: true },
  targetPrice: { type: Number, required: true },
  isActive: { type: Boolean, default: true },
  createdAt: { type: Date, default: Date.now }
});

PriceAlertSchema.index({ userId: 1, gameId: 1 }, { unique: true });

const PriceAlert = mongoose.model('PriceAlert', PriceAlertSchema);

async function initializeSampleNotifications() {
  try {
    const existingNotifications = await Notification.countDocuments();
    if (existingNotifications > 0) {
      console.log('Sample notification data already exists');
      return;
    }

    const sampleNotifications = [
      {
        userId: "user1",
        type: "price_alert",
        title: "Price Drop Alert!",
        message: "The Witcher 3 is now available for €19.99 - that's 50% off!",
        gameId: "1",
        gameTitle: "The Witcher 3",
        currentPrice: 19.99,
        priceThreshold: 25.00
      },
      {
        userId: "user1",
        type: "new_game",
        title: "New Game Added",
        message: "Cyberpunk 2077 has been added to the catalog",
        gameId: "2",
        gameTitle: "Cyberpunk 2077"
      },
      {
        userId: "user1",
        type: "sale",
        title: "Steam Summer Sale",
        message: "Steam Summer Sale is now live with up to 80% off!",
        expiresAt: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000)
      }
    ];

    await Notification.insertMany(sampleNotifications);
    console.log('Sample notification data initialized');
  } catch (error) {
    console.error('Error initializing sample notifications:', error);
  }
}

app.get('/notifications/health', (req, res) => {
  res.status(200).json({ status: 'healthy' });
});

app.get('/notifications/:userId', async (req, res) => {
  try {
    const { userId } = req.params;
    const { type, unreadOnly } = req.query;
    
    let query = { userId };
    if (type) query.type = type;
    if (unreadOnly === 'true') query.isRead = false;
    
    const notifications = await Notification.find(query)
      .sort({ createdAt: -1 })
      .limit(50);
    
    res.json({
      userId,
      notifications: notifications.map(notif => ({
        id: notif._id,
        type: notif.type,
        title: notif.title,
        message: notif.message,
        gameId: notif.gameId,
        gameTitle: notif.gameTitle,
        currentPrice: notif.currentPrice,
        isRead: notif.isRead,
        createdAt: notif.createdAt.toISOString()
      }))
    });
  } catch (error) {
    console.error('Error fetching notifications:', error);
    res.status(500).json({ error: 'Failed to fetch notifications' });
  }
});

app.patch('/notifications/:userId/:notificationId/read', async (req, res) => {
  try {
    const { userId, notificationId } = req.params;
    
    const notification = await Notification.findOneAndUpdate(
      { _id: notificationId, userId },
      { isRead: true },
      { new: true }
    );
    
    if (!notification) {
      return res.status(404).json({ error: 'Notification not found' });
    }
    
    res.json({ message: 'Notification marked as read' });
  } catch (error) {
    console.error('Error marking notification as read:', error);
    res.status(500).json({ error: 'Failed to mark notification as read' });
  }
});

app.post('/notifications/:userId/price-alerts', async (req, res) => {
  try {
    const { userId } = req.params;
    const { gameId, gameTitle, targetPrice } = req.body;
    
    if (!gameId || !gameTitle || !targetPrice) {
      return res.status(400).json({ error: 'Missing required fields' });
    }
    
    const priceAlert = new PriceAlert({
      userId,
      gameId,
      gameTitle,
      targetPrice: parseFloat(targetPrice)
    });
    
    await priceAlert.save();
    
    res.status(201).json({
      message: 'Price alert created successfully',
      alert: {
        id: priceAlert._id,
        gameId: priceAlert.gameId,
        gameTitle: priceAlert.gameTitle,
        targetPrice: priceAlert.targetPrice
      }
    });
  } catch (error) {
    if (error.code === 11000) {
      res.status(409).json({ error: 'Price alert already exists for this game' });
    } else {
      console.error('Error creating price alert:', error);
      res.status(500).json({ error: 'Failed to create price alert' });
    }
  }
});

app.get('/notifications/:userId/price-alerts', async (req, res) => {
  try {
    const { userId } = req.params;
    
    const alerts = await PriceAlert.find({ userId, isActive: true })
      .sort({ createdAt: -1 });
    
    res.json({
      userId,
      alerts: alerts.map(alert => ({
        id: alert._id,
        gameId: alert.gameId,
        gameTitle: alert.gameTitle,
        targetPrice: alert.targetPrice,
        createdAt: alert.createdAt.toISOString()
      }))
    });
  } catch (error) {
    console.error('Error fetching price alerts:', error);
    res.status(500).json({ error: 'Failed to fetch price alerts' });
  }
});

app.delete('/notifications/:userId/price-alerts/:alertId', async (req, res) => {
  try {
    const { userId, alertId } = req.params;
    
    const result = await PriceAlert.deleteOne({ _id: alertId, userId });
    
    if (result.deletedCount === 0) {
      return res.status(404).json({ error: 'Price alert not found' });
    }
    
    res.status(204).send();
  } catch (error) {
    console.error('Error deleting price alert:', error);
    res.status(500).json({ error: 'Failed to delete price alert' });
  }
});

app.post('/notifications/check-price-alerts', async (req, res) => {
  try {
    const { gameId, currentPrice } = req.body;
    
    if (!gameId || !currentPrice) {
      return res.status(400).json({ error: 'Missing gameId or currentPrice' });
    }
    
    const triggeredAlerts = await PriceAlert.find({
      gameId,
      targetPrice: { $gte: currentPrice },
      isActive: true
    });
    
    const notifications = [];
    
    for (const alert of triggeredAlerts) {
      const notification = new Notification({
        userId: alert.userId,
        type: 'price_alert',
        title: 'Price Alert Triggered!',
        message: `${alert.gameTitle} is now available for €${currentPrice} - below your target of €${alert.targetPrice}!`,
        gameId: alert.gameId,
        gameTitle: alert.gameTitle,
        currentPrice: currentPrice,
        priceThreshold: alert.targetPrice
      });
      
      await notification.save();
      notifications.push(notification);
      
      alert.isActive = false;
      await alert.save();
    }
    
    res.json({
      message: `${notifications.length} price alerts triggered`,
      triggeredAlerts: notifications.length
    });
  } catch (error) {
    console.error('Error checking price alerts:', error);
    res.status(500).json({ error: 'Failed to check price alerts' });
  }
});

app.listen(port, () => {
  console.log(`Notification service listening on port ${port}`);
});