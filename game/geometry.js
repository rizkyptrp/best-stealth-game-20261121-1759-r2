// The Quiet Floor — geometry helpers.
// Small, pure functions for collision and sight: a circle against the
// level's rectangles, and whether a straight line between two points is
// blocked by a wall or a crate.

export function pointInRect(px, py, r) {
  return px >= r.x && px <= r.x + r.w && py >= r.y && py <= r.y + r.h;
}

export function circleHitsRect(cx, cy, radius, r) {
  const nx = Math.max(r.x, Math.min(cx, r.x + r.w));
  const ny = Math.max(r.y, Math.min(cy, r.y + r.h));
  const dx = cx - nx;
  const dy = cy - ny;
  return dx * dx + dy * dy < radius * radius;
}

export function circleHitsAnyRect(cx, cy, radius, rects) {
  for (const r of rects) {
    if (circleHitsRect(cx, cy, radius, r)) return true;
  }
  return false;
}

// Move a circle by (dx, dy) against solid rectangles, sliding along them:
// try the x step, then the y step, keeping whichever axis is free.
export function moveCircle(x, y, radius, dx, dy, solids) {
  let nx = x;
  let ny = y;
  if (!circleHitsAnyRect(x + dx, y, radius, solids)) nx = x + dx;
  if (!circleHitsAnyRect(nx, y + dy, radius, solids)) ny = y + dy;
  return { x: nx, y: ny };
}

function segmentHitsRect(x1, y1, x2, y2, r) {
  // Slab test: the segment enters the rectangle's x-span and y-span at
  // overlapping parameters.
  const dx = x2 - x1;
  const dy = y2 - y1;
  let tMin = 0;
  let tMax = 1;
  const axes = [
    [x1, dx, r.x, r.x + r.w],
    [y1, dy, r.y, r.y + r.h],
  ];
  for (const [p, d, lo, hi] of axes) {
    if (Math.abs(d) < 1e-9) {
      if (p < lo || p > hi) return false;
    } else {
      let t1 = (lo - p) / d;
      let t2 = (hi - p) / d;
      if (t1 > t2) {
        const tmp = t1;
        t1 = t2;
        t2 = tmp;
      }
      tMin = Math.max(tMin, t1);
      tMax = Math.min(tMax, t2);
      if (tMin > tMax) return false;
    }
  }
  return true;
}

export function segmentBlocked(x1, y1, x2, y2, rects) {
  for (const r of rects) {
    if (segmentHitsRect(x1, y1, x2, y2, r)) return true;
  }
  return false;
}

// Can `from` see `to`? Nothing but distance is checked here; the caller
// adds range and angle. Walls and crates block sight.
export function hasLineOfSight(fromX, fromY, toX, toY, blockers) {
  return !segmentBlocked(fromX, fromY, toX, toY, blockers);
}

export function distance(ax, ay, bx, by) {
  const dx = bx - ax;
  const dy = by - ay;
  return Math.sqrt(dx * dx + dy * dy);
}

export function clamp(v, lo, hi) {
  return v < lo ? lo : v > hi ? hi : v;
}

export function angleDifference(a, b) {
  let d = a - b;
  while (d > Math.PI) d -= Math.PI * 2;
  while (d < -Math.PI) d += Math.PI * 2;
  return d;
}
