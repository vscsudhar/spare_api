import { Server } from 'socket.io';
import jwt from 'jsonwebtoken';
import env from './env.js';
import Users from '../modules/users/users.model.js';
import RareProductRequest from '../modules/rare-requests/rare-requests.model.js';
import { RareChatMessage } from '../modules/rare-requests/rare-requests.model.js';

let io = null;

// Track message rate limits per socket ID: { socketId: [timestamps] }
const messageTimestamps = new Map();

// Simple rate limiter check (max 5 messages per 5 seconds)
const checkRateLimit = (socketId) => {
  const now = Date.now();
  if (!messageTimestamps.has(socketId)) {
    messageTimestamps.set(socketId, []);
  }

  const timestamps = messageTimestamps.get(socketId);
  // Keep only timestamps within last 5 seconds
  const recent = timestamps.filter((time) => now - time < 5000);
  recent.push(now);
  messageTimestamps.set(socketId, recent);

  return recent.length <= 5;
};

// Clean text function to prevent HTML/XSS injection
const sanitizeText = (text) => {
  if (!text) return '';
  return text
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#x27;')
    .replace(/\//g, '&#x2F;');
};

export const initSocket = (server) => {
  io = new Server(server, {
    cors: {
      origin: '*',
      methods: ['GET', 'POST'],
    },
  });

  // JWT Middleware validation
  io.use(async (socket, next) => {
    try {
      const authHeader =
        socket.handshake.auth?.token ||
        socket.handshake.headers?.authorization ||
        socket.handshake.query?.token;

      if (!authHeader) {
        return next(new Error('Authentication error: Token missing'));
      }

      const token = authHeader.startsWith('Bearer ') ? authHeader.split(' ')[1] : authHeader;
      const decoded = jwt.verify(token, env.JWT_ACCESS_SECRET);

      const user = await Users.findById(decoded.id).populate('role');
      if (!user) {
        return next(new Error('Authentication error: User not found'));
      }
      if (user.status !== 'active') {
        return next(new Error('Authentication error: User is inactive'));
      }

      socket.user = user;
      next();
    } catch (err) {
      return next(new Error('Authentication error: Invalid or expired token'));
    }
  });

  io.on('connection', (socket) => {
    const user = socket.user;
    const isUserAdmin = ['owner', 'admin'].includes(user.role.name) || 
      user.permissions?.includes('rare_requests.read') || 
      user.role.permissions?.some(p => p.name === 'rare_requests.read');

    console.log(`🔌 Client connected: ${user.name} (${user.role.name})`);

    // 1. Join personal room
    socket.join(`user:${user._id}`);

    // 2. If staff, join admin updates room
    if (isUserAdmin) {
      socket.join('admin:rare-requests');
      console.log(`👑 Admin joined room 'admin:rare-requests'`);
    }

    // Generic room join handler supporting room:join and join_request
    socket.on('room:join', async (payload, callback) => {
      try {
        let roomId = typeof payload === 'string' ? payload : (payload?.roomId || (payload?.requestId ? `rare-request:${payload.requestId}` : ''));
        if (!roomId) {
          throw new Error('Invalid room parameter');
        }

        socket.join(roomId);
        console.log(`💬 Socket [${user.name}] (${user._id}) joined room: ${roomId}`);
        if (typeof callback === 'function') {
          callback({ success: true, message: `Successfully joined room ${roomId}` });
        }
      } catch (err) {
        console.error('Socket room:join error:', err.message);
        if (typeof callback === 'function') {
          callback({ success: false, message: err.message });
        }
      }
    });

    socket.on('room:leave', (payload, callback) => {
      let roomId = typeof payload === 'string' ? payload : (payload?.roomId || (payload?.requestId ? `rare-request:${payload.requestId}` : ''));
      if (roomId) {
        socket.leave(roomId);
        console.log(`💬 Socket [${user.name}] (${user._id}) left room: ${roomId}`);
        if (typeof callback === 'function') callback({ success: true });
      }
    });

    // Handle legacy request room join
    socket.on('join_request', async (payload, callback) => {
      try {
        const { requestId } = payload || {};
        if (requestId) {
          socket.join(`rare-request:${requestId}`);
          console.log(`💬 Socket [${user.name}] joined rare-request room: rare-request:${requestId}`);
        }
        if (typeof callback === 'function') {
          callback({ success: true, message: `Successfully joined room rare-request:${requestId}` });
        }
      } catch (err) {
        if (typeof callback === 'function') {
          callback({ success: false, message: err.message });
        }
      }
    });

    // 4. Handle incoming typing events
    socket.on('rare_chat:typing', (payload) => {
      const { requestId, isTyping } = payload || {};
      if (!requestId) return;

      // Broadcast typing indicator to other room participants
      socket.to(`rare-request:${requestId}`).emit('rare_chat:typing', {
        requestId,
        userId: user._id,
        userName: user.name,
        isTyping: !!isTyping,
      });
    });

    // Handle read receipt
    socket.on('rare_chat:read', async (payload) => {
      try {
        const { requestId } = payload || {};
        if (!requestId) return;
        await RareChatMessage.updateMany(
          { request: requestId, readBy: { $ne: user._id } },
          { $addToSet: { readBy: user._id } }
        );
        io.to(`rare-request:${requestId}`).emit('rare_chat:read', {
          requestId,
          userId: user._id,
        });
      } catch (err) {
        console.error('Error in rare_chat:read:', err);
      }
    });

    // Handle received receipt
    socket.on('rare_chat:received', async (payload) => {
      try {
        const { messageId, requestId } = payload || {};
        if (!messageId || !requestId) return;
        await RareChatMessage.findByIdAndUpdate(
          messageId,
          { $addToSet: { receivedBy: user._id } },
          { new: true }
        );
        io.to(`rare-request:${requestId}`).emit('rare_chat:received', {
          requestId,
          messageId,
          userId: user._id,
        });
      } catch (err) {
        console.error('Error in rare_chat:received:', err);
      }
    });

    // 5. Handle direct message posts (persisted first)
    socket.on('rare_chat:message', async (payload, callback) => {
      try {
        const { requestId, message } = payload || {};
        if (!requestId || !message || typeof message !== 'string') {
          throw new Error('Invalid payload parameters');
        }

        // Apply rate limit checks
        if (!checkRateLimit(socket.id)) {
          throw new Error('Rate limit exceeded. Please wait a moment.');
        }

        const requestDoc = await RareProductRequest.findById(requestId);
        if (!requestDoc) {
          throw new Error('Request not found');
        }

        // Verify room access
        const isOwner = requestDoc.user.toString() === user._id.toString();
        if (!isOwner && !isUserAdmin) {
          throw new Error('Access denied');
        }

        // Clean & sanitize text to prevent injection attacks
        const cleanMsg = sanitizeText(message.trim());
        if (!cleanMsg) {
          throw new Error('Message content cannot be blank');
        }

        // Persistent save (never trust client sender ID, use socket.user._id)
        const chatMsg = await RareChatMessage.create({
          request: requestId,
          sender: user._id,
          senderType: isUserAdmin ? 'admin' : 'customer',
          messageType: 'text',
          message: cleanMsg,
          readBy: [user._id],
          receivedBy: [user._id],
        });

        const populatedMsg = await RareChatMessage.findById(chatMsg._id).populate(
          'sender',
          'name profileImage'
        );

        // Emit saved message
        io.to(`rare-request:${requestId}`).emit('rare_chat:message', populatedMsg);

        if (callback) {
          callback({ success: true, data: populatedMsg });
        }
      } catch (err) {
        if (callback) {
          callback({ success: false, message: err.message });
        }
      }
    });

    socket.on('disconnect', () => {
      messageTimestamps.delete(socket.id);
      console.log(`🔌 Client disconnected: ${user.name}`);
    });
  });

  return io;
};

export const getIO = () => {
  if (!io) {
    throw new Error('Socket.io has not been initialized');
  }
  return io;
};
