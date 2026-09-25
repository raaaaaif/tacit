import D from "./dimensions.json";
import { fixtureDistance } from "./fixtureGeometry";
import { toWorld } from "./geometry";
import type { FixtureSpec, Vec3 } from "./types";

export const GEOMETRY_VERSION = D.revision;
export const ASSEMBLY = {
  id: "bottom-datum-guide-02",
  geometryVersion: GEOMETRY_VERSION,
  units: "mm",
  fitStatus: "computationally-checked",
  datum:
    "Tube flat outer bottom at local z=-0.65 mm contacts the tilted support pad.",
  seatingRule:
    "Offsets lie in the tube transverse plane, within 0.8 × radial clearance.",
  retainedDegreesOfFreedom: ["downward axial translation at support datum"],
  uncertainDegreesOfFreedom: [
    "lateral placement",
    "rotation",
    "tilt maintained by declared setup",
  ],
  orientationEvidenceRule:
    "Visual marker only. Externally recorded history and assumed retention uncertainty; no mechanical key.",
  excludedHardware: ["camera housings", "camera supports", "robot arm"],
  limitations: [
    "Nominal geometry and sampled tolerance checks, not measured fit.",
    "No force, stability, friction, printability or biological validation. Not for fabrication.",
  ],
} as const;

export function assemblySupported(s: FixtureSpec) {
  return [0, 5].includes(s.tilt) && s.clearance === D.holder.seatClearance;
}
/** Independent surface samples include the complete outer wall, lip, cap and hinge.
 * Allowed datum contact is zero distance; finite sampling does not prove continuous fit. */
export function checkAssembly(
  spec: FixtureSpec,
  insertion = 0,
  radialDelta = 0,
  offset: [number, number] = [0, 0],
) {
  let minimum = Infinity,
    samples = 0;
  let witness: Vec3 = [0, 0, 0];
  const sample = (p: Vec3) => {
    const q = toWorld(
      [p[0] + offset[0], p[1] + offset[1], p[2] + insertion],
      spec.tilt,
    );
    const d = fixtureDistance(q, spec);
    samples++;
    if (d < minimum) {
      minimum = d;
      witness = q;
    }
  };
  for (let i = 0; i <= 140; i++) {
    const z = -0.65 + i * (33.75 / 140);
    const radius =
      z < 0
        ? 0.65 + ((z + 0.65) / 0.65) * 0.55
        : z < 11
          ? 1.2 + (z / 11) * 3.85
          : z < 31.3
            ? 5.05
            : 5.7;
    for (let a = 0; a < 96; a++)
      sample([
        (radius + radialDelta) * Math.cos((a * Math.PI) / 48),
        (radius + radialDelta) * Math.sin((a * Math.PI) / 48),
        z,
      ]);
  }
  for (let a = 0; a < 96; a++) {
    sample([
      0.65 * Math.cos((a * Math.PI) / 48),
      0.65 * Math.sin((a * Math.PI) / 48),
      -0.65,
    ]);
    for (const z of [
      D.tube.capZ - D.tube.capThickness / 2,
      D.tube.capZ + D.tube.capThickness / 2,
    ])
      sample([
        D.tube.capRadius * Math.cos((a * Math.PI) / 48),
        D.tube.capY + D.tube.capRadius * Math.sin((a * Math.PI) / 48),
        z,
      ]);
  }
  for (const x of [-1, 1])
    for (const y of [-1, 1])
      for (const z of [-1, 1])
        sample(
          D.tube.hingeCenter.map(
            (v, i) => v + ([x, y, z][i] * D.tube.hingeSize[i]) / 2,
          ) as Vec3,
        );
  return {
    pass: minimum >= -1e-6,
    minimumClearanceMm: minimum,
    witness,
    samples,
    supportGapMm: insertion,
    insertionMm: insertion,
    radialDeltaMm: radialDelta,
    offset,
    scope:
      "Sampled nominal assembly with a 1e-6 mm numerical contact tolerance; not physical validation.",
  };
}
