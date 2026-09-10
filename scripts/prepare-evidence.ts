/** Package hosted episode records with an explicit final-state assessment.
 * This changes no trajectory, observation, training ranking or selected parameter.
 */
import fs from "node:fs";
import path from "node:path";
import assert from "node:assert/strict";
import { MODEL_VERSION } from "../src/model/geometry";
import {
  ASSESSMENT_VERSION,
  TARGET_TOLERANCE_UL,
} from "../src/model/assessment";
import { CONTROLLERS, policy } from "../src/model/scenarios";
const source = process.argv[2];
if (!source)
  throw Error(
    "Usage: npx tsx scripts/prepare-evidence.ts <held-out-evidence-directory>",
  );
const out = "public/data";
fs.mkdirSync(out, { recursive: true });
const rows = (file: string) => {
  const lines = fs.readFileSync(file, "utf8").trim().split("\n");
  const keys = lines.shift()!.split(",");
  return lines.map((l) =>
    Object.fromEntries(l.split(",").map((v, i) => [keys[i], v])),
  );
};
const reports = CONTROLLERS.map((c) => {
  const r = JSON.parse(
    fs.readFileSync(path.join(source, `controller-${c.id}.json`), "utf8"),
  );
  assert.equal(r.modelVersion, MODEL_VERSION);
  assert.equal(r.seeds.length, 512);
  const episodes = rows(path.join(source, `episodes-${c.id}.csv`));
  const update = (summary: any, label: string, family?: string) => {
    const selected = episodes.filter(
      (e) => e.comparison === label && (!family || e.scenario === family),
    );
    assert.equal(selected.length, summary.n);
    const target =
      label === "baseline"
        ? policy(c.id).residualTarget
        : r.chosen.policy.residualTarget;
    const declared = selected.filter(
      (e) => (e.controller_status ?? e.status) === "completed",
    );
    const completed = declared.filter(
      (e) =>
        Number(e.remaining_uL) <= target + TARGET_TOLERANCE_UL && !e.violations,
    ).length;
    const stopped = selected.filter(
      (e) => (e.controller_status ?? e.status) === "stopped",
    ).length;
    const violated = selected.filter((e) => e.violations).length;
    const missedTargets = declared.length - completed;
    assert.equal(completed + stopped + violated + missedTargets, summary.n);
    return {
      ...summary,
      declaredComplete: declared.length,
      completed,
      stopped,
      missedTargets,
    };
  };
  r.baseline = update(r.baseline, "baseline");
  r.optimized = update(r.optimized, "optimized");
  r.byScenario = r.byScenario.map((s: any) => ({
    ...s,
    baseline: update(s.baseline, "baseline", s.scenario),
    optimized: update(s.optimized, "optimized", s.scenario),
  }));
  // Older tuning summaries contain only declarations, not per-episode final states.
  if (!r.assessmentVersion) {
    r.tuning = r.tuning.map((t: any) => {
      const { completed, ...summary } = t.summary;
      return {
        ...t,
        summary: { ...summary, declaredComplete: completed },
        assessment:
          "Controller declarations only; tuning final states were not retained.",
      };
    });
  }
  r.assessmentVersion = ASSESSMENT_VERSION;
  fs.writeFileSync(
    path.join(out, `controller-${c.id}.json`),
    JSON.stringify(r),
  );
  fs.copyFileSync(
    path.join(source, `episodes-${c.id}.csv`),
    path.join(out, `episodes-${c.id}.csv`),
  );
  return r;
});
for (const r of reports) {
  assert.deepEqual(r.seeds, reports[0].seeds);
  assert.equal(r.sourceCommit, reports[0].sourceCommit);
}
const original = JSON.parse(
  fs.readFileSync(path.join(source, "experiment.json"), "utf8"),
);
assert.equal(original.stress.n, 4096);
const report = {
  ...original,
  assessmentVersion: ASSESSMENT_VERSION,
  summaries: reports.map((r) => r.baseline),
  optimizedSummaries: reports.map((r) => r.optimized),
  byScenario: reports.map((r) => ({
    controller: r.controller,
    outcomes: r.byScenario,
  })),
  selectedSearches: reports.map((r) => ({
    ...r.searches.find((s: any) => s.seed === r.chosen.optimizationSeed),
    provenance: {
      kind: "recorded",
      sourceCommit: r.sourceCommit,
      scope: "Known, changed and missing-context training families",
    },
  })),
};
report.notes.push(
  "Completion requires both a controller declaration and final simulated target attainment without a recorded violation. Missed targets are reported separately. Assessment is derived from saved episode final states; no control parameter changes.",
);
fs.writeFileSync(path.join(out, "experiment.json"), JSON.stringify(report));
for (const name of [
  "episodes.csv",
  "demo-known.json",
  "demo-shifted.json",
  "demo-missing.json",
])
  fs.copyFileSync(path.join(source, name), path.join(out, name));
console.log(
  JSON.stringify(
    {
      model: MODEL_VERSION,
      assessment: ASSESSMENT_VERSION,
      baseline: report.summaries,
      optimized: report.optimizedSummaries,
    },
    null,
    2,
  ),
);
