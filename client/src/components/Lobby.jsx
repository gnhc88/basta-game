import { useEffect, useState, useRef } from 'react';
import { useSocket } from '../context/SocketContext';
import { Copy, Check, Users } from 'lucide-react';
import { playCountdown } from '../utils/sounds';

const COLORS = ['bg-red-400','bg-blue-400','bg-green-400','bg-yellow-400','bg-purple-400','bg-pink-400','bg-orange-400','bg-teal-400'];

export default function Lobby({ roomCode, playerId, isHost, onGameStart }) {
  const { socket } = useSocket();
  const [room, setRoom] = useState(null);
  const [copied, setCopied] = useState(false);
  const [starting, setStarting] = useState(false);
  const [error, setError] = useState('');
  const [messages, setMessages] = useState([]);
  const [chatInput, setChatInput] = useState('');
  const [countdown, setCountdown] = useState(null);
  const chatContainerRef = useRef(null);

  useEffect(() => {
    if (!socket) return;

    const onRoundStart = (data) => onGameStart(data);
    const onError = ({ msg }) => setError(msg);
    const onChatMessage = (msg) => setMessages(prev => [...prev.slice(-99), msg]);
    const onGameStarting = () => setCountdown(3);

    socket.on('room_update', setRoom);
    socket.on('round_start', onRoundStart);
    socket.on('error', onError);
    socket.on('chat_message', onChatMessage);
    socket.on('game_starting', onGameStarting);

    socket.emit('get_room_state');

    return () => {
      socket.off('room_update', setRoom);
      socket.off('round_start', onRoundStart);
      socket.off('error', onError);
      socket.off('chat_message', onChatMessage);
      socket.off('game_starting', onGameStarting);
    };
  }, [socket]);

  useEffect(() => {
    if (chatContainerRef.current) {
      chatContainerRef.current.scrollTop = chatContainerRef.current.scrollHeight;
    }
  }, [messages]);

  useEffect(() => {
    if (countdown === null) return;
    playCountdown(countdown);
    if (countdown <= 0) return;
    const t = setTimeout(() => setCountdown(c => c - 1), 1000);
    return () => clearTimeout(t);
  }, [countdown]);

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

  const sendMessage = () => {
    const text = chatInput.trim();
    if (!text) return;
    socket.emit('chat_message', { text });
    setChatInput('');
  };

  if (!room) return (
    <div className="min-h-screen flex items-center justify-center">
      <div className="text-white/50 text-xl animate-pulse">Conectando...</div>
    </div>
  );

  return (
    <div className="min-h-screen flex flex-col items-center justify-center px-4 py-8">
      {/* Countdown overlay */}
      {countdown !== null && (
        <div className="fixed inset-0 z-50 flex flex-col items-center justify-center" style={{ background: 'rgba(0,0,0,0.88)' }}>
          {countdown > 0 ? (
            <div key={countdown} className="font-game animate-dice-pop" style={{ fontSize: '14rem', lineHeight: 1, color: '#FFD700', textShadow: '0 0 60px rgba(255,200,0,0.6)' }}>
              {countdown}
            </div>
          ) : (
            <div key="go" className="font-game animate-dice-pop" style={{ fontSize: '6rem', color: '#ff4444', textShadow: '0 0 40px rgba(255,0,0,0.5)' }}>
              ¡BASTA!
            </div>
          )}
          <p className="font-game text-2xl text-white/50 mt-6">
            {countdown > 0 ? '¡Prepárense!' : '¡Empieza la ronda!'}
          </p>
        </div>
      )}
      <h1 className="font-game text-6xl text-yellow-400 mb-2 drop-shadow">BASTA!</h1>
      <p className="text-blue-200 mb-6">Sala de espera</p>

      <div className="bg-white/10 backdrop-blur-sm rounded-3xl p-6 w-full max-w-lg shadow-2xl border border-white/20">
        {/* Room code */}
        <div className="text-center mb-6">
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
        <div className="mb-5">
          <div className="flex items-center gap-2 mb-3">
            <Users size={16} className="text-blue-200" />
            <span className="text-blue-200 text-sm font-bold uppercase tracking-wider">
              Jugadores ({room.players?.length || 0}/8)
            </span>
          </div>
          <div className="grid grid-cols-2 gap-2">
            {room.players?.map((p, i) => (
              <div key={p.id} className={`flex items-center gap-2 rounded-xl px-3 py-2 ${p.disconnected ? 'bg-white/5 opacity-50' : 'bg-white/10'}`}>
                <div className={`w-8 h-8 rounded-full ${COLORS[i % COLORS.length]} flex items-center justify-center text-white font-black text-sm shrink-0`}>
                  {p.name[0].toUpperCase()}
                </div>
                <span className="font-semibold truncate">{p.name}</span>
                {p.disconnected && <span className="ml-auto text-white/30 text-xs">desconectado</span>}
                {!p.disconnected && p.id === room.hostId && (
                  <span className="ml-auto text-yellow-400 text-xs">★</span>
                )}
              </div>
            ))}
          </div>
        </div>

        {/* Game settings */}
        <div className="flex gap-3 mb-5 text-center">
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

        {/* Chat */}
        <div className="mb-5 rounded-2xl overflow-hidden border border-white/10" style={{ background: 'rgba(0,0,0,0.2)' }}>
          <div
            ref={chatContainerRef}
            className="px-3 py-2.5 space-y-1.5 overflow-y-auto"
            style={{ height: '130px', overscrollBehavior: 'contain' }}
          >
            {messages.length === 0 ? (
              <p className="text-white/20 text-xs text-center pt-6">Saluda a tus compañeros 👋</p>
            ) : (
              messages.map((msg, i) => {
                const pIdx = room.players?.findIndex(p => p.id === msg.playerId) ?? 0;
                const color = COLORS[Math.max(0, pIdx) % COLORS.length];
                return (
                  <div key={i} className="flex items-start gap-2">
                    <div className={`w-5 h-5 rounded-full ${color} flex items-center justify-center text-white font-black text-xs shrink-0 mt-0.5`}>
                      {msg.name[0].toUpperCase()}
                    </div>
                    <p className="text-xs leading-snug break-all">
                      <span className="text-white/60 font-bold">{msg.name} </span>
                      <span className="text-white/90">{msg.text}</span>
                    </p>
                  </div>
                );
              })
            )}
          </div>
          <div className="border-t border-white/10 flex items-center gap-2 px-3 py-2">
            <input
              type="text"
              value={chatInput}
              onChange={e => setChatInput(e.target.value)}
              onKeyDown={e => e.key === 'Enter' && sendMessage()}
              maxLength={100}
              placeholder="Escribe un mensaje..."
              className="flex-1 bg-transparent text-white text-sm placeholder-white/25 focus:outline-none"
            />
            <button
              onClick={sendMessage}
              disabled={!chatInput.trim()}
              className="text-yellow-400 hover:text-yellow-300 disabled:opacity-30 transition font-black text-xs uppercase tracking-wide"
            >
              Enviar
            </button>
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
