import fs from "node:fs";
import { scenario, worldFromScenario, policy } from "../src/model/scenarios";
import { initialBelief, updateBelief } from "../src/model/belief";
import { renderObservation } from "../src/model/optics";
import { runSimulation } from "../src/model/simulation";
import { MANIFEST } from "../src/model/evidence";
const cases = [];
for (const family of ["known", "shifted", "missing"] as const)
  for (let j = 0; j < 12; j++) {
    const s = scenario(family, 600001 + j * 41),
      w = worldFromScenario(s),
      b = initialBelief(s);
    const packet = renderObservation(w, "side", s.seed, 0.7, "side-epoch-0", {
      calibrationSigma: s.cameraBias,
    });
    const u = updateBelief(b, packet, s);
    cases.push({
      family,
      seed: s.seed,
      trueVolume: w.volume,
      volume95: u.belief.volume,
      covered: w.volume >= u.belief.volume[0] && w.volume <= u.belief.volume[1],
      levelDetected: u.features.level !== null,
      pelletDetected: u.features.pelletAngle !== null,
    });
  }
const sensitivity = [];
for (const family of ["known", "shifted", "missing"] as const)
  for (const setting of [
    { id: "baseline", pump: 0.018, camera: 0.12 },
    { id: "pump-error-4pct", pump: 0.04, camera: 0.12 },
    { id: "camera-bias-0.4mm", pump: 0.018, camera: 0.4 },
  ]) {
    const s = scenario(family);
    s.pumpSigma = setting.pump;
    s.cameraBias = setting.camera;
    const t = runSimulation(s, policy("progress"));
    sensitivity.push({
      family,
      setting,
      removed: t.result.removed,
      residual: t.result.remaining,
      violations: t.result.violations,
      blockers: t.events.at(-1)!.receipt!.blockers,
      observations: t.result.observations,
    });
  }
const report = {
  manifest: MANIFEST,
  kind: "internal generative-model coverage diagnostic; not a proof of calibrated inference",
  scope:
    "36 prespecified synthetic side views. No real images; model discrepancy is separate. Sensitivity uses development seed 1847 only.",
  cases,
  sensitivity,
  summary: {
    covered: cases.filter((c) => c.covered).length,
    n: cases.length,
    levelMisses: cases.filter((c) => !c.levelDetected).length,
  },
  independentRenderer: {
    status: "historical retained audit; extractor unchanged",
    images: 5,
    maxLiquidErrorMm: 1.39,
    overheadPelletMisses: 2,
    overheadImages: 2,
  },
  physicalValidation: "not performed",
};
fs.writeFileSync(
  "public/data/readiness-calibration.json",
  JSON.stringify(report, null, 2),
);
console.log(report.summary);
