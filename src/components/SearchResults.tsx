import type { SearchResult, Candidate } from "../model/optimization";
import { Check, Download } from "lucide-react";
export function SearchResults({
  result,
  onApply,
  onExport,
  applied = false,
  disabled = false,
}: {
  result: SearchResult;
  onApply: (c: Candidate) => void;
  onExport: () => void;
  applied?: boolean;
  disabled?: boolean;
}) {
  const points = result.frontier.length ? result.frontier : [result.best];
  const maxX = Math.max(...points.map((p) => p.remaining), 200),
    maxY = Math.max(...points.map((p) => p.seconds), 60);
  const x = (v: number) => 35 + (v / maxX) * 260,
    y = (v: number) => 130 - (v / maxY) * 95;
  return (
    <section className="search-results">
      <div className="section-label">
        <span>
          {result.provenance?.kind === "recorded"
            ? "SAVED TRAINING SEARCH"
            : "SEARCH RESULTS"}
        </span>
        <span>{result.evaluations} evaluations</span>
      </div>
      <svg
        viewBox="0 0 325 166"
        role="img"
        aria-label="Tradeoff between remaining liquid and execution time. Lower and left is better."
      >
        <path d="M35 25V130H300" fill="none" stroke="#bdcdb0" />
        <path d="M35 82H300M35 35H300" stroke="#e0e8d8" strokeDasharray="3 4" />
        {points.map((p, i) => (
          <g key={i}>
            <circle
              cx={x(p.remaining)}
              cy={y(p.seconds)}
              r={p === result.best ? 6 : 4}
              fill={p.violations ? "#b88848" : "#668652"}
            >
              <title>
                {p.remaining.toFixed(0)} µL / {p.seconds.toFixed(1)} s /{" "}
                {p.tilt}° / {p.violations * 100}% violations
              </title>
            </circle>
          </g>
        ))}
        <text x="37" y="153">
          Remaining wash (µL)
        </text>
        <text x="7" y="23">
          s
        </text>
        <text x="274" y="145">
          {Math.round(maxX)}
        </text>
      </svg>
      <p className="search-method">
        Training cases only · seed {result.seed}. Test the selected
        configuration on a fresh scene before drawing a conclusion.
      </p>
      <p className="search-method">
        Withdrawals up to {result.best.policy.chunk.toFixed(0)} µL · immersion{" "}
        {result.best.policy.surfaceDepth.toFixed(1)} mm · clearance{" "}
        {result.best.policy.margin.toFixed(1)} mm · observe every{" "}
        {result.best.policy.observeEvery} strokes.
      </p>
      <p className="search-method">
        Across {result.trainingSeeds.length} training scenes:{" "}
        {(result.best.violations * 100).toFixed(0)}% had a constraint violation;{" "}
        {(result.best.stops * 100).toFixed(0)}% stopped conservatively. Amber
        points have a violation.
      </p>
      <div className="candidate-metrics">
        <div>
          <span>Residual</span>
          <strong>
            {result.best.remaining.toFixed(0)} <small>µL</small>
          </strong>
        </div>
        <div>
          <span>Duration</span>
          <strong>
            {result.best.seconds.toFixed(1)} <small>s</small>
          </strong>
        </div>
        <div>
          <span>Inclination</span>
          <strong>{result.best.tilt}°</strong>
        </div>
      </div>
      <div className="export-buttons">
        <button
          className="secondary-button"
          disabled={disabled || applied}
          onClick={() => onApply(result.best)}
        >
          <Check size={14} />
          {applied ? "Candidate applied" : "Apply candidate"}
        </button>
        <button
          className="secondary-button"
          onClick={onExport}
          aria-label="Export search result"
        >
          <Download size={14} />
        </button>
      </div>
    </section>
  );
}
