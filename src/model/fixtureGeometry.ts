import type { FixtureSpec, Vec3 } from "./types";
import D from "./dimensions.json";
/** Signed distance bounds for the same constructive primitives in cad/solid.ts. */
export function fixtureDistance(p: Vec3, s: FixtureSpec) {
  const a = (s.tilt * Math.PI) / 180,
    c = Math.cos(a),
    sn = Math.sin(a),
    sx = 14 * sn,
    sz = 14 * c;
  function box(center: Vec3, size: Vec3, angle = 0) {
    const x = p[0] - center[0],
      y = p[1] - center[1],
      z = p[2] - center[2],
      ca = Math.cos(angle),
      sa = Math.sin(angle);
    const q = [
      Math.abs(ca * x - sa * z) - size[0] / 2,
      Math.abs(y) - size[1] / 2,
      Math.abs(sa * x + ca * z) - size[2] / 2,
    ];
    return (
      Math.hypot(...q.map((v) => Math.max(0, v))) + Math.min(0, Math.max(...q))
    );
  }
  const local: Vec3 = [c * p[0] - sn * p[2], p[1], sn * p[0] + c * p[2]];
  const cylinder = (r: number, half: number, z: number) => {
    const q = [
      Math.hypot(local[0], local[1]) - r,
      Math.abs(local[2] - z) - half,
    ];
    return (
      Math.hypot(Math.max(0, q[0]), Math.max(0, q[1])) +
      Math.min(0, Math.max(...q))
    );
  };
  const base = box(
    [0, 0, -2.6],
    [D.holder.width, D.holder.depth, D.holder.baseHeight],
  );
  const posts = [-1, 1].map((side) => {
    const top = sz - side * 9 * sn;
    return box([side * 9 + sx, 0, (top - 1.3) / 2], [5, 10, top + 1.3]);
  });
  const shoulder = box([sx, 0, sz], [23, 10, 3], a),
    ring = cylinder(6.4, 1.3, 14),
    bore = cylinder(D.tube.outerRadius + s.clearance, 25, 0);
  const seat = Math.max(Math.min(shoulder, ring), -bore);
  const index = s.indexed ? box([sx, 5.7, sz + 0.2], [2, 4, 2], a) : Infinity;
  return Math.min(base, ...posts, seat, index);
}
