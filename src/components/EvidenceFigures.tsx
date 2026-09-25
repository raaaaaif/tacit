import { useId } from "react";
import {
  INTERVENTIONS,
  type Campaign,
  type Comparison,
  type Intervention,
  type PairRow,
} from "../model/comparison";
import "../evidence-figures.css";

const number = (value: number) =>
  value.toLocaleString("en-US", { maximumFractionDigits: 1 });
const signed = (value: number) =>
  `${value < 0 ? "−" : value > 0 ? "+" : ""}${number(Math.abs(value))}`;
const interventionLabels: Record<Intervention, string> = {
  history: "Withhold orientation history",
  view: "Make the overhead view available",
  policy: "Use the readiness controller",
};
const familyLabels = {
  known: "Known setup",
  shifted: "Changed setup",
  missing: "Missing context",
} as const;

export function pairDirectionCounts(rows: PairRow[]) {
  const values = rows.map((row) => row.b.removed - row.a.removed);
  return {
    more: values.filter((value) => value > 0).length,
    less: values.filter((value) => value < 0).length,
    unchanged: values.filter((value) => value === 0).length,
  };
}

function FigureAxis({
  values,
  label,
}: {
  values: number[];
  label: (value: number) => string;
}) {
  return (
    <div className="evidence-figure-axis" aria-hidden="true">
      {values.map((value) => (
        <span key={value}>{label(value)}</span>
      ))}
    </div>
  );
}

/** A display of recorded evaluation quantities, never a controller input. */
export function PairedVolumeFigure({ comparison }: { comparison: Comparison }) {
  const id = useId();
  const rows = comparison.arms.map(({ trace }, index) => ({
    key: index === 0 ? "A" : "B",
    label:
      index === 0
        ? INTERVENTIONS[comparison.kind].a
        : INTERVENTIONS[comparison.kind].b,
    initial: trace.initial.initialVolume,
    remaining: trace.result.remaining,
    removed: trace.result.removed,
    target: trace.policy.residualTarget,
  }));
  const maximum =
    Math.ceil(
      Math.max(
        100,
        ...rows.flatMap((row) => [
          row.initial,
          row.remaining + row.removed,
          row.target,
        ]),
      ) / 100,
    ) * 100;
  const position = (value: number) => (value / maximum) * 100;
  return (
    <figure className="evidence-figure volume-figure" aria-labelledby={id}>
      <div className="evidence-figure-heading">
        <h3 id={id}>Paired volume balance</h3>
        <span>Recorded outcome · µL</span>
      </div>
      <div className="volume-figure-legend" aria-hidden="true">
        <span>
          <i className="volume-remaining-key" />
          Retained wash
        </span>
        <span>
          <i className="volume-removed-key" />
          Removed
        </span>
        <span>
          <i className="volume-target-key" />
          Residual target
        </span>
      </div>
      <FigureAxis
        values={Array.from({ length: 5 }, (_, index) => (maximum * index) / 4)}
        label={number}
      />
      <div className="volume-figure-rows">
        {rows.map((row) => (
          <div className="volume-figure-row" key={row.key}>
            <div className="volume-row-label">
              <strong>
                <span>{row.key}</span>
                {row.label}
              </strong>
              <span>{number(row.initial)} µL initially</span>
            </div>
            <svg
              className="volume-plot"
              viewBox="0 0 100 36"
              preserveAspectRatio="none"
              aria-hidden="true"
              focusable="false"
            >
              {[0, 25, 50, 75, 100].map((x) => (
                <line
                  className="figure-grid"
                  key={x}
                  x1={x}
                  x2={x}
                  y1="0"
                  y2="36"
                />
              ))}
              <rect
                className="volume-remaining"
                x="0"
                y="8"
                width={position(row.remaining)}
                height="20"
              />
              <rect
                className="volume-removed"
                x={position(row.remaining)}
                y="8"
                width={position(row.removed)}
                height="20"
              />
              <line
                className="volume-boundary"
                x1={position(row.remaining)}
                x2={position(row.remaining)}
                y1="8"
                y2="28"
              />
              <line
                className="volume-target-halo"
                x1={position(row.target)}
                x2={position(row.target)}
                y1="0"
                y2="36"
              />
              <line
                className="volume-target"
                x1={position(row.target)}
                x2={position(row.target)}
                y1="0"
                y2="36"
              />
            </svg>
            <div className="volume-row-values">
              <span>
                <b>{number(row.remaining)} µL</b> retained
              </span>
              <span>
                <b>{number(row.removed)} µL</b> removed
              </span>
              <span>
                Target <b>{number(row.target)} µL</b>
              </span>
            </div>
          </div>
        ))}
      </div>
      <figcaption>
        Both arms use the same volume scale. The dashed mark is each arm’s
        residual target. Reaching that volume alone does not establish
        completion without the recorded checks and final outcome.
      </figcaption>
    </figure>
  );
}

export function PairedIntervalFigure({
  kind,
  comparisons,
}: {
  kind: Intervention;
  comparisons: Campaign["comparisons"];
}) {
  const id = useId();
  const rows = comparisons.flatMap((comparison) => {
    const result = comparison.paired.find(
      (entry) => entry.metric === "residual",
    );
    return result ? [{ kind: comparison.kind, result }] : [];
  });
  if (!rows.length) return null;
  const extent =
    Math.ceil(
      Math.max(
        50,
        ...rows.flatMap(({ result }) =>
          [...result.ci, result.estimate].map(Math.abs),
        ),
      ) / 50,
    ) * 50;
  const position = (value: number) => ((value + extent) / (2 * extent)) * 100;
  return (
    <figure className="evidence-figure interval-figure" aria-labelledby={id}>
      <div className="evidence-figure-heading">
        <h3 id={id}>Residual effect across interventions</h3>
        <span>All assigned pairs · B − A · µL</span>
      </div>
      <div className="interval-direction" aria-hidden="true">
        <span>Less retained in B</span>
        <span>More retained in B</span>
      </div>
      <FigureAxis
        values={[-extent, -extent / 2, 0, extent / 2, extent]}
        label={signed}
      />
      <div className="interval-figure-rows">
        {rows.map(({ kind: rowKind, result }) => (
          <div
            className={`interval-figure-row${rowKind === kind ? " is-selected" : ""}`}
            key={rowKind}
          >
            <div className="interval-row-label">
              <strong>{interventionLabels[rowKind]}</strong>
              <span>
                {result.n} pairs{rowKind === kind ? " · selected" : ""}
              </span>
            </div>
            <div className="interval-arm-labels">
              A: {INTERVENTIONS[rowKind].a} → B: {INTERVENTIONS[rowKind].b}
            </div>
            <div className="interval-plot" aria-hidden="true">
              {[0, 25, 50, 75, 100].map((left) => (
                <i
                  className={left === 50 ? "interval-zero" : "interval-grid"}
                  key={left}
                  style={{ left: `${left}%` }}
                />
              ))}
              <i
                className="interval-range"
                style={{
                  left: `${position(result.ci[0])}%`,
                  width: `${position(result.ci[1]) - position(result.ci[0])}%`,
                }}
              />
              <i
                className="interval-point"
                style={{ left: `${position(result.estimate)}%` }}
              />
            </div>
            <div className="interval-row-values">
              <strong>{signed(result.estimate)} µL</strong>
              <span>
                95% interval {signed(result.ci[0])} to {signed(result.ci[1])} µL
              </span>
            </div>
          </div>
        ))}
      </div>
      <figcaption>
        Mean paired residual difference with a 95% interval from matched
        resampling. Negative values mean less liquid remains in B. Every stopped
        episode is included. These exploratory model results do not measure
        physical performance.
      </figcaption>
    </figure>
  );
}

/** Every saved pair occupies its own row, so coincident zeroes stay visible. */
export function PairDifferenceFigure({
  kind,
  rows,
  scaleRows = rows,
}: {
  kind: Intervention;
  rows: PairRow[];
  scaleRows?: PairRow[];
}) {
  const id = useId();
  if (!rows.length) return null;
  const extent =
    Math.ceil(
      Math.max(
        50,
        ...scaleRows.map((row) => Math.abs(row.b.removed - row.a.removed)),
      ) / 50,
    ) * 50;
  const position = (value: number) => ((value + extent) / (2 * extent)) * 100;
  const totals = pairDirectionCounts(rows);
  return (
    <figure
      className="evidence-figure pair-difference-figure"
      aria-labelledby={id}
    >
      <div className="evidence-figure-heading">
        <h3 id={id}>Every paired change in removed volume</h3>
        <span>{rows.length} shown pairs · B − A · µL</span>
      </div>
      <p className="difference-definition">
        A: {INTERVENTIONS[kind].a} → B: {INTERVENTIONS[kind].b}
      </p>
      <div className="pair-direction-counts">
        <span>
          <b>{totals.more}</b> more removed
        </span>
        <span>
          <b>{totals.less}</b> less removed
        </span>
        <span>
          <b>{totals.unchanged}</b> exactly unchanged
        </span>
      </div>
      <div className="difference-family-grid">
        {(Object.keys(familyLabels) as (keyof typeof familyLabels)[]).flatMap(
          (family) => {
            const familyRows = rows
              .filter((row) => row.family === family)
              .sort((a, b) => a.sceneId.localeCompare(b.sceneId));
            if (!familyRows.length) return [];
            const counts = pairDirectionCounts(familyRows);
            return [
              <section
                className="difference-family"
                key={family}
                aria-label={`${familyLabels[family]} paired differences`}
              >
                <h4>
                  {familyLabels[family]} <span>{familyRows.length} pairs</span>
                </h4>
                <p>
                  {counts.more} more · {counts.less} less · {counts.unchanged}{" "}
                  unchanged
                </p>
                <div className="difference-plot-directions" aria-hidden="true">
                  <span>Less in B</span>
                  <span>More in B</span>
                </div>
                <FigureAxis
                  values={[-extent, -extent / 2, 0, extent / 2, extent]}
                  label={signed}
                />
                <div
                  className="individual-pair-plot"
                  style={{ height: `${familyRows.length * 12 + 8}px` }}
                  aria-hidden="true"
                >
                  {[0, 25, 50, 75, 100].map((left) => (
                    <i
                      className={
                        left === 50 ? "interval-zero" : "interval-grid"
                      }
                      key={left}
                      style={{ left: `${left}%` }}
                    />
                  ))}
                  {familyRows.map((row, index) => {
                    const difference = row.b.removed - row.a.removed;
                    return (
                      <i
                        className={`individual-pair-point ${difference === 0 ? "unchanged" : difference > 0 ? "more" : "less"}`}
                        key={row.sceneId}
                        data-scene={row.sceneId}
                        data-difference={difference}
                        title={`${row.sceneId}: ${signed(difference)} µL removed; ${signed(row.b.seconds - row.a.seconds)} s elapsed`}
                        style={{
                          left: `${position(difference)}%`,
                          top: `${index * 12 + 10}px`,
                        }}
                      />
                    );
                  })}
                </div>
              </section>,
            ];
          },
        )}
      </div>
      <details className="pair-values-details">
        <summary>Inspect all {rows.length} pair values</summary>
        <div
          className="pair-values-scroll"
          tabIndex={0}
          role="region"
          aria-label="Individual pair values; scroll horizontally for all columns"
        >
          <table>
            <thead>
              <tr>
                <th>Scene</th>
                <th>Removed · B − A</th>
                <th>Elapsed · B − A</th>
                <th>A outcome</th>
                <th>B outcome</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((row) => (
                <tr key={row.sceneId}>
                  <th>{row.sceneId}</th>
                  <td>
                    {signed(row.b.removed - row.a.removed)} µL
                    {row.b.removed === row.a.removed ? " · exact zero" : ""}
                  </td>
                  <td>{signed(row.b.seconds - row.a.seconds)} s</td>
                  <td>{row.a.outcome}</td>
                  <td>{row.b.outcome}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </details>
      <figcaption>
        One mark per saved pair, arranged vertically by scene ID within each
        family. Position encodes the recorded change in removed volume; open
        marks on zero are exactly unchanged pairs. All panels use the same
        scale, retained when filtering families. More removal does not establish
        target completion or physical safety.
      </figcaption>
    </figure>
  );
}
