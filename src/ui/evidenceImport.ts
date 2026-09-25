import { readCaseOrTrace } from "../model/casePacket";
import { canonical, REQUIRED, type DecisionCheck } from "../model/evidence";
import type { Arm, Comparison } from "../model/comparison";
import { validateImportShape } from "./importShape";
import { policy } from "../model/scenarios";

const equal = (a: unknown, b: unknown) => canonical(a) === canonical(b);
const close = (a: number, b: number) => Math.abs(a - b) <= 1e-6;
function requireEvidence(
  condition: unknown,
  message: string,
): asserts condition {
  if (!condition) throw Error(`Inconsistent imported evidence: ${message}`);
}

/** Additional import-only consistency checks. They neither recompute a run nor
 * authenticate its author, and do not change the frozen evaluation kernel. */
function validateEpisode({ trace: t, packets }: Arm) {
  const current = t.modelVersion === "tacit-0.4.0";
  const final = t.events.at(-1)!;
  requireEvidence(
    t.events.every((e, i) => e.index === i),
    "decision indices must follow the recorded event order.",
  );
  requireEvidence(
    close(final.volume, t.result.remaining) &&
      close(final.aspirated, t.result.removed),
    "the final event and reported liquid outcome disagree.",
  );
  if (!current) return; // Historical traces retain their original assessment.

  const access = t.intervention;
  requireEvidence(
    access &&
      ["available", "withheld"].includes(access.history) &&
      Array.isArray(access.views) &&
      access.views.length <= 2 &&
      new Set(access.views).size === access.views.length &&
      access.views.every((view) => ["side", "overhead"].includes(view)),
    "current runs must record valid evidence access.",
  );
  requireEvidence(
    equal(t.initial.fixture, t.scenario.fixture) &&
      t.initial.tilt === t.scenario.fixture.tilt &&
      close(t.initial.initialVolume, t.initial.volume) &&
      t.provenance.seed === t.scenario.seed,
    "recorded geometry and scenario disagree.",
  );
  requireEvidence(
    final.action.kind === "stop" &&
      final.action.reason === t.result.reason &&
      final.reason === t.result.reason,
    "the terminal action and reported reason disagree.",
  );
  const recordedViolations = [
    ...new Set(t.events.flatMap((e) => e.violations)),
  ];
  requireEvidence(
    equal([...t.result.violations].sort(), recordedViolations.sort()),
    "event violations and reported violations disagree.",
  );
  requireEvidence(
    t.result.status ===
      (recordedViolations.length
        ? "violated"
        : final.receipt?.reasonCode === "TARGET_DECLARED"
          ? "completed"
          : "stopped"),
    "the outcome does not match the recorded terminal decision.",
  );
  requireEvidence(
    close(
      t.result.minClearance,
      Math.min(100, ...t.events.map((e) => e.clearance)),
    ),
    "reported minimum clearance disagrees with the events.",
  );
  const observations = t.events.filter((e) => e.action.kind === "observe");
  requireEvidence(
    t.result.observations === observations.length &&
      packets.length === observations.length,
    "observation counts and recorded camera acquisitions disagree.",
  );
  const receiptIds = new Set<string>();
  let commanded = 0;
  let end = 0;
  let tip = [0, -1.5, 42];
  let priorVolume = t.initial.volume;
  let priorAspirated = 0;
  for (const e of t.events) {
    const r = e.receipt!; // The bounded model schema already requires receipts.
    requireEvidence(close(e.t, end), "the event clock has an unrecorded gap.");
    requireEvidence(
      r.episodeId === t.id && !receiptIds.has(r.id),
      "receipt identity does not match its episode.",
    );
    receiptIds.add(r.id);
    requireEvidence(
      equal(r.from, tip) && close(r.commandedUl, commanded),
      "receipt starting position or prior withdrawal disagrees with the events.",
    );
    requireEvidence(
      r.privileged === (t.policy.controller === "oracle"),
      "receipt privilege and controller disagree.",
    );
    const physical = e.action.kind === "move" || e.action.kind === "aspirate";
    requireEvidence(
      r.disposition ===
        (e.action.kind === "stop"
          ? "stop-recorded"
          : physical && ["nominal", "estimate"].includes(t.policy.controller)
            ? "comparator-unchecked"
            : "checks-recorded-as-passing") &&
        r.search.count === r.candidates.length &&
        r.search.limit === (t.policy.controller === "progress" ? 4 : 1) &&
        r.search.algorithm ===
          (t.policy.controller === "progress"
            ? "bounded-four-targets"
            : "single-procedure-target"),
      "receipt action status or candidate count disagrees with its contents.",
    );
    const subjectChecks = (checks: DecisionCheck[], required: string[]) => {
      const ids = checks.map((check) => check.id);
      requireEvidence(
        new Set(ids).size === ids.length &&
          required.every((id) => ids.includes(id)),
        "a candidate or selected action has missing or duplicate required checks.",
      );
    };
    requireEvidence(
      new Set(r.candidates.map((c) => c.id)).size === r.candidates.length,
      "candidate identities are duplicated.",
    );
    for (const candidate of r.candidates)
      subjectChecks(candidate.checks, REQUIRED.move);
    if (e.action.kind !== "stop")
      subjectChecks(r.checks, REQUIRED[e.action.kind]);
    for (const check of [
      ...r.checks,
      ...r.candidates.flatMap((c) => c.checks),
    ]) {
      if (check.status === "unknown") {
        requireEvidence(
          check.value === null &&
            check.threshold === null &&
            check.relation === "available",
          "unknown checks must preserve unresolved values.",
        );
      } else {
        requireEvidence(
          check.value !== null &&
            check.threshold !== null &&
            ["≥", "="].includes(check.relation),
          "resolved checks require a registered numeric relation.",
        );
        const passes =
          check.relation === "≥"
            ? check.value >= check.threshold
            : check.value === check.threshold;
        requireEvidence(
          check.status === (passes ? "pass" : "fail"),
          "a numeric check status contradicts its recorded comparison.",
        );
      }
    }
    if (physical) {
      const selected = r.candidates.find((c) => c.id === r.candidateId);
      requireEvidence(
        selected &&
          equal(selected.checks, r.checks) &&
          (e.action.kind === "move"
            ? equal(selected.target, e.action.to)
            : e.action.kind === "aspirate" &&
              close(selected.requestedVolumeUl, e.action.volume)),
        "the committed action does not match its selected candidate.",
      );
    }
    requireEvidence(
      r.reason === e.reason &&
        equal(
          [
            ...new Set(
              r.checks.filter((c) => c.status !== "pass").map((c) => c.id),
            ),
          ].sort(),
          [...r.blockers].sort(),
        ),
      "receipt summary disagrees with its original checks.",
    );
    requireEvidence(
      (access.history !== "withheld" && t.scenario.historyKnown) ||
        !r.evidence.some((ref) => ref.kind === "history-record"),
      "withheld or absent history appears in the decision inputs.",
    );
    for (const ref of r.evidence) {
      if (ref.kind === "synthetic-observation") {
        const packet = packets.find((p) => p.id === ref.id);
        requireEvidence(
          packet && close(ref.capturedAtS, packet.t),
          "the receipt and camera capture times disagree.",
        );
      }
    }
    if (e.action.kind === "observe") {
      const packet = packets.find((p) => p.id === e.observation?.packetId);
      requireEvidence(
        access.views.includes(e.action.view) &&
          e.observation?.view === e.action.view &&
          packet?.calibration.view === e.action.view &&
          close(packet.t, e.t + e.duration),
        "camera evidence does not match its recorded acquisition.",
      );
    }
    requireEvidence(
      equal(e.tip, e.action.kind === "move" ? e.action.to : tip),
      "recorded tip position disagrees with the action.",
    );
    requireEvidence(
      e.action.kind === "aspirate"
        ? e.volume <= priorVolume + 1e-6 && e.aspirated >= priorAspirated - 1e-6
        : close(e.volume, priorVolume) && close(e.aspirated, priorAspirated),
      "liquid transfer does not match the recorded action.",
    );
    if (e.action.kind === "aspirate") commanded += e.action.volume;
    priorVolume = e.volume;
    priorAspirated = e.aspirated;
    tip = e.tip;
    end = e.t + e.duration;
  }
}

function validatePair(c: Comparison) {
  const [a, b] = c.arms.map((arm) => arm.trace);
  requireEvidence(
    a.modelVersion === "tacit-0.4.0" &&
      b.modelVersion === "tacit-0.4.0" &&
      equal(a.scenario, b.scenario) &&
      c.sceneId === `${a.scenario.id}-${a.scenario.seed}`,
    "comparison arms do not describe the same current scenario.",
  );
  const expected = (history: "available" | "withheld", views: string[]) => ({
    history,
    views,
  });
  const both = ["side", "overhead"];
  const expectedA = expected("available", c.kind === "view" ? ["side"] : both);
  const expectedB = expected(
    c.kind === "history" ? "withheld" : "available",
    both,
  );
  requireEvidence(
    equal(a.intervention, expectedA) &&
      equal(b.intervention, expectedB) &&
      (c.kind !== "history" || a.scenario.historyKnown),
    "arm evidence access does not match the labeled intervention.",
  );
  requireEvidence(
    a.policy.controller === (c.kind === "policy" ? "preflight" : "progress") &&
      b.policy.controller === "progress" &&
      equal({ ...a.policy, controller: "progress" }, b.policy) &&
      equal(a.policy, policy(c.kind === "policy" ? "preflight" : "progress")) &&
      equal(b.policy, policy("progress")),
    "arm policies do not match the labeled intervention.",
  );
}

export async function readImportedEvidence(value: unknown) {
  validateImportShape(value);
  const bundle = await readCaseOrTrace(value);
  validateEpisode(bundle);
  if (bundle.comparison) {
    for (const arm of bundle.comparison.arms) validateEpisode(arm);
    validatePair(bundle.comparison);
    requireEvidence(
      bundle.comparison.arms.some(
        (arm) =>
          equal(arm.trace, bundle.trace) && equal(arm.packets, bundle.packets),
      ),
      "the selected trace is not an arm of its comparison.",
    );
  }
  return bundle;
}
