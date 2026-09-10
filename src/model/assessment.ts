import type { PolicySpec, RunTrace } from "./types";
export const ASSESSMENT_VERSION = "target-attainment-1";
export const TARGET_TOLERANCE_UL = 12;
/** Evaluator only: never passed to an observed controller. */
export function targetMet(
  result: Pick<RunTrace["result"], "remaining" | "violations">,
  policy: PolicySpec,
) {
  return (
    result.violations.length === 0 &&
    result.remaining <= policy.residualTarget + TARGET_TOLERANCE_UL
  );
}
export function outcomeReason(trace: RunTrace) {
  return trace.result.status === "completed" &&
    !targetMet(trace.result, trace.policy)
    ? `The controller's estimate reached the target, but the simulated residual was ${Math.round(trace.result.remaining)} µL. The evaluation records an unmet target.`
    : trace.result.reason;
}
