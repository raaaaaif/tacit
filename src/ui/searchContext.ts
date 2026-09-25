import { canonical } from "../model/evidence";
import type { SearchResult } from "../model/optimization";
import type { PolicySpec, ScenarioSpec } from "../model/types";

export type ContextualSearchResult = SearchResult & {
  trainingScenario: ScenarioSpec;
};

function trainingContext(scene: ScenarioSpec) {
  // The optimizer supplies fixed training seeds and searches inclination.
  return canonical({
    ...scene,
    seed: 0,
    fixture: { ...scene.fixture, tilt: 0 },
  });
}

export function searchForContext(
  result: ContextualSearchResult | null,
  scene: ScenarioSpec,
  policy: PolicySpec,
) {
  return result &&
    result.best.policy.controller === policy.controller &&
    result.best.policy.residualTarget === policy.residualTarget &&
    trainingContext(result.trainingScenario) === trainingContext(scene)
    ? result
    : null;
}
