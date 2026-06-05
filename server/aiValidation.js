const Groq = require('groq-sdk');

let groq = null;

function initAI() {
  if (process.env.GROQ_API_KEY) {
    groq = new Groq({ apiKey: process.env.GROQ_API_KEY });
  }
}

async function validateAnswers(letter, categories, answers, players) {
  if (!groq) return null;

  // Use numeric indices to avoid Groq corrupting long socket IDs
  const indexToId = {};
  const toValidate = [];
  players.forEach((player, idx) => {
    indexToId[idx] = player.id;
    categories.forEach(category => {
      const answer = (answers[player.id]?.[category] || '').trim();
      if (answer) {
        toValidate.push({ playerIndex: idx, category, answer });
      }
    });
  });

  if (toValidate.length === 0) return {};

  const prompt = `Eres un juez del juego Basta, el juego de las letras.
La letra de esta ronda es: "${letter}"

Valida cada respuesta. Una respuesta es VÁLIDA si:
1. Empieza con la letra "${letter}" (ignora artículos como "el", "la", "un", "una")
2. Es un ejemplo real y válido de la categoría indicada
3. No es solo la letra suelta ni una palabra inventada o sin sentido

Responde ÚNICAMENTE con un JSON array sin texto adicional:
[{"playerIndex":0,"category":"...","answer":"...","valid":true,"reason":"..."}]

Respuestas a validar:
${JSON.stringify(toValidate, null, 2)}`;

  try {
    const completion = await groq.chat.completions.create({
      model: 'llama-3.1-8b-instant',
      messages: [{ role: 'user', content: prompt }],
      temperature: 0,
    });

    const text = completion.choices[0]?.message?.content?.trim() || '';

    const start = text.indexOf('[');
    const end = text.lastIndexOf(']');
    if (start === -1 || end === -1 || end <= start) {
      console.error('AI validation: no JSON array in response:', text.substring(0, 200));
      return null;
    }

    const validated = JSON.parse(text.slice(start, end + 1));

    const validationMap = {};
    validated.forEach(({ playerIndex, category, valid, reason }) => {
      const playerId = indexToId[playerIndex];
      if (!playerId) return;
      if (!validationMap[playerId]) validationMap[playerId] = {};
      validationMap[playerId][category] = { valid: !!valid, reason };
    });

    return validationMap;
  } catch (err) {
    console.error('AI validation error:', err.message);
    return null;
  }
}

module.exports = { initAI, validateAnswers };
