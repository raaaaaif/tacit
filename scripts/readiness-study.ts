import fs from "node:fs";
import { scenario } from "../src/model/scenarios";
import {
  STUDY_PLAN,
  assignments,
  runComparison,
  pairRow,
  summarize,
  pairedAnalysis,
  type Campaign,
  type Intervention,
  type PairRow,
} from "../src/model/comparison";
import { sha256 } from "../src/model/evidence";
fs.mkdirSync("work/refinement", { recursive: true });
fs.writeFileSync(
  "work/refinement/frozen-study.json",
  JSON.stringify({ plan: STUDY_PLAN, hash: await sha256(STUDY_PLAN) }, null, 2),
);
const campaign: Campaign = {
  plan: STUDY_PLAN,
  generatedAt: new Date().toISOString(),
  comparisons: [],
};
for (const kind of ["history", "view", "policy"] as Intervention[]) {
  const ledger = assignments(kind);
  const rows: PairRow[] = [];
  for (const a of ledger) {
    const c = runComparison(scenario(a.family, a.seed), kind);
    rows.push(pairRow(c));
    console.log(
      kind,
      a.family,
      a.seed,
      rows.at(-1)?.a.outcome,
      rows.at(-1)?.b.outcome,
    );
  }
  campaign.comparisons.push({
    kind,
    assigned: ledger.length,
    administrativeFailures: [],
    rows,
    a: summarize(rows.map((r) => r.a)),
    b: summarize(rows.map((r) => r.b)),
    paired: (["residual", "seconds", "completion"] as const).map((m) =>
      pairedAnalysis(rows, m),
    ),
    discordantViolations: {
      aOnly: rows.filter(
        (r) => r.a.outcome === "violated" && r.b.outcome !== "violated",
      ).length,
      bOnly: rows.filter(
        (r) => r.b.outcome === "violated" && r.a.outcome !== "violated",
      ).length,
    },
  });
}
fs.writeFileSync("public/data/readiness-study.json", JSON.stringify(campaign));
console.log("All assignments accounted for.", await sha256(campaign));
