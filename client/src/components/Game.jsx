import { useEffect, useState, useRef } from 'react';
import { useSocket } from '../context/SocketContext';
import { playTick, playUrgentTick, playValid, playInvalid, playBastaCalled } from '../utils/sounds';

function CircleTimer({ timeLeft, timeLimit, color }) {
  const r = 26;
  const circ = 2 * Math.PI * r;
  const progress = timeLimit > 0 ? Math.max(0, timeLeft) / timeLimit : 0;
  const dash = circ * progress;
  const urgent = timeLeft > 0 && timeLeft <= 10;

  return (
    <div
      key={urgent ? timeLeft : 'calm'}
      className={urgent ? 'animate-timer-beat' : ''}
      style={{ position: 'relative', width: 64, height: 64, display: 'flex', alignItems: 'center', justifyContent: 'center' }}
    >
      <svg width="64" height="64" style={{ position: 'absolute', inset: 0, transform: 'rotate(-90deg)' }}>
        <circle cx="32" cy="32" r={r} fill="none" stroke="rgba(255,255,255,0.1)" strokeWidth="5" />
        <circle
          cx="32" cy="32" r={r} fill="none"
          stroke={color} strokeWidth="5"
          strokeDasharray={`${dash} ${circ}`}
          strokeLinecap="round"
          style={{ transition: 'stroke-dasharray 0.9s linear, stroke 0.5s ease' }}
        />
      </svg>
      <span className="font-game text-2xl" style={{ color, position: 'relative', lineHeight: 1 }}>
        {timeLeft}
      </span>
    </div>
  );
}

const ROLL_LETTERS = 'ABCDEFGHIJLMNOPRSTV'.split('');

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
  const [displayedLetter, setDisplayedLetter] = useState(
    () => ROLL_LETTERS[Math.floor(Math.random() * ROLL_LETTERS.length)]
  );
  const [rolling, setRolling] = useState(true);
  const [tickKey, setTickKey] = useState(0);
  const timerRef = useRef(null);
  const answersRef = useRef({});
  const submittedRef = useRef(false);
  const lastSoundSecRef = useRef(null);

  const { letter, categories, round, timerEnd, maxRounds, listNumber } = roundData;

  // Dice roll animation
  useEffect(() => {
    let cancelled = false;
    const delays = [...Array(7).fill(60), ...Array(5).fill(110), ...Array(3).fill(190), 320];
    let idx = 0;
    const roll = () => {
      if (cancelled) return;
      if (idx < delays.length) {
        setDisplayedLetter(ROLL_LETTERS[Math.floor(Math.random() * ROLL_LETTERS.length)]);
        setTickKey(k => k + 1);
        setTimeout(roll, delays[idx++]);
      } else {
        setDisplayedLetter(letter);
        setRolling(false);
      }
    };
    setTimeout(roll, 60);
    return () => { cancelled = true; };
  }, []);

  useEffect(() => {
    const total = Math.ceil((timerEnd - Date.now()) / 1000);
    setMaxTime(total);
    setTimeLeft(total);

    timerRef.current = setInterval(() => {
      const left = Math.max(0, Math.ceil((timerEnd - Date.now()) / 1000));
      setTimeLeft(left);

      if (left !== lastSoundSecRef.current && !submittedRef.current) {
        lastSoundSecRef.current = left;
        if (left > 0) {
          if (left <= 10) playUrgentTick();
          else if (left <= total / 2) playTick();
        }
      }

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
      playBastaCalled();
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
    const prev = answersRef.current[cat] || '';
    const updated = { ...answersRef.current, [cat]: value };
    answersRef.current = updated;
    setAnswers(updated);

    const wasValid = prev.trim().toUpperCase().startsWith(letter);
    const isNowValid = value.trim().toUpperCase().startsWith(letter);
    if (!prev.trim() && value.trim()) {
      isNowValid ? playValid() : playInvalid();
    } else if (prev.trim() && value.trim() && wasValid !== isNowValid) {
      isNowValid ? playValid() : playInvalid();
    }
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

  const timerColor = timeLeft > maxTime * 0.4 ? '#4ade80' : timeLeft > maxTime * 0.2 ? '#facc15' : '#f87171';
  const urgent = timeLeft > 0 && timeLeft <= 10 && !submitted;

  if (aiValidating) return (
    <div className="min-h-screen flex flex-col items-center justify-center gap-4">
      <div className="text-7xl animate-bounce">🤖</div>
      <p className="font-game text-4xl text-yellow-400">Validando...</p>
      <p className="text-white/50 text-sm">La IA está revisando cada respuesta</p>
    </div>
  );

  return (
    <div className="flex flex-col max-w-xl mx-auto w-full px-3 py-4" style={{ minHeight: '100dvh' }}>
      {/* Urgent screen-edge flash */}
      {urgent && (
        <div
          key={timeLeft}
          className="animate-timer-beat"
          style={{ position: 'fixed', inset: 0, pointerEvents: 'none', zIndex: 10, boxShadow: 'inset 0 0 80px rgba(239,68,68,0.45)' }}
        />
      )}

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
          <div
            key={rolling ? 'rolling' : 'final'}
            className={`w-20 h-20 rounded-2xl flex items-center justify-center shadow-xl ${!rolling ? 'animate-dice-pop' : ''}`}
            style={{ background: 'linear-gradient(135deg, #FFD700, #FFA500)', boxShadow: '0 4px 20px rgba(255,165,0,0.5)' }}
          >
            <span
              key={tickKey}
              className={`font-game text-6xl text-gray-900 leading-none ${rolling ? 'animate-letter-tick' : ''}`}
            >
              {displayedLetter}
            </span>
          </div>
        </div>

        {/* Circle timer */}
        <div className="card px-3 py-2 flex flex-col items-center gap-1">
          <div className="text-yellow-300 text-xs font-black uppercase tracking-wider">Tiempo</div>
          <CircleTimer timeLeft={timeLeft} timeLimit={maxTime} color={timerColor} />
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

      {/* Answer sheet */}
      <div className="card flex-1 overflow-hidden mb-3 flex flex-col" style={{ background: 'rgba(255,255,255,0.08)' }}>
        <div className="px-4 pt-3 pb-1 border-b border-white/10 shrink-0">
          <p className="text-center text-white/50 text-xs font-bold uppercase tracking-widest">
            Escribe con la letra <span className="text-yellow-300 font-black text-sm">{letter}</span>
          </p>
        </div>
        <div className="overflow-y-auto flex-1" style={{ overscrollBehavior: 'contain' }}>
          {categories.map((cat, i) => {
            const val = answers[cat] || '';
            const hasInput = val.trim().length > 0;
            const valid = val.trim().toUpperCase().startsWith(letter);

            return (
              <div key={cat} className="flex items-center border-b border-white/10 px-3 py-2.5 gap-2">
                <span className="text-yellow-400 font-black text-sm w-5 shrink-0 text-right">{i + 1}</span>
                <span className="text-white/80 text-sm font-semibold w-36 shrink-0 leading-tight">{cat}</span>
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
