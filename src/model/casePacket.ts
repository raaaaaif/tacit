import type { RunTrace, ObservationPacket } from "./types";
import { traceFile, readTraceFile } from "./traceFile";
import { MANIFEST, canonical, sha256 } from "./evidence";
import { ASSEMBLY } from "./assembly";
import type { Comparison } from "./comparison";
export async function casePacket(
  trace: RunTrace,
  packets: ObservationPacket[],
  comparison?: Comparison | null,
) {
  const payload = {
    trace: traceFile(trace, packets),
    comparison: comparison
      ? {
          ...comparison,
          arms: comparison.arms.map((a) => traceFile(a.trace, a.packets)),
        }
      : null,
    summary: `${trace.id}: ${trace.result.status}; ${trace.result.remaining.toFixed(1)} µL retained, ${trace.result.removed.toFixed(1)} µL removed. ${trace.result.reason}`,
    limitations: [
      ...ASSEMBLY.limitations,
      "Synthetic observations and assumed uncertainty, not calibrated physical measurements. No RNA yield or safety claim.",
      "SHA-256 detects changes to this local packet; it is not an external authenticity signature.",
    ],
  };
  return {
    schema: "tacit-case/1",
    manifest: trace.manifest ?? null,
    integrity: { algorithm: "SHA-256", payloadHash: await sha256(payload) },
    payload,
  };
}
export async function readCaseOrTrace(value: unknown) {
  if (
    value &&
    typeof value === "object" &&
    "schema" in value &&
    (value as { schema: string }).schema === "tacit-case/1"
  ) {
    const p = value as Awaited<ReturnType<typeof casePacket>>;
    if (
      !p.payload ||
      p.integrity?.algorithm !== "SHA-256" ||
      p.integrity.payloadHash !== (await sha256(p.payload))
    )
      throw Error(
        "Case packet integrity check failed. Original evidence was modified.",
      );
    let comparison: Comparison | null = null;
    if (p.payload.comparison) {
      const c = p.payload.comparison;
      if (
        c.schema !== "tacit-comparison/1" ||
        !["history", "view", "policy"].includes(c.kind) ||
        c.mode !== "full-rerun" ||
        typeof c.id !== "string" ||
        typeof c.sceneId !== "string" ||
        !Array.isArray(c.arms) ||
        c.arms.length !== 2 ||
        canonical(c.manifest) !== canonical(MANIFEST)
      )
        throw Error("Invalid paired comparison.");
      const arms = c.arms.map((a) => readTraceFile(a)) as Comparison["arms"];
      if (
        canonical(arms[0].trace.initial) !== canonical(arms[1].trace.initial) ||
        canonical(arms[0].trace.initial) !== c.sharedLatentInputs
      )
        throw Error("Paired physical states disagree.");
      const fields =
        c.kind === "history"
          ? ["history-access"]
          : c.kind === "view"
            ? ["available-views"]
            : ["policy"];
      if (canonical(c.interventionFields) !== canonical(fields))
        throw Error("Paired intervention metadata disagrees.");
      comparison = { ...c, arms };
    }
    const bundle = readTraceFile(p.payload.trace);
    if (canonical(p.manifest) !== canonical(bundle.trace.manifest ?? null))
      throw Error("Case manifest disagrees with its trace.");
    return { ...bundle, comparison };
  }
  return { ...readTraceFile(value), comparison: null };
}
