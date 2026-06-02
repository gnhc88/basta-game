const express = require('express');
const http = require('http');
const { Server } = require('socket.io');
const cors = require('cors');
const { createRoom, pickRandomLetter, pickCategoryList, scoreRound, CATEGORY_LISTS } = require('./gameLogic');

const app = express();
app.use(cors());
app.use(express.json());

const server = http.createServer(app);
const ALLOWED_ORIGINS = process.env.ALLOWED_ORIGINS
  ? process.env.ALLOWED_ORIGINS.split(',')
  : '*';

const io = new Server(server, {
  cors: { origin: ALLOWED_ORIGINS, methods: ['GET', 'POST'] }
});

const rooms = {};
const playerRoom = {};

function broadcast(roomCode, event, data) {
  io.to(roomCode).emit(event, data);
}

function getRoomState(room) {
  return {
    code: room.code,
    hostId: room.hostId,
    players: room.players,
    status: room.status,
    round: room.round,
    maxRounds: room.maxRounds,
    timeLimit: room.timeLimit,
    categories: room.categories,
    currentLetter: room.currentLetter,
    roundScores: room.roundScores,
    calledBasta: room.calledBasta,
    timerEnd: room.timerEnd,
    challenges: room.challenges,
  };
}

io.on('connection', (socket) => {
  socket.on('create_room', ({ name, maxRounds, timeLimit }) => {
    const room = createRoom(socket.id, name);
    if (maxRounds) room.maxRounds = maxRounds;
    if (timeLimit) room.timeLimit = timeLimit;

    rooms[room.code] = room;
    playerRoom[socket.id] = room.code;

    socket.join(room.code);
    socket.emit('room_created', { roomCode: room.code, playerId: socket.id });
    broadcast(room.code, 'room_update', getRoomState(room));
  });

  socket.on('join_room', ({ name, roomCode }) => {
    const room = rooms[roomCode];
    if (!room) return socket.emit('error', { msg: 'Sala no encontrada' });
    if (room.status !== 'lobby') return socket.emit('error', { msg: 'La partida ya comenzó' });
    if (room.players.length >= 8) return socket.emit('error', { msg: 'Sala llena' });

    room.players.push({ id: socket.id, name, score: 0, ready: false });
    playerRoom[socket.id] = roomCode;

    socket.join(roomCode);
    socket.emit('room_joined', { roomCode, playerId: socket.id });
    broadcast(roomCode, 'room_update', getRoomState(room));
  });

  // Request current room state (e.g., when Lobby mounts after joining)
  socket.on('get_room_state', () => {
    const roomCode = playerRoom[socket.id];
    const room = rooms[roomCode];
    if (room) socket.emit('room_update', getRoomState(room));
  });

  socket.on('start_game', () => {
    const roomCode = playerRoom[socket.id];
    const room = rooms[roomCode];
    if (!room || room.hostId !== socket.id) return;
    if (room.players.length < 2) return socket.emit('error', { msg: 'Necesitas al menos 2 jugadores' });
    startRound(room);
  });

  socket.on('submit_answers', ({ answers }) => {
    const roomCode = playerRoom[socket.id];
    const room = rooms[roomCode];
    if (!room || room.status !== 'playing') return;

    room.answers[socket.id] = answers;

    const allSubmitted = room.players.every(p => room.answers[p.id]);
    if (allSubmitted) endRound(room);
  });

  socket.on('call_basta', ({ answers }) => {
    const roomCode = playerRoom[socket.id];
    const room = rooms[roomCode];
    if (!room || room.status !== 'playing') return;

    room.answers[socket.id] = answers;
    room.calledBasta = socket.id;

    const caller = room.players.find(p => p.id === socket.id);
    broadcast(roomCode, 'basta_called', { playerName: caller?.name });

    // Give others 5s to submit
    setTimeout(() => {
      if (rooms[roomCode]?.status === 'playing') endRound(room);
    }, 5000);
  });

  // --- Challenge an answer ---
  socket.on('challenge_answer', ({ targetPlayerId, category }) => {
    const roomCode = playerRoom[socket.id];
    const room = rooms[roomCode];
    if (!room || room.status !== 'reviewing') return;

    const key = `${targetPlayerId}::${category}`;
    if (!room.challenges[key]) {
      room.challenges[key] = { challengerId: socket.id, targetPlayerId, category, votes: {}, resolved: false };
    }

    broadcast(roomCode, 'challenge_started', {
      key,
      challengerId: socket.id,
      challengerName: room.players.find(p => p.id === socket.id)?.name,
      targetPlayerId,
      targetName: room.players.find(p => p.id === targetPlayerId)?.name,
      category,
      answer: room.answers[targetPlayerId]?.[category],
    });
  });

  // --- Vote on a challenge ---
  socket.on('vote_challenge', ({ key, accept }) => {
    const roomCode = playerRoom[socket.id];
    const room = rooms[roomCode];
    if (!room) return;

    const challenge = room.challenges[key];
    if (!challenge || challenge.resolved) return;

    challenge.votes[socket.id] = accept;

    const totalVoters = room.players.length - 1; // exclude challenged player
    const votesIn = Object.keys(challenge.votes).length;
    const acceptVotes = Object.values(challenge.votes).filter(Boolean).length;
    const rejectVotes = votesIn - acceptVotes;

    broadcast(roomCode, 'challenge_vote_update', { key, votes: challenge.votes });

    if (votesIn >= totalVoters || rejectVotes > totalVoters / 2 || acceptVotes > totalVoters / 2) {
      challenge.resolved = true;
      const accepted = acceptVotes >= rejectVotes;
      if (!accepted) {
        // Remove answer points — reset that answer
        if (room.answers[challenge.targetPlayerId]) {
          room.answers[challenge.targetPlayerId][challenge.category] = '';
        }
        // Recalculate scores
        room.players.forEach(p => { p.score -= (room.roundScores[p.id] || 0); });
        const newScores = scoreRound(room);
        room.players.forEach(p => { p.score += newScores[p.id] || 0; });
      }
      broadcast(roomCode, 'challenge_resolved', { key, accepted, players: room.players });
    }
  });

  socket.on('next_round', () => {
    const roomCode = playerRoom[socket.id];
    const room = rooms[roomCode];
    if (!room || room.hostId !== socket.id) return;

    if (room.round >= room.maxRounds) {
      room.status = 'finished';
      broadcast(roomCode, 'game_over', { players: room.players });
    } else {
      startRound(room);
    }
  });

  socket.on('disconnect', () => {
    const roomCode = playerRoom[socket.id];
    if (!roomCode) return;
    const room = rooms[roomCode];
    if (!room) return;

    room.players = room.players.filter(p => p.id !== socket.id);
    delete playerRoom[socket.id];

    if (room.players.length === 0) { delete rooms[roomCode]; return; }
    if (room.hostId === socket.id) room.hostId = room.players[0].id;

    broadcast(roomCode, 'player_left', { playerId: socket.id });
    broadcast(roomCode, 'room_update', getRoomState(room));
  });
});

function startRound(room) {
  room.round += 1;
  room.status = 'playing';
  room.answers = {};
  room.roundScores = {};
  room.challenges = {};
  room.calledBasta = null;

  // Pick new letter and category list
  room.currentLetter = pickRandomLetter(room.usedLetters);
  room.usedLetters.push(room.currentLetter);

  const listNum = pickCategoryList(room.usedLists);
  room.usedLists.push(listNum);
  room.currentListNumber = listNum;
  room.categories = [...CATEGORY_LISTS[listNum]];

  room.timerEnd = Date.now() + room.timeLimit * 1000;

  broadcast(room.code, 'round_start', {
    round: room.round,
    letter: room.currentLetter,
    categories: room.categories,
    listNumber: listNum,
    timerEnd: room.timerEnd,
    maxRounds: room.maxRounds,
  });
  broadcast(room.code, 'room_update', getRoomState(room));

  room._timer = setTimeout(() => {
    if (rooms[room.code]?.status === 'playing') endRound(room);
  }, room.timeLimit * 1000);
}

function endRound(room) {
  if (room._timer) clearTimeout(room._timer);
  room.status = 'reviewing';

  const scores = scoreRound(room);

  broadcast(room.code, 'round_end', {
    answers: room.answers,
    roundScores: scores,
    players: room.players,
    categories: room.categories,
    letter: room.currentLetter,
    listNumber: room.currentListNumber,
    isLastRound: room.round >= room.maxRounds,
  });
  broadcast(room.code, 'room_update', getRoomState(room));
}

app.get('/health', (_, res) => res.json({ ok: true }));

const PORT = process.env.PORT || 3001;
server.listen(PORT, () => console.log(`Server running on port ${PORT}`));
