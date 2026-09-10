import { runSimulation } from "../model/simulation";
import type {
  ScenarioSpec,
  PolicySpec,
  ObservationPacket,
} from "../model/types";
import { optimize } from "../model/optimization";
self.onmessage = (
  event: MessageEvent<{
    type: "run" | "optimize";
    scenario: ScenarioSpec;
    policy: PolicySpec;
  }>,
) => {
  try {
    const { scenario, policy, type } = event.data;
    const packets: ObservationPacket[] = [];
    if (type === "optimize") {
      const result = optimize(scenario, policy, 739, {
        onEvaluation: (completed, total) =>
          self.postMessage({ type: "search-evaluation", completed, total }),
        onProgress: (generation, candidate) =>
          self.postMessage({ type: "search-progress", generation, candidate }),
      });
      self.postMessage({ type: "search-done", result });
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
