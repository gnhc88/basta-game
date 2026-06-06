import { useEffect, useState } from 'react';
import { useSocket } from '../context/SocketContext';
import { Copy, Check, Users } from 'lucide-react';

const COLORS = ['bg-red-400','bg-blue-400','bg-green-400','bg-yellow-400','bg-purple-400','bg-pink-400','bg-orange-400','bg-teal-400'];

export default function Lobby({ roomCode, playerId, isHost, onGameStart }) {
  const { socket } = useSocket();
  const [room, setRoom] = useState(null);
  const [copied, setCopied] = useState(false);
  const [starting, setStarting] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    if (!socket) return;

    const onRoundStart = (data) => onGameStart(data);
    const onError = ({ msg }) => setError(msg);
    socket.on('room_update', setRoom);
    socket.on('round_start', onRoundStart);
    socket.on('error', onError);

    // Request current room state in case we missed the broadcast
    socket.emit('get_room_state');

    return () => {
      socket.off('room_update', setRoom);
      socket.off('round_start', onRoundStart);
      socket.off('error', onError);
    };
  }, [socket]);

  const copyCode = () => {
    navigator.clipboard.writeText(roomCode);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const startGame = () => {
    if (starting) return;
    setError('');
    setStarting(true);
    socket.emit('start_game');
  };

  if (!room) return (
    <div className="min-h-screen flex items-center justify-center">
      <div className="text-white/50 text-xl animate-pulse">Conectando...</div>
    </div>
  );

  return (
    <div className="min-h-screen flex flex-col items-center justify-center px-4 py-8">
      <h1 className="font-game text-6xl text-yellow-400 mb-2 drop-shadow">BASTA!</h1>
      <p className="text-blue-200 mb-8">Sala de espera</p>

      <div className="bg-white/10 backdrop-blur-sm rounded-3xl p-8 w-full max-w-lg shadow-2xl border border-white/20">
        {/* Room code */}
        <div className="text-center mb-8">
          <p className="text-blue-200 text-sm font-bold uppercase tracking-widest mb-2">Código de sala</p>
          <div className="flex items-center justify-center gap-3">
            <span className="font-game text-5xl text-yellow-400 tracking-widest">{roomCode}</span>
            <button
              onClick={copyCode}
              className="bg-white/10 hover:bg-white/20 p-3 rounded-xl transition"
              title="Copiar código"
            >
              {copied ? <Check size={20} className="text-green-400" /> : <Copy size={20} />}
            </button>
          </div>
          <p className="text-white/40 text-xs mt-2">Comparte este código con tus amigos</p>
        </div>

        {/* Players list */}
        <div className="mb-6">
          <div className="flex items-center gap-2 mb-3">
            <Users size={16} className="text-blue-200" />
            <span className="text-blue-200 text-sm font-bold uppercase tracking-wider">
              Jugadores ({room.players?.length || 0}/8)
            </span>
          </div>
          <div className="grid grid-cols-2 gap-2">
            {room.players?.map((p, i) => (
              <div key={p.id} className="flex items-center gap-2 bg-white/10 rounded-xl px-3 py-2">
                <div className={`w-8 h-8 rounded-full ${COLORS[i % COLORS.length]} flex items-center justify-center text-white font-black text-sm`}>
                  {p.name[0].toUpperCase()}
                </div>
                <span className="font-semibold truncate">{p.name}</span>
                {p.id === room.hostId && (
                  <span className="ml-auto text-yellow-400 text-xs">★</span>
                )}
              </div>
            ))}
          </div>
        </div>

        {/* Game settings */}
        <div className="flex gap-4 mb-6 text-center">
          <div className="flex-1 bg-white/5 rounded-xl py-3">
            <p className="text-yellow-400 font-black text-2xl">{room.maxRounds}</p>
            <p className="text-white/60 text-xs uppercase tracking-wide">Rondas</p>
          </div>
          <div className="flex-1 bg-white/5 rounded-xl py-3">
            <p className="text-yellow-400 font-black text-2xl">{room.timeLimit}s</p>
            <p className="text-white/60 text-xs uppercase tracking-wide">Por ronda</p>
          </div>
          <div className="flex-1 bg-white/5 rounded-xl py-3">
            <p className="text-yellow-400 font-black text-2xl">{room.categories?.length}</p>
            <p className="text-white/60 text-xs uppercase tracking-wide">Categorías</p>
          </div>
        </div>

        {error && (
          <div className="mb-4 bg-red-500/20 border border-red-400/50 rounded-xl px-4 py-3 text-red-300 text-sm font-semibold text-center">
            {error}
          </div>
        )}

        {isHost ? (
          <button
            onClick={startGame}
            disabled={(room.players?.length || 0) < 2 || starting}
            className="w-full bg-yellow-400 hover:bg-yellow-300 disabled:opacity-40 disabled:cursor-not-allowed text-gray-900 font-black text-xl py-4 rounded-2xl transition shadow-lg active:scale-95"
          >
            {starting ? 'Iniciando...' : (room.players?.length || 0) < 2 ? 'Esperando jugadores...' : '¡Empezar juego!'}
          </button>
        ) : (
          <div className="w-full bg-white/10 rounded-2xl py-4 text-center text-white/60 font-semibold">
            Esperando al anfitrión...
          </div>
        )}
      </div>
    </div>
  );
}
