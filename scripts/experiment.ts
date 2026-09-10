import { writeFileSync, mkdirSync } from "node:fs";
import { resolve } from "node:path";
import { scenario, policy, CONTROLLERS } from "../src/model/scenarios";
import { runSimulation } from "../src/model/simulation";
import { MODEL_VERSION, sweptClearance, toWorld } from "../src/model/geometry";
import { worldFromScenario } from "../src/model/scenarios";
import { stream, wilson } from "../src/model/math";
import { optimize } from "../src/model/optimization";
import type {
  ExperimentReport,
  ScenarioId,
  PolicySummary,
  RunTrace,
} from "../src/model/types";
const arg = (key: string, fallback: number) => {
  const i = process.argv.indexOf(key);
  return i >= 0 ? Number(process.argv[i + 1]) : fallback;
};
const n = arg("--n", 512),
  stressN = arg("--stress", 4096),
  search = process.argv.includes("--optimize");
mkdirSync("public/data", { recursive: true });
const summaries: PolicySummary[] = [],
  episodes: {
    scenario: string;
    controller: string;
    seed: number;
    remaining: number;
    seconds: number;
    status: string;
    violations: string[];
  }[] = [];
const seeds = Array.from({ length: n }, (_, i) => 100003 + i * 17);
for (const c of CONTROLLERS) {
  let remaining = 0,
    seconds = 0,
    violationCount = 0,
    completed = 0,
    stopped = 0,
    observations = 0;
  for (let i = 0; i < n; i++) {
    const id = (["known", "shifted", "missing"] as ScenarioId[])[i % 3];
    const s = scenario(id, seeds[i]);
    const trace = runSimulation(s, policy(c.id));
    const r = trace.result;
    remaining += r.remaining;
    seconds += r.seconds;
    violationCount += r.violations.length ? 1 : 0;
    completed += r.status === "completed" ? 1 : 0;
    stopped += r.status === "stopped" ? 1 : 0;
    observations += r.observations;
    episodes.push({
      scenario: id,
      controller: c.id,
      seed: s.seed,
      remaining: r.remaining,
      seconds: r.seconds,
      status: r.status,
      violations: r.violations,
    });
    if (i % 64 === 0) console.log(`${c.id}: ${i}/${n}`);
  }
  summaries.push({
    controller: c.id,
    n,
    meanRemaining: remaining / n,
    meanSeconds: seconds / n,
    violationRate: violationCount / n,
    violationCI: wilson(violationCount, n),
    completed,
    stopped,
    meanObservations: observations / n,
  });
}
let rejected = 0;
const random = stream(4147, "geometry-stress");
for (let i = 0; i < stressN; i++) {
  const s = scenario("known", i + 1);
  s.fixture.tilt = ([0, 5, 10] as const)[i % 3];
  const w = worldFromScenario(s);
  const end = toWorld(
    [(random() - 0.5) * 8, (random() - 0.5) * 8, 2 + random() * 23],
    w.tilt,
    w.pose,
  );
  if (sweptClearance([0, -1.5, 42], end, w) < 0) rejected++;
}
const report: ExperimentReport = {
  version: 1,
  modelVersion: MODEL_VERSION,
  generatedAt: new Date().toISOString(),
  split:
    "Held-out IID scene seeds, stratified approximately equally over the three authored scenario families. All controllers receive the same scenes.",
  seeds,
  summaries,
  stress: { n: stressN, rejected },
  notes: [
    "These are synthetic model outcomes, not biological success rates.",
    "Intervals are Wilson 95% confidence intervals for whole-episode constraint violations.",
    "Stops are distinct from completed tasks and remain in residual-volume averages.",
    "Geometric stress sampling is reported separately from rendered evaluation.",
    "No optimization is performed on the held-out scenes.",
  ],
};
writeFileSync(
  "public/data/experiment.json",
  JSON.stringify(report, null, 2) + "\n",
);
writeFileSync(
  "public/data/episodes.csv",
  "scenario,controller,seed,remaining_uL,seconds,status,violations\n" +
    episodes
      .map((r) =>
        [
          r.scenario,
          r.controller,
          r.seed,
          r.remaining.toFixed(4),
          r.seconds.toFixed(4),
          r.status,
          r.violations.join(";"),
        ].join(","),
      )
      .join("\n"),
);
for (const id of ["known", "shifted", "missing"] as const) {
  const trace = runSimulation(scenario(id), policy("belief"));
  trace.provenance.kind = "recorded";
  writeFileSync(`public/data/demo-${id}.json`, JSON.stringify(trace));
}
if (search) {
  const searches = [];
  for (const seed of [739, 1459, 2903])
    searches.push(
      optimize(scenario("known"), policy("belief"), seed, {
        trainingSeeds: [33011, 33013, 33017, 33019],
        population: 8,
        generations: 3,
        onProgress: (g) => console.log(`Optimization ${seed}: generation ${g}`),
      }),
    );
  writeFileSync(
    "public/data/search.json",
    JSON.stringify(
      {
        version: 1,
        modelVersion: MODEL_VERSION,
        searches,
        notes:
          "Training-only search, never fitted to held-out results. Equal evaluation budget per optimization seed. The default-policy evaluation is separate; no uplift claim is inferred from training scores.",
      },
      null,
      2,
    ),
  );
}
console.log(JSON.stringify(summaries, null, 2));
