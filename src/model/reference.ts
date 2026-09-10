import reference from "./surface-reference.json";
import type { Tilt } from "./types";
/** Empirical envelope of the converged reference grid, not a rigorous interpolation error bound. */
export function surfaceSupport(tilt: Tilt, volume: [number, number]) {
  const cases = reference.cases.filter((c) => c.tilt === tilt);
  const supported =
    reference.supportedTilts.includes(tilt) &&
    volume[0] >= 100 &&
    volume[1] <= 950;
  const converged = cases.filter((c) => c.converged);
  return {
    supported,
    reason: !reference.supportedTilts.includes(tilt)
      ? "Equilibrium reference coverage is incomplete for this inclination."
      : "The liquid estimate is outside the 100–950 µL reference domain.",
    depression: Math.max(
      ...converged.map(
        (c) => c.flatHeight - c.minZ + c.meshDifferenceMm + c.iterationDriftMm,
      ),
    ),
    rise: Math.max(
      ...converged.map(
        (c) => c.maxZ - c.flatHeight + c.meshDifferenceMm + c.iterationDriftMm,
      ),
    ),
    sourceRun: reference.sourceRun,
  };
}
