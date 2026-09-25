import fs from "node:fs";
import { extractFeatures, calibration } from "../src/model/optics";
import { MANIFEST } from "../src/model/evidence";
const manifest = JSON.parse(
  fs.readFileSync("public/reference-readiness/manifest.json", "utf8"),
);
const cases = manifest.cases.map(
  (c: { id: string; view: "side" | "overhead"; referenceHeight: number }) => {
    const pixels = new Uint8ClampedArray(
      fs.readFileSync(`work/refinement/${c.id}.rgba`),
    );
    const features = extractFeatures({
      version: 1,
      id: c.id,
      t: 0,
      calibration: calibration(c.view),
      pixels,
      valid: new Uint8Array(112 * 144).fill(1),
      exposureGroup: c.id,
    });
    const interval =
      features.level === null
        ? null
        : [
            features.level - 1.96 * features.levelSigma,
            features.level + 1.96 * features.levelSigma,
          ];
    return {
      ...c,
      features,
      levelErrorMm:
        features.level === null ? null : features.level - c.referenceHeight,
      nominal95LevelInterval: interval,
      levelCovered:
        interval === null
          ? false
          : interval[0] <= c.referenceHeight &&
            interval[1] >= c.referenceHeight,
    };
  },
);
const side = cases.filter((c: { view: string }) => c.view === "side"),
  overhead = cases.filter((c: { view: string }) => c.view === "overhead");
const summary = {
  sideN: side.length,
  sideLevelMisses: side.filter(
    (c: (typeof cases)[0]) => c.features.level === null,
  ).length,
  nominalLevel95Covered: side.filter((c: (typeof cases)[0]) => c.levelCovered)
    .length,
  maxAbsoluteLevelErrorMm: Math.max(
    ...side.map((c: (typeof cases)[0]) => Math.abs(c.levelErrorMm ?? 0)),
  ),
  overheadN: overhead.length,
  overheadPelletMisses: overhead.filter(
    (c: (typeof cases)[0]) => c.features.pelletAngle === null,
  ).length,
};
const report = {
  ...manifest,
  manifest: MANIFEST,
  cases,
  summary,
  scope:
    "Independent Cycles nuisance grid, frozen before rendering. Nominal feature-level intervals only, not posterior or joint trajectory coverage. Missing detections count as noncoverage. Assumed lighting/material/calibration ranges; no extractor tuning or physical validation. This does not replace the five historical failed examples.",
};
fs.writeFileSync(
  "public/data/readiness-optics.json",
  JSON.stringify(report, null, 2),
);
console.log(summary);
