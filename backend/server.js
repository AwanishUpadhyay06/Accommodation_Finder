const express = require('express');
const mongoose = require('mongoose');
const cors = require('cors');
const dotenv = require('dotenv');
const http = require('http');
const { Server } = require('socket.io');
const cron = require('node-cron');

// Load environment variables
dotenv.config();

const app = express();
const server = http.createServer(app);

// CORS configuration
const corsOptions = {
  origin: process.env.FRONTEND_URL || 'http://localhost:3000',
  methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization'],
  credentials: true
};

// Apply CORS to all routes
app.use(cors(corsOptions));

// Initialize Socket.IO with CORS
const io = new Server(server, {
  cors: {
    origin: process.env.FRONTEND_URL || 'http://localhost:3000',
    methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
    allowedHeaders: ['Content-Type', 'Authorization'],
    credentials: true
  },
  transports: ['websocket', 'polling'],
  allowEIO3: true
});

// Socket.IO connection handler
io.on('connection', (socket) => {
  console.log('New client connected:', socket.id);

  // Optional auth handshake: client emits 'auth' with JWT to join a user room
  socket.on('auth', async (token) => {
    try {
      const jwt = require('jsonwebtoken');
      const User = require('./models/User');
      const decoded = jwt.verify(token, process.env.JWT_SECRET || 'your-secret-key');
      const user = await User.findById(decoded.userId).select('_id name role');
      if (user) {
        socket.join(`user:${user._id.toString()}`);
        socket.data.userId = user._id.toString();
        console.log(`Socket ${socket.id} joined room user:${user._id.toString()}`);
        socket.emit('auth:ok', { userId: user._id.toString() });
      } else {
        socket.emit('auth:error', { message: 'Invalid user' });
      }
    } catch (err) {
      console.error('Socket auth error:', err.message);
      socket.emit('auth:error', { message: 'Invalid token' });
    }
  });

  // Handle test event from client
  socket.on('test', (data) => {
    console.log('Test message from client:', data);
    socket.emit('test-response', { 
      message: 'Hello from server!',
      originalData: data,
      timestamp: new Date().toISOString()
    });
  });

  // Handle disconnection
  socket.on('disconnect', () => {
    console.log('Client disconnected:', socket.id);
  });
});

// Middleware
app.use(express.json({ limit: '50mb' }));
app.use(express.urlencoded({ extended: true, limit: '50mb' }));
app.use(express.json({ limit: '50mb' }));
app.use(express.urlencoded({ extended: true, limit: '50mb' }));

// Database connection
mongoose.connect(process.env.MONGODB_URI || 'mongodb://localhost:27017/accommodation-finder', {
  useNewUrlParser: true,
  useUnifiedTopology: true,
})
.then(() => console.log('Connected to MongoDB'))
.catch(err => console.error('MongoDB connection error:', err));

// Routes
app.use('/api/auth', require('./routes/auth'));
app.use('/api/properties', require('./routes/properties'));
app.use('/api/reviews', require('./routes/reviews'));
app.use('/api/users', require('./routes/users'));
app.use('/api/admin', require('./routes/admin'));
app.use('/api/bookings', require('./routes/bookings'));
app.use('/api/enquiries', require('./routes/enquiries'));
app.use('/api/favorites', require('./routes/favorites'));
app.use('/api/notifications', require('./routes/notifications'));

app.use('/api/owner', require('./routes/owner'));
app.use('/api/tenant-profile', require('./routes/tenant-profile'));
app.use('/api/owner-profile', require('./routes/owner-profile'));
app.use('/api/user-settings', require('./routes/user-settings'));

// Basic route
app.get('/', (req, res) => {
  res.json({ message: 'Accommodation Finder API is running!' });
});

// Error handling middleware
app.use((err, req, res, next) => {
  console.error(err.stack);
  res.status(500).json({ message: 'Something went wrong!' });
});

// Make io available in routes
app.set('io', io);

// Start server
const PORT = process.env.PORT || 5000;
server.listen(PORT, () => {
  console.log(`Server is running on port ${PORT}`);
  console.log(`WebSocket server is running on ws://localhost:${PORT}`);
});

// Reservation cron removed (token flow disabled)