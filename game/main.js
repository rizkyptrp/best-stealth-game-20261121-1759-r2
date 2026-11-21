// The Quiet Floor — main controller.
// Boots the game, runs the loop, owns the screens and the HUD, and stages
// the four deterministic screenshot scenes (?shot=cover|patrol|alarm|
// victory) so the game's own code renders them, frozen, for the camera.

import { LEVELS } from './levels.js';
import { createGuard, updateGuard } from './guards.js';
import {
  createPlayer,
  updatePlayer,
  throwPebble,
  updatePebble,
  guardsHearingPebble,
  collectPages,
  playerAtExit,
} from './player.js';
import { renderGame } from './render.js';
import {
  initAudio,
  setMuted,
  isMuted,
  playFootstep,
  playGuardStep,
  playSuspicious,
  playAlarm,
  playLost,
  playPickup,
  playPebble,
  playPebbleLand,
  playExitOpen,
  playWin,
  playLose,
} from './audio.js';

const canvas = document.getElementById('game');
const ctx = canvas.getContext('2d');

const $ = (id) => document.getElementById(id);
const hud = $('hud');
const bannerEl = $('banner');
const toastEl = $('toast');

const state = {
  screen: 'title', // title | playing | paused | win | lose | complete
  levelIndex: 0,
  level: null,
  player: null,
  guards: [],
  taken: new Set(),
  pebble: null,
  pebbleGoneAt: 0,
  time: 0,
  elapsed: 0,
  everAlerted: false,
  totalCaught: 0,
  shotMode: null,
  lastFrame: 0,
  playerStepAcc: 0,
};

function loadLevel(index) {
  state.levelIndex = index;
  state.level = LEVELS[index];
  state.player = createPlayer(state.level);
  state.guards = state.level.guards.map((def, i) => createGuard(def, i));
  state.taken = new Set();
  state.pebble = null;
  state.elapsed = 0;
  state.everAlerted = false;
  for (const g of state.guards) {
    g.prevX = g.x;
    g.prevY = g.y;
    g.stepAcc = 0;
  }
  updateHud();
}

function showOnly(id) {
  for (const name of ['screen-title', 'screen-pause', 'screen-win', 'screen-lose', 'screen-complete']) {
    $(name).classList.toggle('hidden', name !== id);
  }
}

function showBanner(text, ms = 1800) {
  bannerEl.textContent = text;
  bannerEl.classList.remove('hidden');
  clearTimeout(showBanner.timer);
  showBanner.timer = setTimeout(() => bannerEl.classList.add('hidden'), ms);
}

let toastTimer = null;
function showToast(text, ms = 2200) {
  toastEl.textContent = text;
  toastEl.classList.remove('hidden');
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => toastEl.classList.add('hidden'), ms);
}

function formatTime(seconds) {
  const m = Math.floor(seconds / 60);
  const s = Math.floor(seconds % 60);
  return `${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`;
}

function updateHud() {
  const level = state.level;
  if (!level) return;
  $('hud-level').textContent = level.name;
  $('hud-pages').textContent = `${state.taken.size}/${level.pages.length}`;
  const exitEl = $('hud-exit');
  const open = state.taken.size === level.pages.length;
  exitEl.textContent = open ? 'EXIT: OPEN' : 'EXIT: LOCKED';
  exitEl.classList.toggle('open', open);
  $('hud-pebble-count').textContent = String(state.player ? state.player.pebbles : level.pebbles);
  $('hud-timer').textContent = formatTime(state.elapsed);
  const maxSuspicion = state.guards.reduce((m, g) => Math.max(m, g.suspicion), 0);
  const anyAlert = state.guards.some((g) => g.state === 'alert');
  $('suspicion-fill').style.width = `${maxSuspicion}%`;
  $('suspicion-fill').style.background = anyAlert
    ? '#ff5a4e'
    : maxSuspicion >= 50
      ? '#f2a13e'
      : '#f2c14e';
  const stateEl = $('suspicion-state');
  stateEl.textContent = anyAlert ? 'ALARM!' : maxSuspicion >= 50 ? 'SUSPICIOUS' : maxSuspicion > 5 ? 'WARY' : 'CALM';
  stateEl.classList.toggle('alarm', anyAlert);
  stateEl.classList.toggle('suspicious', !anyAlert && maxSuspicion >= 50);
}

function startGame() {
  initAudio();
  loadLevel(0);
  state.screen = 'playing';
  hud.classList.remove('hidden');
  showOnly(null);
  showToast('Take every ledger page. Reach the service door unseen.');
}

function pauseGame() {
  if (state.screen !== 'playing') return;
  state.screen = 'paused';
  showOnly('screen-pause');
}

function resumeGame() {
  if (state.screen !== 'paused') return;
  state.screen = 'playing';
  showOnly(null);
}

function restartFloor() {
  loadLevel(state.levelIndex);
  state.screen = 'playing';
  hud.classList.remove('hidden');
  showOnly(null);
  showToast(`${state.level.name} — again, quieter this time.`);
}

function floorCleared() {
  const rating = state.everAlerted ? 'SHADOW — seen, but never caught' : 'GHOST — never even suspected';
  $('win-title').textContent =
    state.levelIndex + 1 >= LEVELS.length ? 'THE ARCHIVE IS YOURS' : 'FLOOR CLEAR';
  $('win-sub').textContent = 'Every page is yours. The service door sighs open.';
  $('win-stats').textContent =
    `${state.level.name}\nTime: ${formatTime(state.elapsed)} · Pages: ${state.taken.size}/${state.level.pages.length}\nRating: ${rating}`;
  $('btn-next').textContent =
    state.levelIndex + 1 >= LEVELS.length ? 'FINISH THE NIGHT' : 'NEXT FLOOR';
  state.screen = 'win';
  playWin();
  showOnly('screen-win');
}

function gameComplete() {
  const total = LEVELS.length;
  $('complete-stats').textContent =
    `${total} floors · every page taken\nCaught ${state.totalCaught} time${state.totalCaught === 1 ? '' : 's'}\nThe archive never knew you were there.`;
  state.screen = 'complete';
  showOnly('screen-complete');
}

function caughtBy(guard) {
  state.totalCaught += 1;
  $('lose-sub').textContent =
    `${guard.name} swings his lantern round. A hand closes on your shoulder.`;
  $('lose-stats').textContent =
    `${state.level.name}\nPages taken: ${state.taken.size}/${state.level.pages.length} · Time: ${formatTime(state.elapsed)}`;
  state.screen = 'lose';
  playLose();
  showOnly('screen-lose');
}

// ---- the loop ----

function handleGuardEvents(events) {
  for (const ev of events) {
    if (ev.type === 'alarm') {
      state.everAlerted = true;
      playAlarm();
      showBanner('SPOTTED!', 2200);
      showToast(`${ev.guard.name} raised the alarm — break line of sight!`);
    } else if (ev.type === 'suspicious') {
      playSuspicious();
      showToast(`${ev.guard.name} thinks he saw something…`);
    } else if (ev.type === 'lost') {
      playLost();
      showToast(`${ev.guard.name} lost you. Stay out of the light.`);
    }
  }
}

function frame(now) {
  requestAnimationFrame(frame);
  if (state.screen !== 'playing') return;
  const dt = Math.min(0.05, (now - state.lastFrame) / 1000 || 0.016);
  state.lastFrame = now;
  state.time += dt;
  state.elapsed += dt;

  const events = [];
  updatePlayer(state.player, keys, state.level, dt);

  // Wren's own footsteps: soft, quicker when she runs.
  if (state.player.moving) {
    state.playerStepAcc += dt * (state.player.sneaking ? 1.4 : 2.4);
    if (state.playerStepAcc >= 1) {
      state.playerStepAcc = 0;
      playFootstep(true, 0);
    }
  }

  for (const guard of state.guards) {
    const result = updateGuard(guard, state.player, state.level, dt, state.time, events);
    // A guard's step, heard from where he is.
    const moved = Math.hypot(guard.x - guard.prevX, guard.y - guard.prevY);
    guard.prevX = guard.x;
    guard.prevY = guard.y;
    guard.stepAcc += moved;
    if (guard.stepAcc >= 30) {
      guard.stepAcc = 0;
      playGuardStep(guard, state.player);
    }
    if (result === 'caught') {
      renderGame(ctx, state);
      caughtBy(guard);
      return;
    }
  }
  handleGuardEvents(events);

  // Pebbles: fly, land, and pull nearby guards over to look.
  if (state.pebble) {
    const wasLanded = state.pebble.landed;
    updatePebble(state.pebble, dt);
    if (state.pebble.landed && !wasLanded) {
      playPebbleLand();
      state.pebbleGoneAt = state.time + 1.2;
      for (const g of guardsHearingPebble(state.guards, state.pebble)) {
        g.heardX = state.pebble.x;
        g.heardY = state.pebble.y;
      }
      showToast('The pebble clatters — a guard turns to look.');
    }
    if (state.pebble.landed && state.time > state.pebbleGoneAt) state.pebble = null;
  }

  // Ledger pages.
  const newly = collectPages(state.player, state.level, state.taken);
  for (const i of newly) {
    playPickup();
    if (state.taken.size === state.level.pages.length) {
      playExitOpen();
      showToast('All pages taken — the service door is OPEN. Run for it!');
      showBanner('EXIT OPEN', 1800);
    } else {
      showToast(`Ledger page ${state.taken.size} of ${state.level.pages.length} — keep going.`);
    }
  }

  // The exit, once open.
  if (state.taken.size === state.level.pages.length && playerAtExit(state.player, state.level)) {
    renderGame(ctx, state);
    if (state.levelIndex + 1 >= LEVELS.length) {
      floorCleared();
      gameComplete();
    } else {
      floorCleared();
    }
    return;
  }

  renderGame(ctx, state);
  updateHud();
}

// ---- input ----

const keys = new Set();
window.addEventListener('keydown', (e) => {
  if (['ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight', 'Space'].includes(e.code)) {
    e.preventDefault();
  }
  if (e.code === 'KeyP' && (state.screen === 'playing' || state.screen === 'paused')) {
    if (state.screen === 'playing') pauseGame();
    else resumeGame();
    return;
  }
  if (e.code === 'KeyR' && (state.screen === 'playing' || state.screen === 'paused' || state.screen === 'lose')) {
    restartFloor();
    return;
  }
  if (e.code === 'KeyM') {
    const muted = setMuted(!isMuted());
    $('btn-mute').textContent = muted ? 'SOUND OFF' : 'SOUND ON';
    return;
  }
  if (e.code === 'Enter' && state.screen === 'title') {
    startGame();
    return;
  }
  keys.add(e.code);
});
window.addEventListener('keyup', (e) => keys.delete(e.code));
window.addEventListener('blur', () => keys.clear());

canvas.addEventListener('click', (e) => {
  if (state.screen !== 'playing') return;
  initAudio();
  const rect = canvas.getBoundingClientRect();
  const x = ((e.clientX - rect.left) / rect.width) * 960;
  const y = ((e.clientY - rect.top) / rect.height) * 640;
  const pebble = throwPebble(state.player, x, y);
  if (!pebble) {
    showToast('No pebbles left — your pockets are empty.');
    return;
  }
  state.pebble = pebble;
  playPebble();
  updateHud();
});

// ---- buttons ----

$('btn-start').addEventListener('click', startGame);
$('btn-resume').addEventListener('click', resumeGame);
$('btn-restart-pause').addEventListener('click', restartFloor);
$('btn-next').addEventListener('click', () => {
  if (state.levelIndex + 1 >= LEVELS.length) {
    gameComplete();
    return;
  }
  loadLevel(state.levelIndex + 1);
  state.screen = 'playing';
  showOnly(null);
  showToast(`${state.level.name} — ${state.level.subtitle}`);
});
$('btn-replay-win').addEventListener('click', restartFloor);
$('btn-retry').addEventListener('click', restartFloor);
$('btn-title-lose').addEventListener('click', () => {
  state.screen = 'title';
  hud.classList.add('hidden');
  showOnly('screen-title');
});
$('btn-again').addEventListener('click', () => {
  state.totalCaught = 0;
  loadLevel(0);
  state.screen = 'playing';
  hud.classList.remove('hidden');
  showOnly(null);
});
$('btn-pause').addEventListener('click', () => {
  if (state.screen === 'playing') pauseGame();
  else if (state.screen === 'paused') resumeGame();
});
$('btn-mute').addEventListener('click', () => {
  const muted = setMuted(!isMuted());
  $('btn-mute').textContent = muted ? 'SOUND OFF' : 'SOUND ON';
});

// ---- screenshot staging ----
// ?shot=cover|patrol|alarm|victory renders one frozen, deterministic scene
// with the game's own code — no animation, no audio, no randomness.

function stageShot(name) {
  state.shotMode = name;
  hud.classList.remove('hidden');
  if (name === 'cover') {
    loadLevel(0);
    state.player.x = 420;
    state.player.y = 290;
    state.player.sneaking = true;
    state.player.angle = Math.PI / 2;
    const [g1, g2] = state.guards;
    g1.x = 280; g1.y = 200; g1.angle = Math.PI / 4; g1.suspicion = 18;
    g2.x = 700; g2.y = 140; g2.angle = Math.PI * 0.75; g2.suspicion = 32;
    state.time = 12;
    state.elapsed = 73;
    state.screen = 'playing';
    showOnly(null);
  } else if (name === 'patrol') {
    loadLevel(1);
    state.player.x = 480;
    state.player.y = 580;
    state.player.angle = -Math.PI / 2;
    const [g1, g2, g3] = state.guards;
    g1.x = 480; g1.y = 80; g1.angle = 0; g1.suspicion = 0;
    g2.x = 880; g2.y = 240; g2.angle = Math.PI / 2; g2.suspicion = 8;
    g3.x = 560; g3.y = 470; g3.angle = Math.PI; g3.suspicion = 0;
    state.time = 40;
    state.elapsed = 148;
    state.screen = 'playing';
    showOnly(null);
  } else if (name === 'alarm') {
    loadLevel(0);
    state.player.x = 230;
    state.player.y = 190;
    state.player.sneaking = true;
    state.player.angle = Math.PI;
    const [g1, g2] = state.guards;
    g1.x = 280; g1.y = 200; g1.angle = Math.atan2(190 - 200, 230 - 280);
    g1.state = 'alert';
    g1.suspicion = 100;
    g1.lastSeenX = 230;
    g1.lastSeenY = 190;
    g2.x = 700; g2.y = 300; g2.angle = Math.PI; g2.suspicion = 62; g2.state = 'suspicious';
    state.time = 25;
    state.elapsed = 96;
    state.screen = 'playing';
    showOnly(null);
    showBanner('SPOTTED!', 60000);
    showToast('Old Marek raised the alarm — break line of sight!');
  } else if (name === 'victory') {
    loadLevel(2);
    state.player.x = 480;
    state.player.y = 580;
    state.player.angle = -Math.PI / 2;
    state.taken = new Set([0, 1, 2, 3]);
    state.elapsed = 214;
    state.everAlerted = false;
    state.screen = 'win';
    $('win-title').textContent = 'THE ARCHIVE IS YOURS';
    $('win-sub').textContent = 'Every page is yours. The service door sighs open.';
    $('win-stats').textContent =
      'FLOOR 3 — THE VAULT\nTime: 03:34 · Pages: 4/4\nRating: GHOST — never even suspected';
    $('btn-next').textContent = 'FINISH THE NIGHT';
    showOnly('screen-win');
  }
  renderGame(ctx, state);
  updateHud();
}

// ---- boot ----

const shot = new URLSearchParams(window.location.search).get('shot');
if (shot && ['cover', 'patrol', 'alarm', 'victory'].includes(shot)) {
  stageShot(shot);
} else {
  loadLevel(0);
  state.screen = 'title';
  showOnly('screen-title');
  renderGame(ctx, state);
  requestAnimationFrame(frame);
}
