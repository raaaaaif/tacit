import type { BeliefState, TraceEvent } from "../model/types";

/** The acquisition posterior is unavailable until capture finishes. In that
 * interval use the original decision inputs, including any withheld history. */
export function visibleReplayBelief(
  playback: {
    belief: TraceEvent["belief"] | undefined;
    event: TraceEvent;
  } | null,
  fallback: BeliefState,
): TraceEvent["belief"] {
  return playback?.belief ?? playback?.event.receipt?.belief ?? fallback;
}
