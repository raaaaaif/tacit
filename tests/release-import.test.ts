import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import { scenario, policy, CONTROLLERS } from "../src/model/scenarios";
import { runSimulation } from "../src/model/simulation";
import { traceFile } from "../src/model/traceFile";
import { casePacket } from "../src/model/casePacket";
import { canonical, MANIFEST } from "../src/model/evidence";
import { initialBelief } from "../src/model/belief";
import { playbackState } from "../src/model/playback";
import {
  runComparison,
  type Arm,
  type Comparison,
} from "../src/model/comparison";
import type { ObservationPacket, RunTrace } from "../src/model/types";
import { readImportedEvidence } from "../src/ui/evidenceImport";
import { visibleReplayBelief } from "../src/ui/replayEvidence";

const stopped = runSimulation(scenario("known"), policy("stop"));
function shortArm(history: "available" | "withheld"): Arm {
  const packets: ObservationPacket[] = [];
  const trace = runSimulation(scenario("known"), policy("progress"), {
    history,
    maxActions: 0,
    onObservation: (p) => packets.push(p),
  });
  return { trace, packets };
}

test("Release import accepts current and historical evidence; rejects contradictory outcomes and event indices", async () => {
  await readImportedEvidence(traceFile(stopped, []));
  for (const family of ["known", "shifted", "missing"])
    await readImportedEvidence(
      JSON.parse(fs.readFileSync(`public/data/demo-${family}.json`, "utf8")),
    );
  const index = structuredClone(traceFile(stopped, []));
  index.events[0].index = 999;
  await assert.rejects(() => readImportedEvidence(index), /indices/);
  const volume = structuredClone(traceFile(stopped, []));
  volume.result.remaining = 100;
  volume.result.removed = volume.initial.volume - 100;
  await assert.rejects(() => readImportedEvidence(volume), /final event/);
  const completion = structuredClone(traceFile(stopped, []));
  completion.result.status = "completed";
  await assert.rejects(
    () => readImportedEvidence(completion),
    /terminal decision/,
  );
});

test("Release import validates labeled interventions and camera acquisition against complete paired evidence", async () => {
  const a = shortArm("available"),
    b = shortArm("withheld");
  const c: Comparison = {
    schema: "tacit-comparison/1",
    id: "history-known-1847",
    kind: "history",
    mode: "full-rerun",
    manifest: MANIFEST,
    sceneId: "known-1847",
    sharedLatentInputs: canonical(a.trace.initial),
    interventionFields: ["history-access"],
    arms: [a, b],
  };
  await readImportedEvidence(await casePacket(a.trace, a.packets, c));
  const mislabeled = { ...c, arms: [a, a] as [Arm, Arm] };
  await assert.rejects(
    () => casePacket(a.trace, a.packets, mislabeled).then(readImportedEvidence),
    /evidence access/,
  );
  await assert.rejects(
    () => casePacket(stopped, [], c).then(readImportedEvidence),
    /not an arm/,
  );
  const acquisition = structuredClone(traceFile(b.trace, b.packets));
  acquisition.events[0].observation!.packetId = "different-capture";
  await assert.rejects(
    () => readImportedEvidence(acquisition),
    /camera evidence/,
  );
  const numeric = structuredClone(traceFile(b.trace, b.packets));
  numeric.events[0].receipt!.checks[0].value = 0;
  await assert.rejects(
    () => readImportedEvidence(numeric),
    /numeric check status/,
  );
});

test("Release import retains supported current controller traces without reevaluating outcomes", async () => {
  for (const controller of CONTROLLERS) {
    const packets: ObservationPacket[] = [];
    const trace = runSimulation(scenario("known"), policy(controller.id), {
      maxActions: 2,
      onObservation: (packet) => packets.push(packet),
    });
    const restored = await readImportedEvidence(traceFile(trace, packets));
    assert.deepEqual(restored.trace.result, trace.result, controller.id);
    assert.deepEqual(restored.trace.events, trace.events, controller.id);
  }
});

test("Policy comparisons retain preflight/readiness arms and reject identical controllers under different labels", async () => {
  const comparison = runComparison(scenario("known"), "policy");
  assert.deepEqual(
    comparison.arms.map((arm) => arm.trace.policy.controller),
    ["preflight", "progress"],
  );
  const [a, b] = comparison.arms;
  const imported = await readImportedEvidence(
    await casePacket(a.trace, a.packets, comparison),
  );
  assert.deepEqual(
    imported.comparison!.arms.map((arm) => arm.trace.result),
    comparison.arms.map((arm) => arm.trace.result),
  );
  for (const repeated of [a, b]) {
    const mislabeled: Comparison = {
      ...comparison,
      arms: [repeated, repeated],
    };
    // Recompute a valid transport hash: consistency rejection is distinct
    // from integrity checking and does not purport to authenticate an author.
    await assert.rejects(
      () =>
        casePacket(repeated.trace, repeated.packets, mislabeled).then(
          readImportedEvidence,
        ),
      /arm policies do not match/,
    );
  }
});

test("Worker reruns retain inspected history/view access and replay keeps the original pre-capture belief", async () => {
  const host = globalThis as unknown as { self?: unknown };
  const previous = host.self;
  const messages: {
    type: string;
    trace?: RunTrace;
    packets?: ObservationPacket[];
    message?: string;
  }[] = [];
  const worker = {
    onmessage: undefined as ((event: unknown) => void) | undefined,
    postMessage: (m: (typeof messages)[number]) => messages.push(m),
  };
  host.self = worker;
  try {
    await import("../src/workers/simulation.worker");
    worker.onmessage!({
      data: {
        type: "run",
        jobId: 1,
        scenario: scenario("known"),
        policy: policy("progress"),
        access: { history: "withheld", views: ["side"] },
      },
    });
    const done = messages.find((m) => m.type === "done");
    assert.ok(
      done?.trace,
      JSON.stringify(messages.filter((m) => m.type === "error")),
    );
    assert.deepEqual(done.trace.intervention, {
      history: "withheld",
      views: ["side"],
    });
    assert.ok(
      done.trace.events.every(
        (e) => !e.receipt!.evidence.some((r) => r.kind === "history-record"),
      ),
    );
    assert.ok(done.packets!.every((p) => p.calibration.view === "side"));
    const before = playbackState(done.trace, 0);
    assert.equal(
      initialBelief(done.trace.scenario).pelletKnown,
      true,
      "physical scenario retains its original history record",
    );
    assert.equal(
      visibleReplayBelief(before, initialBelief(done.trace.scenario))
        .pelletKnown,
      false,
    );
    assert.deepEqual(
      visibleReplayBelief(
        playbackState(done.trace, 0.7),
        initialBelief(done.trace.scenario),
      ),
      done.trace.events[0].belief,
    );
    await readImportedEvidence(traceFile(done.trace, done.packets!));
  } finally {
    if (previous === undefined) delete host.self;
    else host.self = previous;
  }
});
