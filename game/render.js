// The Quiet Floor — rendering.
// Everything on screen is drawn in code: floorboards, lantern-lit walls,
// crates, bushes, the guards' vision cones, Wren herself. No images.

import { guardConeColor, guardBodyColor, GUARD_RADIUS } from './guards.js';
import { PLAYER_RADIUS } from './player.js';

const TILE = 32;

function drawFloor(ctx, level) {
  ctx.fillStyle = '#1a1e2a';
  ctx.fillRect(0, 0, 960, 640);
  // Floorboards: alternating rows, faint seams.
  for (let y = 0; y < 640; y += TILE) {
    for (let x = 0; x < 960; x += TILE) {
      const odd = ((x / TILE) + (y / TILE)) % 2 === 0;
      ctx.fillStyle = odd ? '#1d2230' : '#1a1e2a';
      ctx.fillRect(x, y, TILE, TILE);
      ctx.strokeStyle = 'rgba(255,255,255,0.025)';
      ctx.strokeRect(x + 0.5, y + 0.5, TILE, TILE);
    }
  }
  // Shadow patches: dark pools where suspicion builds slowly.
  for (const s of level.shadows) {
    ctx.fillStyle = 'rgba(4, 6, 12, 0.42)';
    ctx.fillRect(s.x, s.y, s.w, s.h);
    ctx.strokeStyle = 'rgba(120, 140, 200, 0.10)';
    ctx.strokeRect(s.x + 0.5, s.y + 0.5, s.w, s.h);
  }
}

function drawWalls(ctx, level) {
  for (const w of level.walls) {
    ctx.fillStyle = '#2e3444';
    ctx.fillRect(w.x, w.y, w.w, w.h);
    ctx.fillStyle = '#454e66';
    ctx.fillRect(w.x, w.y, w.w, 4);
    ctx.fillStyle = '#1c2029';
    ctx.fillRect(w.x, w.y + w.h - 3, w.w, 3);
    ctx.strokeStyle = 'rgba(0,0,0,0.5)';
    ctx.strokeRect(w.x + 0.5, w.y + 0.5, w.w, w.h);
  }
}

function drawCrates(ctx, level) {
  for (const c of level.crates) {
    ctx.fillStyle = '#4a3823';
    ctx.fillRect(c.x, c.y, c.w, c.h);
    ctx.fillStyle = '#5d4830';
    ctx.fillRect(c.x + 3, c.y + 3, c.w - 6, c.h - 6);
    ctx.strokeStyle = '#2c2113';
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.moveTo(c.x, c.y);
    ctx.lineTo(c.x + c.w, c.y + c.h);
    ctx.moveTo(c.x + c.w, c.y);
    ctx.lineTo(c.x, c.y + c.h);
    ctx.stroke();
    ctx.lineWidth = 1;
    ctx.strokeStyle = 'rgba(0,0,0,0.45)';
    ctx.strokeRect(c.x + 0.5, c.y + 0.5, c.w, c.h);
  }
}

function drawBushes(ctx, level, time) {
  for (const b of level.bushes) {
    const cx = b.x + b.w / 2;
    const cy = b.y + b.h / 2;
    ctx.fillStyle = '#1d3a24';
    ctx.beginPath();
    ctx.ellipse(cx, cy, b.w / 2, b.h / 2, 0, 0, Math.PI * 2);
    ctx.fill();
    // Leafy dots, gently swaying.
    ctx.fillStyle = '#2c5a33';
    for (let i = 0; i < 9; i++) {
      const a = (i / 9) * Math.PI * 2 + 0.4;
      const rx = (b.w / 2 - 8) * Math.cos(a);
      const ry = (b.h / 2 - 7) * Math.sin(a);
      const sway = Math.sin(time * 1.3 + i * 1.7) * 1.5;
      ctx.beginPath();
      ctx.arc(cx + rx + sway, cy + ry, 5, 0, Math.PI * 2);
      ctx.fill();
    }
    ctx.fillStyle = '#3f7a48';
    ctx.beginPath();
    ctx.arc(cx - b.w / 5, cy - b.h / 6, 4, 0, Math.PI * 2);
    ctx.arc(cx + b.w / 6, cy + b.h / 5, 4, 0, Math.PI * 2);
    ctx.fill();
  }
}

function drawPages(ctx, level, taken, time) {
  level.pages.forEach((page, i) => {
    if (taken.has(i)) return;
    const bob = Math.sin(time * 2.4 + i * 1.9) * 3;
    const glow = 14 + Math.sin(time * 3 + i) * 4;
    const grad = ctx.createRadialGradient(page.x, page.y + bob, 2, page.x, page.y + bob, glow + 12);
    grad.addColorStop(0, 'rgba(242, 193, 78, 0.55)');
    grad.addColorStop(1, 'rgba(242, 193, 78, 0)');
    ctx.fillStyle = grad;
    ctx.beginPath();
    ctx.arc(page.x, page.y + bob, glow + 12, 0, Math.PI * 2);
    ctx.fill();
    // A folded ledger page: gold diamond with a crease.
    ctx.save();
    ctx.translate(page.x, page.y + bob);
    ctx.rotate(Math.PI / 4);
    ctx.fillStyle = '#f2c14e';
    ctx.fillRect(-8, -8, 16, 16);
    ctx.strokeStyle = '#8a6a1d';
    ctx.lineWidth = 1.5;
    ctx.strokeRect(-8, -8, 16, 16);
    ctx.beginPath();
    ctx.moveTo(-8, 0);
    ctx.lineTo(8, 0);
    ctx.stroke();
    ctx.restore();
  });
}

function drawExit(ctx, level, open, time) {
  const e = level.exit;
  const cx = e.x + e.w / 2;
  const cy = e.y + e.h / 2;
  const pulse = open ? 0.55 + Math.sin(time * 3) * 0.2 : 0.18;
  const grad = ctx.createRadialGradient(cx, cy, 4, cx, cy, 70);
  grad.addColorStop(0, open ? `rgba(125, 220, 138, ${pulse})` : 'rgba(140, 150, 170, 0.12)');
  grad.addColorStop(1, 'rgba(125, 220, 138, 0)');
  ctx.fillStyle = grad;
  ctx.beginPath();
  ctx.arc(cx, cy, 70, 0, Math.PI * 2);
  ctx.fill();
  ctx.fillStyle = open ? '#17351d' : '#232833';
  ctx.fillRect(e.x, e.y, e.w, e.h);
  ctx.strokeStyle = open ? '#7ddc8a' : '#5a6376';
  ctx.lineWidth = 3;
  ctx.strokeRect(e.x + 1.5, e.y + 1.5, e.w - 3, e.h - 3);
  ctx.lineWidth = 1;
  // Door bars.
  ctx.strokeStyle = open ? '#7ddc8a' : '#4a5265';
  ctx.beginPath();
  ctx.moveTo(e.x + 8, e.y + e.h / 3);
  ctx.lineTo(e.x + e.w - 8, e.y + e.h / 3);
  ctx.moveTo(e.x + 8, e.y + (2 * e.h) / 3);
  ctx.lineTo(e.x + e.w - 8, e.y + (2 * e.h) / 3);
  ctx.stroke();
  ctx.fillStyle = open ? '#7ddc8a' : '#8a93a8';
  ctx.font = 'bold 11px Georgia, serif';
  ctx.textAlign = 'center';
  ctx.fillText(open ? 'EXIT' : 'LOCKED', cx, cy + 4);
}

function drawVisionCone(ctx, guard) {
  const range = guard.viewRange;
  const half = guard.viewAngle / 2;
  ctx.beginPath();
  ctx.moveTo(guard.x, guard.y);
  ctx.arc(guard.x, guard.y, range, guard.angle - half, guard.angle + half);
  ctx.closePath();
  ctx.fillStyle = guardConeColor(guard);
  ctx.fill();
  ctx.strokeStyle = guardConeColor(guard).replace(/0\.\d+\)$/, '0.55)');
  ctx.stroke();
}

function drawGuardBody(ctx, guard, time) {
  // Lantern glow around the guard.
  const glow = ctx.createRadialGradient(guard.x, guard.y, 2, guard.x, guard.y, 46);
  glow.addColorStop(0, 'rgba(242, 193, 78, 0.20)');
  glow.addColorStop(1, 'rgba(242, 193, 78, 0)');
  ctx.fillStyle = glow;
  ctx.beginPath();
  ctx.arc(guard.x, guard.y, 46, 0, Math.PI * 2);
  ctx.fill();
  // Body: a watchman in a dark coat, bobbing as he walks.
  const bob = Math.sin(guard.stepPhase) * 1.5;
  ctx.fillStyle = guardBodyColor(guard);
  ctx.beginPath();
  ctx.arc(guard.x, guard.y + bob * 0.3, GUARD_RADIUS, 0, Math.PI * 2);
  ctx.fill();
  ctx.strokeStyle = '#10131c';
  ctx.lineWidth = 2;
  ctx.stroke();
  // Facing tick and lantern dot.
  const fx = guard.x + Math.cos(guard.angle) * GUARD_RADIUS;
  const fy = guard.y + Math.sin(guard.angle) * GUARD_RADIUS + bob * 0.3;
  ctx.fillStyle = '#10131c';
  ctx.beginPath();
  ctx.arc(fx, fy, 3.5, 0, Math.PI * 2);
  ctx.fill();
  ctx.fillStyle = '#ffd76a';
  ctx.beginPath();
  ctx.arc(
    guard.x + Math.cos(guard.angle + 0.6) * (GUARD_RADIUS - 3),
    guard.y + Math.sin(guard.angle + 0.6) * (GUARD_RADIUS - 3),
    2.5,
    0,
    Math.PI * 2,
  );
  ctx.fill();
  // State mark: ? when suspicious, ! when alarmed.
  ctx.font = 'bold 18px Georgia, serif';
  ctx.textAlign = 'center';
  if (guard.state === 'alert') {
    ctx.fillStyle = '#ff5a4e';
    ctx.fillText('!', guard.x, guard.y - GUARD_RADIUS - 8);
  } else if (guard.suspicion >= 50) {
    ctx.fillStyle = '#f2a13e';
    ctx.fillText('?', guard.x, guard.y - GUARD_RADIUS - 8);
  }
  // Name tag, small.
  ctx.font = '10px Georgia, serif';
  ctx.fillStyle = 'rgba(207, 214, 228, 0.75)';
  ctx.fillText(guard.name.toUpperCase(), guard.x, guard.y + GUARD_RADIUS + 12);
}

function drawPlayer(ctx, player, time) {
  const bob = player.moving ? Math.sin(player.stepPhase) * 1.5 : Math.sin(time * 1.6) * 0.8;
  // Soft shadow under Wren.
  ctx.fillStyle = 'rgba(0, 0, 0, 0.4)';
  ctx.beginPath();
  ctx.ellipse(player.x, player.y + PLAYER_RADIUS - 2, PLAYER_RADIUS, 5, 0, 0, Math.PI * 2);
  ctx.fill();
  // Cloak: a dark hooded triangle pointing where she faces.
  ctx.save();
  ctx.translate(player.x, player.y + bob * 0.3);
  ctx.rotate(player.angle);
  ctx.fillStyle = player.hiddenInBush ? '#2c5a33' : '#54478f';
  ctx.beginPath();
  ctx.moveTo(PLAYER_RADIUS + 4, 0);
  ctx.lineTo(-PLAYER_RADIUS, PLAYER_RADIUS - 2);
  ctx.lineTo(-PLAYER_RADIUS + 4, 0);
  ctx.lineTo(-PLAYER_RADIUS, -PLAYER_RADIUS + 2);
  ctx.closePath();
  ctx.fill();
  ctx.strokeStyle = '#14100a';
  ctx.lineWidth = 1.5;
  ctx.stroke();
  ctx.fillStyle = '#e8e2d0';
  ctx.beginPath();
  ctx.arc(2, 0, 4.5, 0, Math.PI * 2);
  ctx.fill();
  ctx.restore();
  if (player.hiddenInBush) {
    ctx.font = '11px Georgia, serif';
    ctx.textAlign = 'center';
    ctx.fillStyle = '#9fd6a8';
    ctx.fillText('HIDDEN', player.x, player.y - PLAYER_RADIUS - 8);
  } else if (player.sneaking) {
    ctx.font = '11px Georgia, serif';
    ctx.textAlign = 'center';
    ctx.fillStyle = '#b9c0cf';
    ctx.fillText('SNEAKING', player.x, player.y - PLAYER_RADIUS - 8);
  }
}

function drawPebble(ctx, pebble) {
  if (!pebble) return;
  const arc = Math.sin((pebble.t / pebble.duration) * Math.PI) * 22;
  ctx.fillStyle = '#cfd6e4';
  ctx.beginPath();
  ctx.arc(pebble.x, pebble.y - arc, 4, 0, Math.PI * 2);
  ctx.fill();
  if (pebble.landed) {
    ctx.strokeStyle = 'rgba(207, 214, 228, 0.7)';
    ctx.beginPath();
    ctx.arc(pebble.x, pebble.y, 10 + ((pebble.t * 40) % 14), 0, Math.PI * 2);
    ctx.stroke();
  }
}

function drawVignette(ctx, time) {
  const grad = ctx.createRadialGradient(480, 320, 240, 480, 320, 640);
  grad.addColorStop(0, 'rgba(0,0,0,0)');
  grad.addColorStop(1, 'rgba(0,0,0,0.45)');
  ctx.fillStyle = grad;
  ctx.fillRect(0, 0, 960, 640);
}

// One full frame of the game world.
export function renderGame(ctx, state) {
  const { level, player, guards, taken, pebble, time } = state;
  const exitOpen = taken.size === level.pages.length;
  drawFloor(ctx, level);
  // Cones first, under the walls and crates: stone blocks sight, so the
  // cone stops at a wall instead of shining through it.
  for (const guard of guards) drawVisionCone(ctx, guard);
  drawExit(ctx, level, exitOpen, time);
  drawPages(ctx, level, taken, time);
  drawBushes(ctx, level, time);
  drawCrates(ctx, level);
  drawWalls(ctx, level);
  for (const guard of guards) drawGuardBody(ctx, guard, time);
  drawPebble(ctx, pebble);
  drawPlayer(ctx, player, time);
  drawVignette(ctx, time);
}
