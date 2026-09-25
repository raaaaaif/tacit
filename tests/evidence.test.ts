import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import {
  ASSESSMENT_VERSION,
  outcomeReason,
  targetMet,
} from "../src/model/assessment";
import { MODEL_VERSION } from "../src/model/geometry";
import { readTraceFile, traceFile } from "../src/model/traceFile";
import { policy } from "../src/model/scenarios";
import type { ControllerId } from "../src/model/types";

const read = (name: string) =>
  JSON.parse(readFileSync(`public/data/${name}.json`, "utf8"));
test("published outcomes partition all paired held-out episodes and exclude missed targets", () => {
  const combined = read("experiment");
  assert.equal(combined.modelVersion, "tacit-0.3.0");
  assert.notEqual(
    combined.modelVersion,
    MODEL_VERSION,
    "historical evidence must retain its original model identity",
  );
  assert.equal(combined.assessmentVersion, ASSESSMENT_VERSION);
  assert.equal(combined.stress.n, 4096);
  for (const id of [
    "nominal",
    "estimate",
    "belief",
    "oracle",
  ] as ControllerId[]) {
    const report = read(`controller-${id}`);
    assert.deepEqual(report.seeds, combined.seeds);
    assert.equal(report.seeds.length, 512);
    assert.equal(
      new Set([...report.seeds, ...report.trainingSeeds, ...report.tuningSeeds])
        .size,
      report.seeds.length +
        report.trainingSeeds.length +
        report.tuningSeeds.length,
    );
    const rows = readFileSync(`public/data/episodes-${id}.csv`, "utf8")
      .trim()
      .split("\n")
      .slice(1)
      .map((line) => line.split(","));
    for (const comparison of ["baseline", "optimized"]) {
      const selected = rows.filter((row) => row[0] === comparison);
      const summary = report[comparison];
      const p = comparison === "baseline" ? policy(id) : report.chosen.policy;
      let complete = 0,
        stopped = 0,
        missed = 0,
        violated = 0;
      for (const row of selected) {
        const met = targetMet(
          { remaining: Number(row[4]), violations: row[7] ? [row[7]] : [] },
          p,
        );
        if (row[7]) violated++;
        else if (row[6] === "stopped") stopped++;
        else if (row[6] === "completed" && met) complete++;
        else missed++;
      }
      assert.equal(selected.length, 512);
      assert.deepEqual(
        [complete, stopped, missed],
        [summary.completed, summary.stopped, summary.missedTargets],
      );
      assert.equal(violated, summary.violationRate * 512);
      assert.equal(complete + stopped + missed + violated, 512);
    }
  }
});
test("trace export distinguishes controller completion from final-state target attainment", () => {
  const { trace, packets } = readTraceFile(read("demo-known"));
  const declared = {
    ...trace,
    result: { ...trace.result, status: "completed" as const },
  };
  // The recorded conservative run actually retains about 176 µL, above the 162 µL limit.
  assert.equal(trace.result.remaining > 162, true);
  const exported = traceFile(declared, packets);
  assert.equal(exported.assessment.declaredComplete, true);
  assert.equal(exported.assessment.targetMet, false);
  assert.equal(exported.assessment.complete, false);
  assert.match(outcomeReason(declared), /unmet target/);
  assert.equal(traceFile(trace, packets).assessment.declaredComplete, false);
});
