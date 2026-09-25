/** Bound and scope imported data before hashing or handing it to the historical
 * readers. This does not turn a local packet into an authenticity signature. */
export function validateImportShape(value: unknown) {
  let nodes = 0;
  const scan = (v: unknown, depth: number) => {
    if (++nodes > 8_000_000 || depth > 24)
      throw Error("Imported evidence is too large or deeply nested.");
    if (v && typeof v === "object")
      for (const child of Object.values(v)) scan(child, depth + 1);
  };
  scan(value, 0);
  const object = (v: unknown, keys: string[], label: string) => {
    if (
      !v ||
      typeof v !== "object" ||
      Array.isArray(v) ||
      Object.keys(v).some((key) => !keys.includes(key))
    )
      throw Error(`Unsupported imported ${label} fields.`);
    return v as Record<string, unknown>;
  };
  const action = (v: unknown) => {
    const kind = (v as { kind?: unknown } | null)?.kind;
    object(
      v,
      kind === "move"
        ? ["kind", "to"]
        : kind === "aspirate"
          ? ["kind", "volume", "rate"]
          : kind === "observe"
            ? ["kind", "view"]
            : ["kind", "reason"],
      "action",
    );
  };
  const fixture = (v: unknown) =>
    object(
      v,
      ["version", "tilt", "indexed", "window", "seatingSigma", "clearance"],
      "fixture",
    );
  const trace = (v: unknown) => {
    const t = object(
      v,
      [
        "version",
        "modelVersion",
        "id",
        "scenario",
        "policy",
        "initial",
        "events",
        "result",
        "provenance",
        "manifest",
        "intervention",
        "assessment",
        "cameraPackets",
      ],
      "trace",
    );
    if (
      ["tacit-0.2.0", "tacit-0.3.0"].includes(String(t.modelVersion)) &&
      (t.manifest !== undefined ||
        (Array.isArray(t.events) &&
          t.events.some((e) => e?.receipt !== undefined)))
    )
      throw Error(
        "Historical traces cannot carry current manifests or decision receipts.",
      );
    const scenario = object(
      t.scenario,
      [
        "version",
        "id",
        "seed",
        "volume",
        "fixture",
        "historyKnown",
        "contrast",
        "poseSigma",
        "pumpSigma",
        "cameraBias",
      ],
      "scenario",
    );
    fixture(scenario.fixture);
    object(
      t.policy,
      [
        "version",
        "controller",
        "chunk",
        "margin",
        "surfaceDepth",
        "observeEvery",
        "residualTarget",
      ],
      "policy",
    );
    const initial = object(
      t.initial,
      [
        "fixturePose",
        "volume",
        "initialVolume",
        "pose",
        "tilt",
        "pelletAngle",
        "pelletZ",
        "pelletRadius",
        "contrast",
        "fixture",
      ],
      "initial state",
    );
    fixture(initial.fixture);
    object(
      t.result,
      [
        "remaining",
        "removed",
        "seconds",
        "violations",
        "status",
        "reason",
        "minClearance",
        "observations",
      ],
      "outcome",
    );
    object(
      t.provenance,
      ["kind", "source", "seed", "referenceStatus"],
      "provenance",
    );
    if (t.intervention !== undefined)
      object(t.intervention, ["history", "views"], "evidence access");
    if (t.assessment !== undefined)
      object(
        t.assessment,
        ["version", "targetMet", "declaredComplete", "complete"],
        "assessment",
      );
    if (!Array.isArray(t.events))
      throw Error("Invalid imported event collection.");
    for (const item of t.events) {
      const event = object(
        item,
        [
          "receipt",
          "index",
          "t",
          "duration",
          "action",
          "tip",
          "volume",
          "aspirated",
          "belief",
          "reason",
          "clearance",
          "violations",
          "observation",
        ],
        "event",
      );
      action(event.action);
      object(
        event.belief,
        ["volume", "poseX", "pelletKnown", "effectiveN"],
        "event belief",
      );
      if (event.receipt) action((event.receipt as { action?: unknown }).action);
      if (event.observation !== undefined) {
        const observation = object(
          event.observation,
          ["view", "features", "packetId"],
          "observation",
        );
        object(
          observation.features,
          [
            "level",
            "levelSigma",
            "tubeX",
            "tubeXSigma",
            "tubeY",
            "pelletAngle",
            "pelletSigma",
            "visiblePixels",
            "quality",
          ],
          "image features",
        );
      }
    }
    if (t.cameraPackets !== undefined) {
      if (!Array.isArray(t.cameraPackets))
        throw Error("Invalid camera packet collection.");
      for (const item of t.cameraPackets) {
        const packet = object(
          item,
          [
            "version",
            "id",
            "t",
            "calibration",
            "pixels",
            "valid",
            "exposureGroup",
          ],
          "camera packet",
        );
        object(
          packet.calibration,
          [
            "view",
            "width",
            "height",
            "mmPerPixel",
            "center",
            "origin",
            "direction",
            "right",
            "up",
          ],
          "camera calibration",
        );
      }
    }
  };
  if ((value as { schema?: unknown } | null)?.schema === "tacit-case/1") {
    const envelope = object(
      value,
      ["schema", "manifest", "integrity", "payload"],
      "case envelope",
    );
    object(envelope.integrity, ["algorithm", "payloadHash"], "case integrity");
    const payload = object(
      envelope.payload,
      ["trace", "comparison", "summary", "limitations"],
      "case payload",
    );
    trace(payload.trace);
    if (payload.comparison !== null && payload.comparison !== undefined) {
      const comparison = object(
        payload.comparison,
        [
          "schema",
          "id",
          "kind",
          "mode",
          "manifest",
          "sceneId",
          "sharedLatentInputs",
          "interventionFields",
          "arms",
        ],
        "comparison",
      );
      if (!Array.isArray(comparison.arms))
        throw Error("Invalid comparison arms.");
      comparison.arms.forEach(trace);
    }
  } else trace(value);
}
