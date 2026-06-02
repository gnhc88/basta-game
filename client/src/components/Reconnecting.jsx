import { useEffect, useState } from 'react';
import { useSocket } from '../context/SocketContext';
import { getSession, clearSession } from '../App';

export default function Reconnecting({ onReconnected, onFailed }) {
  const { socket } = useSocket();
  const [status, setStatus] = useState('Reconectando...');

  useEffect(() => {
    if (!socket) return;
    const session = getSession();
    if (!session) { onFailed(); return; }

    const { name, roomCode } = session;

    const timeout = setTimeout(() => {
      setStatus('No se pudo reconectar');
      setTimeout(onFailed, 1500);
    }, 6000);

    socket.emit('rejoin_room', { name, roomCode });

    socket.on('room_joined', ({ roomCode, playerId, isHost }) => {
      clearTimeout(timeout);
      onReconnected({ roomCode, playerId, isHost });
    });

    socket.on('round_start', (rd) => {
      clearTimeout(timeout);
      const { roomCode: rc, playerId: pid, isHost: ih } = getSession() || {};
      onReconnected({ roomCode: rc, playerId: pid, isHost: ih, roundData: rd });
    });

    socket.on('round_end', (red) => {
      clearTimeout(timeout);
      const { roomCode: rc, playerId: pid, isHost: ih } = getSession() || {};
      onReconnected({ roomCode: rc, playerId: pid, isHost: ih, roundEndData: red });
    });

    socket.on('rejoin_failed', ({ msg }) => {
      clearTimeout(timeout);
      setStatus(msg);
      setTimeout(onFailed, 1500);
    });

    return () => {
      clearTimeout(timeout);
      socket.off('room_joined');
      socket.off('round_start');
      socket.off('round_end');
      socket.off('rejoin_failed');
    };
  }, [socket]);

  return (
    <div className="min-h-screen flex flex-col items-center justify-center gap-4">
      <div className="text-6xl animate-spin">🎲</div>
      <p className="font-game text-3xl text-yellow-400">{status}</p>
      <p className="text-white/40 text-sm">Volviendo a tu partida...</p>
      <button onClick={onFailed} className="mt-4 text-white/30 hover:text-white text-sm transition">
        Salir de la partida
      </button>
    </div>
  );
}
