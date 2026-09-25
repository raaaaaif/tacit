import { useState } from "react";
import { ArrowDownToLine, ArrowUpRight } from "lucide-react";
import { CONTROLLERS } from "../model/scenarios";
import type {
  ExperimentReport,
  PolicySpec,
  ScenarioId,
  Tilt,
} from "../model/types";
export function EvidenceReport({
  report,
  onExport,
  onApply,
  disabled = false,
}: {
  report: ExperimentReport | null;
  onExport: () => void;
  onApply: (c: { policy: PolicySpec; tilt: Tilt }) => void;
  disabled?: boolean;
}) {
  const [optimized, setOptimized] = useState(false);
  const [family, setFamily] = useState<"all" | ScenarioId>("all");
  const rows =
    family !== "all" && report?.byScenario
      ? report.byScenario.flatMap((r) => {
          const outcome = r.outcomes.find((s) => s.scenario === family);
          return outcome
            ? [optimized ? outcome.optimized : outcome.baseline]
            : [];
        })
      : optimized && report?.optimizedSummaries
        ? report.optimizedSummaries
        : report?.summaries;
  return (
    <section className="benchmark evidence-report">
      <div className="evidence-heading">
        <div>
          <div className="eyebrow">HISTORICAL EVIDENCE · TACIT 0.3</div>
          <h2>Keep the original findings.</h2>
          <p>
            The original 512-scene evaluation predates the assembly repair.
            These saved results are retained under their original model; they do
            not describe the current controller.
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
          <div className="evidence-scope">
            <label htmlFor="evidence-family">Scene family</label>
            <select
              id="evidence-family"
              value={family}
              onChange={(e) => setFamily(e.target.value as typeof family)}
            >
              <option value="all">All scenarios</option>
              <option value="known">Known setup</option>
              <option value="shifted">Changed setup</option>
              <option value="missing">Missing context</option>
            </select>
            <span>
              Means include every run, including stops. Target: ≤162 µL with no
              recorded violation.
            </span>
          </div>
          <div className="evidence-scroll">
            <table className="evidence-table">
              <thead>
                <tr>
                  <th>Controller</th>
                  <th>Wash remaining</th>
                  <th>Duration</th>
                  <th>Any violation</th>
                  <th>Completed / stopped</th>
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
                          {s.remainingCI.map((x) => x.toFixed(1)).join("–")} µL
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
                      {!!s.missedTargets && (
                        <small>
                          {s.missedTargets} declared done but missed the target
                        </small>
                      )}
                      <small>
                        {Math.round(s.violationRate * s.n)} halted with a
                        violation
                      </small>
                    </td>
                    {optimized && (
                      <td>
                        <button
                          className="text-button"
                          disabled={disabled}
                          onClick={() => {
                            const p = report.policies?.find(
                              (p) => p.policy.controller === s.controller,
                            );
                            if (p) onApply(p);
                          }}
                        >
                          Historical configuration <ArrowUpRight size={13} />
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
              Aspiration exposure is unavailable in this aggregate view. Small
              figures are 95% confidence intervals: bootstrap for means, Wilson
              for violations. A zero observed failure count is not a zero-risk
              claim. {report.stress.n.toLocaleString()} separate geometric
              stress cases; {report.stress.rejected.toLocaleString()} paths
              rejected.
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
          <span className="mono">EVIDENCE NOT LOADED</span>
          <p>
            The versioned comparison loads from this site's saved results.
            Reload the page to retry if your connection was interrupted.
          </p>
        </div>
      )}
    </section>
  );
}
