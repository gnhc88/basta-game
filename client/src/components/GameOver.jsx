import LetterDice from './LetterDice';
const MEDALS = ['🥇','🥈','🥉'];
const COLORS = [
  'from-yellow-400 to-orange-400',
  'from-gray-300 to-gray-400',
  'from-orange-400 to-orange-600',
  'from-blue-400 to-blue-600',
  'from-purple-400 to-purple-600',
];

import { useEffect } from 'react';
import { clearSession } from '../App';

export default function GameOver({ players, onRestart }) {
  useEffect(() => { clearSession(); }, []);
  const sorted = [...players].sort((a, b) => b.score - a.score);
  const winner = sorted[0];

  return (
    <div className="min-h-screen flex flex-col items-center justify-center px-4 py-8">
      {/* Confetti-like decoration */}
      <div className="absolute inset-0 overflow-hidden pointer-events-none">
        {['🎉','🎊','⭐','🏆','🎯'].map((e, i) => (
          <div key={i} className="absolute text-4xl opacity-20 animate-bounce"
            style={{
              top: `${10 + i * 18}%`,
              left: `${5 + i * 20}%`,
              animationDelay: `${i * 0.3}s`,
            }}>
            {e}
          </div>
        ))}
      </div>

      <div className="text-center mb-6 relative z-10">
        <div className="text-6xl mb-3">🏆</div>
        <div className="basta-logo text-6xl mb-2">
          ¡BASTA!
        </div>
        <p className="font-game text-2xl text-yellow-300">Juego terminado</p>
        <p className="text-white/70 text-lg mt-2">
          ¡Felicidades, <span className="text-yellow-300 font-black">{winner.name}</span>!
        </p>
      </div>

      <div className="card p-6 w-full max-w-md shadow-2xl relative z-10 mb-6">
        <h3 className="text-center text-yellow-300 text-xs uppercase tracking-widest font-black mb-5">
          Clasificación final
        </h3>
        {sorted.map((p, i) => (
          <div key={p.id} className={`flex items-center gap-4 mb-3 p-3 rounded-2xl ${
            i === 0 ? 'bg-yellow-400/20 border-2 border-yellow-400/50' : 'bg-white/5'
          }`}>
            <span className="text-2xl w-8 text-center">{MEDALS[i] || `${i+1}`}</span>
            <div className={`w-10 h-10 rounded-full bg-gradient-to-br ${COLORS[i % COLORS.length]} flex items-center justify-center text-gray-900 font-black text-lg shrink-0`}>
              {p.name[0].toUpperCase()}
            </div>
            <span className={`font-bold flex-1 text-lg ${i === 0 ? 'text-yellow-200' : ''}`}>{p.name}</span>
            <div className="text-right">
              <span className={`font-black text-3xl ${i === 0 ? 'text-yellow-400' : 'text-white'}`}>{p.score}</span>
              <span className="text-white/40 text-xs block">pts</span>
            </div>
          </div>
        ))}
      </div>

      <button onClick={onRestart} className="btn-primary text-xl px-12 py-4 relative z-10">
        <LetterDice size={22} className="inline-block mr-2 align-middle -mt-0.5" />Jugar de nuevo
      </button>
    </div>
  );
}
