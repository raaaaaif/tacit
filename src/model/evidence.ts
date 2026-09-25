import type { Action, BeliefState, Vec3 } from "./types";
import { GEOMETRY_VERSION } from "./assembly";
export const MANIFEST = Object.freeze({
  kernel: "tacit-0.4.0",
  geometry: GEOMETRY_VERSION,
  collision: "swept-envelope-2",
  observation: "refractive-camera-2",
  extraction: "pixel-features-1",
  belief: "correlated-particles-1",
  policy: "readiness-policy-2",
  scenario: "physical-scene-2",
  streams: "keyed-scene-sensor-stroke-2",
  assessment: "target-attainment-1",
  support: "surface-0-5-100-950-1",
});
export type CheckStatus = "pass" | "fail" | "unknown";
export interface DecisionCheck {
  id: string;
  status: CheckStatus;
  method: string;
  value: number | null;
  unit: string;
  threshold: number | null;
  relation: string;
  evidenceIds: string[];
}
export interface EvidenceRef {
  id: string;
  kind:
    | "research-assumption"
    | "history-record"
    | "synthetic-observation"
    | "evaluation-truth";
  capturedAtS: number;
  availableAtS: number;
  correlationGroup: string;
}
export interface CandidateRecord {
  id: string;
  target: Vec3;
  requestedVolumeUl: number;
  checks: DecisionCheck[];
}
export interface ObservationOption {
  view: "side" | "overhead";
  samples: number;
  currentProgressUl: number;
  expectedProgressUl: number;
  costUl: number;
  netValueUl: number;
  method: string;
}
export type StopCode =
  | "ASSEMBLY_UNVERIFIED"
  | "MODEL_DOMAIN_UNSUPPORTED"
  | "EVIDENCE_UNRESOLVED"
  | "OBSERVATION_UNINFORMATIVE"
  | "CANDIDATE_SEARCH_EXHAUSTED"
  | "ACTUATION_LIMIT"
  | "RESOURCE_LIMIT"
  | "TARGET_DECLARED"
  | "EVALUATED_VIOLATION";
export interface DecisionReceipt {
  schema: "tacit-decision/1";
  id: string;
  episodeId: string;
  decisionAtS: number;
  action: Action;
  candidateId: string | null;
  manifest: typeof MANIFEST;
  evidence: EvidenceRef[];
  belief: BeliefState;
  from: Vec3;
  commandedUl: number;
  checks: DecisionCheck[];
  candidates: CandidateRecord[];
  observationOptions: ObservationOption[];
  search: {
    algorithm: string;
    count: number;
    limit: number;
    termination: string;
    claim: string;
  };
  reasonCode: string;
  reason: string;
  blockers: string[];
  disposition:
    | "checks-recorded-as-passing"
    | "comparator-unchecked"
    | "stop-recorded";
  uncertainty: string;
  privileged: boolean;
}
export const REQUIRED: Record<Action["kind"], string[]> = {
  move: [
    "assembly-fit",
    "model-domain",
    "swept-hardware",
    "swept-pellet",
    "motion-limits",
    "immersion-through-stroke",
    "capacity",
    "volume-budget",
  ],
  aspirate: [
    "assembly-fit",
    "model-domain",
    "swept-hardware",
    "swept-pellet",
    "motion-limits",
    "immersion-through-stroke",
    "capacity",
    "volume-budget",
  ],
  observe: ["optical-support", "evidence-provenance"],
  stop: [],
};
export function auditReceipt(r: DecisionReceipt) {
  if (
    !r ||
    r.schema !== "tacit-decision/1" ||
    !Number.isFinite(r.decisionAtS) ||
    r.decisionAtS < 0
  )
    throw Error("Invalid decision receipt.");
  const ids = new Set(r.evidence.map((e) => e.id));
  if (ids.size !== r.evidence.length)
    throw Error("Duplicate decision evidence.");
  for (const e of r.evidence) {
    if (
      ![
        "research-assumption",
        "history-record",
        "synthetic-observation",
        "evaluation-truth",
      ].includes(e.kind) ||
      !Number.isFinite(e.availableAtS) ||
      !Number.isFinite(e.capturedAtS) ||
      e.capturedAtS < 0 ||
      e.availableAtS < e.capturedAtS ||
      e.availableAtS > r.decisionAtS + 1e-8
    )
      throw Error("Decision includes unavailable or future evidence.");
    if (e.kind === "evaluation-truth" && !r.privileged)
      throw Error("Evaluation truth is forbidden in ordinary policy inputs.");
  }
  for (const c of [...r.checks, ...r.candidates.flatMap((c) => c.checks)]) {
    if (
      !["pass", "fail", "unknown"].includes(c.status) ||
      (c.value !== null && !Number.isFinite(c.value)) ||
      (c.threshold !== null && !Number.isFinite(c.threshold))
    )
      throw Error("Invalid decision check.");
    if (!c.evidenceIds.length || c.evidenceIds.some((id) => !ids.has(id)))
      throw Error("Missing check provenance.");
  }
  const blockers = REQUIRED[r.action.kind].filter(
    (id) => !r.checks.some((c) => c.id === id && c.status === "pass"),
  );
  if (
    r.disposition === "checks-recorded-as-passing" &&
    (blockers.length || r.checks.some((c) => c.status !== "pass"))
  )
    throw Error("Missing or unresolved required action check.");
  return blockers;
}
export function canonical(value: unknown): string {
  if (value === null || typeof value !== "object") return JSON.stringify(value);
  if (Array.isArray(value)) return "[" + value.map(canonical).join(",") + "]";
  return (
    "{" +
    Object.entries(value)
      .filter(([, v]) => v !== undefined)
      .sort(([a], [b]) => a.localeCompare(b))
      .map(([k, v]) => JSON.stringify(k) + ":" + canonical(v))
      .join(",") +
    "}"
  );
}
export async function sha256(value: unknown) {
  const bytes = new TextEncoder().encode(canonical(value));
  const digest = await crypto.subtle.digest("SHA-256", bytes);
  return Array.from(new Uint8Array(digest), (x) =>
    x.toString(16).padStart(2, "0"),
  ).join("");
}
