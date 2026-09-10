import type {
  Vec3,
  ViewId,
  Calibration,
  ObservationPacket,
  WorldState,
  Features,
} from "./types";
import {
  D,
  innerRadius,
  toLocal,
  liquidHeight,
  pelletPosition,
} from "./geometry";
import {
  add,
  mul,
  dot,
  norm,
  sub,
  length,
  clamp,
  stream,
  normal,
  radians,
} from "./math";
type Medium = 0 | 1 | 2;
export function refract(
  direction: Vec3,
  normalIn: Vec3,
  n1: number,
  n2: number,
): Vec3 | null {
  let n = normalIn;
  if (dot(direction, n) > 0) n = mul(n, -1);
  const eta = n1 / n2,
    c = -dot(n, direction),
    k = 1 - eta * eta * (1 - c * c);
  return k < 0
    ? null
    : norm(add(mul(direction, eta), mul(n, eta * c - Math.sqrt(k))));
}
export function calibration(
  view: ViewId,
  width = 112,
  height = 144,
): Calibration {
  return {
    view,
    width,
    height,
    mmPerPixel: view === "side" ? 0.21 : 0.16,
    center: view === "side" ? [0, 0, 14] : [0, 0, 0],
    origin: view === "side" ? [0, -18, 0] : [0, 0, 40],
    direction: view === "side" ? [0, 1, 0] : [0, 0, -1],
    right: [1, 0, 0],
    up: view === "side" ? [0, 0, 1] : [0, 1, 0],
  };
}
function rayStart(c: Calibration, x: number, y: number): Vec3 {
  return add(
    add(c.origin, c.center),
    add(
      mul(c.right, (x + 0.5 - c.width / 2) * c.mmPerPixel),
      mul(c.up, (c.height / 2 - y - 0.5) * c.mmPerPixel),
    ),
  );
}
function medium(p: Vec3, w: WorldState, h: number): Medium {
  const q = toLocal(p, w.tilt, w.pose),
    r = Math.hypot(q[0], q[1]);
  if (q[2] < -0.65 || q[2] > D.tube.innerTop + 0.3) return 0;
  const inner = innerRadius(Math.max(0, q[2]));
  if (r > inner + D.tube.wall) return 0;
  if (r > inner || q[2] < 0) return 1;
  return p[2] < h ? 2 : 0;
}
const index = [1, 1.49, 1.36];
function boundaryNormal(
  p: Vec3,
  w: WorldState,
  h: number,
  a: Medium,
  b: Medium,
): Vec3 {
  const q = toLocal(p, w.tilt, w.pose);
  if (
    ((a === 0 && b === 2) || (a === 2 && b === 0)) &&
    Math.abs(p[2] - h) < 0.22
  )
    return [0, 0, 1];
  if (q[2] < 0.15 || q[2] > D.tube.innerTop - 0.15) return [0, 0, 1];
  const r = Math.hypot(q[0], q[1]) || 1,
    k =
      q[2] < D.tube.coneHeight
        ? (D.tube.innerRadius - D.tube.innerBaseRadius) / D.tube.coneHeight
        : 0;
  const n = norm([q[0] / r, q[1] / r, -k]),
    t = radians(w.tilt);
  return [
    n[0] * Math.cos(t) + n[2] * Math.sin(t),
    n[1],
    -n[0] * Math.sin(t) + n[2] * Math.cos(t),
  ];
}
/** Snapshot ray marcher: air / polypropylene / liquid; Snell transmission, bounded paths, no object-ID image. */
export function renderObservation(
  w: WorldState,
  view: ViewId,
  seed: number,
  t: number,
  exposureGroup: string,
): ObservationPacket {
  const c = calibration(view),
    pixels = new Uint8ClampedArray(c.width * c.height * 4),
    valid = new Uint8Array(c.width * c.height),
    h = liquidHeight(w.volume, w.tilt, undefined, w.pose[2]),
    pellet = pelletPosition(w),
    random = stream(seed, `image-${view}-${exposureGroup}`),
    bias = normal(stream(seed, `calibration-${view}`)) * 0.12;
  const step = 0.32;
  for (let y = 0; y < c.height; y++)
    for (let x = 0; x < c.width; x++) {
      let pos = rayStart(c, x, y);
      pos[2] += view === "side" ? bias : 0;
      let dir: Vec3 = [...c.direction],
        m = medium(pos, w, h),
        glass = 0,
        fluid = 0,
        hit = 0,
        bounces = 0,
        ok = true;
      for (let i = 0; i < 155; i++) {
        const next = add(pos, mul(dir, step)),
          n = medium(next, w, h);
        if (n !== m) {
          let lo = 0,
            hi = step;
          for (let j = 0; j < 7; j++) {
            const d = (lo + hi) / 2;
            if (medium(add(pos, mul(dir, d)), w, h) === m) lo = d;
            else hi = d;
          }
          const boundary = add(pos, mul(dir, hi)),
            normal = boundaryNormal(boundary, w, h, m, n),
            refracted = refract(dir, normal, index[m], index[n]);
          bounces++;
          if (!refracted || bounces > 8) {
            ok = false;
            break;
          }
          dir = refracted;
          pos = add(boundary, mul(dir, 0.02));
          m = medium(pos, w, h);
          continue;
        }
        pos = next;
        if (m === 1) glass += step;
        if (m === 2) fluid += step;
        if (length(sub(pos, pellet)) < w.pelletRadius) {
          hit = 1;
          break;
        }
        if (
          (view === "side" && pos[1] > 14) ||
          (view === "overhead" && pos[2] < -2)
        )
          break;
      }
      const glare =
        Math.max(0, Math.sin(x * 0.15 + seed) * Math.sin(y * 0.04)) *
        (glass > 2 ? 17 : 0);
      const background = 225 + (5 * y) / c.height;
      const noisy = normal(random) * 1.5;
      const shade = clamp(
        background -
          glass * 7 -
          fluid * 3.2 -
          hit * 100 * w.contrast +
          glare +
          noisy,
        35,
        249,
      );
      const i = y * c.width + x;
      pixels[i * 4] = shade;
      pixels[i * 4 + 1] = shade + (fluid > 0 ? 2 : 0);
      pixels[i * 4 + 2] = shade + (fluid > 0 ? 1 : 0);
      pixels[i * 4 + 3] = 255;
      valid[i] = ok && glare < 12 ? 1 : 0;
    }
  return {
    version: 1,
    id: `${seed}-${view}-${exposureGroup}`,
    t,
    calibration: c,
    pixels,
    valid,
    exposureGroup,
  };
}
/** Only pixels/calibration enter feature extraction. No world, seed, geometry truth or semantic mask. */
export function extractFeatures(packet: ObservationPacket): Features {
  const { pixels, valid, calibration: c } = packet,
    w = c.width,
    h = c.height;
  const gray = (x: number, y: number) => pixels[(y * w + x) * 4];
  const xMean: number[] = [];
  for (let x = 0; x < w; x++) {
    let sum = 0,
      n = 0;
    for (let y = Math.floor(h * 0.15); y < Math.floor(h * 0.65); y++)
      if (valid[y * w + x]) {
        sum += gray(x, y);
        n++;
      }
    xMean[x] = n ? sum / n : 230;
  }
  const dark = xMean.map((v, x) => (v < 217 ? x : -1)).filter((x) => x >= 0),
    left = dark[0] ?? w * 0.3,
    right = dark.at(-1) ?? w * 0.7,
    center = (left + right) / 2;
  let level: number | null = null,
    best = 0,
    levelY = 0;
  const a = Math.max(1, Math.round(center - 6)),
    b = Math.min(w - 2, Math.round(center + 6));
  if (c.view === "side")
    for (let y = 5; y < h - 12; y++) {
      let difference = 0,
        n = 0;
      for (let x = a; x <= b; x++)
        if (valid[(y - 4) * w + x] && valid[(y + 4) * w + x]) {
          difference += gray(x, y - 4) - gray(x, y + 4);
          n++;
        }
      difference /= n || 1;
      if (difference > 8 && n >= 5) {
        best = difference;
        levelY = y + 2;
        break;
      }
    }
  if (best > 4) level = c.center[2] + (h / 2 - levelY) * c.mmPerPixel;
  // Pellet detection is intentionally conservative: no artificial labels or color coding.
  let pelletAngle: number | null = null,
    px = 0,
    py = 0,
    count = 0;
  const threshold = 135;
  for (let y = 3; y < h - 3; y++)
    for (
      let x = Math.max(0, Math.round(left));
      x < Math.min(w, Math.round(right));
      x++
    )
      if (valid[y * w + x] && gray(x, y) < threshold) {
        px += x;
        py += y;
        count++;
      }
  if (c.view === "overhead" && count >= 3 && count < 90) {
    const dx = (px / count - w / 2) * c.mmPerPixel,
      dy = (h / 2 - py / count) * c.mmPerPixel;
    pelletAngle = Math.atan2(dy, dx);
  }
  return {
    level,
    levelSigma: Math.max(0.28, 1.2 / (best || 1)),
    tubeX: dark.length > 5 ? (center - w / 2) * c.mmPerPixel : null,
    tubeXSigma: c.view === "side" ? 0.4 : 0.5,
    pelletAngle,
    pelletSigma: 0.55,
    visiblePixels: count,
    quality: clamp((best + dark.length * 0.1) / 20, 0, 1),
  };
}
