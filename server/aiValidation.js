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
  const letterRejected = {};   // answers that fail the letter check — skip AI
  const toValidate = [];
  players.forEach((player, idx) => {
    indexToId[idx] = player.id;
    categories.forEach(category => {
      const answer = (answers[player.id]?.[category] || '').trim();
      if (!answer) return;
      // Strip leading articles before letter check
      const stripped = answer.replace(/^(el|la|los|las|un|una|unos|unas)\s+/i, '');
      if (stripped.charAt(0).toUpperCase() !== letter) {
        if (!letterRejected[player.id]) letterRejected[player.id] = {};
        letterRejected[player.id][category] = { valid: false, reason: `No comienza con ${letter}` };
      } else {
        toValidate.push({ playerIndex: idx, category, answer });
      }
    });
  });

  if (toValidate.length === 0) {
    // Merge letter rejections into an empty AI result
    return Object.keys(letterRejected).length ? letterRejected : {};
  }

  const prompt = `Eres un juez del juego Basta, el juego de las letras.
La letra de esta ronda es: "${letter}". TODAS las respuestas a continuación YA fueron verificadas y comienzan con "${letter}".

Tu única tarea: verificar si cada respuesta es un ejemplo REAL y VÁLIDO de la categoría indicada.
NO debes rechazar ninguna respuesta por razones de letra — eso ya fue validado.

Una respuesta es INVÁLIDA solo si:
- Es una palabra inventada o sin sentido
- No corresponde a la categoría indicada
- Es solo la letra suelta

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

    // Merge letter rejections (authoritative) with AI category results
    Object.entries(letterRejected).forEach(([pid, cats]) => {
      if (!validationMap[pid]) validationMap[pid] = {};
      Object.assign(validationMap[pid], cats);
    });

    return validationMap;
  } catch (err) {
    console.error('AI validation error:', err.message);
    return null;
  }
}

module.exports = { initAI, validateAnswers };
