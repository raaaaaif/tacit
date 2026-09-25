import { runComparison, type Intervention } from "../model/comparison";
import { runSimulation } from "../model/simulation";
import type {
  ScenarioSpec,
  PolicySpec,
  ObservationPacket,
  RunTrace,
} from "../model/types";
import { optimize } from "../model/optimization";
type Request = {
  jobId: number;
  scenario: ScenarioSpec;
} & (
  | { type: "compare"; intervention: Intervention }
  | {
      type: "run" | "optimize";
      policy: PolicySpec;
      access?: RunTrace["intervention"];
    }
);
self.onmessage = (event: MessageEvent<Request>) => {
  try {
    const request = event.data;
    const { scenario, jobId } = request;
    const post = (value: object) => self.postMessage({ ...value, jobId });
    if (request.type === "compare") {
      const result = runComparison(scenario, request.intervention, (progress) =>
        post({ type: "progress", progress }),
      );
      post({ type: "comparison-done", result });
      return;
    }
    const { policy } = request;
    const packets: ObservationPacket[] = [];
    if (request.type === "optimize") {
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
      ...request.access,
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
