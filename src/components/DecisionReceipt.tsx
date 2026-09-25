import { useState } from "react";
import { ChevronLeft, ChevronRight, ArrowRight, Download } from "lucide-react";
import type { TraceEvent, RunTrace } from "../model/types";
const names: Record<string, string> = {
  "assembly-fit": "Nominal assembly",
  "model-domain": "Model support",
  "swept-hardware": "Instrument clearance",
  "swept-pellet": "Pellet exclusion",
  "motion-limits": "Stage travel",
  "immersion-through-stroke": "Full-stroke immersion",
  capacity: "Tip capacity",
  "volume-budget": "Useful withdrawal",
  "optical-support": "Supported camera",
  "evidence-provenance": "Evidence timing",
  "orientation-history": "Orientation history",
};
export function DecisionReceipt({
  event,
  trace,
  onSelect,
  onCompare,
  onExport,
}: {
  event: TraceEvent | undefined;
  trace: RunTrace;
  onSelect: (t: number) => void;
  onCompare: () => void;
  onExport: () => void;
}) {
  const [expanded, setExpanded] = useState(false);
  const [inspected, setInspected] = useState({ receipt: "", candidate: "" });
  const r = event?.receipt,
    index = Math.max(
      0,
      trace.events.findIndex((e) => e === event),
    );
  const alternatives =
    event?.action.kind === "stop" ? (r?.candidates ?? []) : [];
  const candidate =
    alternatives.find(
      (c) => inspected.receipt === r?.id && c.id === inspected.candidate,
    ) ?? alternatives[0];
  // A stop receipt retains a union of checks from its search. Never present
  // that union as if a single physical action passed those checks.
  const checks = candidate?.checks ?? r?.checks ?? [];
  const passingCandidates = alternatives.filter(
    (c) =>
      c.checks.length > 0 && c.checks.every((check) => check.status === "pass"),
  ).length;
  const blocker =
    trace.events.find(
      (e) => e.receipt?.blockers.length || e.violations.length,
    ) || trace.events.at(-1)!;
  return (
    <section className="receipt-panel" aria-label="Decision receipt">
      <div className="decision-nav">
        <button
          aria-label="Previous decision"
          disabled={index === 0}
          onClick={() => onSelect(trace.events[index - 1].t)}
        >
          <ChevronLeft size={16} />
        </button>
        <span>
          DECISION {index + 1} / {trace.events.length}
        </span>
        <button
          aria-label="Next decision"
          disabled={index === trace.events.length - 1}
          onClick={() => onSelect(trace.events[index + 1].t)}
        >
          <ChevronRight size={16} />
        </button>
        <button className="first-blocker" onClick={() => onSelect(blocker.t)}>
          First blocker
        </button>
      </div>
      <div className="receipt-verdict">
        <span className="eyebrow">
          {r?.reasonCode.replaceAll("_", " ") ?? "LEGACY EVIDENCE"}
          {r?.privileged ? " · PRIVILEGED REFERENCE" : ""}
        </span>
        <h2>
          {!r
            ? "Original rationale not recorded."
            : r.disposition === "comparator-unchecked"
              ? "Unchecked comparator action."
              : event?.action.kind === "stop"
                ? ((
                    {
                      TARGET_DECLARED: "Target declared.",
                      MODEL_DOMAIN_UNSUPPORTED: "Outside the supported model.",
                      ASSEMBLY_UNVERIFIED: "Assembly not checked.",
                      RESOURCE_LIMIT: "Computation budget reached.",
                      EVALUATED_VIOLATION: "Modeled violation recorded.",
                      EVIDENCE_UNRESOLVED: "Evidence remains unresolved.",
                    } as Record<string, string>
                  )[r.reasonCode] ??
                  `Stopped at ${event.volume.toFixed(1)} µL.`)
                : event?.action.kind === "observe"
                  ? "Acquire decision evidence."
                  : event?.action.kind === "move"
                    ? "Commit the checked path."
                    : "Make bounded progress."}
        </h2>
        <p>
          {r?.reason ??
            "Decision rationale not recorded. This historical trace retains its original events and camera pixels."}
        </p>
        {r && (
          <span
            className={
              "receipt-state " + (r.blockers.length ? "unresolved" : "")
            }
          >
            {r.disposition === "checks-recorded-as-passing"
              ? "Checks recorded as passing"
              : r.disposition === "comparator-unchecked"
                ? "Unchecked comparator action"
                : r.reasonCode === "TARGET_DECLARED"
                  ? "Target declared · assess final outcome"
                  : "Stop recorded · not completion"}
          </span>
        )}
      </div>
      {r && (
        <>
          {alternatives.length > 0 && (
            <div className="candidate-overview">
              <p>
                <strong>
                  {passingCandidates === 0
                    ? `None of ${alternatives.length} tested withdrawals passed every check.`
                    : `${passingCandidates} of ${alternatives.length} alternatives passed every recorded check.`}
                </strong>
                <br />
                Pellet exclusion blocked{" "}
                {
                  alternatives.filter((c) =>
                    c.checks.some(
                      (k) => k.id === "swept-pellet" && k.status === "fail",
                    ),
                  ).length
                }
                /{alternatives.length}; hardware clearance blocked{" "}
                {
                  alternatives.filter((c) =>
                    c.checks.some(
                      (k) => k.id === "swept-hardware" && k.status === "fail",
                    ),
                  ).length
                }
                /{alternatives.length}.
              </p>
              <table className="candidate-matrix">
                <caption>Modeled clearance · mm</caption>
                <thead>
                  <tr>
                    <th scope="col">Alternative</th>
                    <th scope="col">Withdrawal</th>
                    <th scope="col">Hardware</th>
                    <th scope="col">Pellet</th>
                  </tr>
                </thead>
                <tbody>
                  {alternatives.map((c, i) => (
                    <tr key={c.id}>
                      <th scope="row">{i + 1}</th>
                      <td>{c.requestedVolumeUl.toFixed(1)} µL</td>
                      {["swept-hardware", "swept-pellet"].map((id) => {
                        const check = c.checks.find((k) => k.id === id);
                        return (
                          <td key={id} data-status={check?.status}>
                            {check?.value?.toFixed(3) ?? "Unknown"}
                            <br />
                            {check?.status === "pass"
                              ? "Pass"
                              : check?.status === "fail"
                                ? "Blocked"
                                : "Unknown"}
                          </td>
                        );
                      })}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
          {candidate && (
            <div className="candidate-selector">
              <label htmlFor="receipt-candidate">
                Inspect a searched alternative
              </label>
              <select
                id="receipt-candidate"
                value={candidate.id}
                onChange={(e) =>
                  setInspected({ receipt: r.id, candidate: e.target.value })
                }
              >
                {alternatives.map((c, i) => (
                  <option key={c.id} value={c.id}>
                    Alternative {i + 1} · {c.requestedVolumeUl.toFixed(1)} µL ·{" "}
                    {c.checks.filter((k) => k.status !== "pass").length}{" "}
                    unresolved checks
                  </option>
                ))}
              </select>
              <p>
                {passingCandidates} of {alternatives.length} alternatives passed
                every recorded check. Values below belong to alternative{" "}
                {alternatives.indexOf(candidate) + 1}; no action was selected at
                this stop.
              </p>
            </div>
          )}
          <div className="receipt-checks">
            {(expanded
              ? checks
              : checks.filter(
                  (c) =>
                    c.status !== "pass" ||
                    ["swept-pellet", "immersion-through-stroke"].includes(c.id),
                )
            ).map((c, i) => (
              <div className={"receipt-check " + c.status} key={c.id + i}>
                <span>
                  {names[c.id] ?? c.id}
                  <small>
                    {c.value === null
                      ? "Not resolved"
                      : c.unit === "boolean"
                        ? "Declared model check"
                        : `${c.value.toFixed(3)} ${c.unit} · requires ${c.relation} ${c.threshold?.toFixed(3) ?? "—"}`}
                  </small>
                  {c.value !== null &&
                    c.threshold !== null &&
                    c.unit !== "boolean" &&
                    ["≥", "≤", ">=", "<="].includes(c.relation) &&
                    c.threshold > 0 &&
                    (() => {
                      const lo = Math.min(0, c.value),
                        hi = Math.max(c.threshold * 1.3, c.value * 1.1);
                      const position = (v: number) =>
                        `${(100 * (v - lo)) / (hi - lo)}%`;
                      return (
                        <>
                          <div className="check-margin" aria-hidden="true">
                            <b style={{ left: position(c.threshold) }} />
                            <i style={{ left: position(c.value) }} />
                          </div>
                          <small className="check-margin-legend">
                            ● evaluated value · │ required bound
                          </small>
                        </>
                      );
                    })()}
                </span>
                <b>
                  {c.status === "pass"
                    ? "PASS"
                    : c.status === "fail"
                      ? "BLOCKED"
                      : "UNKNOWN"}
                </b>
              </div>
            ))}
          </div>
          <p className="check-count">
            {candidate
              ? `Alternative ${alternatives.indexOf(candidate) + 1}: ${checks.filter((c) => c.status === "pass").length} / ${checks.length} checks pass under model assumptions.`
              : event?.action.kind === "stop"
                ? "A recorded stop is not an authorization to act."
                : `${checks.filter((c) => c.status === "pass").length} / ${checks.length} checks recorded as passing for this action, under model assumptions.`}
          </p>
          <button
            className="receipt-expand"
            aria-expanded={expanded}
            onClick={() => setExpanded(!expanded)}
          >
            {expanded ? "Hide" : "Show"} observations and tested alternatives{" "}
            <ChevronRight size={14} />
          </button>
          {expanded && (
            <div className="receipt-detail">
              <p>
                <b>
                  {r.reasonCode} · At {r.decisionAtS.toFixed(2)} s
                </b>{" "}
                · {r.evidence.length} available sources · {r.search.count}{" "}
                tested candidates
              </p>
              <p>{r.uncertainty}</p>
              <h3>Evidence available at this decision</h3>
              {r.evidence.map((e) => (
                <div className="source-line" key={e.id}>
                  <b>{e.kind.replaceAll("-", " ")}</b>
                  <span>{e.id}</span>
                  <small>
                    Available {e.availableAtS.toFixed(2)} s ·{" "}
                    {e.correlationGroup}
                  </small>
                </div>
              ))}
              <h3>Actually evaluated alternatives</h3>
              {r.candidates.length ? (
                r.candidates.map((c) => (
                  <div className="candidate-line" key={c.id}>
                    <b>
                      {c.id} · {c.requestedVolumeUl.toFixed(1)} µL
                    </b>
                    <span>
                      {c.checks
                        .filter((k) => k.status !== "pass")
                        .map((k) => names[k.id] ?? k.id)
                        .join(", ") || "All recorded checks pass"}
                    </span>
                    <small>
                      Target [{c.target.map((v) => v.toFixed(2)).join(", ")}] mm
                    </small>
                  </div>
                ))
              ) : (
                <p>No physical candidate evaluated at this boundary.</p>
              )}
              {r.observationOptions.length > 0 && (
                <>
                  <h3>Predicted value of another view</h3>
                  {r.observationOptions.map((o) => (
                    <div className="candidate-line" key={o.view}>
                      <b>
                        {o.view} · {o.netValueUl.toFixed(1)} µL-equivalent net
                      </b>
                      <small>
                        {o.samples} hypothetical samples · {o.method}
                      </small>
                    </div>
                  ))}
                </>
              )}
              <p>{r.search.claim}</p>
              <details>
                <summary>Raw immutable receipt</summary>
                <pre>{JSON.stringify(r, null, 2)}</pre>
              </details>
            </div>
          )}
        </>
      )}
      <div className="receipt-actions">
        <button className="primary-button" onClick={onCompare}>
          Change one thing <ArrowRight size={15} />
        </button>
        <button className="secondary-button" onClick={onExport}>
          <Download size={15} />
          Evidence packet
        </button>
      </div>
    </section>
  );
}
