import test from "node:test";
import assert from "node:assert/strict";
import { scenario, policy } from "../src/model/scenarios";
import {
  searchForContext,
  type ContextualSearchResult,
} from "../src/ui/searchContext";

const base = scenario("known");
const controller = policy("progress");
const candidate = {
  parameters: [],
  policy: controller,
  tilt: 5 as const,
  remaining: 300,
  seconds: 30,
  violations: 0,
  stops: 1,
  score: 0,
};
const result: ContextualSearchResult = {
  version: 1,
  modelVersion: "test-fixture",
  seed: 739,
  evaluations: 32,
  trainingSeeds: [33011, 33013],
  best: candidate,
  frontier: [candidate],
  history: [],
  trainingScenario: base,
};

test("training search survives a new replay seed and applying the searched parameters", () => {
  const freshScene = {
    ...base,
    seed: 2200,
    fixture: { ...base.fixture, tilt: 5 as const },
  };
  const searchedPolicy = {
    ...controller,
    chunk: 80,
    surfaceDepth: 4,
    margin: 2,
    observeEvery: 3,
  };
  assert.equal(searchForContext(result, freshScene, searchedPolicy), result);
  // Imported JSON may contain the same fields in a different order.
  const reordered = Object.fromEntries(
    Object.entries(freshScene).reverse(),
  ) as typeof freshScene;
  assert.equal(searchForContext(result, reordered, searchedPolicy), result);
});

test("training search is hidden when a non-searched scene assumption changes", () => {
  for (const scene of [
    scenario("shifted"),
    scenario("missing"),
    { ...base, contrast: 0.4 },
    { ...base, cameraBias: 0.3 },
    { ...base, pumpSigma: 0.05 },
    { ...base, fixture: { ...base.fixture, indexed: false } },
    { ...base, fixture: { ...base.fixture, clearance: 0.8 } },
  ]) {
    assert.equal(searchForContext(result, scene, controller), null);
  }
  assert.equal(searchForContext(result, base, controller), result);
});

test("an imported target or different controller cannot reuse stale search results", () => {
  assert.equal(
    searchForContext(result, base, { ...controller, residualTarget: 400 }),
    null,
  );
  assert.equal(searchForContext(result, base, policy("belief")), null);
  assert.equal(searchForContext(null, base, controller), null);
});
