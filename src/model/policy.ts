/** Ordinary planning has no environment or evaluator import. Inputs are copied by whitelist. */
import type {
  ScenarioSpec,
  PolicySpec,
  BeliefState,
  Vec3,
  ViewId,
} from "./types";
import type {
  DecisionCheck,
  EvidenceRef,
  CandidateRecord,
  ObservationOption,
} from "./evidence";
import {
  D,
  toWorld,
  innerRadius,
  liquidHeight,
  volumeAtHeight,
  displacedTipVolume,
  sweptClearance,
  sweptPelletClearance,
  pelletPosition,
} from "./geometry";
import { meanState, updateBelief } from "./belief";
import { surfaceSupport } from "./reference";
import { assemblySupported } from "./assembly";
import { renderObservation } from "./optics";

export interface PolicyInput {
  scenario: ScenarioSpec;
  policy: PolicySpec;
  belief: BeliefState;
  tip: Vec3;
  commanded: number;
  evidence: EvidenceRef[];
  views: ViewId[];
}
export function policyInput(
  s: ScenarioSpec,
  p: PolicySpec,
  b: BeliefState,
  tip: Vec3,
  commanded: number,
  evidence: EvidenceRef[],
  views: ViewId[],
): PolicyInput {
  // No world, final assessment, hidden volume, physical angle, or closure capability.
  return structuredClone({
    scenario: {
      version: s.version,
      id: s.id,
      seed: s.seed,
      volume: s.volume,
      fixture: {
        version: s.fixture.version,
        tilt: s.fixture.tilt,
        indexed: s.fixture.indexed,
        window: s.fixture.window,
        seatingSigma: s.fixture.seatingSigma,
        clearance: s.fixture.clearance,
      },
      historyKnown: s.historyKnown,
      contrast: s.contrast,
      poseSigma: s.poseSigma,
      pumpSigma: s.pumpSigma,
      cameraBias: s.cameraBias,
    },
    policy: {
      version: p.version,
      controller: p.controller,
      chunk: p.chunk,
      margin: p.margin,
      surfaceDepth: p.surfaceDepth,
      observeEvery: p.observeEvery,
      residualTarget: p.residualTarget,
    },
    belief: {
      version: b.version,
      particles: b.particles.map((q) => ({
        volume: q.volume,
        pose: [...q.pose],
        pelletAngle: q.pelletAngle,
        weight: q.weight,
        levelBias: q.levelBias,
      })),
      seenGroups: [...b.seenGroups],
      observations: b.observations,
      volume: [...b.volume],
      poseX: [...b.poseX],
      poseY: [...b.poseY],
      pelletKnown: b.pelletKnown,
      effectiveN: b.effectiveN,
    },
    tip: [...tip],
    commanded,
    evidence: evidence.map((e) => ({
      id: e.id,
      kind: e.kind,
      capturedAtS: e.capturedAtS,
      availableAtS: e.availableAtS,
      correlationGroup: e.correlationGroup,
    })),
    views: [...views],
  }) as PolicyInput;
}
export const UNCERTAINTY =
  "Marginal 95% pose/volume intervals; all retained particle orientations (entire orientation ring when unresolved); 3σ pump allowance and 1.85 mm surface allowance. Sampled/composite screening, not a joint guarantee. Gaussian tails and real model discrepancy are not bounded.";
export function evaluateCandidates(input: PolicyInput): CandidateRecord[] {
  const { scenario: s, policy: p, belief: b, tip, commanded } = input,
    mean = meanState(b);
  const robust = ["progress", "belief", "preflight"].includes(p.controller);
  const nominal = ["nominal", "preflight"].includes(p.controller);
  const lower = robust ? b.volume[0] : mean.volume,
    upper = robust ? b.volume[1] : mean.volume;
  const depth = p.surfaceDepth;
  const designs =
    p.controller === "progress"
      ? [
          { depth, r: 1.1 },
          { depth: depth + 1, r: 0 },
          { depth: Math.max(2, depth - 1), r: 0 },
          { depth, r: 0 },
        ]
      : [{ depth, r: 1.35 }];
  const poses: Vec3[] = robust
    ? [
        [b.poseX[0], b.poseY[0], 0],
        [b.poseX[0], b.poseY[1], 0],
        [b.poseX[1], b.poseY[0], 0],
        [b.poseX[1], b.poseY[1], 0],
        mean.pose,
      ]
    : [nominal ? [0, 0, 0] : mean.pose];
  // Each hypothesis has a stationary holder. Its unknown seating offset is bounded
  // by 0.8 × seat clearance; subtract that distance from the swept clearance.
  // Tube placement is in the transverse plane; bound its z contribution separately.
  const poseZAllowance = robust
    ? Math.sin((s.fixture.tilt * Math.PI) / 180) * s.fixture.clearance
    : 0;
  const refs = input.evidence.map((e) => e.id);
  const check = (
    id: string,
    value: number,
    threshold: number,
    unit: string,
    method: string,
  ): DecisionCheck => ({
    id,
    status: value >= threshold ? "pass" : "fail",
    value,
    threshold,
    unit,
    relation: "≥",
    method,
    evidenceIds: refs,
  });
  return designs.map((d, i) => {
    const z = Math.max(
      3,
      (liquidHeight(nominal ? mean.volume : lower, s.fixture.tilt) - d.depth) /
        Math.cos((s.fixture.tilt * Math.PI) / 180),
    );
    const radius = Math.min(d.r, Math.max(0, innerRadius(z) - 1.6));
    const az = nominal ? Math.PI * 1.5 : mean.angle + Math.PI;
    const target = toWorld(
      [radius * Math.cos(az), radius * Math.sin(az), z],
      s.fixture.tilt,
      nominal ? [0, 0, 0] : mean.pose,
    );
    const support = surfaceSupport(s.fixture.tilt, [lower, upper]);
    const allowance =
      robust || p.controller === "oracle"
        ? Math.max(D.operating.surfaceAllowance, support.depression)
        : 0.65;
    const reserve =
      volumeAtHeight(target[2] + allowance + poseZAllowance, s.fixture.tilt) -
      displacedTipVolume(target[2] + allowance + poseZAllowance, target);
    const requested = Math.max(
      0,
      Math.min(
        p.chunk,
        mean.volume - p.residualTarget,
        (lower - reserve - 0.01) / (1 + 3 * s.pumpSigma),
        (D.tip.capacity - commanded * (1 + 3 * s.pumpSigma)) /
          (1 + 3 * s.pumpSigma),
        (lower - 100) / (1 + 3 * s.pumpSigma),
      ),
    );
    const endVolume = lower - requested * (1 + 3 * s.pumpSigma);
    const hardware =
      Math.min(
        ...poses.map((pose) =>
          sweptClearance(tip, target, {
            tilt: s.fixture.tilt,
            pose,
            fixturePose: [pose[0], pose[1], 0],
            fixture: s.fixture,
          }),
        ),
      ) -
      poseZAllowance -
      (robust || p.controller === "oracle" ? s.fixture.clearance * 0.8 : 0);
    // Enclose every retained orientation with a sphere; a missing history uses the full ring.
    const center = pelletPosition({
      pose: mean.pose,
      tilt: s.fixture.tilt,
      pelletAngle: mean.angle,
      pelletZ: 3.3,
      pelletRadius: 0.65,
    });
    let angularAllowance = 0;
    if (robust) {
      if (!b.pelletKnown) angularAllowance = 2 * (innerRadius(3.3) - 0.325);
      else
        for (const q of b.particles)
          angularAllowance = Math.max(
            angularAllowance,
            2 *
              (innerRadius(3.3) - 0.325) *
              Math.abs(Math.sin((q.pelletAngle - mean.angle) / 2)),
          );
    }
    const poseAllowance = robust
      ? Math.hypot(
          Math.max(
            Math.abs(b.poseX[0] - mean.pose[0]),
            Math.abs(b.poseX[1] - mean.pose[0]),
          ),
          Math.max(
            Math.abs(b.poseY[0] - mean.pose[1]),
            Math.abs(b.poseY[1] - mean.pose[1]),
          ),
        )
      : 0;
    const pellet = sweptPelletClearance(
      tip,
      target,
      center,
      0.65 + angularAllowance + poseAllowance + (robust ? 0.45 : 0),
    );
    const immersion =
      liquidHeight(Math.max(0, endVolume), s.fixture.tilt, target) -
      target[2] -
      poseZAllowance;
    const workspace = Math.min(
      D.stage.xyLimit - Math.abs(target[0]),
      D.stage.xyLimit - Math.abs(target[1]),
      target[2] - D.stage.zMin,
      D.stage.zMax - target[2],
    );
    const checks = [
      check(
        "assembly-fit",
        assemblySupported(s.fixture) ? 1 : 0,
        1,
        "boolean",
        "bottom-datum-guide-02; nominal sampled fit, camera housings excluded",
      ),
      check(
        "model-domain",
        support.supported && endVolume >= 100 ? 1 : 0,
        1,
        "boolean",
        "0° or 5°; complete stroke in 100–950 µL interval",
      ),
      check(
        "swept-hardware",
        hardware,
        D.operating.wallBuffer,
        "mm",
        "tip/shaft sweep, pose interval corners, axial sampling allowance",
      ),
      check(
        "swept-pellet",
        pellet,
        p.margin,
        "mm",
        "swept instrument against orientation/pose enclosing sphere; assumed 1.8 mm exclusion",
      ),
      check(
        "motion-limits",
        workspace,
        0,
        "mm",
        "linear trajectory workspace extrema; bounded stage profile",
      ),
      check(
        "immersion-through-stroke",
        immersion,
        allowance,
        "mm",
        "monotone depletion: worst pump-volume endpoint with tip displacement and surface allowance",
      ),
      check(
        "capacity",
        D.tip.capacity - (commanded + requested) * (1 + 3 * s.pumpSigma),
        0,
        "µL",
        "cumulative commanded volume plus 3σ multiplicative pump allowance",
      ),
      check(
        "volume-budget",
        requested,
        3,
        "µL",
        "useful stroke ≥3 µL; retained model-domain reserve",
      ),
    ];
    if (p.controller === "belief" && !b.pelletKnown)
      checks.push({
        id: "orientation-history",
        status: "unknown",
        value: null,
        threshold: null,
        unit: "record",
        relation: "available",
        method:
          "Historical belief controller requires resolved orientation before movement.",
        evidenceIds: refs,
      });
    return {
      id: `candidate-${i}`,
      target,
      requestedVolumeUl: requested,
      checks,
    };
  });
}
export const admissible = (c: CandidateRecord) =>
  c.checks.every((c) => c.status === "pass");
export function bestCandidate(
  candidates: CandidateRecord[],
): CandidateRecord | undefined {
  return candidates
    .filter(admissible)
    .sort((a, b) => b.requestedVolumeUl - a.requestedVolumeUl)[0];
}
/** Three deterministic posterior-predictive samples. Never uses the realized environment.
 * Belief updates preserve each particle's persistent calibration nuisance. */
export function observationValue(
  input: PolicyInput,
  candidates: CandidateRecord[],
  epoch: number,
): ObservationOption[] {
  const b = input.belief,
    s = input.scenario,
    current = bestCandidate(candidates)?.requestedVolumeUl ?? 0;
  const samples = [0.17, 0.5, 0.83].map((u) => {
    let cumulative = 0;
    return (
      b.particles.find((p) => (cumulative += p.weight) >= u) ??
      b.particles.at(-1)!
    );
  });
  return input.views
    .filter((view) => !b.seenGroups.includes(`${view}-epoch-${epoch}`))
    .map((view) => {
      let sum = 0;
      for (let j = 0; j < samples.length; j++) {
        const p = samples[j];
        const hypothetical = {
          volume: p.volume,
          initialVolume: p.volume,
          pose: p.pose,
          fixturePose: [p.pose[0], p.pose[1], 0] as Vec3,
          tilt: s.fixture.tilt,
          pelletAngle: p.pelletAngle,
          pelletZ: 3.3,
          pelletRadius: 0.65,
          contrast: s.contrast,
          fixture: s.fixture,
        };
        const packet = renderObservation(
          hypothetical,
          view,
          s.seed + 7919 + j,
          0,
          `${view}-epoch-${epoch}`,
          { tip: input.tip, calibrationSigma: s.cameraBias },
        );
        const next = updateBelief(b, packet, s).belief;
        sum +=
          bestCandidate(evaluateCandidates({ ...input, belief: next }))
            ?.requestedVolumeUl ?? 0;
      }
      const expected = sum / samples.length,
        cost = 2;
      return {
        view,
        samples: samples.length,
        currentProgressUl: current,
        expectedProgressUl: expected,
        costUl: cost,
        netValueUl: expected - current - cost,
        method:
          "Three posterior-predictive states; additional permitted stroke minus 2 µL-equivalent view cost. Planning samples, not acquired evidence.",
      };
    });
}
