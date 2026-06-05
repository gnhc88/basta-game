const LETTERS = 'ABCDEFGHIJLMNOPRSTV'.split('');

// Multiple category lists like the real game
const CATEGORY_LISTS = {
  1: [
    'Nombres de hombre',
    'Ciudades',
    'Cosas frías',
    'Cosas que NO quieres en tu casa',
    'Equipos deportivos profesionales',
    'Insectos',
    'Cosas que hay en una cafetería',
    'Cosas que mezclas',
    'Series de TV',
    'Cosas que hay en el océano',
    'Tipos de clima',
    'Comidas que los niños odian',
  ],
  2: [
    'Nombres de mujer',
    'Países',
    'Cosas que son suaves',
    'Animales salvajes',
    'Películas de acción',
    'Frutas o verduras',
    'Cosas que encuentras en la playa',
    'Marcas de ropa',
    'Instrumentos musicales',
    'Profesiones',
    'Cosas que vuelan',
    'Cosas que huelen mal',
  ],
  3: [
    'Apellidos famosos',
    'Capitales del mundo',
    'Cosas redondas',
    'Deportes',
    'Personajes de caricatura',
    'Cosas en un supermercado',
    'Tipos de baile',
    'Animales del mar',
    'Canciones populares',
    'Cosas que brillan',
    'Marcas de autos',
    'Cosas que haces antes de dormir',
  ],
};

function generateRoomCode(existingCodes = new Set()) {
  let code;
  do {
    code = Math.random().toString(36).substring(2, 7).toUpperCase();
  } while (existingCodes.has(code));
  return code;
}

function pickRandomLetter(usedLetters = []) {
  const available = LETTERS.filter(l => !usedLetters.includes(l));
  if (available.length === 0) return LETTERS[Math.floor(Math.random() * LETTERS.length)];
  return available[Math.floor(Math.random() * available.length)];
}

function pickCategoryList(usedLists = []) {
  const listNumbers = Object.keys(CATEGORY_LISTS).map(Number);
  const available = listNumbers.filter(n => !usedLists.includes(n));
  if (available.length === 0) return listNumbers[Math.floor(Math.random() * listNumbers.length)];
  return available[Math.floor(Math.random() * available.length)];
}

function createRoom(hostId, hostName, existingCodes = new Set()) {
  return {
    code: generateRoomCode(existingCodes),
    hostId,
    players: [{ id: hostId, name: hostName, score: 0, ready: false }],
    status: 'lobby',
    round: 0,
    maxRounds: 3,
    timeLimit: 60,
    categories: [...CATEGORY_LISTS[1]],
    currentListNumber: 1,
    usedLists: [1],
    currentLetter: null,
    usedLetters: [],
    answers: {},
    roundScores: {},
    challenges: {},        // { category: { challenged: true, votes: { playerId: bool } } }
    calledBasta: null,
    timerEnd: null,
  };
}

function scoreRound(room) {
  const { answers, categories, players } = room;
  const scores = {};

  players.forEach(p => { scores[p.id] = 0; });

  categories.forEach(cat => {
    const catAnswers = {};
    players.forEach(p => {
      const ans = (answers[p.id]?.[cat] || '').trim().toLowerCase();
      if (ans) catAnswers[p.id] = ans;
    });

    const uniqueValues = new Set(Object.values(catAnswers));

    players.forEach(p => {
      const ans = catAnswers[p.id];
      if (!ans) return;
      // unique answer = 10pts, shared answer = 5pts
      const count = Object.values(catAnswers).filter(a => a === ans).length;
      scores[p.id] += count === 1 ? 10 : 5;
    });
  });

  // Apply scores
  players.forEach(p => {
    p.score += scores[p.id];
    room.roundScores[p.id] = scores[p.id];
  });

  return scores;
}

module.exports = { createRoom, pickRandomLetter, pickCategoryList, scoreRound, CATEGORY_LISTS };
