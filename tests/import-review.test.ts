import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import { runSimulation } from "../src/model/simulation";
import { scenario, policy } from "../src/model/scenarios";
import { traceFile } from "../src/model/traceFile";
import { casePacket } from "../src/model/casePacket";
import { runComparison, type Comparison } from "../src/model/comparison";
import { initialBelief } from "../src/model/belief";
import { worldFromScenario } from "../src/model/scenarios";
import { playbackState } from "../src/model/playback";
import { readImportedEvidence } from "../src/ui/evidenceImport";
import { createImportRequest } from "../src/ui/importRequest";
import { comparisonForScenario, replayQuantities } from "../src/ui/runContext";
import type { ObservationPacket } from "../src/model/types";

const packets: ObservationPacket[] = [];
const trace = runSimulation(scenario("known"), policy("progress"), {
  onObservation: (p) => packets.push(p),
});
const saved = traceFile(trace, packets);
const physicalIndex = trace.events.findIndex((e) => e.action.kind === "move");

test("External review F1: all eleven textual trace counterexamples reject at the actual UI import boundary", async () => {
  const probes: [string, (value: typeof saved) => void][] = [
    [
      "final result mass relabel",
      (t) => {
        t.result.remaining += 100;
        t.result.removed -= 100;
      },
    ],
    [
      "event index 999",
      (t) => {
        t.events[0].index = 999;
      },
    ],
    [
      "wrong receipt episode",
      (t) => {
        t.events[0].receipt!.episodeId = "another-episode";
      },
    ],
    [
      "numeric pass below threshold",
      (t) => {
        t.events[0].receipt!.checks[0].value = -1;
      },
    ],
    [
      "selected candidate differs from action",
      (t) => {
        const receipt = t.events[physicalIndex].receipt!;
        receipt.candidates.find(
          (candidate) => candidate.id === receipt.candidateId,
        )!.target[0] += 1;
      },
    ],
    [
      "incorrect prior tip",
      (t) => {
        t.events[physicalIndex].receipt!.from[0] += 1;
      },
    ],
    [
      "ordinary action relabeled unchecked",
      (t) => {
        t.events[physicalIndex].receipt!.disposition = "comparator-unchecked";
      },
    ],
    [
      "ordinary controller promoted privileged",
      (t) => {
        t.events[physicalIndex].receipt!.privileged = true;
      },
    ],
    [
      "unexpected nested action payload",
      (t) => {
        Object.assign(t.events[0].action, { payload: { truth: 1 } });
        Object.assign(t.events[0].receipt!.action, { payload: { truth: 1 } });
      },
    ],
    [
      "erased blockers",
      (t) => {
        t.events.at(-1)!.receipt!.blockers = [];
      },
    ],
    [
      "legacy model with current receipts",
      (t) => {
        t.modelVersion = "tacit-0.3.0";
        delete t.manifest;
      },
    ],
  ];
  await readImportedEvidence(structuredClone(saved));
  for (const [name, mutate] of probes) {
    const value = structuredClone(saved);
    mutate(value);
    await assert.rejects(() => readImportedEvidence(value), name);
  }
});

test("External review F2: both textual mislabeled-pair counterexamples reject with otherwise valid hashes", async () => {
  const original = runComparison(scenario("known"), "policy");
  const a = original.arms[0];
  await readImportedEvidence(await casePacket(a.trace, a.packets, original));
  const asHistory: Comparison = {
    ...original,
    kind: "history",
    interventionFields: ["history-access"],
  };
  await assert.rejects(
    () => casePacket(a.trace, a.packets, asHistory).then(readImportedEvidence),
    /evidence access|arm policies/,
  );
  const identical: Comparison = { ...original, arms: [a, a] };
  await assert.rejects(
    () => casePacket(a.trace, a.packets, identical).then(readImportedEvidence),
    /arm policies/,
  );
  const nondefault = structuredClone(original);
  for (const arm of nondefault.arms) arm.trace.policy.chunk = 80;
  await assert.rejects(
    () =>
      casePacket(
        nondefault.arms[0].trace,
        nondefault.arms[0].packets,
        nondefault,
      ).then(readImportedEvidence),
    /arm policies/,
  );
});

test("Import schema rejects missing/duplicate evidence, missing checks/manifest and deeply nested data", async () => {
  const missing = structuredClone(saved);
  missing.cameraPackets = [];
  await assert.rejects(() => readImportedEvidence(missing));
  const duplicated = structuredClone(saved);
  duplicated.cameraPackets.push(duplicated.cameraPackets[0]);
  await assert.rejects(() => readImportedEvidence(duplicated));
  const checks = structuredClone(saved);
  checks.events[physicalIndex].receipt!.checks = checks.events[
    physicalIndex
  ].receipt!.checks.filter((c) => c.id !== "capacity");
  await assert.rejects(() => readImportedEvidence(checks));
  const candidate = structuredClone(saved);
  candidate.events.at(-1)!.receipt!.candidates[0].checks.pop();
  await assert.rejects(
    () => readImportedEvidence(candidate),
    /required checks/,
  );
  const manifest = structuredClone(saved);
  delete manifest.manifest;
  await assert.rejects(() => readImportedEvidence(manifest));
  const incompatible = structuredClone(saved);
  Object.assign(incompatible.manifest!, { policy: "wrong-revision" });
  await assert.rejects(() => readImportedEvidence(incompatible));
  const deep = structuredClone(saved);
  let payload: unknown = null;
  for (let i = 0; i < 30; i++) payload = { nested: payload };
  Object.assign(deep.events[0].action, { payload });
  await assert.rejects(() => readImportedEvidence(deep), /deeply nested/);
  const movedLiquid = structuredClone(saved);
  movedLiquid.events[physicalIndex].volume -= 1;
  movedLiquid.events[physicalIndex].aspirated += 1;
  await assert.rejects(
    () => readImportedEvidence(movedLiquid),
    /liquid transfer/,
  );
});

function deferredFile() {
  let resolve!: (text: string) => void;
  const text = new Promise<string>((r) => {
    resolve = r;
  });
  return { file: { size: 1000, text: () => text }, resolve };
}

test("Rapid imports commit only the latest file; obsolete successes/errors and edited-context reads stay inert", async () => {
  const request = createImportRequest();
  const a = deferredFile(),
    b = deferredFile();
  const committed: string[] = [],
    errors: string[] = [];
  const commit = (bundle: Awaited<ReturnType<typeof readImportedEvidence>>) =>
    committed.push(bundle.trace.id);
  const first = request.load(a.file, commit, (message) => errors.push(message));
  const second = request.load(b.file, commit, (message) =>
    errors.push(message),
  );
  const legacy = fs.readFileSync("public/data/demo-shifted.json", "utf8");
  b.resolve(legacy);
  assert.equal(await second, true);
  a.resolve(JSON.stringify(saved));
  assert.equal(await first, false);
  assert.deepEqual(committed, [JSON.parse(legacy).id]);
  assert.equal(errors.length, 0);
  const staleFailure = deferredFile(),
    newer = deferredFile();
  const old = request.load(staleFailure.file, commit, (message) =>
    errors.push(message),
  );
  const last = request.load(newer.file, commit, (message) =>
    errors.push(message),
  );
  newer.resolve(JSON.stringify(saved));
  assert.equal(await last, true);
  staleFailure.resolve('{"truncated":');
  assert.equal(await old, false);
  assert.equal(errors.length, 0);
  const edited = deferredFile();
  const canceled = request.load(edited.file, commit, (message) =>
    errors.push(message),
  );
  request.invalidate();
  edited.resolve(legacy);
  assert.equal(await canceled, false);
  assert.equal(committed.length, 2);
  await request.load(
    { size: 20, text: async () => '{"truncated":' },
    commit,
    (message) => errors.push(message),
  );
  assert.equal(errors.length, 1);
  assert.equal(committed.length, 2);
});

test("Recorded readouts use saved mass, and prepared configuration edits invalidate paired context", async () => {
  const legacy = await readImportedEvidence(
    JSON.parse(fs.readFileSync("public/data/demo-known.json", "utf8")),
  );
  const playback = playbackState(legacy.trace, legacy.trace.result.seconds);
  const unrelatedPrepared = worldFromScenario(scenario("known", 77));
  unrelatedPrepared.volume = 999;
  assert.deepEqual(
    replayQuantities(legacy.trace, playback, unrelatedPrepared),
    {
      initial: legacy.trace.initial.volume,
      remaining: legacy.trace.result.remaining,
      removed: legacy.trace.result.removed,
    },
  );
  const pair: Comparison = {
    schema: "tacit-comparison/1",
    id: "view-known-1847",
    kind: "view",
    mode: "full-rerun",
    manifest: trace.manifest!,
    sceneId: "known-1847",
    sharedLatentInputs: "",
    interventionFields: ["available-views"],
    arms: [
      { trace, packets },
      { trace, packets },
    ],
  };
  assert.equal(
    comparisonForScenario(pair, trace.scenario),
    pair,
    "inspecting either matching arm preserves its paired context",
  );
  assert.equal(comparisonForScenario(pair, scenario("shifted")), null);
  assert.equal(
    comparisonForScenario(pair, {
      ...trace.scenario,
      fixture: { ...trace.scenario.fixture, tilt: 5 },
    }),
    null,
  );
  assert.equal(comparisonForScenario(pair, scenario("known", 77)), null);
});
