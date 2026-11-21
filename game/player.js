// The Quiet Floor — the player.
// Wren moves with WASD or the arrow keys, sneaks on Shift, and throws a
// pebble with a mouse click. She is quick on her feet and quiet when she
// chooses to be; running is faster and far easier to spot.

import { distance, moveCircle, pointInRect } from './geometry.js';
import { playerHiddenInBush, playerInShadow } from './guards.js';

export const PLAYER_RADIUS = 11;
const WALK_SPEED = 150;
const SNEAK_SPEED = 82;
const RUN_SPEED = 205;

export function createPlayer(level) {
  return {
    x: level.playerStart.x,
    y: level.playerStart.y,
    angle: -Math.PI / 2,
    sneaking: false,
    running: false,
    moving: false,
    hiddenInBush: false,
    inShadow: false,
    stepPhase: 0,
    pebbles: level.pebbles,
  };
}

export function updatePlayer(player, keys, level, dt) {
  let dx = 0;
  let dy = 0;
  if (keys.has('KeyA') || keys.has('ArrowLeft')) dx -= 1;
  if (keys.has('KeyD') || keys.has('ArrowRight')) dx += 1;
  if (keys.has('KeyW') || keys.has('ArrowUp')) dy -= 1;
  if (keys.has('KeyS') || keys.has('ArrowDown')) dy += 1;

  player.sneaking = keys.has('ShiftLeft') || keys.has('ShiftRight');
  player.running = !player.sneaking && (dx !== 0 || dy !== 0);
  player.moving = dx !== 0 || dy !== 0;

  if (player.moving) {
    const len = Math.sqrt(dx * dx + dy * dy);
    const speed = player.sneaking ? SNEAK_SPEED : WALK_SPEED;
    const solids = [...level.walls, ...level.crates];
    const moved = moveCircle(
      player.x,
      player.y,
      PLAYER_RADIUS,
      (dx / len) * speed * dt,
      (dy / len) * speed * dt,
      solids,
    );
    const actuallyMoved = distance(player.x, player.y, moved.x, moved.y);
    player.x = moved.x;
    player.y = moved.y;
    player.angle = Math.atan2(dy, dx);
    player.stepPhase += actuallyMoved / 9;
  }

  player.hiddenInBush = playerHiddenInBush(player, level);
  player.inShadow = playerInShadow(player, level);
}

// Throw a pebble at the clicked floor point. Guards inside earshot walk
// over to see what made the sound. Returns the pebble or null.
export function throwPebble(player, targetX, targetY) {
  if (player.pebbles <= 0) return null;
  player.pebbles -= 1;
  return {
    x: player.x,
    y: player.y,
    tx: targetX,
    ty: targetY,
    t: 0,
    duration: 0.35,
    landed: false,
  };
}

export function updatePebble(pebble, dt) {
  if (!pebble || pebble.landed) return pebble;
  pebble.t += dt;
  if (pebble.t >= pebble.duration) {
    pebble.landed = true;
    pebble.x = pebble.tx;
    pebble.y = pebble.ty;
  } else {
    const k = pebble.t / pebble.duration;
    pebble.x = pebble.x + (pebble.tx - pebble.x) * k * 0.4;
    pebble.y = pebble.y + (pebble.ty - pebble.y) * k * 0.4;
  }
  return pebble;
}

export const PEBBLE_EARSHOT = 260;

// Which guards hear the pebble land? Distance only — sound goes round
// corners, which is exactly why it is useful.
export function guardsHearingPebble(guards, pebble) {
  return guards.filter(
    (g) => distance(g.x, g.y, pebble.x, pebble.y) <= PEBBLE_EARSHOT,
  );
}

// Pick up any ledger page the player is standing on.
export function collectPages(player, level, taken) {
  const newly = [];
  level.pages.forEach((page, i) => {
    if (!taken.has(i) && distance(player.x, player.y, page.x, page.y) < 26) {
      taken.add(i);
      newly.push(i);
    }
  });
  return newly;
}

export function playerAtExit(player, level) {
  return pointInRect(player.x, player.y, level.exit);
}

export function pagesRemaining(level, taken) {
  return level.pages.length - taken.size;
}
