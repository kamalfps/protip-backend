import express from 'express';
import { createServer } from 'http';
import { Server } from 'socket.io';
import cors from 'cors';
import dotenv from 'dotenv';
import { PrismaClient } from '@prisma/client';

// Load environment variables
dotenv.config();

const app = express();
// To use WebSockets, we need to wrap Express in a standard Node HTTP server
const httpServer = createServer(app); 

// Initialize Socket.io for Real-Time OBS Alerts
const io = new Server(httpServer, {
  cors: {
    origin: '*', // We will restrict this to your frontend URL later for security
    methods: ['GET', 'POST']
  }
});

const prisma = new PrismaClient();
const PORT = process.env.PORT || 5000;

app.use(cors());
app.use(express.json());

// ==========================================
// 1. REAL-TIME SOCKET.IO LOGIC (OBS WIDGET)
// ==========================================
io.on('connection', (socket) => {
  console.log(`🔌 New WebSocket connection: ${socket.id}`);

  // When a streamer adds the widget link to OBS, OBS sends a "join-overlay" event
  socket.on('join-overlay', (userId) => {
    socket.join(userId); // Put this OBS source into a private "room" just for this streamer
    console.log(`📺 OBS Widget connected for Streamer ID: ${userId}`);
  });

  socket.on('disconnect', () => {
    console.log(`❌ WebSocket disconnected: ${socket.id}`);
  });
});

// ==========================================
// 2. REST API ROUTES
// ==========================================

// Health Check for Render
app.get('/api/health', (req, res) => {
  res.json({ status: 'online', service: 'OBS Alert Engine' });
});

// Fetch a streamer's specific widget settings (colors, gifs, sounds)
app.get('/api/widget-settings/:userId', async (req, res) => {
  try {
    const settings = await prisma.widgetSettings.findUnique({
      where: { userId: req.params.userId }
    });
    res.json(settings);
  } catch (error) {
    res.status(500).json({ error: 'Failed to fetch settings' });
  }
});

// The magical endpoint: When a viewer sends a tip!
app.post('/api/tip', async (req, res) => {
  const { userId, donorName, amount, message } = req.body;

  try {
    // 1. Save the tip to the database
    const donation = await prisma.donation.create({
      data: { userId, donorName, amount, message }
    });

    // 2. Get the streamer's custom alert settings (like min donation amount)
    const settings = await prisma.widgetSettings.findUnique({
      where: { userId }
    });

    // 3. BLAST the alert to OBS!
    if (settings && amount >= settings.minDonation) {
      // io.to(userId) sends the event ONLY to this specific streamer's OBS room
      io.to(userId).emit('new-tip-alert', {
        donorName: donation.donorName,
        amount: donation.amount,
        message: donation.message,
        image: settings.alertImage,
        sound: settings.alertSound,
        duration: settings.alertDuration,
        textColor: settings.textColor
      });
    }

    res.json({ success: true, message: 'Tip sent and OBS alert triggered!' });
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: 'Failed to process tip.' });
  }
});

// Start the server (Using httpServer.listen instead of app.listen for WebSockets)
httpServer.listen(PORT, () => {
  console.log(`🚀 OBS Alert Backend is running on port ${PORT}`);
});
