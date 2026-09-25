import { useEffect, useMemo, useRef, useState } from "react";
import {
  ArrowDownToLine,
  ArrowRight,
  ArrowUpRight,
  Box,
  Check,
  ChevronDown,
  ChevronRight,
  ChevronLeft,
  Compass,
  Download,
  Eye,
  Focus,
  Github,
  Info,
  Layers,
  LoaderCircle,
  Maximize2,
  Pause,
  Play,
  RotateCcw,
  ScanLine,
  Settings2,
  ShieldCheck,
  SlidersHorizontal,
  Square,
  Upload,
  X,
} from "lucide-react";
import { DecisionReceipt } from "./components/DecisionReceipt";
import { ControlledComparison } from "./components/ControlledComparison";
import { EvidenceLedger } from "./components/EvidenceLedger";
import { casePacket } from "./model/casePacket";
import { createImportRequest } from "./ui/importRequest";
import { visibleReplayBelief } from "./ui/replayEvidence";
import { comparisonForScenario, replayQuantities } from "./ui/runContext";
import { ASSEMBLY } from "./model/assembly";
import type { Comparison, Intervention, Arm } from "./model/comparison";
import { Workbench } from "./scene/Workbench";
import { targetMet, outcomeReason } from "./model/assessment";
import { initialBelief } from "./model/belief";
import { traceFile } from "./model/traceFile";
import { playbackState, packetAt, PARKED_TIP } from "./model/playback";
import { CameraFrame } from "./components/CameraFrame";
import { EvidenceReport } from "./components/EvidenceReport";
import { SearchResults } from "./components/SearchResults";
import type { SearchResult, Candidate } from "./model/optimization";
import {
  SCENARIOS,
  CONTROLLERS,
  scenario,
  policy,
  worldFromScenario,
} from "./model/scenarios";
import { D, capillaryLength, MODEL_VERSION } from "./model/geometry";
import type {
  ScenarioId,
  ControllerId,
  RunTrace,
  ObservationPacket,
  Tilt,
  Vec3,
  ExperimentReport,
  PolicySpec,
} from "./model/types";
type Mode = "run" | "investigate" | "design";
function save(name: string, value: unknown, type = "application/json") {
  const blob = new Blob(
    [typeof value === "string" ? value : JSON.stringify(value)],
    { type },
  );
  const a = document.createElement("a");
  a.href = URL.createObjectURL(blob);
  a.download = name;
  a.click();
  setTimeout(() => URL.revokeObjectURL(a.href), 2000);
}
const format = (n: number) => Math.round(n).toLocaleString();
export default function App() {
  const [mode, setMode] = useState<Mode>("run"),
    [scenarioId, setScenario] = useState<ScenarioId>("known"),
    [controller, setController] = useState<ControllerId>("progress"),
    [seed, setSeed] = useState(1847),
    [tilt, setTilt] = useState<Tilt>(0),
    [indexed, setIndexed] = useState(true),
    [cutaway, setCutaway] = useState(true),
    [showExclusion, setShowExclusion] = useState(true),
    [reset, setReset] = useState(0),
    [overview, setOverview] = useState(false),
    [inspector, setInspector] = useState(false),
    [about, setAbout] = useState(false),
    [trace, setTrace] = useState<RunTrace | null>(null),
    [packets, setPackets] = useState<ObservationPacket[]>([]),
    [busy, setBusy] = useState(false),
    [progress, setProgress] = useState(0),
    [playing, setPlaying] = useState(false),
    [time, setTime] = useState(0),
    [speed, setSpeed] = useState(2),
    [error, setError] = useState(""),
    [report, setReport] = useState<ExperimentReport | null>(null),
    [exporting, setExporting] = useState(false),
    [searching, setSearching] = useState(false),
    [searchEvaluations, setSearchEvaluations] = useState(0),
    [searchResult, setSearchResult] = useState<SearchResult | null>(null),
    [customPolicy, setCustomPolicy] = useState<PolicySpec | null>(null);
  const [comparison, setComparison] = useState<Comparison | null>(null);
  const [comparing, setComparing] = useState(false);
  const [geometryOpen, setGeometryOpen] = useState(false);
  // A collapsed specimen has no visible replay controls or time context.
  useEffect(() => {
    if (mode === "design" && !geometryOpen) setPlaying(false);
  }, [mode, geometryOpen]);
  const jobId = useRef(0);
  const importRequest = useRef(createImportRequest());
  const [importedRun, setImportedRun] = useState<{
    trace: RunTrace;
    packets: ObservationPacket[];
  } | null>(null);
  const selectedPolicy =
    customPolicy?.controller === controller ? customPolicy : policy(controller);
  const displayedSearch =
    searchResult?.best.policy.controller === controller ? searchResult : null;
  const worker = useRef<Worker | null>(null),
    fileInput = useRef<HTMLInputElement>(null),
    modal = useRef<HTMLElement>(null);
  const config = useMemo(() => {
    if (importedRun) return importedRun.trace.scenario;
    const s = scenario(scenarioId, seed);
    s.fixture.tilt = tilt;
    s.fixture.indexed = indexed;
    return s;
  }, [scenarioId, seed, tilt, indexed, importedRun]);
  const initialEstimate = useMemo(() => initialBelief(config), [config]);
  const initial = useMemo(() => worldFromScenario(config), [config]);
  function createWorker() {
    worker.current?.terminate();
    const w = new Worker(
      new URL("./workers/simulation.worker.ts", import.meta.url),
      { type: "module" },
    );
    w.onmessage = (e) => {
      const m = e.data;
      if (worker.current !== w || m.jobId !== jobId.current) return;
      if (m.type === "comparison-done") {
        setComparison(m.result);
        setComparing(false);
        setBusy(false);
        return;
      }
      if (m.type === "progress") setProgress(m.progress);
      if (m.type === "search-evaluation") setSearchEvaluations(m.completed);
      if (m.type === "search-done") {
        setSearchResult(m.result);
        setSearching(false);
        setBusy(false);
      }
      if (m.type === "done") {
        setTrace(m.trace);
        setPackets(m.packets);
        setBusy(false);
        setSearching(false);
        setTime(0);
        setPlaying(
          !document.hidden &&
            !window.matchMedia("(prefers-reduced-motion: reduce)").matches,
        );
      }
      if (m.type === "error") {
        setSearching(false);
        setComparing(false);
        setError(m.message);
        setBusy(false);
      }
    };
    w.onerror = (e) => {
      if (worker.current !== w) return;
      setComparing(false);
      setSearching(false);
      setError(e.message);
      setBusy(false);
    };
    worker.current = w;
    return w;
  }
  useEffect(() => {
    const w = createWorker();
    setComparison((previous) => comparisonForScenario(previous, config));
    setComparing(false);
    if (importedRun) {
      setTrace(importedRun.trace);
      setPackets(importedRun.packets);
      setTime(importedRun.trace.result.seconds);
      setPlaying(false);
      setBusy(false);
      setSearching(false);
      return () => w.terminate();
    }
    setPackets([]);
    setTrace(null);
    setTime(0);
    setPlaying(false);
    setBusy(false);
    setSearching(false);
    setComparing(false);
    return () => w.terminate();
  }, [config]);
  useEffect(() => {
    fetch("/data/experiment.json")
      .then((r) => (r.ok ? r.json() : null))
      .then((r) => setReport(r?.modelVersion ? r : null))
      .catch(() => {});
  }, []);
  useEffect(() => {
    if (!playing || !trace || document.hidden) return;
    let frame = 0,
      last = performance.now();
    function tick(now: number) {
      const dt = Math.min(0.1, (now - last) / 1000);
      last = now;
      setTime((t) => {
        const next = t + dt * speed;
        if (next >= trace!.result.seconds) {
          setPlaying(false);
          return trace!.result.seconds;
        }
        return next;
      });
      frame = requestAnimationFrame(tick);
    }
    frame = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(frame);
  }, [playing, trace, speed]);
  useEffect(() => {
    const hidden = () => {
      if (document.hidden) setPlaying(false);
    };
    document.addEventListener("visibilitychange", hidden);
    return () => document.removeEventListener("visibilitychange", hidden);
  }, []);
  useEffect(() => {
    if (!about) return;
    const previous = document.activeElement as HTMLElement | null;
    setPlaying(false);
    const focusables = () =>
      Array.from(
        modal.current?.querySelectorAll<HTMLElement>(
          'button,a[href],input,select,[tabindex="0"]',
        ) ?? [],
      );
    focusables()[0]?.focus({ preventScroll: true });
    const trap = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        e.preventDefault();
        setAbout(false);
      }
      if (e.key === "Tab") {
        const all = focusables(),
          first = all[0],
          last = all.at(-1);
        if (e.shiftKey && document.activeElement === first) {
          e.preventDefault();
          last?.focus();
        } else if (!e.shiftKey && document.activeElement === last) {
          e.preventDefault();
          first?.focus();
        }
      }
    };
    document.addEventListener("keydown", trap);
    return () => {
      document.removeEventListener("keydown", trap);
      previous?.focus({ preventScroll: true });
    };
  }, [about]);
  const playback = trace ? playbackState(trace, time) : null;
  const displayedBelief = visibleReplayBelief(playback, initialEstimate);
  const quantities = replayQuantities(trace, playback, initial);
  const currentIndex = playback?.index ?? 0;
  const current = playback?.event;
  const visibleVolume = quantities.remaining;
  const tip: Vec3 = playback?.tip ?? PARKED_TIP;
  const visibleWorld = useMemo(
    () => ({
      ...(trace?.initial ?? initial),
      volume: visibleVolume,
      fixture: config.fixture,
      tilt,
    }),
    [trace, initial, visibleVolume, config.fixture, tilt],
  );
  const finished = !!trace && time >= trace.result.seconds;
  const hasViolations = !!trace?.result.violations.length;
  const missedTarget =
    !!trace &&
    !hasViolations &&
    trace.result.status === "completed" &&
    !targetMet(trace.result, trace.policy);
  const outcomeTone = !finished
    ? "pending"
    : hasViolations || trace?.result.status === "violated"
      ? "violated"
      : trace?.result.status === "completed" && !missedTarget
        ? "completed"
        : "stopped";
  const stateLabel = busy
    ? "Computing"
    : playing
      ? trace?.provenance.kind === "recorded"
        ? "Saved replay"
        : "Playing run"
      : finished
        ? !hasViolations && trace?.result.status === "completed"
          ? missedTarget
            ? "Target not met"
            : "Target reached"
          : hasViolations || trace?.result.status === "violated"
            ? "Run halted"
            : "Stopped"
        : trace
          ? "Paused"
          : "Ready to run";
  const activePacket = (view: "side" | "overhead") =>
    packetAt(packets, view, time);
  const sInfo = SCENARIOS.find((s) => s.id === scenarioId)!;
  function invalidatePreparedContext() {
    importRequest.current.invalidate();
    setComparison(null);
  }
  const run = () => {
    importRequest.current.invalidate();
    setError("");
    setBusy(true);
    setProgress(0);
    setPlaying(false);
    worker.current?.postMessage({
      type: "run",
      jobId: ++jobId.current,
      scenario: config,
      policy: selectedPolicy,
      access: trace?.intervention,
    });
  };
  function cancel() {
    importRequest.current.invalidate();
    ++jobId.current;
    setComparing(false);
    worker.current?.terminate();
    createWorker();
    setBusy(false);
    setProgress(0);
    setSearching(false);
  }
  function runPair(kind: Intervention) {
    if (busy) return;
    importRequest.current.invalidate();
    setBusy(true);
    setComparing(true);
    setProgress(0);
    setError("");
    setPlaying(false);
    worker.current?.postMessage({
      type: "compare",
      jobId: ++jobId.current,
      scenario: config,
      intervention: kind,
    });
  }
  function inspectArm(a: Arm) {
    importRequest.current.invalidate();
    const t = {
      ...a.trace,
      provenance: { ...a.trace.provenance, kind: "recorded" as const },
    };
    setScenario(t.scenario.id);
    setSeed(t.scenario.seed);
    setTilt(t.scenario.fixture.tilt);
    setIndexed(t.scenario.fixture.indexed);
    setController(t.policy.controller);
    setCustomPolicy(t.policy);
    setImportedRun({ trace: t, packets: a.packets });
    setMode("investigate");
  }
  async function exportCase(paired = false) {
    const t = paired ? comparison?.arms[0].trace : trace,
      ps = paired ? comparison?.arms[0].packets : packets;
    if (!t || !ps) return;
    try {
      save(
        `${t.id}-case.json`,
        await casePacket(t, ps, paired ? comparison : null),
      );
    } catch (e) {
      setError(String(e));
    }
  }
  function selectDecision(t: number) {
    setPlaying(false);
    setTime(t);
  }
  function searchPolicies() {
    importRequest.current.invalidate();
    setError("");
    setBusy(true);
    setSearching(true);
    setPlaying(false);
    setSearchEvaluations(0);
    worker.current?.postMessage({
      type: "optimize",
      jobId: ++jobId.current,
      scenario: config,
      policy: selectedPolicy,
    });
  }
  function applyCandidate(c: Pick<Candidate, "policy" | "tilt">) {
    if (busy) return;
    setError("");
    invalidatePreparedContext();
    setImportedRun(null);
    setCustomPolicy(c.policy);
    setController(c.policy.controller);
    setTilt(c.tilt);
    setTrace(null);
    setPackets([]);
    setTime(0);
    setPlaying(false);
  }
  function toggleReplay() {
    if (!trace || busy) return;
    if (finished) setTime(0);
    setPlaying((value) => !value);
  }
  useEffect(() => {
    const key = (e: KeyboardEvent) => {
      if (about) return;
      if ((e.target as HTMLElement).matches("input,select,textarea,button"))
        return;
      if ((e.target as HTMLElement).closest(".evidence-scroll")) return;
      if (e.code === "Space" && trace && !busy) {
        e.preventDefault();
        toggleReplay();
      }
      if (trace && (e.key === "ArrowLeft" || e.key === "ArrowRight")) {
        e.preventDefault();
        setPlaying(false);
        setTime((t) =>
          Math.max(
            0,
            Math.min(
              trace.result.seconds,
              t + (e.key === "ArrowRight" ? 1 : -1) / 60,
            ),
          ),
        );
      }
      if (e.key === "Escape") {
        setAbout(false);
        setInspector(false);
      }
      if (e.key.toLowerCase() === "r") setReset((r) => r + 1);
    };
    window.addEventListener("keydown", key);
    return () => window.removeEventListener("keydown", key);
  }, [trace, config, controller, busy, finished, selectedPolicy, about]);
  function exportCSV() {
    if (!trace) return;
    save(
      `${trace.id}.csv`,
      "time_s,action,remaining_uL,aspirated_uL,clearance_mm,violations\n" +
        trace.events
          .map((e) =>
            [
              e.t.toFixed(3),
              e.action.kind,
              e.volume.toFixed(3),
              e.aspirated.toFixed(3),
              e.clearance.toFixed(3),
              e.violations.join(";"),
            ].join(","),
          )
          .join("\n"),
      "text/csv",
    );
  }
  async function exportCAD() {
    setExporting(true);
    try {
      const { exportFixture } = await import("./cad/fixture");
      const result = await exportFixture(config.fixture);
      const a = document.createElement("a");
      a.href = URL.createObjectURL(
        new Blob([result.bundle as BlobPart], { type: "application/zip" }),
      );
      a.download = `tacit-holder-${tilt}deg.zip`;
      a.click();
      setTimeout(() => URL.revokeObjectURL(a.href), 2000);
    } catch (e) {
      setError(String(e));
    } finally {
      setExporting(false);
    }
  }
  async function importTrace(file: File) {
    await importRequest.current.load(
      file,
      (bundle) => {
        const t = bundle.trace;
        ++jobId.current;
        worker.current?.terminate();
        setError("");
        setPlaying(false);
        setScenario(t.scenario.id);
        setSeed(t.scenario.seed);
        setTilt(t.scenario.fixture.tilt);
        setIndexed(t.scenario.fixture.indexed);
        setController(t.policy.controller);
        setCustomPolicy(t.policy);
        setComparison(bundle.comparison);
        setImportedRun(bundle);
        setMode("investigate");
      },
      setError,
    );
  }
  return (
    <div className="app-shell">
      <header className="header">
        <a className="brand" href="/" aria-label="TACIT home">
          <span className="brand-mark">
            <i />
            <i />
            <i />
          </span>
          <span>
            TACIT<span className="brand-period">.</span>
          </span>
          <span className="brand-description">
            EXECUTION READINESS
            <br />
            WORKBENCH
          </span>
        </a>
        <nav className="mode-nav" aria-label="Workbench mode">
          {(["run", "investigate", "design"] as Mode[]).map((m) => (
            <button
              key={m}
              className={mode === m ? "selected" : ""}
              onClick={() => setMode(m)}
              aria-current={mode === m ? "page" : undefined}
            >
              {m[0].toUpperCase() + m.slice(1)}
            </button>
          ))}
        </nav>
        <div className="header-right">
          <span className="build-label">
            <span className="signal-dot" />
            RESEARCH BUILD
          </span>
          <button
            className="icon-button"
            aria-label="About TACIT"
            onClick={() => setAbout(true)}
          >
            <Info size={18} />
          </button>
        </div>
      </header>
      <main>
        <div className="page-heading">
          <div>
            <div className="eyebrow">
              BULK WASH REMOVAL <span>/</span> SYNTHETIC MODEL
            </div>
            <h1>
              Remove the wash. <span>Inspect the decision.</span>
            </h1>
          </div>
          <button className="text-button" onClick={() => setAbout(true)}>
            Why this task <ArrowUpRight size={15} />
          </button>
        </div>
        <div className="readiness-strip">
          <span>
            <i /> Synthetic research model
          </span>
          <span>
            {tilt === 10
              ? "Model domain unsupported"
              : "0° / 5° · 100–950 µL screening"}
          </span>
          <span>Computational assembly checks · no physical fit test</span>
        </div>
        {mode === "design" && (
          <div id="paired-experiment">
            <ControlledComparison
              historyKnown={config.historyKnown}
              comparison={comparison}
              busy={comparing}
              disabled={busy && !comparing}
              progress={progress}
              onRun={runPair}
              onCancel={cancel}
              onInspect={inspectArm}
              onExport={() => void exportCase(true)}
            />
            <EvidenceLedger />
          </div>
        )}
        {mode === "design" && (
          <button
            className="geometry-toggle secondary-button"
            aria-expanded={geometryOpen}
            onClick={() => setGeometryOpen((v) => !v)}
          >
            {geometryOpen ? "Hide" : "Inspect"} workcell & research geometry{" "}
            <ChevronDown size={15} />
          </button>
        )}
        {mode === "run" && (
          <div className="run-command" aria-label="Prepared simulation">
            <div className="scenario-select">
              <label htmlFor="scenario">SCENARIO</label>
              <div className="select-wrap">
                <select
                  disabled={busy}
                  id="scenario"
                  value={scenarioId}
                  onChange={(e) => {
                    invalidatePreparedContext();
                    setImportedRun(null);
                    setScenario(e.target.value as ScenarioId);
                    setIndexed(e.target.value !== "missing");
                  }}
                >
                  {SCENARIOS.map((s) => (
                    <option key={s.id} value={s.id}>
                      {s.name}
                    </option>
                  ))}
                </select>
                <ChevronDown size={16} />
              </div>
              <p>
                {trace?.intervention &&
                (trace.intervention.history === "withheld" ||
                  trace.intervention.views.length < 2)
                  ? `${sInfo.name}. Replaying an evidence intervention; controller access is listed below.`
                  : sInfo.description}
              </p>
            </div>
            <div className="run-command-action">
              <span>
                {
                  CONTROLLERS.find((c) => c.id === selectedPolicy.controller)
                    ?.label
                }
              </span>
              <div className="run-controls">
                <button
                  className="primary-button"
                  onClick={busy ? cancel : run}
                >
                  {busy ? (
                    <>
                      <Square size={15} />
                      Cancel computation{" "}
                      <span>{Math.round(progress * 100)}%</span>
                    </>
                  ) : (
                    <>
                      <Play size={17} fill="currentColor" />
                      {trace && trace.modelVersion !== MODEL_VERSION
                        ? "Run under current model"
                        : "Run simulation"}
                    </>
                  )}
                </button>
              </div>
            </div>
          </div>
        )}
        <div
          className="workbench-layout"
          style={
            mode === "design" && !geometryOpen ? { display: "none" } : undefined
          }
        >
          <div className="specimen-column">
            <section className="viewport" aria-label="Physical workcell">
              <div className="viewport-top">
                <div className="viewport-id">
                  <span className="small-cross">+</span>
                  <span className="mono">ASPIRATION WORKCELL</span>
                  <span className="viewport-divider" />
                  <span className="viewport-subtitle">
                    {cutaway ? "Section view" : "Material view"} · {tilt}°
                    holder
                  </span>
                </div>
                <div className="viewport-tools">
                  <button
                    className="icon-button"
                    aria-label={
                      overview ? "View tube detail" : "View whole workcell"
                    }
                    aria-pressed={overview}
                    onClick={() => setOverview((v) => !v)}
                  >
                    <Maximize2 size={17} />
                  </button>
                  <button
                    className={cutaway ? "on" : ""}
                    aria-pressed={cutaway}
                    aria-label="Toggle tube cutaway"
                    title="Toggle tube cutaway"
                    onClick={() => setCutaway((v) => !v)}
                  >
                    <Layers size={16} />
                  </button>
                  <button
                    className={showExclusion ? "on" : ""}
                    aria-pressed={showExclusion}
                    aria-label="Toggle pellet clearance envelope"
                    title="Toggle pellet clearance envelope"
                    onClick={() => setShowExclusion((v) => !v)}
                  >
                    <ScanLine size={16} />
                  </button>
                  <button
                    aria-label="Reset camera"
                    title="Reset camera · R"
                    onClick={() => setReset((r) => r + 1)}
                  >
                    <Focus size={17} />
                  </button>
                </div>
              </div>
              {trace && trace.modelVersion !== MODEL_VERSION ? (
                <div className="historical-scene">
                  <h2>Historical evidence, preserved.</h2>
                  <p>
                    {trace.modelVersion} uses a different assembly. Its recorded
                    pixels and events remain available; current geometry is not
                    substituted for an exact replay.
                  </p>
                </div>
              ) : (
                <Workbench
                  world={visibleWorld}
                  overview={overview}
                  aspirated={playback?.aspirated ?? 0}
                  tip={tip}
                  cutaway={cutaway}
                  showExclusion={showExclusion}
                  reset={reset}
                  active={playing}
                />
              )}
              <div className="scene-side-label">
                <span className="vertical-rule" />
                <span className="mono">NOMINAL 1.5 mL / PP</span>
              </div>
              <div className="scene-annotation">
                <span className="annotation-line" />
                <div>
                  <span className="annotation-dot" />
                  PELLET EXCLUSION ENVELOPE
                  <small>
                    {showExclusion
                      ? "1.8 mm clearance around the model pellet"
                      : "Overlay hidden"}
                  </small>
                </div>
              </div>
              <div className="viewport-bottom">
                <div className="orientation">
                  <Compass size={22} />
                  <span>
                    Drag to orbit <b>·</b> Scroll to zoom
                  </span>
                </div>
                <span className="model-label">
                  Simulator state <span>·</span>{" "}
                  {controller === "oracle"
                    ? "privileged reference access"
                    : "not controller input"}
                </span>
              </div>
              <div className="volume-readout">
                <span className="eyebrow">Simulated remaining</span>
                <div>
                  {format(visibleVolume)}
                  <span>µL</span>
                </div>
                <div className="volume-meter">
                  <i
                    style={{
                      width: `${Math.min(100, (visibleVolume / (quantities.initial || 1)) * 100)}%`,
                    }}
                  />
                </div>
                <small>
                  {trace
                    ? `${format(quantities.removed)} µL removed`
                    : "Initial liquid volume · simulated"}
                </small>
              </div>
            </section>
            <section
              className="timeline"
              aria-label="Execution timeline"
              style={
                mode === "design" && !geometryOpen
                  ? { display: "none" }
                  : undefined
              }
            >
              <div className="timeline-heading">
                <div>
                  <span className="eyebrow">EXECUTION TIMELINE</span>
                  <span className="timeline-subtitle">
                    {trace
                      ? `${trace.events.length} actions · seed ${trace.scenario.seed}${trace.provenance.kind === "recorded" ? ` · saved ${trace.modelVersion}` : ""}`
                      : "An instruction becomes a sequence of physical decisions."}
                  </span>
                </div>
                <div className="playback-tools">
                  <button
                    className="speed-button"
                    aria-label={playing ? "Pause replay" : "Play replay"}
                    title="Replay controls · Space"
                    disabled={!trace || busy}
                    onClick={toggleReplay}
                  >
                    {playing ? <Pause size={14} /> : <Play size={14} />}
                    {playing ? "Pause" : "Replay"}
                  </button>
                  <button
                    className="icon-button"
                    aria-label="Restart replay"
                    disabled={!trace}
                    onClick={() => {
                      setTime(0);
                      setPlaying(false);
                    }}
                  >
                    <RotateCcw size={14} />
                  </button>
                  <button
                    className="icon-button"
                    aria-label="Previous frame"
                    title="Previous frame · ←"
                    disabled={!trace}
                    onClick={() => {
                      setPlaying(false);
                      setTime((t) => Math.max(0, t - 1 / 60));
                    }}
                  >
                    <ChevronLeft size={14} />
                  </button>
                  <button
                    className="icon-button"
                    aria-label="Next frame"
                    title="Next frame · →"
                    disabled={!trace}
                    onClick={() => {
                      setPlaying(false);
                      setTime((t) =>
                        Math.min(trace!.result.seconds, t + 1 / 60),
                      );
                    }}
                  >
                    <ChevronRight size={14} />
                  </button>
                  <button
                    className="speed-button mono"
                    onClick={() =>
                      setSpeed((v) => (v === 1 ? 2 : v === 2 ? 4 : 1))
                    }
                  >
                    {speed}×
                  </button>
                  <span className="timeline-clock mono">
                    {time.toFixed(2)}{" "}
                    <span>/ {trace?.result.seconds.toFixed(2) ?? "—"} s</span>
                  </span>
                </div>
              </div>
              <div className="timeline-track">
                <div className="timeline-rail">
                  {trace ? (
                    trace.events
                      .filter((e) => e.duration > 0)
                      .map((e) => (
                        <button
                          key={e.index}
                          title={`${e.action.kind === "aspirate" ? `Aspirate ${e.action.volume.toFixed(1)} µL` : e.action.kind} · ${e.t.toFixed(2)}–${(e.t + e.duration).toFixed(2)} s`}
                          className={`timeline-segment action-${e.action.kind} ${e.t <= time ? "elapsed" : ""}`}
                          style={{
                            left: `${(100 * e.t) / trace.result.seconds}%`,
                            width: `${(100 * e.duration) / trace.result.seconds}%`,
                          }}
                          onClick={() => {
                            setTime(e.t);
                            setPlaying(false);
                          }}
                        />
                      ))
                  ) : (
                    <div className="empty-track">
                      <i />
                      <i />
                      <i />
                      <i />
                      <i />
                      <i />
                    </div>
                  )}
                  {trace && (
                    <div
                      className="timeline-playhead"
                      style={{
                        left: `${(100 * time) / (trace.result.seconds || 1)}%`,
                      }}
                    />
                  )}
                </div>
                <input
                  aria-label="Scrub execution time"
                  type="range"
                  min={0}
                  max={trace?.result.seconds || 1}
                  step={0.01}
                  value={time}
                  disabled={!trace}
                  onChange={(e) => {
                    setPlaying(false);
                    const value = Number(e.target.value);
                    setTime(
                      trace && value >= trace.result.seconds - 0.011
                        ? trace.result.seconds
                        : value,
                    );
                  }}
                />
              </div>
              <div className="timeline-legend">
                <span>
                  <i className="legend-observe" />
                  Observe
                </span>
                <span>
                  <i className="legend-move" />
                  Move
                </span>
                <span>
                  <i className="legend-aspirate" />
                  Aspirate
                </span>
                <span className="timeline-outcome" data-outcome={outcomeTone}>
                  {finished ? (
                    <>
                      <span className="signal-dot" />
                      {!hasViolations && trace?.result.status === "completed"
                        ? missedTarget
                          ? "Target not met in simulation"
                          : "Bulk-removal target reached"
                        : hasViolations || trace?.result.status === "violated"
                          ? "Constraint violation recorded"
                          : "Stopped before target"}
                    </>
                  ) : (
                    <>
                      <span className="tiny-cross">+</span> Observations,
                      motion, and volume share one clock
                    </>
                  )}
                </span>
              </div>
            </section>
          </div>
          <aside
            className="control-panel"
            key={mode}
            aria-label={`${mode === "design" ? "Design" : mode === "investigate" ? "Evidence" : "Procedure"} controls`}
          >
            <div className="panel-header">
              <span className="eyebrow">
                {mode === "design"
                  ? "CONFIGURATION"
                  : mode === "investigate"
                    ? "EXECUTION EVIDENCE"
                    : "PROCEDURE"}
              </span>
              <span
                className={`status ${playing ? "live" : ""}`}
                data-outcome={outcomeTone}
              >
                <i />
                {stateLabel}
              </span>
            </div>
            {mode === "run" && (
              <>
                {trace && !finished && current && (
                  <div className="live-decision">
                    <b>
                      {current.action.kind === "observe"
                        ? "Observe the " + current.action.view + " view"
                        : current.action.kind === "move"
                          ? current.receipt?.disposition ===
                            "comparator-unchecked"
                            ? "Follow the comparator approach"
                            : "Move along the checked approach"
                          : current.action.kind === "aspirate"
                            ? `Withdraw ${current.action.volume.toFixed(0)} µL`
                            : "Stop and retain liquid"}
                    </b>
                    <span>
                      {current.receipt?.disposition === "comparator-unchecked"
                        ? "Comparator action · recorded checks do not gate this action."
                        : current.action.kind === "aspirate"
                          ? "The complete stroke was screened for immersion, capacity and model support."
                          : current.reason}
                    </span>
                  </div>
                )}
                {finished && (
                  <div className="run-outcome" role="status">
                    <strong>
                      {!hasViolations && trace.result.status === "completed"
                        ? missedTarget
                          ? "Target not met in simulation"
                          : "Bulk-removal target reached"
                        : hasViolations || trace.result.status === "violated"
                          ? "Execution halted"
                          : "Stopped with liquid retained"}
                    </strong>
                    <p>
                      {hasViolations
                        ? `Recorded violations: ${trace.result.violations.join(", ")}. ${trace.result.reason}`
                        : outcomeReason(trace)}
                    </p>
                    <button
                      className="text-button"
                      onClick={() => {
                        setMode("investigate");
                        setPlaying(false);
                        setTime(trace!.result.seconds);
                      }}
                    >
                      Inspect this decision <ArrowRight size={14} />
                    </button>
                  </div>
                )}
                <div className="controller-field">
                  <label htmlFor="controller">CONTROLLER</label>
                  <div className="select-wrap">
                    <select
                      id="controller"
                      disabled={busy}
                      value={controller}
                      onChange={(e) => {
                        invalidatePreparedContext();
                        setImportedRun(null);
                        setCustomPolicy(null);
                        setController(e.target.value as ControllerId);
                        setTrace(null);
                        setPlaying(false);
                        setTime(0);
                      }}
                    >
                      {CONTROLLERS.map((c) => (
                        <option key={c.id} value={c.id}>
                          {c.label}
                        </option>
                      ))}
                    </select>
                    <ChevronDown size={16} />
                  </div>
                  <div className="controller-hint">
                    <ShieldCheck size={16} />
                    <span>
                      {
                        CONTROLLERS.find((c) => c.id === controller)!
                          .description
                      }
                    </span>
                  </div>
                </div>
                {customPolicy && (
                  <div className="applied-policy">
                    <span>
                      Applied policy · {customPolicy.chunk.toFixed(0)} µL
                      strokes · {customPolicy.surfaceDepth.toFixed(1)} mm
                      immersion
                    </span>
                    <button
                      disabled={busy}
                      onClick={() => {
                        setCustomPolicy(null);
                        invalidatePreparedContext();
                        setImportedRun(null);
                        setTrace(null);
                        setPackets([]);
                        setTime(0);
                        setPlaying(false);
                      }}
                    >
                      Reset policy
                    </button>
                  </div>
                )}
                <div className="available-context">
                  <span>AVAILABLE TO THE CONTROLLER</span>
                  <b>
                    {controller === "oracle"
                      ? "Hidden state · privileged diagnostic"
                      : controller === "nominal"
                        ? "Procedure assumptions · no camera update"
                        : config.historyKnown &&
                            trace?.intervention?.history !== "withheld"
                          ? "Handling record + synthetic cameras"
                          : "Synthetic cameras · history absent"}
                  </b>
                  <small>
                    {trace?.intervention &&
                      `Camera access: ${trace.intervention.views.length ? trace.intervention.views.join(" + ") : "none"}. `}
                    Target: {selectedPolicy.residualTarget.toFixed(0)} µL
                    remaining. Final pellet-adjacent removal is outside this
                    model.
                  </small>
                </div>
                <div className="thin-divider" />
                <div className="section-label">
                  <span>OBSERVATION CHANNELS</span>
                  <span className="mono">RGB</span>
                </div>
                <div className="camera-grid">
                  <CameraFrame
                    now={time}
                    enabled={
                      !trace?.intervention ||
                      trace.intervention.views.includes("side")
                    }
                    label="SIDE"
                    packet={activePacket("side")}
                    active={
                      playing &&
                      current?.action.kind === "observe" &&
                      current.observation?.view === "side"
                    }
                  />
                  <CameraFrame
                    now={time}
                    enabled={
                      !trace?.intervention ||
                      trace.intervention.views.includes("overhead")
                    }
                    label="OVERHEAD"
                    packet={activePacket("overhead")}
                    active={
                      playing &&
                      current?.action.kind === "observe" &&
                      current.observation?.view === "overhead"
                    }
                  />
                </div>
                <button
                  className="inspector-trigger"
                  onClick={() => setInspector((v) => !v)}
                >
                  <SlidersHorizontal size={15} />
                  Instrument settings
                  <ChevronDown
                    size={15}
                    className={inspector ? "rotated" : ""}
                  />
                </button>
              </>
            )}
            {mode === "investigate" && (
              <>
                {!trace && (
                  <div className="investigate-intro">
                    <h2>No recorded run yet</h2>
                    <p>
                      Run a simulation to inspect its actions, observations and
                      decisions.
                    </p>
                  </div>
                )}
                {trace ? (
                  <>
                    <DecisionReceipt
                      event={current}
                      trace={trace}
                      onSelect={selectDecision}
                      onCompare={() => setMode("design")}
                      onExport={() => void exportCase()}
                    />
                    <div className="evidence-values">
                      <div>
                        <span>Liquid estimate · marginal 95% interval</span>
                        <strong>
                          {displayedBelief.volume.map(format).join(" – ")}{" "}
                          <small>µL</small>
                        </strong>
                      </div>
                      <div>
                        <span>Pellet orientation</span>
                        <strong>
                          {displayedBelief.pelletKnown
                            ? "History / evidence available"
                            : "Unresolved"}
                        </strong>
                      </div>
                      <div>
                        <span>Recorded constraint violations</span>
                        <strong
                          className={
                            trace.result.violations.length ? "warning-text" : ""
                          }
                        >
                          {trace.result.violations.length
                            ? trace.result.violations.join(", ")
                            : "None in this run"}
                        </strong>
                      </div>
                    </div>
                    <div className="camera-grid">
                      <CameraFrame
                        label="SIDE"
                        packet={activePacket("side")}
                        now={time}
                        enabled={
                          !trace?.intervention ||
                          trace.intervention.views.includes("side")
                        }
                      />
                      <CameraFrame
                        label="OVERHEAD"
                        packet={activePacket("overhead")}
                        now={time}
                        enabled={
                          !trace?.intervention ||
                          trace.intervention.views.includes("overhead")
                        }
                      />
                    </div>
                    <div className="export-buttons">
                      <button
                        className="secondary-button"
                        onClick={() =>
                          save(`${trace.id}.json`, traceFile(trace, packets))
                        }
                      >
                        <Download size={15} />
                        Trace JSON
                      </button>
                      <button className="secondary-button" onClick={exportCSV}>
                        <Download size={15} />
                        CSV
                      </button>
                    </div>
                  </>
                ) : (
                  <button
                    className="primary-button"
                    disabled={busy}
                    onClick={() => {
                      setMode("run");
                      run();
                    }}
                  >
                    <Play size={16} />
                    Run a procedure
                    <ArrowRight size={16} />
                  </button>
                )}
                <button
                  className="inspector-trigger"
                  onClick={() => fileInput.current?.click()}
                >
                  <Upload size={15} />
                  Import a saved trace
                  <ChevronRight size={15} />
                </button>
              </>
            )}
            {mode === "design" && (
              <>
                <div className="investigate-intro">
                  <h2>What changes the decision?</h2>
                  <p>
                    Compare context, observations or policy under the same
                    physical conditions. Inspect both real reruns below.
                  </p>
                </div>
                <div className="design-note">
                  <Info size={15} />
                  <p>
                    The selected scene stays physically identical across
                    information interventions. A new holder configuration starts
                    a new physical run.
                  </p>
                </div>
                <a
                  className="primary-button comparison-jump"
                  href="#paired-experiment"
                >
                  Open controlled experiment <ArrowRight size={16} />
                </a>
                <details className="fixture-drawer">
                  <summary>Research geometry & advanced search</summary>
                  <div className="design-field">
                    <label>HOLDER INCLINATION</label>
                    <div className="tilt-selector">
                      {([0, 5, 10] as Tilt[]).map((v) => (
                        <button
                          key={v}
                          onClick={() => {
                            invalidatePreparedContext();
                            setImportedRun(null);
                            setTilt(v);
                          }}
                          className={tilt === v ? "selected" : ""}
                        >
                          <span
                            className="tilt-glyph"
                            style={{ transform: `rotate(${v}deg)` }}
                          />
                          {v}°
                        </button>
                      ))}
                    </div>
                  </div>
                  <label className="toggle-field">
                    <span>
                      <b>Visual orientation marker</b>
                      <small>Reference marker · no mechanical key</small>
                    </span>
                    <input
                      type="checkbox"
                      checked={indexed}
                      onChange={(e) => {
                        invalidatePreparedContext();
                        setImportedRun(null);
                        setIndexed(e.target.checked);
                      }}
                    />
                    <span className="toggle" />
                  </label>
                  <div className="design-note">
                    <Info size={15} />
                    <p>
                      A visual marker cannot reconstruct handling history or
                      mechanically retain rotation. Seating accuracy is an
                      assumption until physically measured.
                    </p>
                  </div>
                  <div className="dimension-row">
                    <span>Seat clearance</span>
                    <strong>{config.fixture.clearance.toFixed(2)} mm</strong>
                  </div>
                  <div className="dimension-row">
                    <span>Nominal footprint</span>
                    <strong>34 × 28 mm</strong>
                  </div>
                  <div className="dimension-row">
                    <span>Opening between columns</span>
                    <strong>{D.holder.windowWidth} mm</strong>
                  </div>
                  <div className="design-actions">
                    <button
                      className="secondary-button"
                      onClick={searching ? cancel : searchPolicies}
                      disabled={busy && !searching}
                    >
                      {searching ? (
                        <LoaderCircle size={15} className="spin" />
                      ) : (
                        <SlidersHorizontal size={15} />
                      )}
                      {searching
                        ? `Cancel search · ${searchEvaluations}/32 candidates`
                        : "Search policy alternatives"}
                    </button>
                    <button
                      className="primary-button"
                      disabled={busy}
                      onClick={() => {
                        setMode("run");
                        run();
                      }}
                    >
                      <Play size={16} />
                      Test this configuration
                      <ArrowRight size={16} />
                    </button>
                    <button
                      className="secondary-button"
                      disabled={exporting || tilt === 10}
                      onClick={exportCAD}
                    >
                      {exporting ? (
                        <LoaderCircle size={15} className="spin" />
                      ) : (
                        <Box size={15} />
                      )}
                      Export research geometry
                    </button>
                  </div>
                  <p className="fine-print">
                    Nominal assembly checked. Not for fabrication: measured fit,
                    loads and retention are unverified.
                  </p>
                  {displayedSearch && (
                    <SearchResults
                      result={displayedSearch}
                      disabled={busy}
                      applied={
                        customPolicy === displayedSearch.best.policy &&
                        tilt === displayedSearch.best.tilt
                      }
                      onApply={applyCandidate}
                      onExport={() =>
                        save("tacit-policy-search.json", displayedSearch)
                      }
                    />
                  )}
                </details>
              </>
            )}
            {inspector && (
              <div className="settings-drawer">
                <label>
                  REPRODUCIBLE SEED
                  <input
                    type="number"
                    value={seed}
                    onChange={(e) => (
                      invalidatePreparedContext(),
                      setImportedRun(null),
                      setSeed(
                        Math.min(
                          4294967295,
                          Math.max(1, Math.floor(Number(e.target.value)) || 1),
                        ),
                      )
                    )}
                  />
                </label>
                <div>
                  <span>Withdrawal rate</span>
                  <b>{D.operating.flowRate} µL/s</b>
                </div>
                <div>
                  <span>Settling interval</span>
                  <b>{D.operating.settleTime} s</b>
                </div>
                <div>
                  <span>Capillary length</span>
                  <b>{capillaryLength().toFixed(2)} mm</b>
                </div>
                <small>
                  Model parameters are research assumptions, not a validated
                  laboratory procedure.
                </small>
              </div>
            )}
          </aside>
        </div>
        {mode === "design" && (
          <EvidenceReport
            report={report}
            disabled={busy || report?.modelVersion !== MODEL_VERSION}
            onExport={() => save("tacit-experiment.json", report)}
            onApply={(c) => {
              applyCandidate(c);
              setMode("run");
            }}
          />
        )}
        <footer>
          <span>
            <b>TACIT</b> <span className="footer-dot">/</span> An independent
            project by Raaif Bokhari
          </span>
          <div>
            <button onClick={() => setAbout(true)}>
              Model & methods
              <ArrowUpRight size={13} />
            </button>
            <a
              href="https://github.com/raaaaaif/tacit"
              target="_blank"
              rel="noreferrer"
            >
              Source
              <Github size={14} />
            </a>
            <span className="mono">v0.4</span>
          </div>
        </footer>
      </main>
      <input
        className="sr-only"
        type="file"
        accept=".json"
        ref={fileInput}
        onChange={(e) => {
          if (e.target.files?.[0]) void importTrace(e.target.files[0]);
          e.target.value = "";
        }}
      />
      {error && (
        <div className="error-toast" role="alert">
          {error}
          <button aria-label="Dismiss error" onClick={() => setError("")}>
            <X size={16} />
          </button>
        </div>
      )}
      {about && (
        <div className="modal-backdrop" onClick={() => setAbout(false)}>
          <section
            ref={modal}
            className="about-modal"
            role="dialog"
            aria-modal="true"
            aria-labelledby="about-title"
            onClick={(e) => e.stopPropagation()}
          >
            <button
              className="modal-close icon-button"
              aria-label="Close about dialog"
              onClick={() => setAbout(false)}
            >
              <X size={20} />
            </button>
            <div className="eyebrow">
              THE JUDGMENT BETWEEN INSTRUCTION AND ACTION
            </div>
            <h2 id="about-title">
              From a lab instruction
              <br />
              to a physical action.
            </h2>
            <p>
              “Remove the wash without disturbing the pellet” leaves much
              unsaid: where the pellet is, what the camera can see, which
              approach fits, and when to stop.
            </p>
            <p>
              TACIT makes those decisions inspectable. It connects my experience
              isolating RNA at the bench and designing physical objects in 3D to
              a question in laboratory automation: what evidence makes an action
              executable?
            </p>
            <div className="about-rule" />
            <h3>What this model demonstrates</h3>
            <p>
              Geometric access, conserved liquid volume, image-derived
              observations, uncertainty-aware decisions, and reproducible
              comparisons. The highlighted pellet envelope is an explanation;
              camera evidence is generated separately.
            </p>
            <h3>Where its claims stop</h3>
            <p>
              This is a synthetic, quasistatic research workbench. Pellet
              adhesion, near-tip fluid dynamics, RNA yield, and physical fixture
              fit require laboratory validation. The model does not predict
              biological success.
            </p>
            <div className="about-links">
              <a href="/docs/methods.html" target="_blank" rel="noreferrer">
                Read the model dossier
                <ArrowUpRight size={15} />
              </a>
              <a
                href="https://www.transfyr.ai/news/ai-robotics"
                target="_blank"
                rel="noreferrer"
              >
                The execution-data connection
                <ArrowUpRight size={15} />
              </a>
            </div>
            <div className="about-signature">
              <span>Raaif Bokhari</span>
              <span className="mono">{MODEL_VERSION}</span>
            </div>
          </section>
        </div>
      )}
    </div>
  );
}
