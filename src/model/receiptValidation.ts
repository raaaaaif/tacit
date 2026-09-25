import {
  auditReceipt,
  canonical,
  MANIFEST,
  type DecisionReceipt,
} from "./evidence";
/** Strict bounded data schema before a receipt is used by the UI. */
export function validateReceiptShape(
  value: unknown,
): asserts value is DecisionReceipt {
  const fail = () => {
    throw Error("Malformed or oversized decision receipt.");
  };
  const object = (v: unknown, keys: string[]) => {
    if (
      !v ||
      typeof v !== "object" ||
      Array.isArray(v) ||
      Object.keys(v).some((k) => !keys.includes(k))
    )
      fail();
  };
  const array = (v: unknown, max: number) => {
    if (!Array.isArray(v) || v.length > max) fail();
  };
  object(value, [
    "schema",
    "id",
    "episodeId",
    "decisionAtS",
    "action",
    "candidateId",
    "manifest",
    "evidence",
    "belief",
    "from",
    "commandedUl",
    "checks",
    "candidates",
    "observationOptions",
    "search",
    "reasonCode",
    "reason",
    "blockers",
    "disposition",
    "uncertainty",
    "privileged",
  ]);
  const r = value as DecisionReceipt;
  const finite = (v: unknown) => typeof v === "number" && Number.isFinite(v);
  const string = (v: unknown) => typeof v === "string" && v.length <= 5000;
  const vector = (v: unknown, n: number) =>
    Array.isArray(v) && v.length === n && v.every(finite);
  const interval = (v: unknown) =>
    vector(v, 2) && (v as number[])[0] <= (v as number[])[1];
  const scan = (v: unknown, depth = 0): void => {
    if (depth > 12) fail();
    if (typeof v === "number" && !Number.isFinite(v)) fail();
    if (typeof v === "string" && v.length > 5000) fail();
    if (v && typeof v === "object")
      for (const x of Object.values(v)) scan(x, depth + 1);
  };
  array(r.evidence, 64);
  array(r.checks, 40);
  array(r.candidates, 16);
  array(r.observationOptions, 2);
  array(r.blockers, 40);
  if (
    ![
      r.id,
      r.episodeId,
      r.reasonCode,
      r.reason,
      r.uncertainty,
      ...r.blockers,
    ].every(string) ||
    !vector(r.from, 3) ||
    !finite(r.commandedUl) ||
    r.commandedUl < 0 ||
    !(r.candidateId === null || string(r.candidateId)) ||
    canonical(r.manifest) !== canonical(MANIFEST)
  )
    fail();
  object(r.belief, [
    "version",
    "particles",
    "seenGroups",
    "observations",
    "volume",
    "poseX",
    "poseY",
    "pelletKnown",
    "effectiveN",
  ]);
  array(r.belief.particles, 256);
  array(r.belief.seenGroups, 64);
  if (
    r.belief.version !== 1 ||
    !r.belief.particles.length ||
    !r.belief.seenGroups.every(string) ||
    ![r.belief.volume, r.belief.poseX, r.belief.poseY].every(interval) ||
    typeof r.belief.pelletKnown !== "boolean" ||
    !finite(r.belief.effectiveN) ||
    !Number.isInteger(r.belief.observations) ||
    r.belief.observations < 0
  )
    fail();
  for (const p of r.belief.particles) {
    object(p, ["volume", "pose", "pelletAngle", "weight", "levelBias"]);
    if (
      !vector(p.pose, 3) ||
      ![p.volume, p.pelletAngle, p.weight].every(finite) ||
      p.weight < 0 ||
      (p.levelBias !== undefined && !finite(p.levelBias))
    )
      fail();
  }
  for (const e of r.evidence) {
    object(e, [
      "id",
      "kind",
      "capturedAtS",
      "availableAtS",
      "correlationGroup",
    ]);
    if (![e.id, e.correlationGroup].every(string)) fail();
  }
  for (const c of r.candidates) {
    object(c, ["id", "target", "requestedVolumeUl", "checks"]);
    array(c.checks, 40);
    if (
      !vector(c.target, 3) ||
      !string(c.id) ||
      !finite(c.requestedVolumeUl) ||
      c.requestedVolumeUl < 0
    )
      fail();
  }
  for (const c of [...r.checks, ...r.candidates.flatMap((c) => c.checks)]) {
    object(c, [
      "id",
      "status",
      "method",
      "value",
      "unit",
      "threshold",
      "relation",
      "evidenceIds",
    ]);
    array(c.evidenceIds, 64);
    if (![c.id, c.method, c.unit, c.relation, ...c.evidenceIds].every(string))
      fail();
  }
  object(r.search, ["algorithm", "count", "limit", "termination", "claim"]);
  if (
    ![r.search.algorithm, r.search.termination, r.search.claim].every(string) ||
    !Number.isInteger(r.search.count) ||
    !Number.isInteger(r.search.limit) ||
    r.search.count < 0 ||
    r.search.count > r.search.limit ||
    r.search.limit > 1000
  )
    fail();
  for (const o of r.observationOptions) {
    object(o, [
      "view",
      "samples",
      "currentProgressUl",
      "expectedProgressUl",
      "costUl",
      "netValueUl",
      "method",
    ]);
    if (
      !["side", "overhead"].includes(o.view) ||
      ![
        o.samples,
        o.currentProgressUl,
        o.expectedProgressUl,
        o.costUl,
        o.netValueUl,
      ].every(finite) ||
      !Number.isInteger(o.samples) ||
      o.samples < 0 ||
      !string(o.method)
    )
      fail();
  }
  if (
    ![
      "checks-recorded-as-passing",
      "comparator-unchecked",
      "stop-recorded",
    ].includes(r.disposition) ||
    typeof r.privileged !== "boolean"
  )
    fail();
  scan(r);
  auditReceipt(r);
}
