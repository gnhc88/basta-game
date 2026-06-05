import { useEffect, useState } from 'react';
import LetterDice from './LetterDice';
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

    const onRoomJoined = ({ roomCode, playerId, isHost }) => {
      clearTimeout(timeout);
      onReconnected({ roomCode, playerId, isHost });
    };
    const onRoundStart = (rd) => {
      clearTimeout(timeout);
      const { roomCode: rc, playerId: pid, isHost: ih } = getSession() || {};
      onReconnected({ roomCode: rc, playerId: pid, isHost: ih, roundData: rd });
    };
    const onRoundEnd = (red) => {
      clearTimeout(timeout);
      const { roomCode: rc, playerId: pid, isHost: ih } = getSession() || {};
      onReconnected({ roomCode: rc, playerId: pid, isHost: ih, roundEndData: red });
    };
    const onRejoinFailed = ({ msg }) => {
      clearTimeout(timeout);
      setStatus(msg);
      setTimeout(onFailed, 1500);
    };

    socket.on('room_joined', onRoomJoined);
    socket.on('round_start', onRoundStart);
    socket.on('round_end', onRoundEnd);
    socket.on('rejoin_failed', onRejoinFailed);

    return () => {
      clearTimeout(timeout);
      socket.off('room_joined', onRoomJoined);
      socket.off('round_start', onRoundStart);
      socket.off('round_end', onRoundEnd);
      socket.off('rejoin_failed', onRejoinFailed);
    };
  }, [socket]);

  return (
    <div className="min-h-screen flex flex-col items-center justify-center gap-4">
      <LetterDice size={72} className="animate-spin" />
      <p className="font-game text-3xl text-yellow-400">{status}</p>
      <p className="text-white/40 text-sm">Volviendo a tu partida...</p>
      <button onClick={onFailed} className="mt-4 text-white/30 hover:text-white text-sm transition">
        Salir de la partida
      </button>
    </div>
  );
}
