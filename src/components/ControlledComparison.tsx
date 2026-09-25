import { useEffect, useMemo, useState } from "react";
import {
  PairedVolumeFigure,
  PairedIntervalFigure,
  PairDifferenceFigure,
} from "./EvidenceFigures";
import { MANIFEST, canonical } from "../model/evidence";
import { policy } from "../model/scenarios";
import { ArrowRight, Download, Play, Square } from "lucide-react";
import {
  INTERVENTIONS,
  episode,
  summarize,
  pairedAnalysis,
  type Comparison,
  type Intervention,
  type Arm,
  type Campaign,
} from "../model/comparison";
const signed = (value: number, digits = 1) =>
  `${value > 0 ? "+" : value < 0 ? "−" : ""}${Math.abs(value).toFixed(digits)}`;
const familyNames: Record<string, string> = {
  all: "All assigned scenes",
  known: "Known setup",
  shifted: "Changed setup",
  missing: "Missing context",
};
export function ControlledComparison({
  historyKnown,
  comparison,
  busy,
  disabled,
  progress,
  onRun,
  onCancel,
  onInspect,
  onExport,
}: {
  historyKnown: boolean;
  comparison: Comparison | null;
  busy: boolean;
  disabled: boolean;
  progress: number;
  onRun: (kind: Intervention) => void;
  onCancel: () => void;
  onInspect: (a: Arm) => void;
  onExport: () => void;
}) {
  const [kind, setKind] = useState<Intervention>(
      historyKnown ? "history" : "policy",
    ),
    [campaign, setCampaign] = useState<Campaign | null>(null),
    [family, setFamily] = useState("all");
  useEffect(() => {
    if (comparison) setKind(comparison.kind);
  }, [comparison]);
  useEffect(() => {
    if (kind === "history" && family === "missing") setFamily("all");
  }, [kind, family]);
  useEffect(() => {
    if (!historyKnown && kind === "history") setKind("policy");
  }, [historyKnown, kind]);
  useEffect(() => {
    fetch("/data/readiness-study.json")
      .then((r) => (r.ok ? r.json() : null))
      .then((r) =>
        setCampaign(
          r && canonical(r.plan?.manifest) === canonical(MANIFEST) ? r : null,
        ),
      )
      .catch(() => {});
  }, []);
  const active = comparison?.kind === kind ? comparison : null;
  const pop = campaign?.comparisons.find((c) => c.kind === kind);
  const filtered = useMemo(
    () => pop?.rows.filter((r) => family === "all" || r.family === family),
    [pop, family],
  );
  const a = filtered?.length ? summarize(filtered.map((r) => r.a)) : null,
    b = filtered?.length ? summarize(filtered.map((r) => r.b)) : null;
  const paired = useMemo(
    () =>
      !filtered?.length
        ? []
        : family === "all"
          ? pop!.paired
          : (["residual", "seconds", "completion"] as const).map((metric) =>
              pairedAnalysis(filtered, metric),
            ),
    [filtered, family, pop],
  );
  const residualDifference = paired.find(
    (entry) => entry.metric === "residual",
  );
  const timeDifference = paired.find((entry) => entry.metric === "seconds");
  const completionDifference = paired.find(
    (entry) => entry.metric === "completion",
  );
  const defaultPolicy = policy("progress");
  return (
    <section
      className="controlled-comparison"
      aria-label="Controlled comparison"
    >
      <div className="comparison-heading">
        <div className="eyebrow">CONTROLLED SIMULATED INTERVENTION</div>
        <h2>
          {kind === "policy"
            ? "Compare controllers"
            : kind === "view"
              ? "Compare camera access"
              : "Compare history access"}
        </h2>
        <p>
          Change the available context, camera access or controller. Compare
          progress, retained liquid and the evidence behind each stop.
        </p>
      </div>
      <details className="comparison-protocol">
        <summary>Declared default comparison settings</summary>
        <p>
          These comparisons use the default policies shown here. The editable
          settings in Run apply to single runs.
        </p>
        <dl>
          <div>
            <dt>A</dt>
            <dd>
              {kind === "policy" ? "Fixed + preflight" : "Readiness controller"}{" "}
              · {INTERVENTIONS[kind].a}
            </dd>
          </div>
          <div>
            <dt>B</dt>
            <dd>Readiness controller · {INTERVENTIONS[kind].b}</dd>
          </div>
          <div>
            <dt>Shared policy values</dt>
            <dd>
              {defaultPolicy.chunk} µL stroke · {defaultPolicy.surfaceDepth} mm
              immersion · {defaultPolicy.margin} mm pellet margin ·{" "}
              {defaultPolicy.residualTarget} µL residual target
            </dd>
          </div>
          <div>
            <dt>Camera access</dt>
            <dd>
              {kind === "view"
                ? "A: side only · B: side + overhead"
                : "Both arms: side + overhead"}
            </dd>
          </div>
          <div>
            <dt>History access</dt>
            <dd>
              {kind === "history"
                ? "A: available · B: withheld"
                : "Both arms: available when the scene contains a handling record"}
            </dd>
          </div>
        </dl>
      </details>
      <div
        className="intervention-choices"
        role="group"
        aria-label="Intervention"
      >
        {(Object.keys(INTERVENTIONS) as Intervention[]).map((k) => (
          <button
            key={k}
            disabled={busy || disabled || (k === "history" && !historyKnown)}
            aria-pressed={kind === k}
            onClick={() => setKind(k)}
          >
            <span>
              {k === "history"
                ? "Context"
                : k === "view"
                  ? "Observation"
                  : "Policy"}
            </span>
            <small>{INTERVENTIONS[k].title}</small>
          </button>
        ))}
      </div>
      <div className="comparison-brief">
        <p>
          {INTERVENTIONS[kind].description}{" "}
          {kind !== "policy" && "Both arms use the readiness controller."} Both
          arms start from initialization; no future evidence is reused.
        </p>
        <button
          className="primary-button"
          disabled={disabled}
          onClick={busy ? onCancel : () => onRun(kind)}
        >
          {busy ? <Square size={15} /> : <Play size={15} />}{" "}
          {busy
            ? `Cancel comparison · ${Math.round(progress * 100)}%`
            : "Run paired comparison"}
        </button>
      </div>
      {!historyKnown && (
        <p className="fine-print">
          This scene has no handling record to withhold. Context experiments use
          a scene where that record exists.
        </p>
      )}
      {active && (
        <>
          <div className="pair-caption">
            <span className="eyebrow">
              ILLUSTRATIVE EPISODE · {active.sceneId}
            </span>
            <span>Physical state matched · full rerun</span>
          </div>
          <PairedVolumeFigure comparison={active} />
          <div className="pair-arms">
            {active.arms.map((arm, i) => {
              const e = episode(arm.trace);
              return (
                <article key={i} className="pair-arm">
                  <div className="eyebrow">
                    {i === 0 ? "A · BASELINE" : "B · INTERVENTION"}
                  </div>
                  <h3>
                    {i === 0 ? INTERVENTIONS[kind].a : INTERVENTIONS[kind].b}
                  </h3>
                  <div className="pair-outcome">
                    {e.outcome === "completed"
                      ? "Target attained"
                      : e.outcome === "violated"
                        ? "Violation recorded"
                        : e.outcome === "missed"
                          ? "Declared target missed"
                          : "Stopped with liquid retained"}
                  </div>
                  <dl>
                    <div>
                      <dt>Residual</dt>
                      <dd>{e.residual.toFixed(1)} µL</dd>
                    </div>
                    <div>
                      <dt>Elapsed time</dt>
                      <dd>{e.seconds.toFixed(1)} s</dd>
                    </div>
                    <div>
                      <dt>Observations</dt>
                      <dd>{e.observations}</dd>
                    </div>
                    <div>
                      <dt>Modeled violations</dt>
                      <dd>{e.violations.length}</dd>
                    </div>
                  </dl>
                  <p>{arm.trace.result.reason}</p>
                  <button
                    className="text-button"
                    onClick={() => onInspect(arm)}
                  >
                    Inspect this arm <ArrowRight size={14} />
                  </button>
                </article>
              );
            })}
          </div>
          <div className="pair-difference">
            <div className="example-difference-value">
              <strong>
                {signed(
                  active.arms[1].trace.result.removed -
                    active.arms[0].trace.result.removed,
                )}{" "}
                µL
              </strong>
              <span>removed · B − A</span>
            </div>
            <div className="example-difference-value">
              <strong>
                {signed(
                  active.arms[1].trace.result.seconds -
                    active.arms[0].trace.result.seconds,
                )}{" "}
                s
              </strong>
              <span>elapsed · B − A</span>
            </div>
            <span>
              One selected example.
              <br />
              Population results are below.
            </span>
            <button className="text-button" onClick={onExport}>
              Export paired evidence <Download size={15} />
            </button>
          </div>
        </>
      )}
      <section className="population-evidence">
        <div className="eyebrow">
          FROZEN EXPLORATORY EVALUATION · CURRENT MODEL
        </div>
        <h3>Results across the assigned scenes</h3>
        {pop &&
        a &&
        b &&
        filtered &&
        residualDifference &&
        timeDifference &&
        completionDifference ? (
          <>
            <div className="population-caption">
              <p>
                Showing {filtered.length} of {pop.assigned} assigned pairs ·{" "}
                {familyNames[family]} · {pop.administrativeFailures.length}{" "}
                administrative failures. Every stopped episode remains in the
                means.
              </p>
              <label>
                Scene family
                <select
                  value={family}
                  onChange={(e) => setFamily(e.target.value)}
                >
                  <option value="all">All assigned scenes</option>
                  <option value="known">Known setup</option>
                  <option value="shifted">Changed setup</option>
                  {kind !== "history" && (
                    <option value="missing">Missing context</option>
                  )}
                </select>
              </label>
            </div>
            <div
              className="population-tradeoff"
              aria-label="Progress, time and completion for the shown pairs"
            >
              <div>
                <span>Mean removed volume · B − A</span>
                <strong>{signed(b.removed - a.removed)} µL</strong>
                <small>
                  95% interval {signed(-residualDifference.ci[1])} to{" "}
                  {signed(-residualDifference.ci[0])} µL
                </small>
              </div>
              <div>
                <span>Mean elapsed time · B − A</span>
                <strong>{signed(timeDifference.estimate)} s</strong>
                <small>
                  95% interval {signed(timeDifference.ci[0])} to{" "}
                  {signed(timeDifference.ci[1])} s
                </small>
              </div>
              <div>
                <span>Target completion · B − A</span>
                <strong>
                  {signed(completionDifference.estimate * 100)} pp
                </strong>
                <small>
                  A: {a.completed}/{a.n} completed · B: {b.completed}/{b.n}{" "}
                  completed
                </small>
                <small>
                  95% interval {signed(completionDifference.ci[0] * 100)} to{" "}
                  {signed(completionDifference.ci[1] * 100)} pp
                  {completionDifference.ci[0] === completionDifference.ci[1]
                    ? " · degenerate in this sample; not proof of no possible effect"
                    : ""}
                </small>
              </div>
            </div>
            <p className="population-scope-note">
              {a.stopped}/{a.n} A episodes and {b.stopped}/{b.n} B episodes
              stopped. {a.violated}/{a.n} A episodes and {b.violated}/{b.n} B
              episodes recorded modeled violations. Intervals use matched
              resampling of the {filtered.length} shown pairs
              {family !== "all" ? ", recomputed for this family" : ""}. Matched
              initial volumes make the removed-volume interval the sign-reversed
              residual interval.
            </p>
            <PairDifferenceFigure
              kind={kind}
              rows={filtered}
              scaleRows={pop.rows}
            />
            <p className="table-scroll-hint">
              Scroll the table horizontally to inspect all outcome measures.
            </p>
            <div
              className="evidence-scroll"
              tabIndex={0}
              role="region"
              aria-label="Population outcomes table; scroll horizontally for all metrics"
            >
              <table className="evidence-table">
                <thead>
                  <tr>
                    <th>Arm</th>
                    <th>Complete / stop / violate / miss</th>
                    <th>Mean residual</th>
                    <th>Mean removed</th>
                    <th>Mean elapsed</th>
                    <th>Aspirated</th>
                    <th>Stops after progress</th>
                    <th>Mean observations</th>
                  </tr>
                </thead>
                <tbody>
                  {[a, b].map((r, i) => (
                    <tr key={i}>
                      <th>
                        {i === 0 ? "A" : "B"} ·{" "}
                        {i === 0
                          ? INTERVENTIONS[kind].a
                          : INTERVENTIONS[kind].b}
                        <small>{r.n} episodes</small>
                      </th>
                      <td>
                        {r.completed} / {r.stopped} / {r.violated} / {r.missed}
                        <div className="outcome-bar">
                          {(
                            [
                              "completed",
                              "stopped",
                              "violated",
                              "missed",
                            ] as const
                          ).map((k) => (
                            <i
                              key={k}
                              className={k}
                              style={{ width: (r[k] / r.n) * 100 + "%" }}
                            />
                          ))}
                        </div>
                      </td>
                      <td>{r.residual.toFixed(1)} µL</td>
                      <td>{r.removed.toFixed(1)} µL</td>
                      <td>{r.seconds.toFixed(1)} s</td>
                      <td>
                        {r.exposed} / {r.n}
                      </td>
                      <td>
                        {r.stoppedAfterProgress} / {r.stopped}
                      </td>
                      <td>{r.observations.toFixed(1)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            <p className="fine-print">
              {a.violated === 0 || b.violated === 0 ? (
                <>
                  Zero modeled violations were observed in{" "}
                  {a.violated === 0 && b.violated === 0
                    ? "each arm"
                    : a.violated === 0
                      ? "arm A"
                      : "arm B"}
                  . Conditional on independent scene trials and this model, the
                  one-sided 95% binomial upper bound is{" "}
                  {(100 * -Math.expm1(Math.log(0.05) / a.n)).toFixed(1)}% per
                  zero-event arm ({a.n} trials).{" "}
                </>
              ) : null}
              The same scenes recur across intervention types; their arms are
              not pooled as independent trials. Model discrepancy is not covered
              by this bound. No physical safety claim.
            </p>
            {campaign && (
              <details className="comparison-overview">
                <summary>
                  All-family mean effects across the three interventions
                </summary>
                <p>
                  Separate comparisons: 24 history pairs, 36 view pairs and 36
                  policy pairs share 36 unique scene IDs. This overview always
                  uses all families, independently of the filter above.
                </p>
                <PairedIntervalFigure
                  kind={kind}
                  comparisons={campaign.comparisons}
                />
              </details>
            )}
            <a
              className="text-button"
              href="/data/readiness-study.json"
              download
            >
              Download population outcomes, plan & assignment ledger{" "}
              <Download size={14} />
            </a>
            <p className="population-scope-note">
              The population report contains saved outcomes and manifest
              information; it does not include every episode’s original camera
              pixels and receipts.
            </p>
          </>
        ) : (
          <p className="fine-print">
            The current-model study is not loaded. A selected pair remains
            illustrative; no population claim is inferred.
          </p>
        )}
      </section>
    </section>
  );
}
