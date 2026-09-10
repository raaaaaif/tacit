import { writeFileSync, mkdirSync } from "node:fs";
import { scenario, policy, CONTROLLERS } from "../src/model/scenarios";
import { runSimulation } from "../src/model/simulation";
import { MODEL_VERSION } from "../src/model/geometry";
import { wilson, stream, quantile } from "../src/model/math";
import { optimize } from "../src/model/optimization";
import type {
  ControllerId,
  ScenarioId,
  PolicySpec,
  Tilt,
} from "../src/model/types";
const arg = (key: string, fallback: string) => {
  const i = process.argv.indexOf(key);
  return i >= 0 ? process.argv[i + 1] : fallback;
};
const n = Number(arg("--n", "512")),
  selected = arg("--controller", "all");
if (!Number.isInteger(n) || n < 1 || n > 4096)
  throw Error("Episode count must be 1–4096.");
mkdirSync("public/data", { recursive: true });
const families: ScenarioId[] = ["known", "shifted", "missing"];
type Episode = {
  scenario: string;
  controller: string;
  seed: number;
  remaining: number;
  seconds: number;
  status: string;
  violations: string[];
  observations: number;
};
function evaluate(p: PolicySpec, tilt: Tilt, seeds: number[]): Episode[] {
  return seeds.map((seed, i) => {
    const s = scenario(families[i % 3], seed);
    s.fixture.tilt = tilt;
    const r = runSimulation(s, p).result;
    if (i % 128 === 0) console.log(p.controller, seed, i, seeds.length);
    return {
      scenario: s.id,
      controller: p.controller,
      seed,
      remaining: r.remaining,
      seconds: r.seconds,
      status: r.status,
      violations: r.violations,
      observations: r.observations,
    };
  });
}
function summarize(rows: Episode[]) {
  const mean = (key: "remaining" | "seconds" | "observations") =>
    rows.reduce((v, r) => v + r[key], 0) / rows.length;
  const bootstrap = (key: "remaining" | "seconds") => {
    const r = stream(9481, `bootstrap-${key}`),
      means = [];
    for (let j = 0; j < 1000; j++) {
      let sum = 0;
      for (let i = 0; i < rows.length; i++)
        sum += rows[Math.floor(r() * rows.length)][key];
      means.push(sum / rows.length);
    }
    return [quantile(means, 0.025), quantile(means, 0.975)];
  };
  const k = rows.filter((r) => r.violations.length).length;
  return {
    controller: rows[0].controller,
    n: rows.length,
    meanRemaining: mean("remaining"),
    meanSeconds: mean("seconds"),
    remainingCI: bootstrap("remaining"),
    secondsCI: bootstrap("seconds"),
    violationRate: k / rows.length,
    violationCI: wilson(k, rows.length),
    completed: rows.filter((r) => r.status === "completed").length,
    stopped: rows.filter((r) => r.status === "stopped").length,
    meanObservations: mean("observations"),
  };
}
const heldOut = Array.from({ length: n }, (_, i) => 100003 + i * 17),
  tuning = Array.from({ length: 24 }, (_, i) => 61003 + i * 17),
  training = Array.from({ length: 12 }, (_, i) => 33011 + i * 17);
for (const c of CONTROLLERS.filter(
  (c) => selected === "all" || c.id === selected,
)) {
  const baseline = evaluate(policy(c.id), 0, heldOut);
  const searches = [739, 1459, 2903].map((seed) =>
    optimize(scenario("known"), policy(c.id), seed, {
      trainingSeeds: training,
      families,
      population: 8,
      generations: 3,
      onProgress: (g) => console.log("search", c.id, seed, g),
    }),
  );
  const tuned = searches
    .map((search) => {
      const rows = evaluate(search.best.policy, search.best.tilt, tuning);
      const summary = summarize(rows);
      return {
        search,
        summary,
        score:
          summary.violationRate * 1e6 +
          summary.meanRemaining +
          0.3 * summary.meanSeconds,
      };
    })
    .sort((a, b) => a.score - b.score);
  const chosen = tuned[0],
    optimized = evaluate(
      chosen.search.best.policy,
      chosen.search.best.tilt,
      heldOut,
    );
  const artifact = {
    version: 1,
    modelVersion: MODEL_VERSION,
    sourceCommit: process.env.GITHUB_SHA ?? "local",
    controller: c.id,
    seeds: heldOut,
    trainingSeeds: training,
    tuningSeeds: tuning,
    optimizationSeeds: [739, 1459, 2903],
    baseline: summarize(baseline),
    optimized: summarize(optimized),
    byScenario: families.map((id) => ({
      scenario: id,
      baseline: summarize(baseline.filter((r) => r.scenario === id)),
      optimized: summarize(optimized.filter((r) => r.scenario === id)),
    })),
    chosen: {
      policy: chosen.search.best.policy,
      tilt: chosen.search.best.tilt,
      optimizationSeed: chosen.search.seed,
    },
    searches,
    tuning: tuned.map((t) => ({ seed: t.search.seed, summary: t.summary })),
  };
  writeFileSync(
    `public/data/controller-${c.id}.json`,
    JSON.stringify(artifact, null, 2),
  );
  writeFileSync(
    `public/data/episodes-${c.id}.csv`,
    "comparison,scenario,controller,seed,remaining_uL,seconds,status,violations\n" +
      [
        ["baseline", baseline],
        ["optimized", optimized],
      ]
        .flatMap(([label, rows]) =>
          (rows as Episode[]).map((r) =>
            [
              label,
              r.scenario,
              r.controller,
              r.seed,
              r.remaining.toFixed(4),
              r.seconds.toFixed(4),
              r.status,
              r.violations.join(";"),
            ].join(","),
          ),
        )
        .join("\n"),
  );
  console.log(
    c.id,
    JSON.stringify({
      baseline: artifact.baseline,
      optimized: artifact.optimized,
    }),
  );
}
