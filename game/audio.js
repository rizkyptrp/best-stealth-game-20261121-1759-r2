// The Quiet Floor — synthesized sound.
// No audio files: every sound is built from oscillators and filtered
// noise through the Web Audio API. Footsteps pan and fade with distance,
// so you can hear where a guard is before you see him.

let ctx = null;
let master = null;
let muted = false;
let ambientNodes = null;

export function initAudio() {
  if (ctx) {
    if (ctx.state === 'suspended') ctx.resume();
    return;
  }
  const AudioContext = window.AudioContext || window.webkitAudioContext;
  if (!AudioContext) return;
  ctx = new AudioContext();
  master = ctx.createGain();
  master.gain.value = muted ? 0 : 0.5;
  master.connect(ctx.destination);
  startAmbientDrone();
}

export function setMuted(value) {
  muted = value;
  if (master) master.gain.value = muted ? 0 : 0.5;
  return muted;
}

export function isMuted() {
  return muted;
}

function tone(freq, duration, type, volume, when = 0, slideTo = null) {
  if (!ctx || !master) return;
  const t0 = ctx.currentTime + when;
  const osc = ctx.createOscillator();
  const gain = ctx.createGain();
  osc.type = type;
  osc.frequency.setValueAtTime(freq, t0);
  if (slideTo !== null) osc.frequency.exponentialRampToValueAtTime(slideTo, t0 + duration);
  gain.gain.setValueAtTime(0, t0);
  gain.gain.linearRampToValueAtTime(volume, t0 + 0.012);
  gain.gain.exponentialRampToValueAtTime(0.0001, t0 + duration);
  osc.connect(gain);
  gain.connect(master);
  osc.start(t0);
  osc.stop(t0 + duration + 0.05);
}

function noiseBurst(duration, volume, filterFreq, when = 0, pan = 0) {
  if (!ctx || !master) return;
  const t0 = ctx.currentTime + when;
  const len = Math.max(1, Math.floor(ctx.sampleRate * duration));
  const buffer = ctx.createBuffer(1, len, ctx.sampleRate);
  const data = buffer.getChannelData(0);
  for (let i = 0; i < len; i++) {
    data[i] = (Math.random() * 2 - 1) * (1 - i / len);
  }
  const src = ctx.createBufferSource();
  src.buffer = buffer;
  const filter = ctx.createBiquadFilter();
  filter.type = 'lowpass';
  filter.frequency.value = filterFreq;
  const gain = ctx.createGain();
  gain.gain.setValueAtTime(volume, t0);
  gain.gain.exponentialRampToValueAtTime(0.0001, t0 + duration);
  let node = src;
  node.connect(filter);
  filter.connect(gain);
  if (ctx.createStereoPanner && pan !== 0) {
    const panner = ctx.createStereoPanner();
    panner.pan.value = Math.max(-1, Math.min(1, pan));
    gain.connect(panner);
    panner.connect(master);
  } else {
    gain.connect(master);
  }
  src.start(t0);
}

// A low, slow drone with a breathing filter: the archive at night.
function startAmbientDrone() {
  const osc = ctx.createOscillator();
  osc.type = 'sine';
  osc.frequency.value = 55;
  const osc2 = ctx.createOscillator();
  osc2.type = 'sine';
  osc2.frequency.value = 55 * 1.5;
  const gain = ctx.createGain();
  gain.gain.value = 0.045;
  const filter = ctx.createBiquadFilter();
  filter.type = 'lowpass';
  filter.frequency.value = 220;
  const lfo = ctx.createOscillator();
  lfo.frequency.value = 0.07;
  const lfoGain = ctx.createGain();
  lfoGain.gain.value = 90;
  lfo.connect(lfoGain);
  lfoGain.connect(filter.frequency);
  osc.connect(filter);
  osc2.connect(filter);
  filter.connect(gain);
  gain.connect(master);
  osc.start();
  osc2.start();
  lfo.start();
  ambientNodes = { osc, osc2, lfo };
}

export function playFootstep(isPlayer, distancePx) {
  if (!ctx) return;
  // Louder and lower up close; a guard's step carries further than Wren's.
  const closeness = Math.max(0, 1 - distancePx / 420);
  const volume = isPlayer ? 0.05 : 0.04 + closeness * 0.22;
  const pan = 0; // panned by the caller through distance only; keep centred.
  noiseBurst(0.07, volume, isPlayer ? 500 : 380, 0, pan);
}

export function playGuardStep(guard, player) {
  if (!ctx) return;
  const dx = guard.x - player.x;
  const dy = guard.y - player.y;
  const d = Math.sqrt(dx * dx + dy * dy);
  if (d > 420) return;
  const pan = Math.max(-0.8, Math.min(0.8, dx / 300));
  const closeness = Math.max(0, 1 - d / 420);
  noiseBurst(0.08, 0.03 + closeness * 0.2, 340, 0, pan);
}

export function playSuspicious() {
  // A single questioning note: the guard thinks he saw something.
  tone(392, 0.22, 'triangle', 0.16);
  tone(392, 0.18, 'triangle', 0.1, 0.2, 440);
}

export function playAlarm() {
  // The alarm sting: two clashing saws, then a falling wail.
  tone(220, 0.5, 'sawtooth', 0.16, 0, 233);
  tone(233, 0.5, 'sawtooth', 0.16, 0, 220);
  tone(660, 0.7, 'square', 0.08, 0.05, 330);
  noiseBurst(0.4, 0.12, 900, 0);
}

export function playLost() {
  // The guard gives up: a short descending sigh.
  tone(330, 0.3, 'triangle', 0.1, 0, 220);
}

export function playPickup() {
  // A ledger page, taken: a bright little arpeggio.
  tone(523, 0.14, 'sine', 0.16);
  tone(659, 0.14, 'sine', 0.16, 0.09);
  tone(784, 0.22, 'sine', 0.18, 0.18);
}

export function playPebble() {
  noiseBurst(0.09, 0.14, 2400);
  tone(1400, 0.06, 'sine', 0.08, 0.02);
}

export function playPebbleLand() {
  noiseBurst(0.12, 0.2, 1200);
  tone(220, 0.1, 'sine', 0.1, 0, 160);
}

export function playExitOpen() {
  tone(392, 0.25, 'sine', 0.14);
  tone(523, 0.4, 'sine', 0.16, 0.18);
}

export function playWin() {
  const notes = [523, 659, 784, 1047];
  notes.forEach((f, i) => tone(f, 0.35, 'sine', 0.16, i * 0.14));
  tone(1319, 0.6, 'sine', 0.12, 0.6);
}

export function playLose() {
  const notes = [330, 294, 262, 196];
  notes.forEach((f, i) => tone(f, 0.4, 'triangle', 0.14, i * 0.18));
}

export function stopAmbient() {
  if (!ambientNodes) return;
  try {
    ambientNodes.osc.stop();
    ambientNodes.osc2.stop();
    ambientNodes.lfo.stop();
  } catch (e) {
    // Already stopped.
  }
  ambientNodes = null;
}
