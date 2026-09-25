import type { Comparison } from "../model/comparison";
import { canonical } from "../model/evidence";
import type { RunTrace, ScenarioSpec, WorldState } from "../model/types";

export function comparisonForScenario(
  comparison: Comparison | null,
  scenario: ScenarioSpec,
) {
  return comparison?.arms.every(
    (arm) => canonical(arm.trace.scenario) === canonical(scenario),
  )
    ? comparison
    : null;
}

export function replayQuantities(
  trace: RunTrace | null,
  playback: { volume: number; aspirated: number } | null,
  prepared: WorldState,
) {
  const initial = trace?.initial.volume ?? prepared.volume;
  return {
    initial,
    remaining: playback?.volume ?? initial,
    removed: playback?.aspirated ?? 0,
  };
}
