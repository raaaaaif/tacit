import type { ObservationPacket, RunTrace } from "./types";
import { ASSESSMENT_VERSION, targetMet } from "./assessment";
import { validateTrace } from "./validation";

export function traceFile(trace: RunTrace, packets: ObservationPacket[]) {
  return {
    ...trace,
    assessment: {
      version: ASSESSMENT_VERSION,
      targetMet: targetMet(trace.result, trace.policy),
      declaredComplete: trace.result.status === "completed",
      complete:
        trace.result.status === "completed" &&
        targetMet(trace.result, trace.policy),
    },
    cameraPackets: packets.map((p) => ({
      ...p,
      pixels: Array.from(p.pixels),
      valid: Array.from(p.valid),
    })),
  };
}
export function readTraceFile(value: unknown) {
  if (!value || typeof value !== "object" || Array.isArray(value))
    throw Error("Choose a TACIT trace JSON file.");
  const { cameraPackets: omitted, ...traceFields } = value as Record<
    string,
    unknown
  >;
  const trace = validateTrace(traceFields);
  const raw = (value as { cameraPackets?: unknown }).cameraPackets;
  const packets: ObservationPacket[] = [];
  if (raw !== undefined) {
    if (!Array.isArray(raw) || raw.length > 64)
      throw Error("Unsupported camera packet collection.");
    for (const item of raw) {
      const p = item as ObservationPacket;
      const c = p?.calibration;
      const numericVector = (v: unknown) =>
        Array.isArray(v) &&
        v.length === 3 &&
        v.every(
          (x) =>
            typeof x === "number" && Number.isFinite(x) && Math.abs(x) < 10000,
        );
      if (
        p.version !== 1 ||
        !c ||
        !["side", "overhead"].includes(c.view) ||
        c.width !== 112 ||
        c.height !== 144 ||
        ![c.center, c.origin, c.direction, c.right, c.up].every(
          numericVector,
        ) ||
        !Number.isFinite(c.mmPerPixel) ||
        c.mmPerPixel <= 0 ||
        typeof p.id !== "string" ||
        typeof p.exposureGroup !== "string" ||
        !Number.isFinite(p.t) ||
        p.t < 0 ||
        p.t > trace.result.seconds ||
        !Array.isArray(p.pixels) ||
        p.pixels.length !== c.width * c.height * 4 ||
        !p.pixels.every((x) => Number.isInteger(x) && x >= 0 && x <= 255) ||
        !Array.isArray(p.valid) ||
        p.valid.length !== c.width * c.height ||
        !p.valid.every((x) => x === 0 || x === 1)
      )
        throw Error("Invalid camera evidence in trace.");
      packets.push({
        ...p,
        pixels: new Uint8ClampedArray(p.pixels),
        valid: new Uint8Array(p.valid),
      });
    }
  }
  if (trace.manifest) {
    const ids = new Set(packets.map((p) => p.id));
    if (ids.size !== packets.length) throw Error("Duplicate camera evidence.");
    for (const event of trace.events)
      for (const ref of event.receipt?.evidence ?? [])
        if (ref.kind === "synthetic-observation") {
          const packet = packets.find((p) => p.id === ref.id);
          if (
            !packet ||
            Math.abs(packet.t - ref.availableAtS) > 1e-8 ||
            packet.exposureGroup !== ref.correlationGroup
          )
            throw Error(
              "Receipt camera evidence timing or correlation mismatch.",
            );
        }
  }
  return { trace, packets };
}
