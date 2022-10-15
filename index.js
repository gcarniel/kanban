const express = require('express');
const app = express();
const cors = require('cors');
const http = require('http').Server(app);
const PORT = 4000;
require('dotenv').config();

const { Novu } = require('@novu/node');
const novu = new Novu(process.env.NOVU_KEY);

const socketIO = require('socket.io')(http, {
  cors: {
    origin: '*',
  },
});

app.use(cors());
app.use(express.urlencoded({ extended: true }));
app.use(express.json());

const fetchID = () => Math.random().toString(36).substring(2, 10);

let tasks = {
  pending: {
    title: 'pending',
    items: [
      {
        id: fetchID(),
        title: 'Send the Figma file to Dima',
        comments: [],
      },
    ],
  },
  ongoing: {
    title: 'ongoing',
    items: [
      {
        id: fetchID(),
        title: 'Review GitHub issues',
        comments: [
          {
            name: 'David',
            text: 'Ensure you review before merging',
            id: fetchID(),
          },
        ],
      },
    ],
  },
  completed: {
    title: 'completed',
    items: [
      {
        id: fetchID(),
        title: 'Create technical contents',
        comments: [
          {
            name: 'Dima',
            text: 'Make sure you check the requirements',
            id: fetchID(),
          },
        ],
      },
    ],
  },
};

const sendNotification = async (user, id) => {
  try {
    const result = await novu.trigger(process.env.NOVU_TRIGGER_ID, {
      to: {
        subscriberId: process.env.NOVU_IDENTIFIER,
      },
      payload: {
        userId: user,
        id,
      },
    });
  } catch (err) {
    console.error('Error >>>>', { err });
  }
};

socketIO.on('connection', (socket) => {
  console.log(`⚡: ${socket.id} user just connected!`);

  socket.on('taskDragged', (data) => {
    const { source, destination } = data;
    const itemMoved = {
      ...tasks[source.droppableId].items[source.index],
    };

    tasks[source.droppableId].items.splice(source.index, 1);

    tasks[destination.droppableId].items.splice(
      destination.index,
      0,
      itemMoved,
    );

    socket.emit('tasks', tasks);
  });

  socket.on('createTask', (data) => {
    const id = fetchID();
    const newTask = {
      id,
      title: data.task,
      comments: [],
    };

    tasks['pending'].items.push(newTask);
    socket.emit('tasks', tasks);
    sendNotification(data.userId, id);
  });

  socket.on('addComment', (data) => {
    const { category, userId, comment, id } = data;
    const taskItems = tasks[category].items;
    const index = taskItems.findIndex((item) => item.id === id);

    if (index !== -1) {
      taskItems[index].comments.push({
        name: userId,
        text: comment,
        id: fetchID(),
      });
      socket.emit('comments', taskItems[index].comments);
    }
  });

  socket.on('fetchComments', (data) => {
    const { category, id } = data;
    const taskItems = tasks[category].items;

    const index = taskItems.findIndex((item) => item.id === id);

    if (index !== -1) {
      socket.emit('comments', taskItems[index].comments);
    }
  });

  socket.on('disconnect', () => {
    socket.disconnect();
    console.log('🔥: A user disconnected');
  });
});

app.get('/api', (req, res) => {
  res.json(tasks);
});

http.listen(PORT, () => {
  console.log(`server is running on port: ${PORT}`);
});
