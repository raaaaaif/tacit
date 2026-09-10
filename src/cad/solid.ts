import type { ManifoldToplevel, Manifold } from "manifold-3d";
import type { FixtureSpec } from "../model/types";
import D from "../model/dimensions.json";

/** CAD and presentation meshes are generated from this one constructive solid. Units: mm. */
export function fixtureSolid(module: ManifoldToplevel, spec: FixtureSpec) {
  const M = module.Manifold,
    owned: Manifold[] = [];
  const keep = (m: Manifold) => {
    owned.push(m);
    return m;
  };
  const box = (
    size: [number, number, number],
    pos: [number, number, number],
    tilt = 0,
  ) => keep(keep(keep(M.cube(size, true)).rotate([0, tilt, 0])).translate(pos));
  const a = (spec.tilt * Math.PI) / 180,
    sx = 14 * Math.sin(a),
    sz = 14 * Math.cos(a);
  const base = box(
    [D.holder.width, D.holder.depth, D.holder.baseHeight],
    [0, 0, -2.6],
  );
  const posts = [-1, 1].map((side) => {
    const x = side * 9 + sx,
      top = sz - side * 9 * Math.sin(a);
    return box([5, 10, top + 1.3], [x, 0, (top - 1.3) / 2]);
  });
  const shoulder = box([23, 10, 3], [sx, 0, sz], spec.tilt);
  const bore = keep(
    keep(
      M.cylinder(
        50,
        D.tube.outerRadius + spec.clearance,
        D.tube.outerRadius + spec.clearance,
        96,
        true,
      ),
    ).rotate([0, spec.tilt, 0]),
  );
  const ring = keep(
    keep(
      keep(M.cylinder(2.6, 6.4, 6.4, 96, true)).rotate([0, spec.tilt, 0]),
    ).translate([sx, 0, sz]),
  );
  const seat = keep(keep(shoulder.add(ring)).subtract(bore));
  const parts = [base, ...posts, seat];
  // A rear indexing fence marks the known centrifugation orientation; it does not recover history.
  if (spec.indexed) parts.push(box([2, 4, 2], [sx, 5.7, sz + 0.2], spec.tilt));
  const result = M.union(parts);
  owned.forEach((m) => m.delete());
  return result;
}
