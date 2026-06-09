let ctx = null;

function getCtx() {
  if (ctx) return ctx;
  if (typeof AudioContext !== 'undefined') ctx = new AudioContext();
  // eslint-disable-next-line no-undef
  else if (typeof webkitAudioContext !== 'undefined') ctx = new webkitAudioContext();
  return ctx;
}

function tone(freq, dur, type = 'sine', vol = 0.2, delay = 0) {
  const c = getCtx();
  if (!c) return;
  if (c.state === 'suspended') c.resume();
  const osc = c.createOscillator();
  const gain = c.createGain();
  osc.connect(gain);
  gain.connect(c.destination);
  osc.type = type;
  osc.frequency.value = freq;
  const t = c.currentTime + delay;
  gain.gain.setValueAtTime(vol, t);
  gain.gain.exponentialRampToValueAtTime(0.001, t + dur);
  osc.start(t);
  osc.stop(t + dur + 0.05);
}

export const playTick = () => tone(700, 0.04, 'sine', 0.06);

export const playUrgentTick = () => {
  tone(900, 0.05, 'sine', 0.22);
  tone(1200, 0.04, 'sine', 0.1, 0.03);
};

export const playValid = () => {
  tone(880, 0.08, 'sine', 0.15);
  tone(1320, 0.12, 'sine', 0.1, 0.07);
};

export const playInvalid = () => tone(180, 0.1, 'sawtooth', 0.1);

export const playBastaCalled = () => {
  tone(330, 0.1, 'square', 0.2);
  tone(415, 0.1, 'square', 0.2, 0.1);
  tone(523, 0.22, 'square', 0.22, 0.2);
};

export const playCountdown = (n) => {
  if (n === 0) {
    tone(660, 0.15, 'sine', 0.3);
    tone(880, 0.3, 'sine', 0.28, 0.13);
  } else {
    tone(440, 0.13, 'sine', 0.28);
  }
};
