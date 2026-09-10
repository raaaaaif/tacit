import { scenario as makeScenario } from "./scenarios";
import type {
  ScenarioSpec,
  PolicySpec,
  RunTrace,
  Tilt,
  ScenarioId,
} from "./types";
import { surfaceSupport } from "./reference";
import { runSimulation } from "./simulation";
import { stream, clamp } from "./math";
import { MODEL_VERSION } from "./geometry";
export interface Candidate {
  parameters: number[];
  policy: PolicySpec;
  tilt: Tilt;
  remaining: number;
  seconds: number;
  violations: number;
  stops: number;
  score: number;
}
export interface SearchResult {
  version: 1;
  modelVersion: string;
  provenance?: {
    kind: "live" | "recorded";
    sourceCommit?: string;
    scope?: string;
  };
  seed: number;
  evaluations: number;
  trainingSeeds: number[];
  best: Candidate;
  frontier: Candidate[];
  history: { generation: number; best: number }[];
}
const bounds: [
  [number, number],
  [number, number],
  [number, number],
  [number, number],
  [number, number],
] = [
  [40, 160],
  [1.8, 2.6],
  [2.8, 5.2],
  [1, 4],
  [0, 2],
];
function decode(x: number[], base: PolicySpec) {
  return {
    policy: {
      ...base,
      chunk: x[0],
      margin: x[1],
      surfaceDepth: x[2],
      observeEvery: Math.round(x[3]),
    },
    tilt: ([0, 5, 10] as Tilt[])[Math.round(x[4])],
  };
}
/** Seeded DE/rand/1/bin. Ranking is feasibility-first; displayed metrics remain separate. */
export function optimize(
  scenario: ScenarioSpec,
  base: PolicySpec,
  seed = 739,
  options: {
    population?: number;
    generations?: number;
    trainingSeeds?: number[];
    families?: ScenarioId[];
    onProgress?: (generation: number, candidate: Candidate) => void;
    onEvaluation?: (completed: number, total: number) => void;
  } = {},
): SearchResult {
  const random = stream(seed, "differential-evolution"),
    n = options.population ?? 8,
    generations = options.generations ?? 3,
    seeds = options.trainingSeeds ?? [33011, 33013],
    all: Candidate[] = [],
    history: { generation: number; best: number }[] = [];
  if (n < 4 || n > 32 || generations < 1 || generations > 100 || !seeds.length)
    throw Error("Unsupported optimization budget.");
  let evaluations = 0;
  function evaluate(x: number[]): Candidate {
    const decoded = decode(x, base);
    const results = seeds.map((seed, i) => {
      const template = options.families
        ? makeScenario(options.families[i % options.families.length], seed)
        : scenario;
      return runSimulation(
        {
          ...template,
          seed,
          fixture: { ...template.fixture, tilt: decoded.tilt },
        },
        decoded.policy,
      ).result;
    });
    const remaining =
        results.reduce((a, r) => a + r.remaining, 0) / seeds.length,
      seconds = results.reduce((a, r) => a + r.seconds, 0) / seeds.length,
      violations =
        results.filter((r) => r.violations.length > 0).length / seeds.length,
      stops =
        results.filter((r) => r.status === "stopped").length / seeds.length;
    const candidate = {
      parameters: x,
      policy: decoded.policy,
      tilt: decoded.tilt,
      remaining,
      seconds,
      violations,
      stops,
      score: !surfaceSupport(decoded.tilt, [
        scenario.volume - 60,
        scenario.volume + 60,
      ]).supported
        ? 1e9
        : violations * 1e6 + remaining + seconds * 0.3,
    };
    evaluations++;
    options.onEvaluation?.(evaluations, n * (generations + 1));
    all.push(candidate);
    return candidate;
  }
  const population = Array.from({ length: n }, (_, i) =>
    evaluate(
      i === 0
        ? [
            base.chunk,
            base.margin,
            base.surfaceDepth,
            base.observeEvery,
            scenario.fixture.tilt / 5,
          ]
        : bounds.map(([a, b]) => a + random() * (b - a)),
    ),
  );
  for (let generation = 0; generation < generations; generation++) {
    for (let i = 0; i < n; i++) {
      const picks: number[] = [];
      while (picks.length < 3) {
        const j = Math.floor(random() * n);
        if (j !== i && !picks.includes(j)) picks.push(j);
      }
      const forced = Math.floor(random() * bounds.length);
      const trial = population[i].parameters.map((v, k) =>
        random() < 0.8 || k === forced
          ? clamp(
              population[picks[0]].parameters[k] +
                0.65 *
                  (population[picks[1]].parameters[k] -
                    population[picks[2]].parameters[k]),
              ...bounds[k],
            )
          : v,
      );
      const c = evaluate(trial);
      if (c.score < population[i].score) population[i] = c;
    }
    const best = population.reduce((a, b) => (a.score < b.score ? a : b));
    history.push({ generation: generation + 1, best: best.score });
    options.onProgress?.(generation + 1, best);
  }
  const eligible = all.filter(
    (c) =>
      surfaceSupport(c.tilt, [scenario.volume - 60, scenario.volume + 60])
        .supported,
  );
  const frontier = eligible
    .filter(
      (a, i) =>
        !eligible.some(
          (b, j) =>
            j !== i &&
            b.violations <= a.violations &&
            b.remaining <= a.remaining &&
            b.seconds <= a.seconds &&
            (b.violations < a.violations ||
              b.remaining < a.remaining ||
              b.seconds < a.seconds),
        ),
    )
    .filter(
      (a, i, arr) =>
        arr.findIndex(
          (b) =>
            Math.abs(a.remaining - b.remaining) < 0.001 &&
            Math.abs(a.seconds - b.seconds) < 0.001,
        ) === i,
    );
  return {
    version: 1,
    modelVersion: MODEL_VERSION,
    seed,
    evaluations,
    trainingSeeds: seeds,
    best: population.reduce((a, b) => (a.score < b.score ? a : b)),
    frontier,
    history,
  };
}
