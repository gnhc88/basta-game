import { useState, useEffect, useRef } from 'react';
import { SocketProvider, useSocket } from './context/SocketContext';
import Home from './components/Home';
import Lobby from './components/Lobby';
import Game from './components/Game';
import Results from './components/Results';
import GameOver from './components/GameOver';
import Reconnecting from './components/Reconnecting';

const SESSION_KEY = 'basta_session';

export function saveSession(data) {
  sessionStorage.setItem(SESSION_KEY, JSON.stringify(data));
}
export function clearSession() {
  sessionStorage.removeItem(SESSION_KEY);
}
export function getSession() {
  try { return JSON.parse(sessionStorage.getItem(SESSION_KEY)); } catch { return null; }
}

// screens: home | lobby | game | results | gameover | reconnecting
function AppInner() {
  const { socket } = useSocket();
  const [screen, setScreen] = useState(() => getSession() ? 'reconnecting' : 'home');
  const [gameInfo, setGameInfo] = useState(null);
  const [roundData, setRoundData] = useState(null);
  const [roundEndData, setRoundEndData] = useState(null);
  const [finalPlayers, setFinalPlayers] = useState(null);

  const hadDisconnectRef = useRef(false);

  // Auto-rejoin when socket reconnects mid-game (e.g. after network drop)
  useEffect(() => {
    if (!socket) return;
    const onDisconnect = () => { hadDisconnectRef.current = true; };
    const onConnect = () => {
      if (!hadDisconnectRef.current) return; // skip initial connect
      hadDisconnectRef.current = false;
      if (screen === 'home' || screen === 'reconnecting') return;
      if (!getSession()) return;
      setScreen('reconnecting');
    };
    socket.on('disconnect', onDisconnect);
    socket.on('connect', onConnect);
    return () => {
      socket.off('disconnect', onDisconnect);
      socket.off('connect', onConnect);
    };
  }, [socket, screen]);

  const handleEnterGame = (info) => {
    saveSession({ name: info.name || '', roomCode: info.roomCode, isHost: info.isHost });
    setGameInfo(info);
    setScreen('lobby');
  };

  const handleGameStart = (data) => {
    setRoundData(data);
    setScreen('game');
  };

  const handleRoundEnd = (data) => {
    setRoundEndData(data);
    setScreen('results');
  };

  const handleNextRound = (data) => {
    setRoundData(data);
    setScreen('game');
  };

  const handleGameOver = ({ players }) => {
    setFinalPlayers(players);
    setScreen('gameover');
  };

  const handleRestart = () => {
    clearSession();
    setScreen('home');
    setGameInfo(null);
    setRoundData(null);
    setRoundEndData(null);
    setFinalPlayers(null);
  };

  const handleReconnected = ({ roomCode, playerId, isHost, roundData: rd, roundEndData: red }) => {
    setGameInfo({ roomCode, playerId, isHost });
    if (rd) { setRoundData(rd); setScreen('game'); }
    else if (red) { setRoundEndData(red); setScreen('results'); }
    else setScreen('lobby');
  };

  const handleReconnectFailed = () => {
    clearSession();
    setScreen('home');
  };

  return (
    <>
      {screen === 'reconnecting' && (
        <Reconnecting
          onReconnected={handleReconnected}
          onFailed={handleReconnectFailed}
        />
      )}
      {screen === 'home' && (
        <Home onEnterGame={handleEnterGame} />
      )}
      {screen === 'lobby' && gameInfo && (
        <Lobby
          roomCode={gameInfo.roomCode}
          playerId={gameInfo.playerId}
          isHost={gameInfo.isHost}
          onGameStart={handleGameStart}
        />
      )}
      {screen === 'game' && roundData && gameInfo && (
        <Game
          roomCode={gameInfo.roomCode}
          playerId={gameInfo.playerId}
          isHost={gameInfo.isHost}
          initialRoundData={roundData}
          onRoundEnd={handleRoundEnd}
        />
      )}
      {screen === 'results' && roundEndData && gameInfo && (
        <Results
          roundEndData={roundEndData}
          playerId={gameInfo.playerId}
          isHost={gameInfo.isHost}
          onNextRound={handleNextRound}
          onGameOver={handleGameOver}
        />
      )}
      {screen === 'gameover' && finalPlayers && (
        <GameOver players={finalPlayers} onRestart={handleRestart} />
      )}
    </>
  );
}

export default function App() {
  return (
    <SocketProvider>
      <AppInner />
    </SocketProvider>
  );
}
