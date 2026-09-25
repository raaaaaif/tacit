import { D, tipRadius, toLocal } from "./geometry";
import type { Vec3, WorldState } from "./types";

/** Conservative ray-validity mask for hardware whose transmission is unsupported.
 * These are the same constructive primitives as the holder CAD, expanded by half
 * a ray step. This mask never supplies a pellet or liquid segmentation label.
 */
export function hardwareOccluder(world: WorldState, tip?: Vec3) {
  const pose = world.fixturePose ?? [0, 0, 0];
  const a = (world.tilt * Math.PI) / 180,
    c = Math.cos(a),
    s = Math.sin(a);
  const sx = 14 * s,
    sz = 14 * c,
    padding = 0.17;
  const posts = [-1, 1].map((side) => ({
    x: side * 9 + sx,
    top: sz - side * 9 * s,
  }));
  const bore = D.tube.outerRadius + world.fixture.clearance - padding;
  return (p: Vec3) => {
    if (
      tip &&
      p[2] >= tip[2] &&
      p[2] <= tip[2] + D.tip.taperLength + D.tip.shaftLength
    ) {
      if (
        Math.hypot(p[0] - tip[0], p[1] - tip[1]) <
        tipRadius(p[2] - tip[2]) + padding
      )
        return true;
    }
    const x = p[0] - pose[0],
      y = p[1] - pose[1],
      z = p[2] - pose[2];
    if (z > -4.4 && z < 18 && Math.abs(x) < 18 && Math.abs(y) < 15) {
      if (
        Math.abs(z + 2.6) < D.holder.baseHeight / 2 + padding &&
        Math.abs(x) < D.holder.width / 2 + padding &&
        Math.abs(y) < D.holder.depth / 2 + padding
      )
        return true;
      for (const post of posts)
        if (
          Math.abs(x - post.x) < 2.5 + padding &&
          Math.abs(y) < 5 + padding &&
          z > -1.3 - padding &&
          z < post.top + padding
        )
          return true;
      const lx = c * x - s * z,
        lz = s * x + c * z,
        r = Math.hypot(lx, y);
      if (
        r > bore &&
        ((Math.abs(lx) < 11.5 + padding &&
          Math.abs(y) < 5 + padding &&
          Math.abs(lz - 14) < 1.5 + padding) ||
          (r < 6.4 + padding && Math.abs(lz - 14) < 1.3 + padding))
      )
        return true;
      if (
        r < D.holder.supportRadius + padding &&
        lz > D.holder.supportBottom - padding &&
        lz < D.holder.supportTop + padding
      )
        return true;
      if (world.fixture.indexed && r > bore) {
        const dx = x - sx,
          dz = z - sz - 0.2;
        if (
          Math.abs(c * dx - s * dz) < 1 + padding &&
          Math.abs(y - 5.7) < 2 + padding &&
          Math.abs(s * dx + c * dz) < 1 + padding
        )
          return true;
      }
    }
    if (p[2] > 28 && p[2] < 36 && p[1] - world.pose[1] > 3) {
      const q = toLocal(p, world.tilt, world.pose);
      if (
        Math.abs(q[2] - D.tube.capZ) < D.tube.capThickness / 2 + padding &&
        Math.hypot(q[0], q[1] - D.tube.capY) < D.tube.capRadius + padding
      )
        return true;
      if (
        q.every(
          (v, i) =>
            Math.abs(v - D.tube.hingeCenter[i]) <
            D.tube.hingeSize[i] / 2 + padding,
        )
      )
        return true;
    }
    return false;
  };
}
