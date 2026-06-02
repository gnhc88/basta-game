import { useState, useEffect } from 'react';
import { useSocket } from '../context/SocketContext';

export default function Home({ onEnterGame }) {
  const { socket } = useSocket();
  const [name, setName] = useState('');
  const [roomCode, setRoomCode] = useState('');
  const [mode, setMode] = useState(null);
  const [maxRounds, setMaxRounds] = useState(3);
  const [timeLimit, setTimeLimit] = useState(60);
  const [error, setError] = useState('');

  useEffect(() => {
    if (!socket) return;
    socket.on('room_created', ({ roomCode, playerId }) => onEnterGame({ roomCode, playerId, isHost: true }));
    socket.on('room_joined', ({ roomCode, playerId }) => onEnterGame({ roomCode, playerId, isHost: false }));
    socket.on('error', ({ msg }) => setError(msg));
    return () => { socket.off('room_created'); socket.off('room_joined'); socket.off('error'); };
  }, [socket]);

  const handleCreate = () => {
    if (!name.trim()) return setError('Escribe tu nombre');
    setError('');
    socket.emit('create_room', { name: name.trim(), maxRounds, timeLimit });
  };

  const handleJoin = () => {
    if (!name.trim()) return setError('Escribe tu nombre');
    if (!roomCode.trim()) return setError('Escribe el código de sala');
    setError('');
    socket.emit('join_room', { name: name.trim(), roomCode: roomCode.trim().toUpperCase() });
  };

  return (
    <div className="min-h-screen flex flex-col items-center justify-center px-4 py-8">
      {/* Silhouettes decoration */}
      <div className="absolute inset-0 overflow-hidden pointer-events-none opacity-10">
        <div className="absolute -left-10 top-1/4 text-[200px] select-none">🧍</div>
        <div className="absolute -right-10 top-1/3 text-[200px] select-none">🧍</div>
      </div>

      {/* Logo */}
      <div className="text-center mb-8 relative z-10">
        <div className="basta-logo text-[90px] leading-none mb-1">
          <span>B</span>ASTA<span>!</span>
        </div>
        <div className="font-game text-2xl text-yellow-300 tracking-widest opacity-90">Scattergories</div>
        <p className="text-white/60 text-sm mt-2 tracking-wide">¡El juego de las categorías!</p>
      </div>

      {/* Card */}
      <div className="card p-7 w-full max-w-sm shadow-2xl relative z-10">
        {/* Name */}
        <div className="mb-5">
          <label className="block text-xs font-black text-yellow-300 mb-2 uppercase tracking-widest">Tu nombre</label>
          <input
            type="text"
            value={name}
            onChange={e => setName(e.target.value)}
            maxLength={20}
            placeholder="¿Cómo te llamas?"
            className="w-full bg-black/30 border-2 border-white/20 rounded-xl px-4 py-3 text-white placeholder-white/30 text-lg font-bold focus:outline-none focus:border-yellow-400 transition"
          />
        </div>

        {!mode && (
          <div className="space-y-3 mt-4">
            <button onClick={() => setMode('create')} className="btn-primary w-full text-xl py-4">
              🎲 Crear partida
            </button>
            <button onClick={() => setMode('join')} className="btn-basta w-full text-xl py-4">
              🚀 Unirse a sala
            </button>
          </div>
        )}

        {mode === 'create' && (
          <div className="mt-2">
            <div className="grid grid-cols-2 gap-3 mb-4">
              <div>
                <label className="block text-xs font-black text-yellow-300 mb-1 uppercase tracking-wider">Rondas</label>
                <select value={maxRounds} onChange={e => setMaxRounds(Number(e.target.value))}
                  className="w-full bg-black/30 border-2 border-white/20 rounded-xl px-3 py-2.5 text-white focus:outline-none focus:border-yellow-400 font-bold">
                  {[2,3,4,5].map(n => <option key={n} value={n} className="text-gray-900">{n} rondas</option>)}
                </select>
              </div>
              <div>
                <label className="block text-xs font-black text-yellow-300 mb-1 uppercase tracking-wider">Tiempo</label>
                <select value={timeLimit} onChange={e => setTimeLimit(Number(e.target.value))}
                  className="w-full bg-black/30 border-2 border-white/20 rounded-xl px-3 py-2.5 text-white focus:outline-none focus:border-yellow-400 font-bold">
                  {[30,45,60,90,120].map(n => <option key={n} value={n} className="text-gray-900">{n}s</option>)}
                </select>
              </div>
            </div>
            <button onClick={handleCreate} className="btn-primary w-full text-xl py-4 mb-2">
              ¡Crear partida!
            </button>
            <button onClick={() => setMode(null)} className="w-full text-white/50 hover:text-white text-sm py-2 transition font-semibold">
              ← Volver
            </button>
          </div>
        )}

        {mode === 'join' && (
          <div className="mt-2">
            <div className="mb-4">
              <label className="block text-xs font-black text-yellow-300 mb-2 uppercase tracking-widest">Código de sala</label>
              <input
                type="text"
                value={roomCode}
                onChange={e => setRoomCode(e.target.value.toUpperCase())}
                maxLength={6}
                placeholder="ABC12"
                className="w-full bg-black/30 border-2 border-white/20 rounded-xl px-4 py-3 text-white placeholder-white/30 text-3xl font-black text-center tracking-[0.5em] focus:outline-none focus:border-red-400 transition"
              />
            </div>
            <button onClick={handleJoin} className="btn-basta w-full text-xl py-4 mb-2">
              ¡Unirse!
            </button>
            <button onClick={() => setMode(null)} className="w-full text-white/50 hover:text-white text-sm py-2 transition font-semibold">
              ← Volver
            </button>
          </div>
        )}

        {error && (
          <div className="mt-4 bg-black/30 border border-red-400/60 rounded-xl px-4 py-3 text-red-300 text-sm font-bold text-center">
            ⚠️ {error}
          </div>
        )}
      </div>

      <p className="mt-6 text-white/25 text-xs relative z-10">Basta! Scattergories · Web Edition</p>
    </div>
  );
}
