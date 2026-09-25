import type {
  ScenarioSpec,
  PolicySpec,
  RunTrace,
  TraceEvent,
  Vec3,
  ObservationPacket,
  Action,
  ViewId,
} from "./types";
import type {
  DecisionReceipt,
  DecisionCheck,
  EvidenceRef,
  CandidateRecord,
  ObservationOption,
} from "./evidence";
import { MANIFEST, auditReceipt } from "./evidence";
import {
  D,
  MODEL_VERSION,
  liquidHeight,
  pelletPosition,
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
import { stream, normal } from "./math";
import { surfaceSupport } from "./reference";
import { assemblySupported } from "./assembly";
import {
  policyInput,
  evaluateCandidates,
  bestCandidate,
  observationValue,
  UNCERTAINTY,
} from "./policy";
export interface RunOptions {
  onProgress?: (fraction: number) => void;
  onObservation?: (packet: ObservationPacket) => void;
  maxActions?: number;
  history?: "available" | "withheld";
  views?: ViewId[];
}
export function runSimulation(
  s: ScenarioSpec,
  p: PolicySpec,
  options: RunOptions = {},
): RunTrace {
  const world = worldFromScenario(s);
  world.initialVolume = world.volume;
  const initial = structuredClone(world);
  // Withholding a record changes only this explicit policy-visible copy.
  const observed = {
    ...s,
    historyKnown: s.historyKnown && options.history !== "withheld",
  };
  const views = options.views ?? ["side", "overhead"];
  const intervention = { history: options.history ?? "available", views };
  const id = `${s.id}-${s.seed}-${p.controller}-${s.fixture.tilt}-${intervention.history}-${views.join("-")}`;
  let b = initialBelief(observed),
    tip: Vec3 = [0, -1.5, 42],
    held = 0,
    commanded = 0,
    t = 0,
    aspirations = 0,
    minClearance = 100;
  const events: TraceEvent[] = [],
    violations = new Set<string>();
  const evidence: EvidenceRef[] = [
    {
      id: "assumptions-" + MODEL_VERSION,
      kind: "research-assumption",
      capturedAtS: 0,
      availableAtS: 0,
      correlationGroup: "model-assumptions",
    },
  ];
  if (observed.historyKnown)
    evidence.push({
      id: "orientation-history",
      kind: "history-record",
      capturedAtS: 0,
      availableAtS: 0,
      correlationGroup: "handling-history",
    });
  let reason = "",
    code = "CANDIDATE_SEARCH_EXHAUSTED",
    status: RunTrace["result"]["status"] = "stopped";
  let lastCandidates: CandidateRecord[] = [],
    lastOptions: ObservationOption[] = [];
  const input = () =>
    policyInput(observed, p, b, tip, commanded, evidence, views);
  function receipt(
    action: Action,
    why: string,
    checks: DecisionCheck[] = [],
    candidate: CandidateRecord | null = null,
  ): DecisionReceipt {
    const unchecked =
      ["nominal", "estimate"].includes(p.controller) &&
      ["move", "aspirate"].includes(action.kind);
    const r: DecisionReceipt = {
      schema: "tacit-decision/1",
      id: `${id}-d${events.length}`,
      episodeId: id,
      decisionAtS: t,
      action: structuredClone(action),
      candidateId: candidate?.id ?? null,
      manifest: MANIFEST,
      evidence: structuredClone(evidence),
      belief: structuredClone(b),
      from: [...tip],
      commandedUl: commanded,
      checks: structuredClone(checks),
      candidates: structuredClone(lastCandidates),
      observationOptions: structuredClone(lastOptions),
      search: {
        algorithm:
          p.controller === "progress"
            ? "bounded-four-targets"
            : "single-procedure-target",
        count: lastCandidates.length,
        limit: p.controller === "progress" ? 4 : 1,
        termination: action.kind === "stop" ? code : "selected",
        claim:
          "Only the recorded candidates were evaluated. No universal infeasibility claim.",
      },
      reasonCode:
        action.kind === "stop"
          ? code
          : action.kind === "observe"
            ? "ACQUIRE_EVIDENCE"
            : "CANDIDATE_SELECTED",
      reason: why,
      blockers: [
        ...new Set(checks.filter((c) => c.status !== "pass").map((c) => c.id)),
      ],
      disposition:
        action.kind === "stop"
          ? "stop-recorded"
          : unchecked
            ? "comparator-unchecked"
            : "checks-recorded-as-passing",
      uncertainty: UNCERTAINTY,
      privileged: p.controller === "oracle",
    };
    auditReceipt(r);
    return r;
  }
  function record(
    action: Action,
    duration: number,
    r: DecisionReceipt,
    clearance = 100,
    errors: string[] = [],
    observation?: TraceEvent["observation"],
  ) {
    events.push({
      index: events.length,
      t,
      duration,
      action,
      tip: [...tip],
      volume: world.volume,
      aspirated: held,
      belief: {
        volume: [...b.volume],
        poseX: [...b.poseX],
        pelletKnown: b.pelletKnown,
        effectiveN: b.effectiveN,
      },
      reason: r.reason,
      clearance,
      violations: errors,
      ...(observation ? { observation } : {}),
      receipt: r,
    });
    t += duration;
    minClearance = Math.min(minClearance, clearance);
    errors.forEach((e) => violations.add(e));
    options.onProgress?.(Math.min(0.95, held / initial.volume));
  }
  function observe(view: ViewId, why: string) {
    const action: Action = { kind: "observe", view };
    const checks = ["optical-support", "evidence-provenance"].map((id) => ({
      id,
      status: "pass" as const,
      value: 1,
      threshold: 1,
      unit: "boolean",
      relation: "=",
      method:
        "Supported synthetic view; new packet becomes available after this action.",
      evidenceIds: evidence.map((e) => e.id),
    }));
    const r = receipt(action, why, checks);
    const group = `${view}-epoch-${aspirations}`;
    const packet = renderObservation(world, view, s.seed, t + 0.7, group, {
      tip,
      calibrationSigma: s.cameraBias,
    });
    const next = updateBelief(b, packet, observed);
    b = next.belief;
    options.onObservation?.(packet);
    record(action, 0.7, r, 100, [], {
      view,
      features: next.features,
      packetId: packet.id,
    });
    evidence.push({
      id: packet.id,
      kind: "synthetic-observation",
      capturedAtS: packet.t,
      availableAtS: packet.t,
      correlationGroup: group,
    });
  }
  if (!assemblySupported(s.fixture)) {
    reason = "This tilt or assembly lies outside the checked nominal setup.";
    code = "ASSEMBLY_UNVERIFIED";
    return finish();
  }
  if (p.controller === "stop") {
    reason = "Always-stop diagnostic: zero execution is not task success.";
    code = "EVIDENCE_UNRESOLVED";
    return finish();
  }
  if (
    ["estimate", "belief", "progress", "preflight"].includes(p.controller) &&
    views.includes("side")
  )
    observe(
      "side",
      "Locate the liquid and tube with a supported synthetic camera view.",
    );
  if (
    p.controller === "belief" &&
    views.includes("overhead") &&
    (!b.pelletKnown || b.poseY[1] - b.poseY[0] > 1)
  )
    observe(
      "overhead",
      "Test whether the overhead view resolves orientation or lateral placement.",
    );
  for (let step = 0; step < (options.maxActions ?? 24); step++) {
    if (p.controller === "oracle") {
      // Explicit privileged comparator capability. It is never shared with ordinary planning.
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
      if (!evidence.some((e) => e.id === "oracle-truth"))
        evidence.push({
          id: "oracle-truth",
          kind: "evaluation-truth",
          capturedAtS: 0,
          availableAtS: 0,
          correlationGroup: "privileged-environment",
        });
    }
    if (meanState(b).volume <= p.residualTarget + 12) {
      reason =
        "The controller declares the bulk-removal target attained. Hidden residual is assessed separately.";
      code = "TARGET_DECLARED";
      status = "completed";
      break;
    }
    if (commanded * (1 + 3 * s.pumpSigma) >= D.tip.capacity - 3) {
      reason = "Tip capacity reached. A fresh handling cycle is required.";
      code = "ACTUATION_LIMIT";
      break;
    }
    lastCandidates = evaluateCandidates(input());
    lastOptions = [];
    let candidate = bestCandidate(lastCandidates);
    if (["nominal", "estimate"].includes(p.controller))
      candidate = lastCandidates.find((c) => c.requestedVolumeUl >= 3);
    if (!candidate) {
      if (p.controller === "progress" && b.observations < 6) {
        lastOptions = observationValue(input(), lastCandidates, aspirations);
        const best = lastOptions
          .filter((o) => o.netValueUl > 0)
          .sort((a, b) => b.netValueUl - a.netValueUl)[0];
        if (best) {
          observe(
            best.view,
            `The bounded lookahead predicts ${best.netValueUl.toFixed(1)} µL-equivalent net decision value. Acquire the view and test that prediction.`,
          );
          continue;
        }
      }
      const blockers = [
        ...new Set(
          lastCandidates.flatMap((c) =>
            c.checks.filter((k) => k.status !== "pass").map((k) => k.id),
          ),
        ),
      ];
      code = blockers.includes("model-domain")
        ? "MODEL_DOMAIN_UNSUPPORTED"
        : blockers.includes("orientation-history")
          ? "EVIDENCE_UNRESOLVED"
          : lastOptions.length
            ? "OBSERVATION_UNINFORMATIVE"
            : "CANDIDATE_SEARCH_EXHAUSTED";
      reason = `No tested action passed the checks. Unresolved: ${blockers.join(", ")}.${lastOptions.length ? " No tested view had positive predicted decision value." : ""}`;
      break;
    }
    const move: Action = { kind: "move", to: [...candidate.target] };
    const moveReceipt = receipt(
      move,
      "The recorded trajectory and complete withdrawal were screened together.",
      candidate.checks,
      candidate,
    );
    const actual = sweptClearance(tip, candidate.target, world),
      pelletGap = sweptPelletClearance(
        tip,
        candidate.target,
        pelletPosition(world),
        world.pelletRadius,
      );
    const errors: string[] = [];
    if (actual < 0) errors.push("instrument-collision");
    if (pelletGap < D.operating.pelletBuffer) errors.push("pellet-envelope");
    const dt = moveTime(tip, candidate.target);
    tip = [...candidate.target];
    record(move, dt, moveReceipt, actual, errors);
    if (errors.length) {
      reason =
        "The executed trajectory violated a modeled constraint; the original decision receipt is retained.";
      code = "EVALUATED_VIOLATION";
      break;
    }
    const requested = candidate.requestedVolumeUl;
    const action: Action = {
      kind: "aspirate",
      volume: requested,
      rate: D.operating.flowRate,
    };
    const r = receipt(
      action,
      "Withdraw the bounded volume at fixed rate, then settle; the endpoint is the minimum-immersion state.",
      candidate.checks,
      candidate,
    );
    const before = liquidHeight(world.volume, world.tilt, tip, world.pose[2]);
    const desired =
      requested *
      (1 +
        normal(stream(s.seed, `actuation-stroke-${aspirations}`)) *
          s.pumpSigma);
    let lo = 0,
      hi = Math.min(world.volume, desired, D.tip.capacity - held);
    for (let j = 0; j < 18; j++) {
      const v = (lo + hi) / 2;
      if (
        liquidHeight(world.volume - v, world.tilt, tip, world.pose[2]) >
        tip[2] + 0.4
      )
        lo = v;
      else hi = v;
    }
    world.volume -= lo;
    held += lo;
    commanded += requested;
    b = predictWithdrawal(b, requested, s.pumpSigma, s.seed + aspirations);
    aspirations++;
    const faults: string[] = [];
    if (
      world.volume < 100 ||
      world.volume > 950 ||
      !surfaceSupport(world.tilt, [100, 950]).supported
    )
      faults.push("unsupported-surface");
    if (before <= tip[2] + 0.4 || lo < requested * 0.9)
      faults.push("air-ingestion");
    record(
      action,
      requested / D.operating.flowRate + D.operating.settleTime,
      r,
      pelletGap,
      faults,
    );
    if (faults.length) {
      reason =
        "The completed stroke records a modeled violation. This episode cannot count as protective stopping or completion.";
      code = "EVALUATED_VIOLATION";
      break;
    }
    if (
      p.controller === "belief" &&
      views.includes("side") &&
      (aspirations % p.observeEvery === 0 || b.volume[1] - b.volume[0] > 100) &&
      b.observations < 6
    )
      observe(
        "side",
        "Update volume after accumulated pump uncertainty, retaining correlated calibration uncertainty.",
      );
  }
  if (!reason) {
    reason =
      "The bounded action budget was exhausted; this is a resource limit, not physical infeasibility.";
    code = "RESOURCE_LIMIT";
  }
  return finish();
  function finish(): RunTrace {
    const action: Action = { kind: "stop", reason };
    const checks = lastCandidates
      .flatMap((c) => c.checks)
      .filter(
        (c, i, a) =>
          a.findIndex((k) => k.id === c.id && k.status === c.status) === i,
      );
    record(action, 0, receipt(action, reason, checks));
    options.onProgress?.(1);
    return {
      version: 1,
      modelVersion: MODEL_VERSION,
      id,
      manifest: MANIFEST,
      intervention,
      scenario: structuredClone(s),
      policy: structuredClone(p),
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
          "Deterministic local synthetic execution. Decision receipts precede actions; evaluation truth is separate.",
        seed: s.seed,
        referenceStatus:
          "0°/5°, 100–950 µL screening only. Nominal assembly checked; no physical validation.",
      },
    };
  }
}
