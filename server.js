const express = require('express');
const http = require('http');
const { Server } = require('socket.io');
const cors = require('cors');

const app = express();
const server = http.createServer(app);
const io = new Server(server, {
  cors: {
    origin: '*', // Allow all origins (or specify your frontend origin)
    methods: ['GET', 'POST']
  }
});

const users = {};

// Middleware
app.use(cors());

// Basic homepage
app.get('/', (req, res) => {
  res.send('<h1>Group Chat Server is Running</h1>');
});

// Handle socket connections
io.on('connection', (socket) => {
  socket.on('join-group', (group) => {
    if (!group || !group.name || !group.group) {
      socket.emit('join-group', {
        status: 400,
        message: 'Invalid group data. Name and group are required.'
      });
      return;
    }

    socket.join(group.group);
    console.log(`User ${group.name} joined group: ${group.group}`);

    // Notify other members in the group
    socket.to(group.group).emit('notification', `User ${group.name} has joined`);

    users[socket.id] = {
      name: group.name
    };
    // Acknowledge the user who joined the group
    socket.emit('join-group', {
      status: 200,
      message: 'Join success.',
      data: {
        id: socket.id,
        name: group.name
      }
    });
  });

  // Handle sending messages to a group
  socket.on('group-message', ({ group, message }) => {
    if (!group) {
      socket.emit('group-message', {
        status: 400,
        message: 'Invalid group data.Group is required.'
      });
      return;
    }

    const user = users[socket.id];

    // Broadcast the message to the group
    io.to(group).emit('message', {
      name: user.name,
      message
    });
    socket.emit('group-message', {
      status: 200,
      message: 'Send message success.'
    });
  });

  // Handle leaving a group
  socket.on('leave-group', (group) => {
    if (!group) {
      socket.emit('leave-group', {
        status: 400,
        message: 'Invalid group data. Group is required.'
      });
      return;
    }
    if (users[socket.id]) {
      const user = users[socket.id];
      socket.leave(group);
      console.log(`User ${user.name} left group: ${group}`);

      // Notify the group
      socket.to(group).emit('notification', `User ${user.name} has left the group.`);
      socket.emit('leave-group', {
        status: 200,
        message: 'Leave group success.'
      });
      return;
    }
    socket.emit('leave-group', {
      status: 404,
      message: 'User not found.',
    });
  });

  // Handle disconnection
  socket.on('disconnect', () => {
    console.log(`User disconnected: ${socket.id}`);
  });
});

const PORT = 3333;
server.listen(PORT, () => {
  console.log(`Server running on http://localhost:${PORT}`);
});
