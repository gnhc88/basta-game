const { GoogleGenerativeAI } = require('@google/generative-ai');

let genAI = null;

function initAI() {
  if (process.env.GEMINI_API_KEY) {
    genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY);
  }
}

async function validateAnswers(letter, categories, answers, players) {
  if (!genAI) return null; // fallback to manual validation if no API key

  // Build list of all answers to validate
  const toValidate = [];
  players.forEach(player => {
    categories.forEach(category => {
      const answer = (answers[player.id]?.[category] || '').trim();
      if (answer) {
        toValidate.push({ playerId: player.id, category, answer });
      }
    });
  });

  if (toValidate.length === 0) return {};

  const prompt = `Eres un juez del juego Basta (Scattergories en español).
La letra de esta ronda es: "${letter}"

Valida cada respuesta. Una respuesta es VÁLIDA si:
1. Empieza con la letra "${letter}" (ignora artículos como "el", "la", "un", "una")
2. Es un ejemplo real y válido de la categoría indicada

Responde ÚNICAMENTE con un JSON array, sin texto adicional, con este formato exacto:
[{"playerId":"...","category":"...","answer":"...","valid":true,"reason":"..."}]

Respuestas a validar:
${JSON.stringify(toValidate, null, 2)}`;

  try {
    const model = genAI.getGenerativeModel({ model: 'gemini-1.5-flash' });
    const result = await model.generateContent(prompt);
    const text = result.response.text().trim();

    // Extract JSON from response
    const jsonMatch = text.match(/\[[\s\S]*\]/);
    if (!jsonMatch) return null;

    const validated = JSON.parse(jsonMatch[0]);

    // Build validation map: { playerId: { category: { valid, reason } } }
    const validationMap = {};
    validated.forEach(({ playerId, category, valid, reason }) => {
      if (!validationMap[playerId]) validationMap[playerId] = {};
      validationMap[playerId][category] = { valid, reason };
    });

    return validationMap;
  } catch (err) {
    console.error('AI validation error:', err.message);
    return null;
  }
}

module.exports = { initAI, validateAnswers };
