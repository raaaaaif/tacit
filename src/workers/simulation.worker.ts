import { runComparison, type Intervention } from "../model/comparison";
import { runSimulation } from "../model/simulation";
import type {
  ScenarioSpec,
  PolicySpec,
  ObservationPacket,
} from "../model/types";
import { optimize } from "../model/optimization";
self.onmessage = (
  event: MessageEvent<{
    type: "run" | "optimize" | "compare";
    jobId: number;
    intervention?: Intervention;
    scenario: ScenarioSpec;
    policy: PolicySpec;
  }>,
) => {
  try {
    const { scenario, policy, type, jobId } = event.data;
    const post = (value: object) => self.postMessage({ ...value, jobId });
    if (type === "compare") {
      const result = runComparison(
        scenario,
        event.data.intervention!,
        (progress) => post({ type: "progress", progress }),
      );
      post({ type: "comparison-done", result });
      return;
    }
    const packets: ObservationPacket[] = [];
    if (type === "optimize") {
      const result = optimize(scenario, policy, 739, {
        onEvaluation: (completed, total) =>
          post({ type: "search-evaluation", completed, total }),
        onProgress: (generation, candidate) =>
          post({ type: "search-progress", generation, candidate }),
      });
      post({ type: "search-done", result });
      return;
    }
    const trace = runSimulation(scenario, policy, {
      onProgress: (progress) => post({ type: "progress", progress }),
      onObservation: (packet) => packets.push(packet),
    });
    post({ type: "done", trace, packets });
  } catch (error) {
    self.postMessage({
      jobId: event.data.jobId,
      type: "error",
      message: error instanceof Error ? error.message : String(error),
    });
  }
};
