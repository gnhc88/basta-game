import { useEffect, useState, useRef } from 'react';
import { useSocket } from '../context/SocketContext';

function HourglassTimer({ timeLeft, timeLimit, color }) {
  const ratio = timeLimit > 0 ? Math.max(0, timeLeft) / timeLimit : 0;
  const cx = 28, topY = 8, neckY = 38, botY = 68, hw = 22;

  // Top sand: fills from neckY upward based on ratio
  const sandTopY = topY + (neckY - topY) * (1 - ratio);
  const sandTopHW = hw * (neckY - sandTopY) / (neckY - topY);

  // Bottom sand: fills from botY upward as time passes
  const sandBotY = botY - (botY - neckY) * (1 - ratio);
  const sandBotHW = hw * (sandBotY - neckY) / (botY - neckY);

  const topPts = ratio > 0.005
    ? `${cx - sandTopHW},${sandTopY} ${cx + sandTopHW},${sandTopY} ${cx},${neckY}`
    : null;
  const botPts = ratio < 0.995 && sandBotHW > 0.1
    ? `${cx - sandBotHW},${sandBotY} ${cx + sandBotHW},${sandBotY} ${cx + hw},${botY} ${cx - hw},${botY}`
    : null;

  return (
    <div className="flex flex-col items-center gap-1">
      <svg viewBox="0 0 56 78" width="44" height="61">
        {/* Glass outline */}
        <polygon points={`${cx-hw},${topY} ${cx+hw},${topY} ${cx},${neckY}`}
          fill="rgba(255,255,255,0.04)" stroke="rgba(255,255,255,0.3)" strokeWidth="1.5" strokeLinejoin="round"/>
        <polygon points={`${cx},${neckY} ${cx-hw},${botY} ${cx+hw},${botY}`}
          fill="rgba(255,255,255,0.04)" stroke="rgba(255,255,255,0.3)" strokeWidth="1.5" strokeLinejoin="round"/>
        {/* Top sand */}
        {topPts && <polygon points={topPts} fill="rgba(255,255,255,0.88)"/>}
        {/* Falling sand stream */}
        {ratio > 0.02 && ratio < 0.98 && (
          <line x1={cx} y1={neckY} x2={cx} y2={neckY + 4}
            stroke="rgba(255,255,255,0.65)" strokeWidth="2" strokeLinecap="round"/>
        )}
        {/* Bottom sand */}
        {botPts && <polygon points={botPts} fill="rgba(255,255,255,0.88)"/>}
        {/* Black end caps (like the real hourglass) */}
        <rect x="6" y="0" width={hw*2} height="8" rx="4" fill="#111" stroke="rgba(255,255,255,0.18)" strokeWidth="0.5"/>
        <rect x="6" y={botY} width={hw*2} height="8" rx="4" fill="#111" stroke="rgba(255,255,255,0.18)" strokeWidth="0.5"/>
      </svg>
      <span className="font-game text-lg leading-none" style={{ color }}>{timeLeft}</span>
    </div>
  );
}

export default function Game({ roomCode, playerId, isHost, initialRoundData, onRoundEnd }) {
  const { socket } = useSocket();
  const [roundData] = useState(initialRoundData);
  const [answers, setAnswers] = useState({});
  const [timeLeft, setTimeLeft] = useState(0);
  const [maxTime, setMaxTime] = useState(60);
  const [submitted, setSubmitted] = useState(false);
  const [bastaMessage, setBastaMessage] = useState('');
  const [bastaCountdown, setBastaCountdown] = useState(null);
  const [aiValidating, setAiValidating] = useState(false);
  const timerRef = useRef(null);
  const answersRef = useRef({});
  const submittedRef = useRef(false);

  const { letter, categories, round, timerEnd, maxRounds, listNumber } = roundData;

  useEffect(() => {
    const total = Math.ceil((timerEnd - Date.now()) / 1000);
    setMaxTime(total);
    setTimeLeft(total);

    timerRef.current = setInterval(() => {
      const left = Math.max(0, Math.ceil((timerEnd - Date.now()) / 1000));
      setTimeLeft(left);
      if (left === 0) {
        clearInterval(timerRef.current);
        if (!submittedRef.current) {
          submittedRef.current = true;
          setSubmitted(true);
          socket.emit('submit_answers', { answers: answersRef.current });
        }
      }
    }, 200);
    return () => clearInterval(timerRef.current);
  }, [timerEnd]);

  useEffect(() => {
    if (!socket) return;
    const onBastaCalled = ({ playerName }) => {
      setBastaMessage(`¡${playerName} llamó BASTA!`);
      setBastaCountdown(5);
    };
    const onTimeUp = () => {
      clearInterval(timerRef.current);
      if (!submittedRef.current) {
        submittedRef.current = true;
        setSubmitted(true);
        socket.emit('submit_answers', { answers: answersRef.current });
      }
    };
    const onAiValidating = () => setAiValidating(true);
    const onRoundEndEvent = (data) => {
      clearInterval(timerRef.current);
      onRoundEnd(data);
    };
    socket.on('basta_called', onBastaCalled);
    socket.on('time_up', onTimeUp);
    socket.on('ai_validating', onAiValidating);
    socket.on('round_end', onRoundEndEvent);
    return () => {
      socket.off('basta_called', onBastaCalled);
      socket.off('time_up', onTimeUp);
      socket.off('ai_validating', onAiValidating);
      socket.off('round_end', onRoundEndEvent);
    };
  }, [socket]);

  useEffect(() => {
    if (bastaCountdown === null) return;
    if (bastaCountdown <= 0) {
      if (!submittedRef.current) {
        submittedRef.current = true;
        setSubmitted(true);
        socket.emit('submit_answers', { answers: answersRef.current });
      }
      return;
    }
    const t = setTimeout(() => setBastaCountdown(c => c - 1), 1000);
    return () => clearTimeout(t);
  }, [bastaCountdown]);

  const handleChange = (cat, value) => {
    const updated = { ...answersRef.current, [cat]: value };
    answersRef.current = updated;
    setAnswers(updated);
  };

  const handleBasta = () => {
    if (submittedRef.current) return;
    submittedRef.current = true;
    setSubmitted(true);
    socket.emit('call_basta', { answers: answersRef.current });
  };

  const handleSubmit = () => {
    if (submittedRef.current) return;
    submittedRef.current = true;
    setSubmitted(true);
    socket.emit('submit_answers', { answers: answersRef.current });
  };

  // Timer ring
  const radius = 28;
  const circumference = 2 * Math.PI * radius;
  const progress = maxTime > 0 ? timeLeft / maxTime : 0;
  const dashOffset = circumference * (1 - progress);
  const timerColor = timeLeft > maxTime * 0.4 ? '#4ade80' : timeLeft > maxTime * 0.2 ? '#facc15' : '#f87171';

  if (aiValidating) return (
    <div className="min-h-screen flex flex-col items-center justify-center gap-4">
      <div className="text-7xl animate-bounce">🤖</div>
      <p className="font-game text-4xl text-yellow-400">Validando...</p>
      <p className="text-white/50 text-sm">La IA está revisando cada respuesta</p>
    </div>
  );

  return (
    <div className="min-h-screen flex flex-col max-w-xl mx-auto w-full px-3 py-4">
      {/* Header */}
      <div className="flex items-center justify-between mb-4 gap-3">
        {/* Round info */}
        <div className="card px-4 py-2 text-center">
          <div className="text-yellow-300 text-xs font-black uppercase tracking-wider">Ronda</div>
          <div className="font-game text-2xl text-white leading-none">{round}/{maxRounds}</div>
          {listNumber && <div className="text-white/40 text-xs">Lista {listNumber}</div>}
        </div>

        {/* Letter - center */}
        <div className="flex flex-col items-center">
          <div className="text-yellow-300 text-xs font-black uppercase tracking-widest mb-1">Letra</div>
          <div className="w-20 h-20 rounded-2xl flex items-center justify-center shadow-xl"
            style={{ background: 'linear-gradient(135deg, #FFD700, #FFA500)', boxShadow: '0 4px 20px rgba(255,165,0,0.5)' }}>
            <span className="font-game text-6xl text-gray-900 leading-none">{letter}</span>
          </div>
        </div>

        {/* Hourglass timer */}
        <div className="card px-4 py-2 flex flex-col items-center">
          <div className="text-yellow-300 text-xs font-black uppercase tracking-wider mb-1">Tiempo</div>
          <HourglassTimer timeLeft={timeLeft} timeLimit={maxTime} color={timerColor} />
        </div>
      </div>

      {/* Basta notification */}
      {bastaMessage && (
        <div className="bg-red-900/50 border-2 border-red-400/70 rounded-2xl px-5 py-3 mb-3 text-center">
          <p className="font-black text-lg text-red-300">{bastaMessage}</p>
          {bastaCountdown !== null && bastaCountdown > 0 && (
            <p className="text-white/60 text-sm">Termina tus respuestas · {bastaCountdown}s</p>
          )}
        </div>
      )}

      {/* Answer sheet — mimics the paper block from the real game */}
      <div className="card flex-1 overflow-hidden mb-3" style={{ background: 'rgba(255,255,255,0.08)' }}>
        <div className="px-4 pt-3 pb-1 border-b border-white/10">
          <p className="text-center text-white/50 text-xs font-bold uppercase tracking-widest">
            Escribe con la letra <span className="text-yellow-300 font-black text-sm">{letter}</span>
          </p>
        </div>
        <div className="overflow-y-auto" style={{ maxHeight: 'calc(100vh - 320px)' }}>
          {categories.map((cat, i) => {
            const val = answers[cat] || '';
            const hasInput = val.trim().length > 0;
            const valid = val.trim().toUpperCase().startsWith(letter);

            return (
              <div key={cat} className="flex items-center border-b border-white/10 px-3 py-2 gap-2">
                <span className="text-yellow-400 font-black text-sm w-5 shrink-0 text-right">{i + 1}</span>
                <span className="text-white/80 text-sm font-semibold w-44 shrink-0 leading-tight">{cat}</span>
                <div className="flex-1 relative">
                  <input
                    type="text"
                    value={val}
                    onChange={e => handleChange(cat, e.target.value)}
                    disabled={submitted}
                    placeholder={`${letter}...`}
                    className={`w-full bg-transparent border-b-2 px-1 py-1 text-white placeholder-white/20 font-bold text-sm focus:outline-none transition
                      ${submitted ? 'opacity-60' : ''}
                      ${hasInput
                        ? valid ? 'border-green-400' : 'border-red-400'
                        : 'border-white/20 focus:border-yellow-400'}
                    `}
                  />
                  {hasInput && (
                    <span className={`absolute right-0 top-1/2 -translate-y-1/2 text-sm ${valid ? 'text-green-400' : 'text-red-400'}`}>
                      {valid ? '✓' : '✗'}
                    </span>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {/* Actions */}
      <div className="flex gap-3">
        <button onClick={handleSubmit} disabled={submitted}
          className="flex-1 py-4 rounded-2xl font-black text-lg transition active:scale-95 disabled:opacity-40"
          style={{ background: submitted ? 'rgba(255,255,255,0.1)' : 'rgba(100,200,100,0.3)', border: '2px solid rgba(100,200,100,0.5)', color: 'white' }}>
          {submitted ? '✓ Enviado' : '✅ ¡Listo!'}
        </button>
        <button onClick={handleBasta} disabled={submitted}
          className="btn-basta flex-1 py-4 text-2xl disabled:opacity-40">
          ¡BASTA!
        </button>
      </div>
    </div>
  );
}
