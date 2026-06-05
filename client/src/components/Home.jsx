import { useState, useEffect, useRef } from 'react';
import { useSocket } from '../context/SocketContext';
import LetterDice from './LetterDice';

export default function Home({ onEnterGame }) {
  const { socket } = useSocket();
  const [name, setName] = useState('');
  const [roomCode, setRoomCode] = useState('');
  const [mode, setMode] = useState(null);
  const [maxRounds, setMaxRounds] = useState(3);
  const [timeLimit, setTimeLimit] = useState(60);
  const [isPublic, setIsPublic] = useState(true);
  const [error, setError] = useState('');
  const [publicRooms, setPublicRooms] = useState([]);
  const nameRef = useRef(name);

  useEffect(() => { nameRef.current = name; }, [name]);

  useEffect(() => {
    if (!socket) return;
    const onRoomCreated = ({ roomCode, playerId }) => onEnterGame({ roomCode, playerId, isHost: true, name: nameRef.current });
    const onRoomJoined = ({ roomCode, playerId }) => onEnterGame({ roomCode, playerId, isHost: false, name: nameRef.current });
    const onError = ({ msg }) => setError(msg);
    socket.on('room_created', onRoomCreated);
    socket.on('room_joined', onRoomJoined);
    socket.on('error', onError);
    socket.on('public_rooms', setPublicRooms);

    socket.emit('get_public_rooms');

    return () => {
      socket.off('room_created', onRoomCreated);
      socket.off('room_joined', onRoomJoined);
      socket.off('error', onError);
      socket.off('public_rooms', setPublicRooms);
    };
  }, [socket]);

  const handleCreate = () => {
    if (!name.trim()) return setError('Escribe tu nombre');
    setError('');
    socket.emit('create_room', { name: name.trim(), maxRounds, timeLimit, isPublic });
  };

  const handleJoin = () => {
    if (!name.trim()) return setError('Escribe tu nombre');
    if (!roomCode.trim()) return setError('Escribe el código de sala');
    setError('');
    socket.emit('join_room', { name: name.trim(), roomCode: roomCode.trim().toUpperCase() });
  };

  const handleJoinPublic = (code) => {
    if (!name.trim()) return setError('Escribe tu nombre primero');
    setError('');
    socket.emit('join_room', { name: name.trim(), roomCode: code });
  };

  return (
    <div className="min-h-screen flex flex-col items-center justify-center px-4 py-8">
      {/* Logo */}
      <div className="text-center mb-6 relative z-10">
        <div className="basta-logo text-[80px] leading-none mb-1">
          <span>B</span>ASTA<span>!</span>
        </div>
        <div className="font-game text-xl text-yellow-300 tracking-widest opacity-90">El juego de las letras</div>
      </div>

      {/* Name input — always visible */}
      <div className="w-full max-w-sm mb-4 relative z-10">
        <input
          type="text"
          value={name}
          onChange={e => setName(e.target.value)}
          maxLength={20}
          placeholder="¿Cómo te llamas?"
          className="w-full bg-black/30 border-2 border-white/20 rounded-xl px-4 py-3 text-white placeholder-white/30 text-lg font-bold focus:outline-none focus:border-yellow-400 transition"
        />
      </div>

      {/* Main card */}
      <div className="card p-6 w-full max-w-sm shadow-2xl relative z-10 mb-4">
        {!mode && (
          <div className="space-y-3">
            <button onClick={() => setMode('create')} className="btn-primary w-full text-xl py-4">
              <LetterDice size={22} className="inline-block mr-2 align-middle -mt-0.5" />Crear partida
            </button>
            <button onClick={() => setMode('join')} className="btn-basta w-full text-xl py-4">
              🔑 Unirse con código
            </button>
          </div>
        )}

        {mode === 'create' && (
          <div>
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

            {/* Public toggle */}
            <div className="flex items-center justify-between bg-black/20 rounded-xl px-4 py-3 mb-4">
              <div>
                <p className="font-bold text-sm">Sala pública</p>
                <p className="text-white/40 text-xs">Aparece en la lista de salas</p>
              </div>
              <button
                onClick={() => setIsPublic(p => !p)}
                className={`w-12 h-6 rounded-full transition-all ${isPublic ? 'bg-yellow-400' : 'bg-white/20'}`}
              >
                <div className={`w-5 h-5 bg-white rounded-full shadow transition-all mx-0.5 ${isPublic ? 'translate-x-6' : 'translate-x-0'}`} />
              </button>
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
          <div>
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

      {/* Public rooms list */}
      {!mode && (
        <div className="w-full max-w-sm relative z-10">
          <div className="flex items-center gap-2 mb-3">
            <span className="text-yellow-300 text-xs font-black uppercase tracking-widest">Salas abiertas</span>
            <span className="bg-yellow-400/20 text-yellow-300 text-xs font-black px-2 py-0.5 rounded-full">
              {publicRooms.length}
            </span>
          </div>

          {publicRooms.length === 0 ? (
            <div className="card py-6 text-center text-white/30 text-sm">
              No hay salas abiertas — ¡crea una!
            </div>
          ) : (
            <div className="space-y-2">
              {publicRooms.map(room => (
                <div key={room.code} className="card px-4 py-3 flex items-center gap-3">
                  <div className="flex-1">
                    <p className="font-black text-white">{room.host}</p>
                    <p className="text-white/40 text-xs">
                      {room.players}/8 jugadores · {room.maxRounds} rondas · {room.timeLimit}s
                    </p>
                  </div>
                  <div className="text-right mr-2">
                    <span className="font-game text-yellow-400 text-lg tracking-wider">{room.code}</span>
                  </div>
                  <button
                    onClick={() => handleJoinPublic(room.code)}
                    className="btn-primary px-4 py-2 text-sm rounded-xl"
                  >
                    Unirse
                  </button>
                </div>
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  );
}
