import { runSimulation } from "../model/simulation";
import { worldFromScenario } from "../model/scenarios";
import { renderObservation } from "../model/optics";
import type {
  ScenarioSpec,
  PolicySpec,
  ObservationPacket,
} from "../model/types";
import { optimize } from "../model/optimization";
self.onmessage = (
  event: MessageEvent<{
    type: "run" | "preview" | "optimize";
    scenario: ScenarioSpec;
    policy: PolicySpec;
  }>,
) => {
  try {
    const { scenario, policy, type } = event.data;
    const packets: ObservationPacket[] = [];
    if (type === "optimize") {
      const result = optimize(scenario, policy, 739, {
        onProgress: (generation, candidate) =>
          self.postMessage({ type: "search-progress", generation, candidate }),
      });
      self.postMessage({ type: "search-done", result });
      return;
    }
    if (type === "preview") {
      const w = worldFromScenario(scenario);
      for (const view of ["side", "overhead"] as const)
        packets.push(renderObservation(w, view, scenario.seed, 0, "preview"));
      self.postMessage({ type: "preview", packets });
      return;
    }
    const trace = runSimulation(scenario, policy, {
      onProgress: (progress) =>
        self.postMessage({ type: "progress", progress }),
      onObservation: (packet) => packets.push(packet),
    });
    self.postMessage({ type: "done", trace, packets });
  } catch (error) {
    self.postMessage({
      type: "error",
      message: error instanceof Error ? error.message : String(error),
    });
  }
};
