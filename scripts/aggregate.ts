import { readFileSync, writeFileSync } from "node:fs";
import {
  CONTROLLERS,
  scenario,
  policy,
  worldFromScenario,
} from "../src/model/scenarios";
import { runSimulation } from "../src/model/simulation";
import { MODEL_VERSION, sweptClearance, toWorld } from "../src/model/geometry";
import { stream } from "../src/model/math";
import { traceFile } from "../src/model/traceFile";
import { ASSESSMENT_VERSION } from "../src/model/assessment";
import type { ObservationPacket } from "../src/model/types";
const reports = CONTROLLERS.map((c) =>
  JSON.parse(readFileSync(`public/data/controller-${c.id}.json`, "utf8")),
);
if (
  reports.some(
    (r) =>
      r.modelVersion !== MODEL_VERSION ||
      r.sourceCommit !== reports[0].sourceCommit ||
      JSON.stringify(r.seeds) !== JSON.stringify(reports[0].seeds),
  )
)
  throw Error("Mixed experiment versions.");
const random = stream(4147, "geometry-stress");
let rejected = 0;
for (let i = 0; i < 4096; i++) {
  const s = scenario("known", i + 1);
  s.fixture.tilt = ([0, 5, 10] as const)[i % 3];
  const w = worldFromScenario(s),
    end = toWorld(
      [(random() - 0.5) * 8, (random() - 0.5) * 8, 2 + random() * 23],
      w.tilt,
      w.pose,
    );
  if (sweptClearance([0, -1.5, 42], end, w) < 0) rejected++;
}
const report = {
  version: 1,
  modelVersion: MODEL_VERSION,
  assessmentVersion: ASSESSMENT_VERSION,
  sourceCommit: reports[0].sourceCommit,
  generatedAt: new Date().toISOString(),
  split:
    "Paired held-out scene seeds, stratified over known, changed and missing-context families. Training and tuning seeds are disjoint from evaluation.",
  seeds: reports[0].seeds,
  summaries: reports.map((r) => r.baseline),
  optimizedSummaries: reports.map((r) => r.optimized),
  policies: reports.map((r) => r.chosen),
  selectedSearches: reports.map((r) => ({
    ...r.searches.find(
      (s: { seed: number }) => s.seed === r.chosen.optimizationSeed,
    ),
    provenance: {
      kind: "recorded",
      sourceCommit: r.sourceCommit,
      scope: "Known, changed and missing-context training families",
    },
  })),
  byScenario: reports.map((r) => ({
    controller: r.controller,
    outcomes: r.byScenario,
  })),
  stress: { n: 4096, rejected },
  notes: [
    "Synthetic whole-episode results, not biological success rates.",
    "Wilson 95% intervals for violations; 1,000 bootstrap replicates for mean residual and duration.",
    "Three optimization seeds per controller, 32 candidate evaluations per seed, 12 training episodes per candidate; selection on 24 tuning episodes. Equal evaluation budgets.",
    "Conservative stops are distinct from completed tasks and remain in all averages.",
    "Unsupported surface states cannot earn a favorable search score.",
    "No parameter selection used held-out outcomes.",
  ],
};
writeFileSync("public/data/experiment.json", JSON.stringify(report, null, 2));
const csv = reports
  .flatMap((r, i) =>
    readFileSync(`public/data/episodes-${r.controller}.csv`, "utf8")
      .trim()
      .split("\n")
      .slice(i ? 1 : 0),
  )
  .join("\n");
writeFileSync("public/data/episodes.csv", csv + "\n");
for (const id of ["known", "shifted", "missing"] as const) {
  const packets: ObservationPacket[] = [];
  const t = runSimulation(scenario(id), policy("belief"), {
    onObservation: (p) => packets.push(p),
  });
  t.provenance.kind = "recorded";
  writeFileSync(
    `public/data/demo-${id}.json`,
    JSON.stringify(traceFile(t, packets)),
  );
}
console.log(JSON.stringify(report.summaries, null, 2));
