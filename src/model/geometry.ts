import { fixtureDistance } from "./fixtureGeometry";
import D from "./dimensions.json";
import type { Vec3, Tilt, WorldState, FixtureSpec } from "./types";
import { clamp, radians, sub, length } from "./math";
export { D };
export const MODEL_VERSION = "tacit-0.4.0";
export const innerRadius = (z: number) =>
  z < 0
    ? 0
    : z < D.tube.coneHeight
      ? D.tube.innerBaseRadius +
        ((D.tube.innerRadius - D.tube.innerBaseRadius) * z) / D.tube.coneHeight
      : D.tube.innerRadius;
export const tipRadius = (aboveEnd: number) =>
  aboveEnd < D.tip.taperLength
    ? D.tip.apertureRadius +
      ((D.tip.shoulderRadius - D.tip.apertureRadius) * Math.max(0, aboveEnd)) /
        D.tip.taperLength
    : D.tip.shaftRadius;
export function toWorld(p: Vec3, tilt: number, pose: Vec3 = [0, 0, 0]): Vec3 {
  const a = radians(tilt),
    c = Math.cos(a),
    s = Math.sin(a);
  return [
    c * p[0] + s * p[2] + pose[0],
    p[1] + pose[1],
    -s * p[0] + c * p[2] + pose[2],
  ];
}
export function toLocal(p: Vec3, tilt: number, pose: Vec3 = [0, 0, 0]): Vec3 {
  const a = radians(tilt),
    c = Math.cos(a),
    s = Math.sin(a),
    q = sub(p, pose);
  return [c * q[0] - s * q[2], q[1], s * q[0] + c * q[2]];
}
export function uprightVolume(h: number) {
  h = clamp(h, 0, D.tube.innerTop);
  const z = Math.min(h, D.tube.coneHeight),
    a = D.tube.innerBaseRadius,
    b = (D.tube.innerRadius - a) / D.tube.coneHeight;
  return (
    Math.PI *
    (a * a * z +
      a * b * z * z +
      (b * b * z * z * z) / 3 +
      Math.max(0, h - z) * D.tube.innerRadius ** 2)
  );
}
/** Integrate exact circular segment areas; midpoint quadrature refined in independent tests. */
export function tiltedVolume(h: number, tilt: Tilt, slices = 256) {
  if (!tilt) return uprightVolume(h);
  const a = radians(tilt),
    s = Math.sin(a),
    c = Math.cos(a),
    dz = D.tube.innerTop / slices;
  let v = 0;
  for (let i = 0; i < slices; i++) {
    const z = (i + 0.5) * dz,
      r = innerRadius(z),
      q = (c * z - h) / (s * r);
    const fraction =
      q <= -1
        ? 1
        : q >= 1
          ? 0
          : (Math.acos(q) - q * Math.sqrt(1 - q * q)) / Math.PI;
    v += Math.PI * r * r * fraction * dz;
  }
  return v;
}
const tables = new Map<Tilt, { h: number; v: number }[]>();
function table(tilt: Tilt) {
  let t = tables.get(tilt);
  if (!t) {
    t = Array.from({ length: 641 }, (_, i) => {
      const h = -1 + (i * 35) / 640;
      return { h, v: tiltedVolume(h, tilt) };
    });
    tables.set(tilt, t);
  }
  return t;
}
export function volumeAtHeight(h: number, tilt: Tilt) {
  if (!tilt) return uprightVolume(h);
  const t = table(tilt),
    u = clamp(((h + 1) * 640) / 35, 0, 640),
    i = Math.min(639, Math.floor(u));
  return t[i].v + (t[i + 1].v - t[i].v) * (u - i);
}
export function displacedTipVolume(height: number, tip: Vec3) {
  const z = clamp(height - tip[2], 0, D.tip.taperLength),
    a = D.tip.apertureRadius,
    b = (D.tip.shoulderRadius - a) / D.tip.taperLength;
  return Math.PI * (a * a * z + a * b * z * z + (b * b * z * z * z) / 3);
}
export function liquidHeight(
  volume: number,
  tilt: Tilt,
  tip?: Vec3,
  poseZ = 0,
) {
  let lo = -1,
    hi = 34;
  for (let i = 0; i < 28; i++) {
    const mid = (lo + hi) / 2;
    const v =
      volumeAtHeight(mid, tilt) -
      (tip ? displacedTipVolume(mid + poseZ, tip) : 0);
    if (v < volume) lo = mid;
    else hi = mid;
  }
  return (lo + hi) / 2 + poseZ;
}
export function pelletPosition(
  w: Pick<
    WorldState,
    "pelletAngle" | "pelletZ" | "pelletRadius" | "tilt" | "pose"
  >,
): Vec3 {
  const r = innerRadius(w.pelletZ) - w.pelletRadius * 0.5;
  return toWorld(
    [r * Math.cos(w.pelletAngle), r * Math.sin(w.pelletAngle), w.pelletZ],
    w.tilt,
    w.pose,
  );
}
export function instrumentClearance(
  tip: Vec3,
  w: Pick<WorldState, "tilt" | "pose" | "fixture" | "fixturePose">,
) {
  let min = Infinity;
  const end = D.tip.taperLength + D.tip.shaftLength;
  for (let z = 0; z <= end; z += 0.4) {
    const p: Vec3 = [tip[0], tip[1], tip[2] + z],
      q = toLocal(p, w.tilt, w.pose),
      r = tipRadius(z);
    if (q[2] >= -0.1 && q[2] <= D.tube.innerTop + D.tube.lipHeight) {
      min = Math.min(
        min,
        (innerRadius(Math.min(D.tube.innerTop, q[2])) -
          Math.hypot(q[0], q[1])) *
          Math.cos(radians(w.tilt)) -
          r,
      );
    }
    if (q[2] < 0 && Math.hypot(q[0], q[1]) < D.tube.outerRadius + r)
      min = Math.min(min, q[2] - r);
    /* Open lid: parked behind the hinge in local +Y. */ const cap: Vec3 = [
      0,
      D.tube.capY,
      D.tube.capZ,
    ];
    if (Math.abs(q[2] - cap[2]) < r + D.tube.capThickness / 2) {
      min = Math.min(
        min,
        Math.hypot(q[0], q[1] - cap[1]) - D.tube.capRadius - r,
      );
    }
    // The open-cap hinge joins the lip to the lid; include its whole box.
    const hinge = q.map(
      (v, i) => Math.abs(v - D.tube.hingeCenter[i]) - D.tube.hingeSize[i] / 2,
    );
    const hingeDistance =
      Math.hypot(...hinge.map((v) => Math.max(0, v))) +
      Math.min(0, Math.max(...hinge));
    min = Math.min(min, hingeDistance - r);
    // The holder stays fixed to the bench even when the specimen seating pose varies.
    min = Math.min(
      min,
      fixtureDistance(sub(p, w.fixturePose ?? [0, 0, 0]), w.fixture) - r,
    );
  }
  return min;
}
/** Conservative advancement: clearance is 1-Lipschitz under rigid translation. */
export function sweptClearance(
  from: Vec3,
  to: Vec3,
  w: Pick<WorldState, "tilt" | "pose" | "fixture" | "fixturePose">,
) {
  const dist = length(sub(to, from));
  if (dist < 1e-9) return instrumentClearance(to, w);
  let u = 0,
    min = Infinity;
  while (u <= 1) {
    const p: Vec3 = [
        from[0] + (to[0] - from[0]) * u,
        from[1] + (to[1] - from[1]) * u,
        from[2] + (to[2] - from[2]) * u,
      ],
      c = instrumentClearance(p, w) - 0.21;
    min = Math.min(min, c);
    if (c < 0) return c;
    u += Math.max(0.0001, Math.min(0.05, (c * 0.5) / dist));
  }
  return Math.min(min, instrumentClearance(to, w) - 0.21);
}
export function moveTime(from: Vec3, to: Vec3) {
  const d = length(sub(to, from)),
    v = D.stage.maxVelocity,
    a = D.stage.acceleration;
  return d < (v * v) / a
    ? 2 * Math.sqrt(d / a)
    : (2 * v) / a + (d - (v * v) / a) / v;
}
export function capillaryLength() {
  return (
    Math.sqrt(D.fluid.surfaceTension / (D.fluid.density * D.fluid.gravity)) *
    1000
  );
}
export const defaultFixture: FixtureSpec = {
  version: 1,
  tilt: 0,
  indexed: true,
  window: D.holder.windowWidth,
  seatingSigma: 0.15,
  clearance: D.holder.seatClearance,
};

/** Conservative swept distance of every axial instrument section to the protected pellet. */
export function sweptPelletClearance(
  from: Vec3,
  to: Vec3,
  pellet: Vec3,
  radius: number,
) {
  const delta = sub(to, from),
    den = delta.reduce((sum, v) => sum + v * v, 0);
  let closest = Infinity;
  for (let z = 0; z <= D.tip.taperLength + D.tip.shaftLength; z += 0.4) {
    const start: Vec3 = [from[0], from[1], from[2] + z];
    const t =
      den > 0
        ? clamp(
            sub(pellet, start).reduce((sum, v, i) => sum + v * delta[i], 0) /
              den,
            0,
            1,
          )
        : 0;
    const center = start.map((v, i) => v + delta[i] * t) as Vec3;
    closest = Math.min(
      closest,
      length(sub(center, pellet)) - radius - tipRadius(z) - 0.21,
    );
  }
  return closest;
}
