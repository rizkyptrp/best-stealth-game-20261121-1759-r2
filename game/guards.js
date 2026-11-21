// The Quiet Floor — guard AI.
// A guard walks his beat, watches his cone, and remembers what he saw.
// Suspicion 0–100: it builds while the player is in sight (faster up
// close, slower in shadow, slower still when the player sneaks), and it
// drains when the player is hidden. At 50 the guard grows suspicious and
// walks over to look; at 100 he raises the alarm and chases. Lose him and
// he searches the last place he saw you, then gives up and returns to
// his round. A thrown pebble is a sound he investigates, not a sighting.

import {
  distance,
  angleDifference,
  hasLineOfSight,
  moveCircle,
  pointInRect,
  clamp,
} from './geometry.js';

export const GUARD_RADIUS = 13;
export const CATCH_DISTANCE = 24;

const SUSPICION_BUILD_BASE = 55; // per second, point-blank, in the open
const SUSPICION_DRAIN = 22; // per second while unseen
const SUSPICIOUS_AT = 50;
const ALERT_AT = 100;

export function createGuard(def, index) {
  const [sx, sy] = def.waypoints[0];
  return {
    name: def.name,
    index,
    x: sx,
    y: sy,
    angle: 0,
    speed: def.speed,
    viewRange: def.viewRange,
    viewAngle: def.viewAngle,
    pause: def.pause,
    waypoints: def.waypoints,
    loop: def.loop !== false,
    waypointIndex: 1,
    waypointDir: 1,
    pauseLeft: 0,
    state: 'patrol', // patrol | suspicious | alert | investigate | return
    suspicion: 0,
    lastSeenX: sx,
    lastSeenY: sy,
    lastSeenAt: -1,
    investigateX: sx,
    investigateY: sy,
    lookTimer: 0,
    lookAngle: 0,
    heardX: null,
    heardY: null,
    stuckTimer: 0,
    lastMoveDist: 0,
    stepPhase: Math.random() * Math.PI * 2,
  };
}

// Can this guard see the player right now?
export function guardSeesPlayer(guard, player, level) {
  const d = distance(guard.x, guard.y, player.x, player.y);
  if (d > guard.viewRange) return false;
  const toPlayer = Math.atan2(player.y - guard.y, player.x - guard.x);
  if (Math.abs(angleDifference(toPlayer, guard.angle)) > guard.viewAngle / 2) {
    return false;
  }
  // Bushes hide the player unless the guard is nearly on top of them.
  if (player.hiddenInBush && d > 70) return false;
  const blockers = [...level.walls, ...level.crates];
  return hasLineOfSight(guard.x, guard.y, player.x, player.y, blockers);
}

function suspicionRate(guard, player, level) {
  const d = distance(guard.x, guard.y, player.x, player.y);
  const closeness = 1 - d / guard.viewRange; // 0 far, 1 point-blank
  let rate = SUSPICION_BUILD_BASE * (0.45 + closeness * 1.1);
  if (player.sneaking) rate *= 0.55;
  if (player.running) rate *= 1.35;
  if (player.inShadow) rate *= 0.45;
  if (player.hiddenInBush) rate *= 0.25;
  return rate;
}

function moveToward(guard, tx, ty, speed, dt, solids) {
  const dx = tx - guard.x;
  const dy = ty - guard.y;
  const d = Math.sqrt(dx * dx + dy * dy);
  if (d < 1) return true;
  const step = Math.min(d, speed * dt);
  const moved = moveCircle(
    guard.x,
    guard.y,
    GUARD_RADIUS,
    (dx / d) * step,
    (dy / d) * step,
    solids,
  );
  guard.angle = Math.atan2(dy, dx);
  const actuallyMoved = distance(guard.x, guard.y, moved.x, moved.y);
  guard.x = moved.x;
  guard.y = moved.y;
  guard.stepPhase += actuallyMoved / 9;
  guard.lastMoveDist = actuallyMoved;
  return d <= step + 0.5;
}

function advancePatrol(guard, dt, solids) {
  if (guard.pauseLeft > 0) {
    guard.pauseLeft -= dt;
    return;
  }
  const target = guard.waypoints[guard.waypointIndex];
  const arrived = moveToward(guard, target[0], target[1], guard.speed, dt, solids);
  if (arrived) {
    guard.pauseLeft = guard.pause;
    if (guard.loop) {
      guard.waypointIndex = (guard.waypointIndex + 1) % guard.waypoints.length;
    } else {
      // Ping-pong beat: walk the list backwards at the end.
      let next = guard.waypointIndex + guard.waypointDir;
      if (next >= guard.waypoints.length || next < 0) {
        guard.waypointDir = -guard.waypointDir;
        next = guard.waypointIndex + guard.waypointDir;
      }
      guard.waypointIndex = next;
    }
  }
}

function lookAround(guard, dt) {
  guard.lookTimer -= dt;
  guard.angle = guard.lookAngle + Math.sin(guard.lookTimer * 2.2) * 1.1;
}

// One guard, one frame. Returns 'caught' when the guard lays hands on the
// player, otherwise null. `events` collects sounds the game should play.
export function updateGuard(guard, player, level, dt, now, events) {
  const solids = [...level.walls, ...level.crates];
  const sees = guardSeesPlayer(guard, player, level);

  if (sees) {
    guard.lastSeenX = player.x;
    guard.lastSeenY = player.y;
    guard.lastSeenAt = now;
    guard.suspicion = clamp(
      guard.suspicion + suspicionRate(guard, player, level) * dt,
      0,
      100,
    );
  } else {
    guard.suspicion = clamp(guard.suspicion - SUSPICION_DRAIN * dt, 0, 100);
  }

  // A noise the guard heard pulls him to investigate, once.
  if (guard.heardX !== null && guard.state !== 'alert') {
    guard.investigateX = guard.heardX;
    guard.investigateY = guard.heardY;
    guard.heardX = null;
    guard.heardY = null;
    if (guard.state === 'patrol') {
      guard.state = 'investigate';
      guard.lookTimer = 2.2;
      guard.lookAngle = guard.angle;
    }
  }

  if (guard.suspicion >= ALERT_AT && guard.state !== 'alert') {
    guard.state = 'alert';
    events.push({ type: 'alarm', guard });
  } else if (
    guard.suspicion >= SUSPICIOUS_AT &&
    guard.state === 'patrol'
  ) {
    guard.state = 'suspicious';
    guard.investigateX = guard.lastSeenX;
    guard.investigateY = guard.lastSeenY;
    guard.lookTimer = 2.5;
    guard.lookAngle = guard.angle;
    events.push({ type: 'suspicious', guard });
  }

  switch (guard.state) {
    case 'patrol':
      advancePatrol(guard, dt, solids);
      break;
    case 'suspicious': {
      const arrived = moveToward(
        guard,
        guard.investigateX,
        guard.investigateY,
        guard.speed * 1.15,
        dt,
        solids,
      );
      if (arrived) {
        lookAround(guard, dt);
        if (guard.lookTimer <= 0) {
          guard.state = 'return';
        }
      }
      if (guard.suspicion < 25) guard.state = 'return';
      break;
    }
    case 'alert': {
      // Chase the player while seen; otherwise hunt the last seen spot.
      const tx = sees ? player.x : guard.lastSeenX;
      const ty = sees ? player.y : guard.lastSeenY;
      moveToward(guard, tx, ty, guard.speed * 1.65, dt, solids);
      if (!sees && now - guard.lastSeenAt > 2.5) {
        guard.state = 'investigate';
        guard.investigateX = guard.lastSeenX;
        guard.investigateY = guard.lastSeenY;
        guard.lookTimer = 3.0;
        guard.lookAngle = guard.angle;
        events.push({ type: 'lost', guard });
      }
      break;
    }
    case 'investigate': {
      const arrived = moveToward(
        guard,
        guard.investigateX,
        guard.investigateY,
        guard.speed * 1.1,
        dt,
        solids,
      );
      if (arrived) {
        lookAround(guard, dt);
        if (guard.lookTimer <= 0) {
          guard.state = 'return';
          guard.suspicion = Math.min(guard.suspicion, 30);
        }
      }
      break;
    }
    case 'return': {
      // Walk back to the nearest waypoint, then resume the round.
      let nearest = 0;
      let best = Infinity;
      guard.waypoints.forEach((wp, i) => {
        const d = distance(guard.x, guard.y, wp[0], wp[1]);
        if (d < best) {
          best = d;
          nearest = i;
        }
      });
      guard.waypointIndex = nearest;
      const target = guard.waypoints[nearest];
      const arrived = moveToward(guard, target[0], target[1], guard.speed, dt, solids);
      if (arrived || guard.suspicion <= 0) {
        guard.state = 'patrol';
        guard.suspicion = 0;
      }
      break;
    }
    default:
      break;
  }

  // Caught: the guard is on the player and can see him.
  if (
    guard.state === 'alert' &&
    distance(guard.x, guard.y, player.x, player.y) < CATCH_DISTANCE &&
    guardSeesPlayer(guard, player, level)
  ) {
    return 'caught';
  }
  // Stuck against a wall while hunting: give up the chase and search
  // the last seen spot instead of shoving at the wall forever.
  if (
    (guard.state === 'alert' || guard.state === 'suspicious' || guard.state === 'investigate') &&
    guard.lastMoveDist < 0.2
  ) {
    guard.stuckTimer += dt;
    if (guard.stuckTimer > 1.5) {
      guard.stuckTimer = 0;
      guard.state = guard.state === 'alert' ? 'investigate' : 'return';
      guard.investigateX = guard.lastSeenX;
      guard.investigateY = guard.lastSeenY;
      guard.lookTimer = 2.5;
      guard.lookAngle = guard.angle;
    }
  } else {
    guard.stuckTimer = 0;
  }
  return null;
}

// The guard's cone colour tells the player his mood at a glance.
export function guardConeColor(guard) {
  if (guard.state === 'alert') return 'rgba(255, 74, 60, 0.30)';
  if (guard.suspicion >= SUSPICIOUS_AT || guard.state === 'suspicious' || guard.state === 'investigate') {
    return 'rgba(242, 161, 62, 0.28)';
  }
  return 'rgba(242, 193, 78, 0.16)';
}

export function guardBodyColor(guard) {
  if (guard.state === 'alert') return '#ff5a4e';
  if (guard.suspicion >= SUSPICIOUS_AT) return '#f2a13e';
  return '#c8ccd6';
}

// How hidden the player is in a bush, for the renderer.
export function playerHiddenInBush(player, level) {
  for (const b of level.bushes) {
    if (pointInRect(player.x, player.y, b)) return true;
  }
  return false;
}

export function playerInShadow(player, level) {
  for (const s of level.shadows) {
    if (pointInRect(player.x, player.y, s)) return true;
  }
  return false;
}
