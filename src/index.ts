import express from 'express';
import { createServer } from 'http';
import { Server } from 'socket.io';
import cors from 'cors';
import { PrismaClient } from '@prisma/client';
import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import { requireAuth, AuthenticatedRequest } from './authMiddleware';

const app = express();
const httpServer = createServer(app);

app.use(cors({ origin: '*' }));
app.use(express.json());

const prisma = new PrismaClient();
const JWT_SECRET = process.env.JWT_SECRET || 'super-secret-key-change-me-in-production';

const io = new Server(httpServer, {
  cors: {
    origin: '*',
    methods: ['GET', 'POST']
  }
});

// Real-time OBS Stream connections
io.on('connection', (socket) => {
  socket.on('join-overlay', (userId) => {
    socket.join(userId);
    console.log(`Widget client linked to room: ${userId}`);
  });

  socket.on('disconnect', () => {
    console.log('Client separated from socket node');
  });
});

/* ==========================================================================
   AUTHENTICATION ENDPOINTS
   ========================================================================== */

app.post('/api/auth/register', async (req, res) => {
  try {
    const { username, email, password } = req.body;
    if (!username || !email || !password) {
      return res.status(400).json({ error: 'All fields are required' });
    }

    const normalizedUser = username.toLowerCase().trim();
    const existingUser = await prisma.user.findFirst({
      where: { OR: [{ username: normalizedUser }, { email }] }
    });

    if (existingUser) {
      return res.status(400).json({ error: 'Username or email already taken' });
    }

    const hashedPassword = await bcrypt.hash(password, 10);
    const user = await prisma.user.create({
      data: {
        username: normalizedUser,
        email,
        password: hashedPassword,
        widgetSettings: {
          create: {
            image: 'https://media.giphy.com/media/v1.Y2lkPTc5MGI3NjExM3Y0cm83bXNidm56bms1dms3bHh3amFub2t3Y3Y0eXg0Y3I4dzZyeCZlcD12MV9pbnRlcm5hbF9naWZfYnlfaWQmY3Q9cw/8g6F96C1Hwff2/giphy.gif',
            sound: 'https://assets.mixkit.co/active_storage/sfx/911/911-128.mp3',
            duration: 6000,
            textColor: '#a855f7'
          }
        }
      }
    });

    const token = jwt.sign({ userId: user.id }, JWT_SECRET, { expiresIn: '7d' });
    res.status(201).json({ token, username: user.username });
  } catch (error) {
    res.status(500).json({ error: 'Registration failed' });
  }
});

app.post('/api/auth/login', async (req, res) => {
  try {
    const { username, password } = req.body;
    const user = await prisma.user.findUnique({ where: { username: username.toLowerCase().trim() } });

    if (!user || !(await bcrypt.compare(password, user.password))) {
      return res.status(400).json({ error: 'Invalid credentials' });
    }

    const token = jwt.sign({ userId: user.id }, JWT_SECRET, { expiresIn: '7d' });
    res.json({ token, username: user.username });
  } catch (error) {
    res.status(500).json({ error: 'Login failed' });
  }
});

/* ==========================================================================
   PUBLIC TIPPING ENDPOINT
   ========================================================================== */

app.post('/api/tip', async (req, res) => {
  try {
    const { userId, donorName, amount, message } = req.body;

    const streamer = await prisma.user.findUnique({
      where: { username: userId.toLowerCase().trim() },
      include: { widgetSettings: true }
    });

    if (!streamer) return res.status(404).json({ error: 'Streamer not found' });

    const donation = await prisma.donation.create({
      data: {
        userId: streamer.id,
        donorName,
        amount: parseFloat(amount),
        message
      }
    });

    if (streamer.widgetSettings) {
      io.to(streamer.username).emit('new-tip-alert', {
        donorName,
        amount,
        message,
        image: streamer.widgetSettings.image,
        sound: streamer.widgetSettings.sound,
        duration: streamer.widgetSettings.duration,
        textColor: streamer.widgetSettings.textColor
      });
    }

    res.status(200).json(donation);
  } catch (error) {
    res.status(500).json({ error: 'Transaction processing failure' });
  }
});

/* ==========================================================================
   PRIVATE DASHBOARD METRICS & CONFIG
   ========================================================================== */

app.get('/api/dashboard/stats', requireAuth, async (req: AuthenticatedRequest, res) => {
  try {
    const donations = await prisma.donation.findMany({
      where: { userId: req.userId },
      orderBy: { createdAt: 'desc' }
    });

    const settings = await prisma.widgetSettings.findUnique({
      where: { userId: req.userId }
    });

    const totalRevenue = donations.reduce((sum, d) => sum + d.amount, 0);

    res.json({ donations, settings, totalRevenue });
  } catch (error) {
    res.status(500).json({ error: 'Failed to aggregate portal statistics' });
  }
});

app.post('/api/dashboard/settings', requireAuth, async (req: AuthenticatedRequest, res) => {
  try {
    const { image, sound, duration, textColor } = req.body;

    const updated = await prisma.widgetSettings.update({
      where: { userId: req.userId },
      data: {
        image,
        sound,
        duration: parseInt(duration),
        textColor
      }
    });

    res.json({ message: 'Configuration locked successfully', settings: updated });
  } catch (error) {
    res.status(500).json({ error: 'Failed to write configuration variables' });
  }
});

const PORT = process.env.PORT || 10000;
httpServer.listen(PORT, () => {
  console.log(`🚀 OBS Alert Backend running on port ${PORT}`);
});
