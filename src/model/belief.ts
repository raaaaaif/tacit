import type {
  BeliefState,
  ScenarioSpec,
  ObservationPacket,
  Features,
  Particle,
} from "./types";
import { normal, stream, quantile, angleDiff, radians } from "./math";
import { liquidHeight, volumeAtHeight } from "./geometry";
import { extractFeatures } from "./optics";
export function summarize(b: BeliefState): BeliefState {
  const ps = b.particles;
  let acc = 0;
  const weighted = (values: { value: number; weight: number }[], q: number) => {
    const s = values.sort((a, b) => a.value - b.value);
    let w = 0;
    for (const x of s) {
      w += x.weight;
      if (w >= q) return x.value;
    }
    return s.at(-1)!.value;
  };
  b.volume = [
    weighted(
      ps.map((p) => ({ value: p.volume, weight: p.weight })),
      0.025,
    ),
    weighted(
      ps.map((p) => ({ value: p.volume, weight: p.weight })),
      0.975,
    ),
  ];
  b.poseX = [
    weighted(
      ps.map((p) => ({ value: p.pose[0], weight: p.weight })),
      0.025,
    ),
    weighted(
      ps.map((p) => ({ value: p.pose[0], weight: p.weight })),
      0.975,
    ),
  ];
  b.effectiveN = 1 / ps.reduce((s, p) => s + p.weight * p.weight, 0);
  return b;
}
export function initialBelief(s: ScenarioSpec, count = 128): BeliefState {
  const r = stream(s.seed, "prior");
  const particles = Array.from({ length: count }, () => ({
    volume: s.volume + normal(r) * 35,
    pose: [
      normal(r) * Math.max(0.2, s.poseSigma),
      normal(r) * Math.max(0.2, s.poseSigma),
      0,
    ] as [number, number, number],
    pelletAngle: s.historyKnown
      ? Math.PI / 2 + normal(r) * 0.3
      : r() * Math.PI * 2,
    weight: 1 / count,
  }));
  return summarize({
    version: 1,
    particles,
    seenGroups: [],
    observations: 0,
    volume: [0, 0],
    poseX: [0, 0],
    pelletKnown: s.historyKnown,
    effectiveN: count,
  });
}
export function updateBelief(
  b: BeliefState,
  packet: ObservationPacket,
  s: ScenarioSpec,
): { belief: BeliefState; features: Features } {
  const features = extractFeatures(packet);
  if (b.seenGroups.includes(packet.exposureGroup))
    return { belief: b, features };
  const particles = b.particles.map((p) => ({
    ...p,
    pose: [...p.pose] as [number, number, number],
  }));
  let total = 0;
  for (const p of particles) {
    let log = 0;
    if (features.level !== null) {
      const predicted = liquidHeight(p.volume, s.fixture.tilt);
      const sigma = Math.hypot(features.levelSigma, s.cameraBias, 0.3);
      log -= 0.5 * ((predicted - features.level) / sigma) ** 2;
    }
    if (features.tubeX !== null && packet.calibration.view === "side") {
      const expected = p.pose[0] + Math.sin(radians(s.fixture.tilt)) * 16;
      log -=
        0.5 *
        ((expected - features.tubeX) / Math.hypot(features.tubeXSigma, 0.2)) **
          2;
    }
    if (features.pelletAngle !== null)
      log -=
        0.5 *
        (angleDiff(p.pelletAngle, features.pelletAngle) /
          features.pelletSigma) **
          2;
    p.weight *= Math.exp(Math.max(-25, log));
    total += p.weight;
  }
  for (const p of particles) p.weight /= total || 1;
  const result: BeliefState = {
    ...b,
    particles,
    seenGroups: [...b.seenGroups, packet.exposureGroup],
    observations: b.observations + 1,
    pelletKnown: b.pelletKnown || features.pelletAngle !== null,
  };
  // Systematic resampling only on degeneration. Measurement/model floors remain after resampling.
  summarize(result);
  if (result.effectiveN < particles.length * 0.35) {
    const random = stream(s.seed, `resample-${packet.exposureGroup}`),
      out: Particle[] = [],
      n = particles.length;
    let j = 0,
      c = particles[0].weight,
      u = random() / n;
    for (let i = 0; i < n; i++) {
      while (u + i / n > c && j < n - 1) c += particles[++j].weight;
      const p = particles[j];
      out.push({
        ...p,
        volume: Math.max(0, p.volume + normal(random) * 8),
        pose: [p.pose[0] + normal(random) * 0.08, p.pose[1], p.pose[2]],
        weight: 1 / n,
      });
    }
    result.particles = out;
  }
  return { belief: summarize(result), features };
}
export function predictWithdrawal(
  b: BeliefState,
  amount: number,
  sigma: number,
  seed: number,
): BeliefState {
  const r = stream(seed, "belief-pump");
  return summarize({
    ...b,
    particles: b.particles.map((p) => ({
      ...p,
      volume: Math.max(0, p.volume - amount * (1 + normal(r) * sigma)),
    })),
  });
}
export function meanState(b: BeliefState) {
  return {
    volume: b.particles.reduce((s, p) => s + p.volume * p.weight, 0),
    pose: [
      b.particles.reduce((s, p) => s + p.pose[0] * p.weight, 0),
      b.particles.reduce((s, p) => s + p.pose[1] * p.weight, 0),
      0,
    ] as [number, number, number],
    angle: Math.atan2(
      b.particles.reduce((s, p) => s + Math.sin(p.pelletAngle) * p.weight, 0),
      b.particles.reduce((s, p) => s + Math.cos(p.pelletAngle) * p.weight, 0),
    ),
  };
}
