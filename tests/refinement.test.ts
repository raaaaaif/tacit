import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import Module from "manifold-3d";
import { fixtureSolid } from "../src/cad/solid";
import { fixtureDistance } from "../src/model/fixtureGeometry";
import { checkAssembly, ASSEMBLY } from "../src/model/assembly";
import {
  defaultFixture,
  D,
  toWorld,
  liquidHeight,
  sweptClearance,
} from "../src/model/geometry";
import { scenario, policy } from "../src/model/scenarios";
import { initialBelief } from "../src/model/belief";
import { runSimulation } from "../src/model/simulation";
import {
  policyInput,
  evaluateCandidates,
  bestCandidate,
} from "../src/model/policy";
import { auditReceipt, canonical, MANIFEST } from "../src/model/evidence";
import { traceFile, readTraceFile } from "../src/model/traceFile";
import { casePacket, readCaseOrTrace } from "../src/model/casePacket";
import {
  runComparison,
  pairRow,
  pairedAnalysis,
  outcome,
  assignments,
  STUDY_PLAN,
} from "../src/model/comparison";
import type { ObservationPacket } from "../src/model/types";
fs.mkdirSync("work/refinement", { recursive: true });
const packets: ObservationPacket[] = [];
const run = runSimulation(scenario("known"), policy("progress"), {
  onObservation: (p) => packets.push(p),
});

test("G01-G04: fence witness, support datum, complete sampled tolerance sweep", () => {
  assert.ok(fixtureDistance([0, 4.7, 14.2], defaultFixture) > 0.69);
  const reports = [];
  for (const tilt of [0, 5] as const)
    for (const indexed of [false, true])
      for (const radialDelta of [0, 0.05])
        for (const a of [0, Math.PI / 2, Math.PI, (3 * Math.PI) / 2]) {
          const offset: [number, number] = [
            0.28 * Math.cos(a),
            0.28 * Math.sin(a),
          ];
          const r = checkAssembly(
            { ...defaultFixture, tilt, indexed },
            0,
            radialDelta,
            offset,
          );
          assert.ok(r.pass, JSON.stringify(r));
          assert.equal(r.supportGapMm, 0);
          reports.push({ tilt, indexed, ...r });
        }
  fs.writeFileSync(
    "work/refinement/assembly-report.json",
    JSON.stringify({ contract: ASSEMBLY, reports }, null, 2),
  );
});
test("G05-G06: assembled solid intersection and insertion, independent Manifold boundary vs collision field", async () => {
  const m = await Module();
  m.setup();
  const M = m.Manifold;
  for (const tilt of [0, 5] as const)
    for (const indexed of [false, true]) {
      const spec = { ...defaultFixture, tilt, indexed },
        fixture = fixtureSolid(m, spec);
      assert.equal(fixture.status(), "NoError");
      assert.equal(fixture.decompose().length, 1);
      const bottom = M.cylinder(0.65, 0.65, 1.2, 96).translate([0, 0, -0.65]);
      const cone = M.cylinder(11, 1.2, 5.1, 96),
        body = M.cylinder(22.1, 5.1, 5.1, 96).translate([0, 0, 11]);
      const tube = M.union([bottom, cone, body]);
      for (const insert of [0, 0.2, 1, 4, 10, 20, 36])
        for (const x of [-0.28, 0, 0.28]) {
          const assembly = tube.translate([x, 0, insert]).rotate([0, tilt, 0]);
          const intersection = fixture.intersect(assembly);
          assert.ok(
            intersection.volume() < 1e-6,
            `${tilt}/${indexed}/${insert}: ${intersection.volume()}`,
          );
          intersection.delete();
          assembly.delete();
        }
      const mesh = fixture.getMesh();
      let maxError = 0;
      for (let i = 0; i < mesh.triVerts.length; i += 3) {
        const center = [0, 0, 0];
        for (let j = 0; j < 3; j++)
          for (let k = 0; k < 3; k++)
            center[k] +=
              mesh.vertProperties[mesh.triVerts[i + j] * mesh.numProp + k] / 3;
        maxError = Math.max(
          maxError,
          Math.abs(fixtureDistance(center as [number, number, number], spec)),
        );
      }
      assert.ok(
        maxError < 0.006,
        `faceted surface field difference ${maxError}`,
      );
      tube.delete();
      bottom.delete();
      cone.delete();
      body.delete();
      fixture.delete();
    }
});
test("P02: a stroke that starts immersed is rejected when its endpoint leaves immersion", () => {
  const s = scenario("known"),
    p = policy("progress"),
    b = initialBelief(s);
  const i = policyInput(
    s,
    p,
    b,
    [0, -1.5, 42],
    0,
    [
      {
        id: "assumed",
        kind: "research-assumption",
        capturedAtS: 0,
        availableAtS: 0,
        correlationGroup: "model",
      },
    ],
    ["side"],
  );
  const c = bestCandidate(evaluateCandidates(i));
  assert.ok(c);
  assert.ok(liquidHeight(b.volume[0], 0, c.target) > c.target[2] + 1.85);
  const immersion = c.checks.find((c) => c.id === "immersion-through-stroke")!;
  assert.ok(immersion.value! >= immersion.threshold!);
  assert.ok(
    liquidHeight(
      b.volume[0] - c.requestedVolumeUl * (1 + 3 * s.pumpSigma) - 50,
      0,
      c.target,
    ) <
      c.target[2] + 1.85,
    "an extra 50µL would fail the complete stroke",
  );
});
test("O01/O02/D01: whitelisted planner has no truth capability; receipts precede actual actions", () => {
  const s = scenario("known"),
    p = policy("progress"),
    b = initialBelief(s),
    e = [
      {
        id: "a",
        kind: "research-assumption" as const,
        capturedAtS: 0,
        availableAtS: 0,
        correlationGroup: "a",
      },
    ];
  const clean = policyInput(s, p, b, [0, -1.5, 42], 0, e, ["side"]);
  const polluted = policyInput(
    { ...s, hiddenPellet: 99, finalResidual: 0 } as typeof s,
    p,
    b,
    [0, -1.5, 42],
    0,
    e,
    ["side"],
  );
  assert.deepEqual(polluted, clean);
  assert.deepEqual(evaluateCandidates(clean), evaluateCandidates(polluted));
  for (const ev of run.events) {
    const r = ev.receipt!;
    assert.equal(r.decisionAtS, ev.t);
    assert.deepEqual(r.action, ev.action);
    assert.doesNotThrow(() => auditReceipt(r));
    assert.ok(!r.evidence.some((e) => e.kind === "evaluation-truth"));
  }
  const first = run.events[0].receipt!;
  assert.ok(!first.evidence.some((e) => e.kind === "synthetic-observation"));
  const bad = structuredClone(run.events[1].receipt!);
  bad.evidence[0].availableAtS = bad.decisionAtS + 1;
  assert.throws(() => auditReceipt(bad), /future/);
  bad.evidence[0].availableAtS = 0;
  bad.evidence[0].kind = "evaluation-truth";
  assert.throws(() => auditReceipt(bad), /truth/);
});
test("D02: missing required check never becomes a passing receipt", () => {
  const bad = structuredClone(
    run.events.find((e) => e.action.kind === "aspirate")!.receipt!,
  );
  bad.checks = bad.checks.filter((c) => c.id !== "capacity");
  assert.throws(() => auditReceipt(bad), /required/);
});
test("D03/O04: unresolved history can allow distant progress and retains the bounded stop", () => {
  const t = runSimulation(scenario("missing"), policy("progress"));
  assert.ok(t.result.removed > 300);
  assert.equal(t.result.status, "stopped");
  assert.ok(!t.events.at(-1)!.receipt!.belief.pelletKnown);
  assert.ok(t.events.at(-1)!.receipt!.search.count <= 4);
  assert.match(t.result.reason, /No tested action/);
  assert.ok(t.result.remaining >= 100);
});
test("E03/E04: masking history holds exact world fixed; full reruns reproduce receipts", () => {
  const c = runComparison(scenario("known"), "history");
  assert.equal(
    canonical(c.arms[0].trace.initial),
    canonical(c.arms[1].trace.initial),
  );
  assert.ok(
    c.arms[0].trace.events[0].receipt!.evidence.some(
      (e) => e.kind === "history-record",
    ),
  );
  assert.ok(
    !c.arms[1].trace.events.some((e) =>
      e.receipt!.evidence.some((e) => e.kind === "history-record"),
    ),
  );
  assert.deepEqual(runSimulation(scenario("known"), policy("progress")), run);
  assert.throws(
    () => runComparison(scenario("missing"), "history"),
    /no orientation record/,
  );
  const rows = [pairRow(c)];
  assert.deepEqual(
    pairedAnalysis(rows, "residual"),
    pairedAnalysis(rows, "residual"),
  );
  assert.throws(
    () => pairedAnalysis([...rows, ...rows], "residual"),
    /Duplicate/,
  );
});
test("E05/E08: diagnostic stopping does not count as completion; study excludes development scenes", () => {
  const t = runSimulation(scenario("known"), policy("stop"));
  assert.equal(outcome(t), "stopped");
  assert.equal(t.result.removed, 0);
  for (const kind of ["history", "view", "policy"] as const)
    for (const a of assignments(kind))
      assert.ok(
        !STUDY_PLAN.developmentScenes.includes(`${a.family}-${a.seed}`),
      );
});
test("X01/X02: case integrity, exact pixels, bounded/unknown receipt fields and transaction validation", async () => {
  const saved = await casePacket(run, packets),
    copy = await readCaseOrTrace(JSON.parse(JSON.stringify(saved)));
  assert.deepEqual(copy.trace.events, run.events);
  assert.deepEqual(copy.packets, packets);
  const corrupt = structuredClone(saved);
  corrupt.payload.trace.result.remaining += 1;
  await assert.rejects(() => readCaseOrTrace(corrupt), /integrity/);
  const bad = traceFile(run, packets);
  (bad.events[0].receipt as unknown as Record<string, unknown>).injectedTruth =
    10;
  assert.throws(() => readTraceFile(bad), /Malformed/);
  delete (bad.events[0].receipt as unknown as Record<string, unknown>)
    .injectedTruth;
  const mismatched = structuredClone(traceFile(run, packets));
  mismatched.events[0].receipt!.decisionAtS += 0.1;
  assert.throws(() => readTraceFile(mismatched), /disagree/);
  const future = structuredClone(traceFile(run, packets));
  future.cameraPackets[0].t += 1;
  assert.throws(() => readTraceFile(future), /timing|evidence/i);
});

test("X03: paired packets restore both arms; nested malformed inputs reject before display", async () => {
  const comparison = runComparison(scenario("known"), "history");
  const packet = await casePacket(
    comparison.arms[0].trace,
    comparison.arms[0].packets,
    comparison,
  );
  const restored = await readCaseOrTrace(JSON.parse(JSON.stringify(packet)));
  assert.equal(restored.comparison?.arms.length, 2);
  assert.deepEqual(
    restored.comparison?.arms[1].trace.events,
    comparison.arms[1].trace.events,
  );
  const bad = traceFile(run, packets);
  (bad.events[0].receipt!.belief as unknown as Record<string, unknown>).volume =
    "invalid";
  assert.throws(() => readTraceFile(bad), /Malformed/);
});

test("G08: clearance covers a stationary holder across unknown seating offsets", () => {
  const s = scenario("known"),
    b = initialBelief(s);
  for (const p of b.particles) p.pose = [0.28, 0.28, 0];
  b.poseX = [0.28, 0.28];
  b.poseY = [0.28, 0.28];
  const tip: [number, number, number] = [0, -1.5, 42];
  const input = policyInput(
    s,
    policy("progress"),
    b,
    tip,
    0,
    [
      {
        id: "assumed",
        kind: "research-assumption",
        capturedAtS: 0,
        availableAtS: 0,
        correlationGroup: "model",
      },
    ],
    ["side"],
  );
  for (const c of evaluateCandidates(input))
    for (const angle of [0, Math.PI / 2, Math.PI, Math.PI * 1.5]) {
      const actual = sweptClearance(tip, c.target, {
        tilt: 0,
        pose: [0.28, 0.28, 0],
        fixturePose: [
          0.28 + 0.28 * Math.cos(angle),
          0.28 + 0.28 * Math.sin(angle),
          0,
        ],
        fixture: s.fixture,
      });
      assert.ok(
        c.checks.find((k) => k.id === "swept-hardware")!.value! <=
          actual + 1e-8,
      );
    }
});
