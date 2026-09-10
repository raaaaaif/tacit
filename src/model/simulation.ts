import { surfaceSupport } from "./reference";
import type {
  ScenarioSpec,
  PolicySpec,
  RunTrace,
  TraceEvent,
  WorldState,
  BeliefState,
  Vec3,
  ObservationPacket,
  Action,
} from "./types";
import {
  D,
  MODEL_VERSION,
  toWorld,
  liquidHeight,
  volumeAtHeight,
  displacedTipVolume,
  innerRadius,
  pelletPosition,
  instrumentClearance,
  sweptClearance,
  sweptPelletClearance,
  moveTime,
} from "./geometry";
import { worldFromScenario } from "./scenarios";
import {
  initialBelief,
  updateBelief,
  predictWithdrawal,
  meanState,
} from "./belief";
import { renderObservation } from "./optics";
import { stream, normal, clamp, length, sub } from "./math";
export interface RunOptions {
  onProgress?: (fraction: number) => void;
  onObservation?: (packet: ObservationPacket) => void;
  maxActions?: number;
}
/** Environment owns truth. Observed planning only receives scenario, belief, and instrument state. */
function chooseTarget(s: ScenarioSpec, b: BeliefState, p: PolicySpec): Vec3 {
  const mean = meanState(b),
    volume =
      p.controller === "nominal"
        ? mean.volume
        : Math.max(0, p.controller === "belief" ? b.volume[0] : mean.volume);
  const height = liquidHeight(volume, s.fixture.tilt);
  const localZ = Math.max(
    3,
    (height - p.surfaceDepth) / Math.cos((s.fixture.tilt * Math.PI) / 180),
  );
  const r = Math.min(1.35, Math.max(0, innerRadius(localZ) - 1.6));
  const az = p.controller === "nominal" ? Math.PI * 1.5 : mean.angle + Math.PI;
  return toWorld(
    [r * Math.cos(az), r * Math.sin(az), localZ],
    s.fixture.tilt,
    p.controller === "nominal" ? [0, 0, 0] : mean.pose,
  );
}
function plausibleClearance(
  s: ScenarioSpec,
  b: BeliefState,
  p: PolicySpec,
  from: Vec3,
  to: Vec3,
) {
  const mean = meanState(b);
  const poses =
    p.controller === "belief"
      ? ([
          [b.poseX[0], b.poseY[0], 0],
          [b.poseX[0], b.poseY[1], 0],
          [b.poseX[1], b.poseY[0], 0],
          [b.poseX[1], b.poseY[1], 0],
          mean.pose,
        ] as Vec3[])
      : [p.controller === "nominal" ? ([0, 0, 0] as Vec3) : mean.pose];
  return Math.min(
    ...poses.map((pose) =>
      sweptClearance(from, to, {
        tilt: s.fixture.tilt,
        pose,
        fixturePose: pose,
        fixture: s.fixture,
      }),
    ),
  );
}
export function runSimulation(
  s: ScenarioSpec,
  p: PolicySpec,
  options: RunOptions = {},
): RunTrace {
  const world = worldFromScenario(s);
  world.initialVolume = world.volume;
  const initial = structuredClone(world);
  let b = initialBelief(s),
    tip: Vec3 = [0, -1.5, 42],
    held = 0,
    commanded = 0,
    t = 0,
    minClearance = 100,
    aspirations = 0;
  const events: TraceEvent[] = [],
    violations = new Set<string>(),
    actuation = stream(s.seed, "actuation");
  let reason = "",
    status: "completed" | "stopped" | "violated" = "stopped";
  const snapshot = () => ({
    volume: [...b.volume] as [number, number],
    poseX: [...b.poseX] as [number, number],
    pelletKnown: b.pelletKnown,
    effectiveN: b.effectiveN,
  });
  function record(
    action: Action,
    duration: number,
    why: string,
    clearance = 100,
    errors: string[] = [],
    observation?: TraceEvent["observation"],
  ) {
    const e: TraceEvent = {
      index: events.length,
      t,
      duration,
      action,
      tip: [...tip],
      volume: world.volume,
      aspirated: held,
      belief: snapshot(),
      reason: why,
      clearance,
      violations: errors,
      observation,
    };
    events.push(e);
    t += duration;
    minClearance = Math.min(minClearance, clearance);
    for (const error of errors) violations.add(error);
    options.onProgress?.(Math.min(0.95, held / initial.volume));
  }
  function observe(view: "side" | "overhead", why: string) {
    const group = `${view}-epoch-${aspirations}`;
    const packet = renderObservation(world, view, s.seed, t + 0.7, group);
    options.onObservation?.(packet);
    const updated = updateBelief(b, packet, s);
    b = updated.belief;
    record({ kind: "observe", view }, 0.7, why, 100, [], {
      view,
      features: updated.features,
      packetId: packet.id,
    });
  }
  if (p.controller === "estimate" || p.controller === "belief")
    observe(
      "side",
      "Locate the tube and liquid surface before committing a trajectory.",
    );
  if (
    p.controller === "belief" &&
    b.pelletKnown &&
    b.poseY[1] - b.poseY[0] > 1.0
  )
    observe(
      "overhead",
      "The side view cannot resolve seating depth. Use the overhead view to constrain the lateral pose.",
    );
  if (p.controller === "belief" && !b.pelletKnown) {
    observe(
      "overhead",
      "Orientation history is missing. Check whether another view reveals the pellet.",
    );
    if (!b.pelletKnown) {
      reason =
        "Pellet location remains unresolved. Preserve the sample and request its orientation history.";
      record({ kind: "stop", reason }, 0, reason);
      return finish();
    }
  }
  for (let step = 0; step < (options.maxActions ?? 24); step++) {
    if (p.controller === "oracle") {
      b = {
        ...b,
        particles: [
          {
            volume: world.volume,
            pose: [...world.pose],
            pelletAngle: world.pelletAngle,
            weight: 1,
          },
        ],
        volume: [world.volume, world.volume],
        poseX: [world.pose[0], world.pose[0]],
        poseY: [world.pose[1], world.pose[1]],
        pelletKnown: true,
        effectiveN: 1,
      };
    }
    const mean = meanState(b);
    const remaining = mean.volume;
    if (remaining <= p.residualTarget + 12) {
      reason =
        "Bulk-removal target reached. Final pellet-adjacent removal is outside this model.";
      status = "completed";
      break;
    }
    if (commanded * (1 + 3 * s.pumpSigma) >= D.tip.capacity - 1) {
      reason = "Tip capacity reached. A fresh handling cycle is required.";
      break;
    }
    const support = surfaceSupport(
      s.fixture.tilt,
      p.controller === "belief" ? b.volume : [remaining, remaining],
    );
    if (
      !support.supported &&
      (p.controller === "belief" || p.controller === "oracle")
    ) {
      reason = support.reason;
      break;
    }
    const target = chooseTarget(s, b, p);
    const conservative = plausibleClearance(s, b, p, tip, target);
    if (
      (p.controller === "belief" || p.controller === "oracle") &&
      conservative < D.operating.wallBuffer
    ) {
      reason = "The credible tube poses do not admit a clear instrument path.";

      break;
    }
    const estimatedPellet = pelletPosition({
      pose: mean.pose,
      tilt: s.fixture.tilt,
      pelletAngle: mean.angle,
      pelletZ: 3.3,
      pelletRadius: 0.65,
    });
    const estimatedGap = sweptPelletClearance(
      tip,
      target,
      estimatedPellet,
      0.65,
    );
    if (
      (p.controller === "belief" || p.controller === "oracle") &&
      estimatedGap <
        p.margin +
          (p.controller === "oracle"
            ? 0
            : Math.max(
                0.3,
                (b.poseX[1] - b.poseX[0]) / 2,
                (b.poseY[1] - b.poseY[0]) / 2,
              ))
    ) {
      reason =
        p.controller === "oracle"
          ? "Further descent would enter the declared pellet exclusion envelope."
          : "The remaining uncertainty consumes the pellet clearance. Stop before entering the protected region.";
      break;
    }
    const actual = sweptClearance(tip, target, world);
    const moveErrors: string[] = [];
    const pellet = pelletPosition(world),
      pelletClearance = sweptPelletClearance(
        tip,
        target,
        pellet,
        world.pelletRadius,
      );
    if (pelletClearance < D.operating.pelletBuffer)
      moveErrors.push("pellet-envelope");
    if (
      Math.abs(target[0]) > D.stage.xyLimit ||
      Math.abs(target[1]) > D.stage.xyLimit ||
      target[2] < D.stage.zMin ||
      target[2] > D.stage.zMax
    )
      moveErrors.push("stage-limit");
    if (actual < 0) moveErrors.push("instrument-collision");
    const dt = moveTime(tip, target);
    tip = target;
    record(
      { kind: "move", to: [...target] },
      dt,
      "Approach the liquid from the side opposite the estimated pellet.",
      actual,
      moveErrors,
    );
    if (moveErrors.length) {
      reason = moveErrors.includes("pellet-envelope")
        ? "The swept instrument enters the declared pellet exclusion envelope."
        : "The complete instrument envelope intersects the workcell.";
      break;
    }
    const stoppingHeight =
      tip[2] +
      (p.controller === "belief" || p.controller === "oracle"
        ? Math.max(D.operating.surfaceAllowance, support.depression)
        : 0.65);
    const lowerVolume = p.controller === "belief" ? b.volume[0] : remaining;
    const immersedReserve =
      volumeAtHeight(stoppingHeight, s.fixture.tilt) -
      displacedTipVolume(stoppingHeight, tip);
    const requested = Math.min(
      p.chunk,
      Math.max(0, remaining - p.residualTarget),
      Math.max(0, (lowerVolume - immersedReserve) / (1 + 3 * s.pumpSigma)),
      Math.max(0, D.tip.capacity / (1 + 3 * s.pumpSigma) - commanded),
      p.controller === "belief" || p.controller === "oracle"
        ? Math.max(0, (lowerVolume - 100) / (1 + 3 * s.pumpSigma))
        : Infinity,
    );
    if (requested < 3) {
      reason =
        "No further bounded withdrawal is supported at this immersion depth.";
      break;
    }
    // Each chunk is capped by the volume that can leave before the aperture loses immersion.
    const before = liquidHeight(world.volume, world.tilt, tip);
    const desired = requested * (1 + normal(actuation) * s.pumpSigma);
    let lo = 0,
      hi = Math.min(world.volume, desired, D.tip.capacity - held);
    for (let i = 0; i < 18; i++) {
      const v = (lo + hi) / 2;
      if (liquidHeight(world.volume - v, world.tilt, tip) > tip[2] + 0.4)
        lo = v;
      else hi = v;
    }
    const removed = lo;
    world.volume -= removed;
    held += removed;
    b = predictWithdrawal(b, requested, s.pumpSigma, s.seed + aspirations);
    aspirations++;
    commanded += requested;
    const errors: string[] = [];
    if (
      world.volume < 100 ||
      world.volume > 950 ||
      !surfaceSupport(world.tilt, [100, 950]).supported
    )
      errors.push("unsupported-surface");
    if (pelletClearance < D.operating.pelletBuffer)
      errors.push("pellet-envelope");
    if (before <= tip[2] + 0.4 || removed < requested * 0.9)
      errors.push("air-ingestion");
    record(
      { kind: "aspirate", volume: requested, rate: D.operating.flowRate },
      requested / D.operating.flowRate + D.operating.settleTime,
      "Withdraw at a fixed rate, then allow the surface to settle.",
      pelletClearance,
      errors,
    );
    if (errors.length) {
      reason = errors.includes("unsupported-surface")
        ? "The run leaves the supported equilibrium-reference domain."
        : errors.includes("air-ingestion")
          ? "The aperture loses liquid contact before completing the stroke."
          : "The tip enters the declared pellet exclusion envelope.";
      break;
    }
    if (
      p.controller === "belief" &&
      (aspirations % p.observeEvery === 0 || b.volume[1] - b.volume[0] > 100)
    )
      observe(
        "side",
        "Update the liquid estimate after accumulated pump uncertainty.",
      );
  }
  if (!reason) reason = "Action budget reached; retain the remaining liquid.";
  record({ kind: "stop", reason }, 0, reason);
  return finish();
  function finish(): RunTrace {
    options.onProgress?.(1);
    return {
      version: 1,
      modelVersion: MODEL_VERSION,
      id: `${s.id}-${s.seed}-${p.controller}-${s.fixture.tilt}`,
      scenario: s,
      policy: p,
      initial,
      events,
      result: {
        remaining: world.volume,
        removed: held,
        seconds: t,
        violations: [...violations],
        status: violations.size ? "violated" : status,
        reason,
        minClearance: Math.min(100, minClearance),
        observations: b.observations,
      },
      provenance: {
        kind: "live",
        source:
          "Deterministic browser/Node simulation; uncalibrated physical model.",
        seed: s.seed,
        referenceStatus:
          "Quasistatic screening; see reference dossier for supported surface envelopes.",
      },
    };
  }
}
