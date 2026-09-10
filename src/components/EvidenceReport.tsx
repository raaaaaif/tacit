import { useState } from "react";
import { ArrowDownToLine, ArrowUpRight } from "lucide-react";
import { CONTROLLERS } from "../model/scenarios";
import type { ExperimentReport, PolicySpec, Tilt } from "../model/types";
export function EvidenceReport({
  report,
  onExport,
  onApply,
}: {
  report: ExperimentReport | null;
  onExport: () => void;
  onApply: (c: { policy: PolicySpec; tilt: Tilt }) => void;
}) {
  const [optimized, setOptimized] = useState(false);
  const rows =
    optimized && report?.optimizedSummaries
      ? report.optimizedSummaries
      : report?.summaries;
  return (
    <section className="benchmark evidence-report">
      <div className="evidence-heading">
        <div>
          <div className="eyebrow">HELD-OUT EVIDENCE</div>
          <h2>Compare the tradeoffs.</h2>
          <p>
            Whole episodes, including conservative stops. These are synthetic
            engineering results.
          </p>
        </div>
        {report && (
          <div
            className="evidence-toggle"
            role="group"
            aria-label="Comparison policy set"
          >
            <button
              aria-pressed={!optimized}
              onClick={() => setOptimized(false)}
            >
              Baseline policies
            </button>
            <button aria-pressed={optimized} onClick={() => setOptimized(true)}>
              Tuned policies
            </button>
          </div>
        )}
      </div>
      {report && rows ? (
        <>
          <div className="evidence-scroll">
            <table className="evidence-table">
              <thead>
                <tr>
                  <th>Controller</th>
                  <th>Wash remaining</th>
                  <th>Duration</th>
                  <th>Any violation</th>
                  <th>Reached / stopped</th>
                  {optimized && <th>Configuration</th>}
                </tr>
              </thead>
              <tbody>
                {rows.map((s) => (
                  <tr key={s.controller}>
                    <th scope="row">
                      {CONTROLLERS.find((c) => c.id === s.controller)?.short}
                      <small>{s.n} episodes</small>
                    </th>
                    <td>
                      <strong>{s.meanRemaining.toFixed(0)} µL</strong>
                      {s.remainingCI && (
                        <small>
                          {s.remainingCI.map((x) => x.toFixed(0)).join("–")} µL
                        </small>
                      )}
                    </td>
                    <td>
                      {s.meanSeconds.toFixed(1)} s
                      {s.secondsCI && (
                        <small>
                          {s.secondsCI.map((x) => x.toFixed(1)).join("–")} s
                        </small>
                      )}
                    </td>
                    <td>
                      {(s.violationRate * 100).toFixed(1)}%
                      <small>
                        {s.violationCI
                          .map((x) => (x * 100).toFixed(1))
                          .join("–")}
                        %
                      </small>
                    </td>
                    <td>
                      {s.completed} / {s.stopped}
                      <small>
                        {s.n - s.completed - s.stopped} halted with a violation
                      </small>
                    </td>
                    {optimized && (
                      <td>
                        <button
                          className="text-button"
                          onClick={() => {
                            const p = report.policies?.find(
                              (p) => p.policy.controller === s.controller,
                            );
                            if (p) onApply(p);
                          }}
                        >
                          Use in workbench <ArrowUpRight size={13} />
                        </button>
                      </td>
                    )}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <div className="evidence-footnote">
            <p>
              Small figures are 95% confidence intervals: bootstrap for means,
              Wilson for violations. A zero observed failure count is not a
              zero-risk claim. {report.stress.n.toLocaleString()} separate
              geometric stress cases; {report.stress.rejected.toLocaleString()}{" "}
              paths rejected.
            </p>
            <button className="text-button" onClick={onExport}>
              Export full report <ArrowDownToLine size={14} />
            </button>
          </div>
          <p className="evidence-method">
            {optimized
              ? "Three search seeds per controller, equal budgets, selection on separate tuning cases. Evaluation cases were withheld from both stages."
              : "Identical nominal parameters and paired physical scene seeds across controllers."}
          </p>
        </>
      ) : (
        <div className="benchmark-pending">
          <span className="mono">EVALUATION RUNNING</span>
          <p>
            The versioned comparison will appear when its held-out evaluation
            has finished.
          </p>
        </div>
      )}
    </section>
  );
}
