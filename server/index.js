const express = require('express');
const http = require('http');
const { Server } = require('socket.io');
const cors = require('cors');
const { createRoom, pickRandomLetter, pickCategoryList, scoreRound, CATEGORY_LISTS } = require('./gameLogic');
const { initAI, validateAnswers } = require('./aiValidation');

initAI();

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

function broadcastPublicRooms() {
  const publicRooms = Object.values(rooms)
    .filter(r => r.status === 'lobby' && r.players.length < 8 && r.public)
    .map(r => ({
      code: r.code,
      host: r.players[0]?.name || '?',
      players: r.players.length,
      maxRounds: r.maxRounds,
      timeLimit: r.timeLimit,
    }));
  io.emit('public_rooms', publicRooms);
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
  socket.on('create_room', ({ name, maxRounds, timeLimit, isPublic }) => {
    if (typeof name !== 'string' || !name.trim() || name.length > 30) return;
    if (maxRounds && (typeof maxRounds !== 'number' || maxRounds < 1 || maxRounds > 10)) return;
    if (timeLimit && (typeof timeLimit !== 'number' || timeLimit < 10 || timeLimit > 300)) return;
    const room = createRoom(socket.id, name.trim(), new Set(Object.keys(rooms)));
    if (maxRounds) room.maxRounds = maxRounds;
    if (timeLimit) room.timeLimit = timeLimit;
    room.public = !!isPublic;

    rooms[room.code] = room;
    playerRoom[socket.id] = room.code;

    socket.join(room.code);
    socket.emit('room_created', { roomCode: room.code, playerId: socket.id });
    broadcast(room.code, 'room_update', getRoomState(room));
    broadcastPublicRooms();
  });

  socket.on('join_room', ({ name, roomCode }) => {
    if (typeof name !== 'string' || !name.trim() || name.length > 30) return socket.emit('error', { msg: 'Nombre inválido' });
    if (typeof roomCode !== 'string' || !roomCode.trim()) return socket.emit('error', { msg: 'Código inválido' });
    const room = rooms[roomCode.trim().toUpperCase()];
    if (!room) return socket.emit('error', { msg: 'Sala no encontrada' });
    if (room.status !== 'lobby') return socket.emit('error', { msg: 'La partida ya comenzó' });
    if (room.players.length >= 8) return socket.emit('error', { msg: 'Sala llena' });

    room.players.push({ id: socket.id, name: name.trim(), score: 0, ready: false });
    playerRoom[socket.id] = roomCode;

    socket.join(roomCode);
    socket.emit('room_joined', { roomCode, playerId: socket.id });
    broadcast(roomCode, 'room_update', getRoomState(room));
    broadcastPublicRooms();
  });

  // Return list of open public rooms
  socket.on('get_public_rooms', () => {
    const publicRooms = Object.values(rooms)
      .filter(r => r.status === 'lobby' && r.players.length < 8 && r.public)
      .map(r => ({
        code: r.code,
        host: r.players[0]?.name || '?',
        players: r.players.length,
        maxRounds: r.maxRounds,
        timeLimit: r.timeLimit,
      }));
    socket.emit('public_rooms', publicRooms);
  });

  // Request current room state (e.g., when Lobby mounts after joining)
  socket.on('get_room_state', () => {
    const roomCode = playerRoom[socket.id];
    const room = rooms[roomCode];
    if (room) socket.emit('room_update', getRoomState(room));
  });

  // Reconnect after page refresh
  socket.on('rejoin_room', ({ name, roomCode }) => {
    const room = rooms[roomCode];
    if (!room) return socket.emit('rejoin_failed', { msg: 'La sala ya no existe' });

    // Check if player with same name exists (replace their socket)
    const existing = room.players.find(p => p.name === name);
    if (existing) {
      // Update socket ID and clear disconnected flag
      const oldId = existing.id;
      existing.id = socket.id;
      existing.disconnected = false;
      if (room.hostId === oldId) room.hostId = socket.id;
      if (room.answers[oldId]) { room.answers[socket.id] = room.answers[oldId]; delete room.answers[oldId]; }
      if (room.roundScores[oldId]) { room.roundScores[socket.id] = room.roundScores[oldId]; delete room.roundScores[oldId]; }
      delete playerRoom[oldId];
    } else {
      if (room.status !== 'lobby') return socket.emit('rejoin_failed', { msg: 'La partida ya empezó' });
      room.players.push({ id: socket.id, name, score: 0, ready: false });
    }

    playerRoom[socket.id] = roomCode;
    socket.join(roomCode);

    const isHost = room.hostId === socket.id;
    socket.emit('room_joined', { roomCode, playerId: socket.id, isHost, rejoined: true });
    socket.emit('room_update', getRoomState(room));

    // If game is in progress, send current round state
    if (room.status === 'playing') {
      socket.emit('round_start', {
        round: room.round,
        letter: room.currentLetter,
        categories: room.categories,
        listNumber: room.currentListNumber,
        timerEnd: room.timerEnd,
        maxRounds: room.maxRounds,
      });
    } else if (room.status === 'reviewing') {
      socket.emit('round_end', {
        answers: room.answers,
        roundScores: room.roundScores,
        players: room.players,
        categories: room.categories,
        letter: room.currentLetter,
        listNumber: room.currentListNumber,
        isLastRound: room.round >= room.maxRounds,
      });
    }

    broadcast(roomCode, 'room_update', getRoomState(room));
  });

  socket.on('start_game', () => {
    const roomCode = playerRoom[socket.id];
    const room = rooms[roomCode];
    if (!room || room.hostId !== socket.id || room.status !== 'lobby') return;
    if (room.players.length < 2) return socket.emit('error', { msg: 'Necesitas al menos 2 jugadores' });
    startRound(room);
  });

  socket.on('submit_answers', ({ answers }) => {
    const roomCode = playerRoom[socket.id];
    const room = rooms[roomCode];
    // Accept answers until scoring starts (covers late submissions from slow clients)
    if (!room || room._scoring) return;

    room.answers[socket.id] = answers;

    const allSubmitted = room.players.filter(p => !p.disconnected).every(p => room.answers[p.id]);
    if (allSubmitted && !room._ending) endRound(room, true);
  });

  socket.on('call_basta', ({ answers }) => {
    const roomCode = playerRoom[socket.id];
    const room = rooms[roomCode];
    if (!room || room.status !== 'playing') return;
    if (room.calledBasta) return; // alguien ya llamó basta

    room.answers[socket.id] = answers;
    room.calledBasta = socket.id;

    const caller = room.players.find(p => p.id === socket.id);
    broadcast(roomCode, 'basta_called', { playerName: caller?.name });

    // Give others 5s to submit, then end immediately (no extra grace needed)
    setTimeout(() => {
      if (rooms[roomCode]?.status === 'playing') endRound(room, true);
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
        // Remove answer and recalculate — rollback then re-score
        if (room.answers[challenge.targetPlayerId]) {
          room.answers[challenge.targetPlayerId][challenge.category] = '';
        }
        room.players.forEach(p => { p.score -= (room.roundScores[p.id] || 0); });
        scoreRound(room); // already applies new scores internally
      }
      broadcast(roomCode, 'challenge_resolved', { key, accepted, players: room.players, roundScores: room.roundScores });
    }
  });

  socket.on('next_round', () => {
    const roomCode = playerRoom[socket.id];
    const room = rooms[roomCode];
    if (!room || room.hostId !== socket.id || room.status !== 'reviewing') return;

    if (room.round >= room.maxRounds) {
      room.status = 'finished';
      broadcast(roomCode, 'game_over', { players: room.players });
      // Cleanup room after players have time to see results
      setTimeout(() => {
        if (rooms[roomCode]) {
          rooms[roomCode].players.forEach(p => delete playerRoom[p.id]);
          delete rooms[roomCode];
        }
      }, 60000);
    } else {
      startRound(room);
    }
  });

  socket.on('disconnect', () => {
    const roomCode = playerRoom[socket.id];
    if (!roomCode) return;
    const room = rooms[roomCode];
    if (!room) return;

    delete playerRoom[socket.id];

    const player = room.players.find(p => p.id === socket.id);

    // During active game: keep player in room so they can rejoin
    if (player && room.status !== 'lobby') {
      player.disconnected = true;

      if (room.hostId === socket.id) {
        const next = room.players.find(p => !p.disconnected);
        if (next) room.hostId = next.id;
      }

      // Auto-remove after 2 minutes if they never reconnect
      setTimeout(() => {
        const r = rooms[roomCode];
        if (!r) return;
        const stale = r.players.find(p => p.name === player.name && p.disconnected);
        if (stale) {
          r.players = r.players.filter(p => p !== stale);
          if (r.players.length === 0) { delete rooms[roomCode]; return; }
          broadcast(roomCode, 'room_update', getRoomState(r));
          broadcastPublicRooms();
        }
      }, 120000);

      // If all remaining connected players submitted, end the round
      if (room.status === 'playing' && !room._ending) {
        const connected = room.players.filter(p => !p.disconnected);
        if (connected.length > 0 && connected.every(p => room.answers[p.id])) {
          endRound(room, true);
          return;
        }
      }

      broadcast(roomCode, 'player_left', { playerId: socket.id });
      broadcast(roomCode, 'room_update', getRoomState(room));
      broadcastPublicRooms();
      return;
    }

    // Lobby: remove immediately
    room.players = room.players.filter(p => p.id !== socket.id);

    if (room.players.length === 0) { delete rooms[roomCode]; return; }
    if (room.hostId === socket.id) room.hostId = room.players[0].id;

    broadcast(roomCode, 'player_left', { playerId: socket.id });
    broadcast(roomCode, 'room_update', getRoomState(room));
    broadcastPublicRooms();
  });
});

function startRound(room) {
  // Remove players who disconnected and never came back
  room.players = room.players.filter(p => !p.disconnected);
  room.round += 1;
  room.status = 'playing';
  room._ending = false;
  room._scoring = false;
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
    const r = rooms[room.code];
    if (!r || r.status !== 'playing' || r._ending) return;
    endRound(room, false);
  }, room.timeLimit * 1000);
}

async function endRound(room, immediate = false) {
  if (room._ending) return;
  room._ending = true;
  if (room._timer) clearTimeout(room._timer);

  if (!immediate) {
    // Notify clients time is up, then wait 2s for last-second submissions
    broadcast(room.code, 'time_up', {});
    await new Promise(resolve => setTimeout(resolve, 2000));
  }

  room.status = 'reviewing';

  // Notify clients that AI is validating
  broadcast(room.code, 'ai_validating', {});

  // AI validation (falls back to letter-check if no API key or error)
  const aiValidation = await validateAnswers(
    room.currentLetter,
    room.categories,
    room.answers,
    room.players
  );

  // Apply AI validation: invalidate answers that AI rejected
  if (aiValidation) {
    room.players.forEach(player => {
      room.categories.forEach(cat => {
        const result = aiValidation[player.id]?.[cat];
        if (result && !result.valid && room.answers[player.id]?.[cat]) {
          room.answers[player.id][cat + '__invalid'] = room.answers[player.id][cat];
          room.answers[player.id][cat] = '';
        }
      });
    });
  }

  // Lock answers — no more submissions accepted from this point
  room._scoring = true;
  const scores = scoreRound(room);

  // Restore original answers for display (mark as invalid)
  if (aiValidation) {
    room.players.forEach(player => {
      room.categories.forEach(cat => {
        if (room.answers[player.id]?.[cat + '__invalid']) {
          room.answers[player.id][cat] = room.answers[player.id][cat + '__invalid'];
          delete room.answers[player.id][cat + '__invalid'];
        }
      });
    });
  }

  broadcast(room.code, 'round_end', {
    answers: room.answers,
    roundScores: scores,
    players: room.players,
    categories: room.categories,
    letter: room.currentLetter,
    listNumber: room.currentListNumber,
    isLastRound: room.round >= room.maxRounds,
    aiValidation,
  });
  broadcast(room.code, 'room_update', getRoomState(room));
}

app.get('/health', (_, res) => res.json({ ok: true, rooms: Object.keys(rooms).length, v: 2 }));

// Auto-cleanup lobby rooms inactive for more than 2 hours
setInterval(() => {
  const cutoff = Date.now() - 2 * 60 * 60 * 1000;
  Object.values(rooms).forEach(room => {
    if (room.status === 'lobby' && room.createdAt < cutoff) {
      room.players.forEach(p => delete playerRoom[p.id]);
      delete rooms[room.code];
    }
  });
  broadcastPublicRooms();
}, 10 * 60 * 1000);

app.delete('/rooms/:code', (req, res) => {
  const secret = req.headers['x-admin-secret'];
  if (!process.env.ADMIN_SECRET || secret !== process.env.ADMIN_SECRET)
    return res.status(403).json({ error: 'forbidden' });
  const room = rooms[req.params.code.toUpperCase()];
  if (!room) return res.status(404).json({ error: 'not found' });
  room.players.forEach(p => delete playerRoom[p.id]);
  delete rooms[req.params.code.toUpperCase()];
  broadcastPublicRooms();
  res.json({ ok: true });
});

const PORT = process.env.PORT || 3001;
server.listen(PORT, () => console.log(`Server running on port ${PORT}`));
