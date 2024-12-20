const express = require('express');
const http = require('http');
const { Server } = require('socket.io');
const cors = require('cors');
const { v4: uuidv4 } = require('uuid');
const { log } = require('console');

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
  socket.on('create-group', (group) => {
    if (!group || !group.username) {
      socket.emit('create-group', {
        status: 400,
        message: 'Invalid group data. username is required.'
      });
      return;
    }

    const groupId = uuidv4();
    socket.join(groupId);
    users[socket.id] = {
      username: group.username
    };
    socket.emit('create-group', {
      status: 201,
      message: groupId
    });
  });

  socket.on('join-group', (group) => {
    if (!group || !group.username || !group.id) {
      socket.emit('join-group', {
        status: 400,
        message: 'Invalid group data. Name and group are required.'
      });
      return;
    }

    socket.join(group.id);
    console.log(`User ${group.username} joined group`);

    // Notify other members in the group
    socket.to(group.id).emit('notification', `User ${group.username} has joined`);

    users[socket.id] = {
      username: group.username
    };
    // Acknowledge the user who joined the group
    socket.emit('join-group', {
      status: 200,
      message: 'Join success.',
      data: {
        id: socket.id,
        name: group.username
      }
    });
    socket.to(group.id).emit('member-join');

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
      username: user.username,
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
      console.log(`User ${user.username} left group`);

      // Notify the group
      socket.to(group).emit('notification', `User ${user.username} has left the group.`);
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

  socket.on('offer-group', (group) => {
    console.log('offer-group', group);

    socket.to(group.id).emit('offer-group', group.data);
  });

  // Khi nhận answer từ client
  socket.on('answer-group', (group) => {
    socket.to(group.id).emit('answer-group', group.data); // Phát answer đến các client group
  });

  // Khi nhận ICE Candidate
  socket.on('candidate-group', (group) => {
    socket.to(group.id).emit('candidate-group', group.data); // Phát candidate đến các client group 
  });

  socket.on('offer', (data) => {
    socket.broadcast.emit('offer', data);
  });

  // Khi nhận answer từ client
  socket.on('answer', (data) => {
    socket.broadcast.emit('answer', data); // Phát answer đến các client khác
  });

  // Khi nhận ICE Candidate
  socket.on('candidate', (data) => {
    socket.broadcast.emit('candidate', data); // Phát candidate đến các client khác
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
