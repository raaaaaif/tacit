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
  const r = event?.receipt,
    index = event?.index ?? 0;
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
                  )[r.reasonCode] ?? "No tested action passed.")
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
          <div className="receipt-checks">
            {(expanded
              ? r.checks
              : r.checks.filter(
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
                        : `${c.value.toFixed(2)} ${c.unit} · requires ${c.relation} ${c.threshold?.toFixed(2) ?? "—"}`}
                  </small>
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
            {r.checks.filter((c) => c.status === "pass").length} of{" "}
            {r.checks.length} recorded checks pass · under model assumptions
          </p>
          <button
            className="receipt-expand"
            aria-expanded={expanded}
            onClick={() => setExpanded(!expanded)}
          >
            {expanded ? "Hide" : "Inspect"} recorded inputs & alternatives{" "}
            <ChevronRight size={14} />
          </button>
          {expanded && (
            <div className="receipt-detail">
              <p>
                <b>At {r.decisionAtS.toFixed(2)} s</b> · {r.evidence.length}{" "}
                available sources · {r.search.count} tested candidates
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
