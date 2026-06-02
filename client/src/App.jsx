import { useState } from 'react';
import { SocketProvider } from './context/SocketContext';
import Home from './components/Home';
import Lobby from './components/Lobby';
import Game from './components/Game';
import Results from './components/Results';
import GameOver from './components/GameOver';

// screens: home | lobby | game | results | gameover
export default function App() {
  const [screen, setScreen] = useState('home');
  const [gameInfo, setGameInfo] = useState(null);   // { roomCode, playerId, isHost }
  const [roundData, setRoundData] = useState(null);
  const [roundEndData, setRoundEndData] = useState(null);
  const [finalPlayers, setFinalPlayers] = useState(null);

  const handleEnterGame = (info) => {
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
    setScreen('home');
    setGameInfo(null);
    setRoundData(null);
    setRoundEndData(null);
    setFinalPlayers(null);
  };

  return (
    <SocketProvider>
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
    </SocketProvider>
  );
}
