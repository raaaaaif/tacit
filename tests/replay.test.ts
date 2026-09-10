import test from "node:test";
import assert from "node:assert/strict";
import { scenario, policy } from "../src/model/scenarios";
import { runSimulation } from "../src/model/simulation";
import { playbackState, packetAt, motionFraction } from "../src/model/playback";
import { traceFile, readTraceFile } from "../src/model/traceFile";
import { D, moveTime } from "../src/model/geometry";
import type { ObservationPacket } from "../src/model/types";
const packets: ObservationPacket[] = [];
const trace = runSimulation(scenario("known"), policy("belief"), {
  onObservation: (p) => packets.push(p),
});

test("every animation frame preserves mass and respects the stage speed limit", () => {
  let previous = playbackState(trace, 0);
  for (let t = 1 / 60; t <= trace.result.seconds; t += 1 / 60) {
    const frame = playbackState(trace, t);
    assert.ok(
      Math.abs(frame.volume + frame.aspirated - trace.initial.volume) < 1e-7,
    );
    const distance = Math.hypot(
      ...frame.tip.map((v, i) => v - previous.tip[i]),
    );
    assert.ok(
      distance * 60 <= D.stage.maxVelocity + 0.02,
      `discontinuous motion at ${t}: ${distance * 60}`,
    );
    assert.ok(frame.volume <= previous.volume + 1e-7);
    previous = frame;
  }
});
test("all action boundaries are continuous and settling does not remove more liquid", () => {
  for (const e of trace.events) {
    const before = playbackState(trace, Math.max(0, e.t - 1e-6)),
      after = playbackState(trace, e.t + 1e-6);
    assert.ok(Math.abs(before.volume - after.volume) < 0.001);
    assert.ok(
      Math.hypot(...before.tip.map((v, i) => v - after.tip[i])) < 0.001,
    );
    if (e.action.kind === "aspirate") {
      const stop = e.t + e.action.volume / e.action.rate;
      assert.equal(
        playbackState(trace, stop + 0.01).volume,
        playbackState(trace, e.t + e.duration - 0.01).volume,
      );
    }
  }
});
test("camera evidence is absent before its acquisition timestamp", () => {
  assert.equal(packetAt(packets, "side", 0.699), undefined);
  assert.equal(packetAt(packets, "side", 0.7)?.t, 0.7);
  const overhead = packets.find((p) => p.calibration.view === "overhead");
  if (overhead)
    assert.equal(
      packetAt(packets, "overhead", overhead.t - 0.001)?.id,
      undefined,
    );
});
test("saved traces restore the exact camera pixels and full physical configuration", () => {
  const file = JSON.parse(JSON.stringify(traceFile(trace, packets)));
  const restored = readTraceFile(file);
  assert.deepEqual(restored.packets, packets);
  assert.deepEqual(restored.trace.scenario, trace.scenario);
  assert.equal(restored.trace.provenance.kind, "recorded");
  file.cameraPackets[0].pixels[0] = "invalid";
  assert.throws(() => readTraceFile(file));
});
test("short and long moves obey triangular and trapezoidal acceleration profiles", () => {
  for (const d of [0.1, 2, 30]) {
    const from: [number, number, number] = [0, 0, 0],
      to: [number, number, number] = [0, 0, d],
      total = moveTime(from, to),
      dt = 1e-4;
    assert.equal(motionFraction(from, to, -1), 0);
    assert.equal(motionFraction(from, to, total + 1), 1);
    assert.ok(Math.abs(motionFraction(from, to, total / 2) - 0.5) < 1e-10);
    const acceleration = (2 * motionFraction(from, to, dt) * d) / dt ** 2;
    assert.ok(Math.abs(acceleration - D.stage.acceleration) < 0.001);
  }
});
