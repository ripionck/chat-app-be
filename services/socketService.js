const socketIo = require('socket.io');
const jwt = require('jsonwebtoken');
const User = require('../models/User');

const setupSocketServer = (server) => {
  const io = socketIo(server, {
    cors: {
      origin: '*',
      methods: ['GET', 'POST'],
      credentials: true,
    },
  });

  // Middleware to authenticate socket connections
  io.use(async (socket, next) => {
    try {
      const token = socket.handshake.auth.token;

      if (!token) {
        return next(new Error('Authentication error: Token missing'));
      }

      const decoded = jwt.verify(token, process.env.JWT_SECRET);

      const user = await User.findById(decoded.id);

      if (!user) {
        return next(new Error('Authentication error: User not found'));
      }

      socket.user = user;
      next();
    } catch (error) {
      next(new Error('Authentication error: Invalid token'));
    }
  });

  io.on('connection', async (socket) => {
    console.log(`User connected: ${socket.user._id}`);

    // Join a room with the user's ID to allow direct messaging
    socket.join(socket.user._id.toString());

    // Update user status to online
    await User.findByIdAndUpdate(socket.user._id, {
      status: 'online',
      lastSeen: Date.now(),
    });

    // Emit user online status to friends
    socket.broadcast.emit('userStatusChange', {
      userId: socket.user._id,
      status: 'online',
      lastSeen: Date.now(),
    });

    // Join chat rooms
    socket.on('joinRoom', (roomId) => {
      socket.join(roomId);
      console.log(`${socket.user._id} joined room: ${roomId}`);
    });

    // Leave chat room
    socket.on('leaveRoom', (roomId) => {
      socket.leave(roomId);
      console.log(`${socket.user._id} left room: ${roomId}`);
    });

    // Real-time typing indicator
    socket.on('typing', ({ recipientId, roomId, isTyping }) => {
      if (roomId) {
        // Group chat typing
        socket.to(roomId).emit('typing', {
          userId: socket.user._id,
          name: socket.user.name,
          roomId,
          isTyping,
        });
      } else if (recipientId) {
        // Direct message typing
        socket.to(recipientId).emit('typing', {
          userId: socket.user._id,
          name: socket.user.name,
          isTyping,
        });
      }
    });

    // WebRTC signaling for calls
    socket.on('rtcSignal', ({ to, signal, callId, type }) => {
      io.to(to).emit('rtcSignal', {
        from: socket.user._id.toString(),
        signal,
        callId,
        type,
      });
    });

    // Handle disconnection
    socket.on('disconnect', async () => {
      console.log(`User disconnected: ${socket.user._id}`);

      // Update user status to offline
      await User.findByIdAndUpdate(socket.user._id, {
        status: 'offline',
        lastSeen: Date.now(),
      });

      // Emit user offline status to friends
      io.emit('userStatusChange', {
        userId: socket.user._id,
        status: 'offline',
        lastSeen: Date.now(),
      });
    });
  });

  return io;
};

module.exports = setupSocketServer;
