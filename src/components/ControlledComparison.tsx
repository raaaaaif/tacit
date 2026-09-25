import { useEffect, useState } from "react";
import { MANIFEST, canonical } from "../model/evidence";
import { ArrowRight, Download, Play, Square } from "lucide-react";
import {
  INTERVENTIONS,
  episode,
  summarize,
  type Comparison,
  type Intervention,
  type Arm,
  type Campaign,
} from "../model/comparison";
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
  const filtered = pop?.rows.filter(
    (r) => family === "all" || r.family === family,
  );
  const a = filtered?.length ? summarize(filtered.map((r) => r.a)) : null,
    b = filtered?.length ? summarize(filtered.map((r) => r.b)) : null;
  return (
    <section
      className="controlled-comparison"
      aria-label="Controlled comparison"
    >
      <div className="comparison-heading">
        <div className="eyebrow">CONTROLLED SIMULATED INTERVENTION</div>
        <h2>
          Change one thing.
          <br />
          <span>See what it changes.</span>
        </h2>
        <p>
          Two actual reruns. One shared physical scene. Every action keeps its
          evidence.
        </p>
      </div>
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
                  <div className="pair-volume">
                    {e.removed.toFixed(0)}
                    <small>µL removed</small>
                  </div>
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
                      <dt>Observations / elapsed</dt>
                      <dd>
                        {e.observations} / {e.seconds.toFixed(1)} s
                      </dd>
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
            <strong>
              {(
                active.arms[1].trace.result.removed -
                active.arms[0].trace.result.removed
              ).toFixed(1)}{" "}
              µL
            </strong>
            <span>
              change in removed volume · B − A<br />
              One selected example, not the population effect.
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
        <h3>The example is only one pair.</h3>
        {pop && a && b ? (
          <>
            <div className="population-caption">
              <p>
                {pop.assigned} assigned pairs ·{" "}
                {pop.administrativeFailures.length} administrative failures.
                Every stopped episode remains in the means.
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
            <div className="evidence-scroll">
              <table className="evidence-table">
                <thead>
                  <tr>
                    <th>Arm</th>
                    <th>Complete / stop / violate / miss</th>
                    <th>Mean residual</th>
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
            {family === "all" && (
              <div className="paired-intervals">
                {pop.paired
                  .filter((p) => p.metric !== "seconds")
                  .map((p) => (
                    <div key={p.metric}>
                      <span>Paired {p.metric} difference · B − A</span>
                      <strong>
                        {(
                          p.estimate * (p.metric === "completion" ? 100 : 1)
                        ).toFixed(1)}{" "}
                        {p.metric === "completion" ? "pp" : "µL"}
                      </strong>
                      <small>
                        95% interval{" "}
                        {p.ci
                          .map((v) =>
                            (v * (p.metric === "completion" ? 100 : 1)).toFixed(
                              1,
                            ),
                          )
                          .join(" to ")}{" "}
                        · matched resampling
                        {p.ci[0] === p.ci[1]
                          ? " · degenerate: no variation in this sample"
                          : ""}
                      </small>
                    </div>
                  ))}
              </div>
            )}
            <p className="fine-print">
              Zero events do not imply zero risk. With {a.n} independent
              zero-event trials, the one-sided 95% binomial upper bound is{" "}
              {(100 * -Math.expm1(Math.log(0.05) / a.n)).toFixed(1)}%. This
              mathematical bound does not include model error. No physical
              safety claim.
            </p>
            <a
              className="text-button"
              href="/data/readiness-study.json"
              download
            >
              Download complete study & assignment ledger <Download size={14} />
            </a>
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
