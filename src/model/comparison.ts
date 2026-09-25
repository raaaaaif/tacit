import { runSimulation } from "./simulation";
import { scenario, policy } from "./scenarios";
import type {
  RunTrace,
  ObservationPacket,
  ScenarioSpec,
  ScenarioId,
} from "./types";
import { MANIFEST, canonical } from "./evidence";
import { targetMet } from "./assessment";
import { stream } from "./math";
export type Intervention = "history" | "view" | "policy";
export const INTERVENTIONS = {
  history: {
    title: "Withhold orientation history",
    a: "History available",
    b: "History withheld",
    description:
      "Same physical scene and controller. Only access to the existing handling record changes.",
  },
  view: {
    title: "Make the overhead view available",
    a: "Side view only",
    b: "Both views available",
    description:
      "Same scene and controller. The second arm may acquire an overhead view if its predicted decision value is positive.",
  },
  policy: {
    title: "Change the controller",
    a: "Fixed + preflight",
    b: "Readiness controller",
    description:
      "Same scene, evidence access and physical checks. One procedure target versus a bounded search and observation lookahead.",
  },
} as const;
export interface Arm {
  trace: RunTrace;
  packets: ObservationPacket[];
}
export interface Comparison {
  schema: "tacit-comparison/1";
  id: string;
  kind: Intervention;
  mode: "full-rerun";
  manifest: typeof MANIFEST;
  sceneId: string;
  sharedLatentInputs: string;
  interventionFields: string[];
  arms: [Arm, Arm];
}
export function runComparison(
  s: ScenarioSpec,
  kind: Intervention,
  onProgress?: (v: number) => void,
): Comparison {
  if (kind === "history" && !s.historyKnown)
    throw Error(
      "This scene has no orientation record to withhold. Choose a known or changed setup.",
    );
  const make = (arm: number): Arm => {
    const packets: ObservationPacket[] = [];
    const controller =
      kind === "policy" && arm === 0 ? "preflight" : "progress";
    const trace = runSimulation(s, policy(controller), {
      history: kind === "history" && arm === 1 ? "withheld" : "available",
      views: kind === "view" && arm === 0 ? ["side"] : ["side", "overhead"],
      onObservation: (p) => packets.push(p),
      onProgress: (v) => onProgress?.((arm + v) / 2),
    });
    return { trace, packets };
  };
  const arms: [Arm, Arm] = [make(0), make(1)];
  if (canonical(arms[0].trace.initial) !== canonical(arms[1].trace.initial))
    throw Error("Physical scene pairing failed.");
  return {
    schema: "tacit-comparison/1",
    id: `${kind}-${s.id}-${s.seed}`,
    kind,
    mode: "full-rerun",
    manifest: MANIFEST,
    sceneId: `${s.id}-${s.seed}`,
    sharedLatentInputs: canonical(arms[0].trace.initial),
    interventionFields:
      kind === "history"
        ? ["history-access"]
        : kind === "view"
          ? ["available-views"]
          : ["policy"],
    arms,
  };
}
export function outcome(t: RunTrace) {
  return t.result.violations.length
    ? "violated"
    : t.result.status === "completed"
      ? targetMet(t.result, t.policy)
        ? "completed"
        : "missed"
      : "stopped";
}
export function episode(t: RunTrace) {
  const exposed = t.events.some((e) => e.action.kind === "aspirate");
  return {
    outcome: outcome(t),
    residual: t.result.remaining,
    removed: t.result.removed,
    seconds: t.result.seconds,
    observations: t.result.observations,
    exposed,
    stopStage:
      outcome(t) === "stopped"
        ? exposed
          ? "after-progress"
          : "before-aspiration"
        : null,
    reasonCode: t.events.at(-1)?.receipt?.reasonCode ?? "UNRECORDED",
    violations: t.result.violations,
    declared: t.result.status === "completed",
  };
}
export type Episode = ReturnType<typeof episode>;
export interface PairRow {
  sceneId: string;
  family: ScenarioId;
  latentIdentity: string;
  manifest: typeof MANIFEST;
  a: Episode;
  b: Episode;
}
export function pairRow(c: Comparison): PairRow {
  return {
    sceneId: c.sceneId,
    family: c.arms[0].trace.scenario.id,
    latentIdentity: c.sharedLatentInputs,
    manifest: c.manifest,
    a: episode(c.arms[0].trace),
    b: episode(c.arms[1].trace),
  };
}
export function summarize(rows: Episode[]) {
  const n = rows.length;
  if (!n) throw Error("No assigned episodes.");
  const count = (o: string) => rows.filter((r) => r.outcome === o).length;
  const mean = (key: "residual" | "removed" | "seconds" | "observations") =>
    rows.reduce((sum, r) => sum + r[key], 0) / n;
  const violated = count("violated"),
    p = violated / n,
    z = 1.95996398454,
    den = 1 + (z * z) / n,
    center = (p + (z * z) / (2 * n)) / den,
    half = (z * Math.sqrt((p * (1 - p)) / n + (z * z) / (4 * n * n))) / den;
  return {
    n,
    completed: count("completed"),
    stopped: count("stopped"),
    violated,
    missed: count("missed"),
    exposed: rows.filter((r) => r.exposed).length,
    stoppedAfterProgress: rows.filter((r) => r.stopStage === "after-progress")
      .length,
    residual: mean("residual"),
    removed: mean("removed"),
    seconds: mean("seconds"),
    observations: mean("observations"),
    violationCI: [Math.max(0, center - half), Math.min(1, center + half)],
    zeroEventUpper: violated === 0 ? -Math.expm1(Math.log(0.05) / n) : null,
  };
}
export function pairedAnalysis(
  rows: PairRow[],
  metric: "residual" | "seconds" | "completion",
  replicates = 1000,
) {
  if (
    !rows.length ||
    replicates < 100 ||
    replicates > 10000 ||
    rows.length * replicates > 25000000
  )
    throw Error("Invalid analysis budget.");
  const ids = new Set<string>();
  const groups = new Map<string, number[]>();
  for (const r of [...rows].sort((a, b) =>
    a.sceneId.localeCompare(b.sceneId),
  )) {
    if (
      ids.has(r.sceneId) ||
      canonical(r.manifest) !== canonical(MANIFEST) ||
      !r.latentIdentity
    )
      throw Error("Duplicate or incompatible scene pair.");
    ids.add(r.sceneId);
    if (
      !["completed", "stopped", "violated", "missed"].includes(r.a.outcome) ||
      !["completed", "stopped", "violated", "missed"].includes(r.b.outcome)
    )
      throw Error("Unresolved administrative outcome.");
    const delta =
      metric === "completion"
        ? Number(r.b.outcome === "completed") -
          Number(r.a.outcome === "completed")
        : r.b[metric] - r.a[metric];
    if (!Number.isFinite(delta)) throw Error("Nonfinite paired outcome.");
    const g = groups.get(r.family) ?? [];
    g.push(delta);
    groups.set(r.family, g);
  }
  const random = stream(42993, `paired-${metric}`),
    draws: number[] = [],
    n = rows.length;
  for (let i = 0; i < replicates; i++) {
    let sum = 0;
    for (const g of groups.values())
      for (let j = 0; j < g.length; j++)
        sum += g[Math.floor(random() * g.length)];
    draws.push(sum / n);
  }
  draws.sort((a, b) => a - b);
  const values = [...groups.values()].flat();
  return {
    metric,
    n,
    estimate: values.reduce((a, b) => a + b, 0) / n,
    ci: [
      draws[Math.floor(0.025 * (replicates - 1))],
      draws[Math.ceil(0.975 * (replicates - 1))],
    ],
    replicates,
    direction: "B minus A",
    method:
      "Paired percentile bootstrap within fixed scenario-family strata. Independent scene/calibration seeds; not shared sessions.",
  };
}
export const STUDY_PLAN = {
  id: "readiness-study-2",
  status: "frozen exploratory evaluation",
  frozenAt: "2026-09-25",
  manifest: MANIFEST,
  seedRule:
    "771001 + familyIndex*1000 + sceneIndex*37; 12 scenes per eligible family",
  scenesPerFamily: 12,
  developmentScenes: ["known-1847", "shifted-1847", "missing-1847"],
  assignment:
    "Every listed scene runs both arms from initialization. History excludes missing family because no record exists to withhold.",
  streams:
    "Physical scene is identical; sensors keyed by view and aspiration epoch; pump error keyed by stroke index. Divergent actions may encounter different physical noise effects.",
  primary: [
    "completion/all assigned",
    "violations/all assigned",
    "residual including stops",
  ],
  secondary: [
    "removed",
    "exposure from actions",
    "stop stage",
    "duration",
    "observations",
  ],
  failureRule:
    "Any crash, unsupported assignment or missing pair blocks analysis; retain the complete assignment ledger and repair/rerun the entire frozen study version.",
  limits:
    "Exploratory finite synthetic population, not a laboratory safety claim. No tuning on these results. Paired uncertainty is conditional on model and scene population.",
};
export function assignments(kind: Intervention) {
  return (
    kind === "history" ? ["known", "shifted"] : ["known", "shifted", "missing"]
  ).flatMap((family, i) =>
    Array.from({ length: 12 }, (_, j) => ({
      family: family as ScenarioId,
      seed: 771001 + i * 1000 + j * 37,
    })),
  );
}
export interface Campaign {
  plan: typeof STUDY_PLAN;
  generatedAt: string;
  comparisons: {
    kind: Intervention;
    assigned: number;
    administrativeFailures: unknown[];
    rows: PairRow[];
    a: ReturnType<typeof summarize>;
    b: ReturnType<typeof summarize>;
    paired: ReturnType<typeof pairedAnalysis>[];
    discordantViolations: { aOnly: number; bOnly: number };
  }[];
}
