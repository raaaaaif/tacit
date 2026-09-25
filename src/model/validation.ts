import type { RunTrace } from "./types";
import D from "./dimensions.json";
import { validateReceiptShape } from "./receiptValidation";
import { MANIFEST, canonical } from "./evidence";
export function validateTrace(value: unknown): RunTrace {
  const t = value as RunTrace;
  const fail = (
    message = "This file is not a supported TACIT v1 trace.",
  ): never => {
    throw Error(message);
  };
  const number = (v: unknown, min = -1e6, max = 1e6) =>
    typeof v === "number" && Number.isFinite(v) && v >= min && v <= max;
  const text = (v: unknown, max = 3000) =>
    typeof v === "string" && v.length <= max;
  const vector = (v: unknown, n = 3) =>
    Array.isArray(v) &&
    v.length === n &&
    v.every((x) => number(x, -3000, 3000));
  if (
    !t ||
    typeof t !== "object" ||
    t.version !== 1 ||
    !text(t.modelVersion, 64) ||
    !text(t.id, 128) ||
    !t.scenario ||
    !t.policy ||
    !t.initial ||
    !t.result ||
    !t.provenance ||
    !Array.isArray(t.events) ||
    !t.events.length ||
    t.events.length > 1000
  )
    fail();
  if (!["tacit-0.2.0", "tacit-0.3.0", "tacit-0.4.0"].includes(t.modelVersion))
    fail("This model revision is not supported by the current replay viewer.");
  if (
    t.modelVersion === "tacit-0.4.0" &&
    canonical(t.manifest) !== canonical(MANIFEST)
  )
    fail("Current trace manifest does not match its model revision.");
  const s = t.scenario,
    p = t.policy,
    w = t.initial,
    r = t.result;
  const fixture = (f: typeof s.fixture) =>
    f &&
    f.version === 1 &&
    [0, 5, 10].includes(f.tilt) &&
    typeof f.indexed === "boolean" &&
    [9, D.holder.windowWidth].includes(f.window) &&
    f.clearance === D.holder.seatClearance &&
    number(f.seatingSigma, 0, 5);
  if (
    s.version !== 1 ||
    !["known", "shifted", "missing"].includes(s.id) ||
    !number(s.seed, 0, 4294967295) ||
    !Number.isInteger(s.seed) ||
    !number(s.volume, 0, 2000) ||
    !fixture(s.fixture) ||
    typeof s.historyKnown !== "boolean" ||
    !number(s.contrast, 0, 1) ||
    !number(s.poseSigma, 0, 5) ||
    !number(s.pumpSigma, 0, 0.5) ||
    !number(s.cameraBias, 0, 5)
  )
    fail("Unsupported scenario in trace.");
  if (
    p.version !== 1 ||
    ![
      "nominal",
      "estimate",
      "belief",
      "oracle",
      "progress",
      "preflight",
      "stop",
    ].includes(p.controller) ||
    !number(p.chunk, 1, 1000) ||
    !number(p.margin, 0.01, 20) ||
    !number(p.surfaceDepth, 0.01, 40) ||
    !number(p.observeEvery, 1, 100) ||
    !number(p.residualTarget, 0, 1500)
  )
    fail("Unsupported policy in trace.");
  if (
    !number(w.volume, 0, 2000) ||
    !number(w.initialVolume, 0, 2000) ||
    !vector(w.pose) ||
    (w.fixturePose !== undefined && !vector(w.fixturePose)) ||
    ![0, 5, 10].includes(w.tilt) ||
    !number(w.pelletAngle, -20, 20) ||
    !number(w.pelletZ, 0, 32) ||
    !number(w.pelletRadius, 0.01, 5) ||
    !number(w.contrast, 0, 1) ||
    !fixture(w.fixture)
  )
    fail("Unsupported physical state in trace.");
  if (
    !number(r.seconds, 0, 86400) ||
    !number(r.remaining, 0, 2000) ||
    !number(r.removed, 0, 2000) ||
    !number(r.minClearance, -1000, 1000) ||
    !number(r.observations, 0, 1000) ||
    !["completed", "stopped", "violated"].includes(r.status) ||
    !text(r.reason) ||
    !Array.isArray(r.violations) ||
    !r.violations.every((v) => text(v, 100)) ||
    Math.abs(w.volume - r.remaining - r.removed) > 0.01
  )
    fail("Invalid run outcome.");
  if (
    !text(t.provenance.source) ||
    !text(t.provenance.referenceStatus) ||
    !number(t.provenance.seed, 0, 4294967295)
  )
    fail("Missing trace provenance.");
  let end = 0;
  for (const e of t.events) {
    if (
      !number(e.index, 0, 1000) ||
      !number(e.t, 0, r.seconds) ||
      e.t < end - 1e-6 ||
      !number(e.duration, 0, 86400) ||
      e.t + e.duration > r.seconds + 1e-6 ||
      !vector(e.tip) ||
      !number(e.volume, 0, 2000) ||
      !number(e.aspirated, 0, 2000) ||
      !number(e.clearance, -1000, 1000) ||
      !text(e.reason) ||
      !Array.isArray(e.violations) ||
      !e.violations.every((v) => text(v, 100)) ||
      !e.belief ||
      !vector(e.belief.volume, 2) ||
      !vector(e.belief.poseX, 2) ||
      typeof e.belief.pelletKnown !== "boolean" ||
      !number(e.belief.effectiveN, 0, 10000) ||
      !e.action ||
      !["move", "observe", "aspirate", "stop"].includes(e.action.kind)
    )
      fail("Invalid event in the imported trace.");
    if (e.receipt) {
      validateReceiptShape(e.receipt);
      if (
        Math.abs(e.receipt.decisionAtS - e.t) > 1e-8 ||
        canonical(e.receipt.action) !== canonical(e.action)
      )
        fail("Receipt and committed action disagree.");
    } else if (t.modelVersion === "tacit-0.4.0")
      fail("Current traces require original decision receipts.");
    const a = e.action;
    if (a.kind === "move" && !vector(a.to)) fail();
    if (
      a.kind === "aspirate" &&
      (!number(a.volume, 0, 2000) || !number(a.rate, 0.01, 1000))
    )
      fail();
    if (a.kind === "observe" && !["side", "overhead"].includes(a.view)) fail();
    if (a.kind === "stop" && !text(a.reason)) fail();
    if (Math.abs(e.volume + e.aspirated - w.volume) > 0.01)
      fail("Trace does not conserve liquid volume.");
    end = e.t + e.duration;
  }
  if (Math.abs(end - r.seconds) > 1e-6)
    fail("Trace duration and events disagree.");
  return { ...t, provenance: { ...t.provenance, kind: "recorded" } };
}
