import { useEffect, useState } from 'react';
import { useSocket } from '../context/SocketContext';

const COLORS = ['bg-yellow-400','bg-gray-300','bg-orange-400','bg-blue-400','bg-purple-400','bg-pink-400','bg-green-400','bg-teal-400'];

export default function Results({ roundEndData, playerId, isHost, onNextRound, onGameOver }) {
  const { socket } = useSocket();
  const { answers, roundScores, players, categories, letter, listNumber, isLastRound, aiValidation } = roundEndData;
  const [challenges, setChallenges] = useState({});
  const [activeChallenge, setActiveChallenge] = useState(null);

  const sortedPlayers = [...players].sort((a, b) => b.score - a.score);

  useEffect(() => {
    if (!socket) return;
    socket.on('game_over', onGameOver);
    socket.on('round_start', onNextRound);
    socket.on('challenge_started', (data) => {
      setChallenges(prev => ({ ...prev, [data.key]: { ...data, votes: {} } }));
      setActiveChallenge(data.key);
    });
    socket.on('challenge_vote_update', ({ key, votes }) => {
      setChallenges(prev => ({ ...prev, [key]: { ...prev[key], votes } }));
    });
    socket.on('challenge_resolved', ({ key, accepted, players: updatedPlayers }) => {
      setChallenges(prev => ({ ...prev, [key]: { ...prev[key], resolved: true, accepted } }));
      setActiveChallenge(null);
    });
    return () => {
      socket.off('game_over');
      socket.off('round_start');
      socket.off('challenge_started');
      socket.off('challenge_vote_update');
      socket.off('challenge_resolved');
    };
  }, [socket]);

  const handleChallenge = (targetPlayerId, category) => {
    socket.emit('challenge_answer', { targetPlayerId, category });
  };

  const handleVote = (key, accept) => {
    socket.emit('vote_challenge', { key, accept });
  };

  const handleNext = () => socket.emit('next_round');

  return (
    <div className="min-h-screen flex flex-col px-3 py-6 max-w-2xl mx-auto w-full">
      {/* Header */}
      <div className="text-center mb-5">
        <div className="font-game text-5xl text-yellow-400 drop-shadow-lg">Resultados</div>
        <p className="text-white/50 text-sm mt-1">
          Letra <span className="font-game text-yellow-300 text-xl">{letter}</span>
          {listNumber && <span className="ml-2 text-white/30">· Lista {listNumber}</span>}
        </p>
      </div>

      {/* Active challenge modal */}
      {activeChallenge && challenges[activeChallenge] && !challenges[activeChallenge].resolved && (
        <div className="fixed inset-0 bg-black/70 flex items-center justify-center z-50 px-4">
          <div className="card p-6 w-full max-w-sm" style={{ background: 'rgba(30,0,0,0.95)', borderColor: 'rgba(255,100,0,0.5)' }}>
            <div className="text-center mb-4">
              <div className="text-3xl mb-2">⚔️</div>
              <h3 className="font-black text-lg text-orange-300">¡Respuesta retada!</h3>
              <p className="text-white/60 text-sm mt-1">
                {challenges[activeChallenge].challengerName} reta a {challenges[activeChallenge].targetName}
              </p>
            </div>
            <div className="bg-black/40 rounded-xl p-4 mb-4 text-center">
              <p className="text-white/50 text-xs uppercase tracking-wider">{challenges[activeChallenge].category}</p>
              <p className="text-white font-black text-2xl mt-1">"{challenges[activeChallenge].answer}"</p>
            </div>
            {challenges[activeChallenge].targetPlayerId !== playerId ? (
              <div className="flex gap-3">
                <button onClick={() => handleVote(activeChallenge, true)}
                  className="flex-1 bg-green-600 hover:bg-green-500 py-3 rounded-xl font-black transition">
                  ✓ Aceptar
                </button>
                <button onClick={() => handleVote(activeChallenge, false)}
                  className="flex-1 bg-red-700 hover:bg-red-600 py-3 rounded-xl font-black transition">
                  ✗ Rechazar
                </button>
              </div>
            ) : (
              <p className="text-center text-white/50">Esperando votos...</p>
            )}
            <p className="text-center text-white/30 text-xs mt-3">
              Votos: {Object.keys(challenges[activeChallenge].votes || {}).length} / {players.length - 1}
            </p>
          </div>
        </div>
      )}

      {/* Scoreboard */}
      <div className="card p-4 mb-4">
        <h3 className="text-yellow-300 text-xs uppercase tracking-widest font-black mb-3">Puntaje acumulado</h3>
        {sortedPlayers.map((p, i) => (
          <div key={p.id} className={`flex items-center gap-3 py-2 px-2 rounded-xl mb-1 ${i === 0 ? 'bg-yellow-400/15 border border-yellow-400/30' : ''}`}>
            <span className={`w-7 h-7 rounded-full ${COLORS[i % COLORS.length]} flex items-center justify-center text-gray-900 font-black text-sm shrink-0`}>
              {i + 1}
            </span>
            <span className="font-bold flex-1 truncate">{p.name}</span>
            {roundScores[p.id] > 0 && (
              <span className="text-green-400 text-sm font-bold">+{roundScores[p.id]}</span>
            )}
            <span className="font-black text-2xl text-yellow-400 w-12 text-right">{p.score}</span>
          </div>
        ))}
      </div>

      {/* Answers table */}
      <div className="card p-4 flex-1 overflow-hidden mb-4">
        <h3 className="text-yellow-300 text-xs uppercase tracking-widest font-black mb-3">Respuestas de la ronda</h3>
        <div className="overflow-auto" style={{ maxHeight: '280px' }}>
          <table className="w-full text-xs">
            <thead className="sticky top-0" style={{ background: 'rgba(0,0,0,0.5)' }}>
              <tr>
                <th className="text-left text-white/40 font-bold pb-2 pr-2 w-36">#  Categoría</th>
                {players.map(p => (
                  <th key={p.id} className="text-center text-white/40 font-bold pb-2 px-1"
                    style={{ maxWidth: 90, minWidth: 70 }}>
                    {p.name}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {categories.map((cat, idx) => (
                <tr key={cat} className="border-t border-white/10">
                  <td className="py-2 pr-2 text-white/60 font-semibold text-xs leading-tight">
                    <span className="text-yellow-400 font-black mr-1">{idx + 1}.</span>{cat}
                  </td>
                  {players.map((p) => {
                    const ans = (answers[p.id]?.[cat] || '').trim();
                    const aiResult = aiValidation?.[p.id]?.[cat];
                    const isValid = aiResult ? aiResult.valid : ans.toUpperCase().startsWith(letter);
                    const isUnique = isValid && players.filter(pl =>
                      (answers[pl.id]?.[cat] || '').trim().toLowerCase() === ans.toLowerCase()
                    ).length === 1;
                    const challenged = Object.values(challenges).find(
                      c => c.targetPlayerId === p.id && c.category === cat
                    );

                    return (
                      <td key={p.id} className="py-2 px-1 text-center">
                        {ans ? (
                          <div className="flex flex-col items-center gap-0.5">
                            {aiResult && (
                              <span className="text-white/30 text-xs" title={aiResult.reason}>
                                {aiResult.valid ? '🤖✓' : '🤖✗'}
                              </span>
                            )}
                            <span className={`px-2 py-0.5 rounded-lg text-xs font-bold ${
                              challenged?.resolved && !challenged?.accepted
                                ? 'bg-gray-500/30 text-gray-400 line-through'
                                : !isValid ? 'bg-red-500/30 text-red-300'
                                : isUnique ? 'bg-green-500/30 text-green-300'
                                : 'bg-yellow-500/20 text-yellow-300'
                            }`}>
                              {ans}
                            </span>
                            {/* Challenge button */}
                            {playerId !== p.id && isValid && !challenged && (
                              <button onClick={() => handleChallenge(p.id, cat)}
                                className="text-orange-400 hover:text-orange-300 text-xs leading-none transition"
                                title="Retar respuesta">
                                ⚔️
                              </button>
                            )}
                            {challenged && !challenged.resolved && (
                              <span className="text-orange-400 text-xs">¿?</span>
                            )}
                          </div>
                        ) : (
                          <span className="text-white/20">—</span>
                        )}
                      </td>
                    );
                  })}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        <div className="flex flex-wrap gap-3 mt-3 text-xs text-white/30 border-t border-white/10 pt-3">
          <span><span className="text-green-400 font-bold">Verde</span> = única +10pts</span>
          <span><span className="text-yellow-400 font-bold">Amarillo</span> = repetida +5pts</span>
          <span><span className="text-red-400 font-bold">Rojo</span> = inválida</span>
          <span><span className="text-orange-400">⚔️</span> = retar</span>
        </div>
      </div>

      {isHost ? (
        <button onClick={handleNext} className="btn-primary w-full text-xl py-4">
          {isLastRound ? '🏆 Ver ganador final' : '▶ Siguiente ronda'}
        </button>
      ) : (
        <div className="card py-4 text-center text-white/50 font-semibold">
          Esperando al anfitrión...
        </div>
      )}
    </div>
  );
}
