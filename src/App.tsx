import { useEffect, useRef, useState } from "react";
import {
  ArrowDownToLine,
  ArrowRight,
  ArrowUpRight,
  ChartNoAxesColumnIncreasing,
  Check,
  CheckCheck,
  ChevronDown,
  ChevronRight,
  CircleCheck,
  CircleHelp,
  Code2,
  FileImage,
  Fingerprint,
  Focus,
  Info,
  Layers2,
  LoaderCircle,
  LockKeyhole,
  Maximize2,
  PencilLine,
  Plus,
  RotateCcw,
  ScanLine,
  ShieldCheck,
  Upload,
  X,
} from "lucide-react";
import Logo from "./components/Logo";
import Methodology from "./components/Methodology";
import Findings from "./components/Findings";
import Samples from "./components/Samples";
import SourceChart from "./components/SourceChart";
import { analyze, loadImage } from "./analysis/pipeline";
import { validateData } from "./analysis/calibration";
import type { Analysis, Datum, Progress } from "./analysis/types";
import { formatValue } from "./analysis/types";
import { chartSvg, download, exportChart } from "./charts/render";
import { sampleFile } from "./samples";
import type { Sample } from "./samples";

type Row = { id: string; label: string; value: string };
export default function App() {
  const [analysis, setAnalysis] = useState<Analysis | null>(null);
  const [source, setSource] = useState("");
  const [filename, setFilename] = useState("");
  const [sampleId, setSampleId] = useState("");
  const [rows, setRows] = useState<Row[]>([]);
  const [reviewed, setReviewed] = useState(false);
  const [manual, setManual] = useState(false);
  const [progress, setProgress] = useState<Progress | null>(null);
  const [error, setError] = useState("");
  const [annotated, setAnnotated] = useState(true);
  const [methodology, setMethodology] = useState(false);
  const [dragging, setDragging] = useState(false);
  const [exportMenu, setExportMenu] = useState(false);
  const [exporting, setExporting] = useState(false);
  const [notice, setNotice] = useState("");
  const [zoom, setZoom] = useState(false);
  const [title, setTitle] = useState("Reconstructed chart");
  const [unit, setUnit] = useState("");
  const [context, setContext] = useState("");
  const input = useRef<HTMLInputElement>(null);
  const abort = useRef<AbortController | null>(null);
  const sourceRef = useRef("");
  const requestId = useRef(0);
  const samplesRef = useRef<HTMLElement>(null);
  const tableRef = useRef<HTMLElement>(null);
  const menuRef = useRef<HTMLDivElement>(null);
  const zoomRef = useRef<HTMLDialogElement>(null);
  const busy = progress !== null;
  const hasWorkspace = !!source || manual;
  const validation = rows.length ? validateData(rows) : null;
  const data: Datum[] = rows.map((r, i) => ({
    ...(analysis?.data[i] ?? {
      geometryValue: Number(r.value),
      uncertainty: 0,
      source: "manual" as const,
    }),
    id: r.id,
    label: r.label,
    value: Number(r.value),
    source:
      manual || r.value !== String(analysis?.data[i]?.value)
        ? "manual"
        : (analysis?.data[i]?.source ?? "manual"),
  }));
  const validData = data.length >= 2 && !validation;
  const svg = validData ? chartSvg(data, title, unit, reviewed, context) : "";
  const cautionCount =
    analysis?.findings.filter((f) => f.level === "caution").length ?? 0;
  const hasEstimates =
    analysis?.data.some((d) => d.printedValue === undefined) ?? false;

  useEffect(
    () => () => {
      abort.current?.abort();
      if (sourceRef.current) URL.revokeObjectURL(sourceRef.current);
    },
    [],
  );
  useEffect(() => {
    if (!notice) return;
    const timer = setTimeout(() => setNotice(""), 5000);
    return () => clearTimeout(timer);
  }, [notice]);
  useEffect(() => {
    if (!exportMenu) return;
    const outside = (event: PointerEvent) => {
      if (!menuRef.current?.contains(event.target as Node))
        setExportMenu(false);
    };
    const escape = (event: KeyboardEvent) => {
      if (event.key === "Escape") setExportMenu(false);
    };
    document.addEventListener("pointerdown", outside);
    document.addEventListener("keydown", escape);
    return () => {
      document.removeEventListener("pointerdown", outside);
      document.removeEventListener("keydown", escape);
    };
  }, [exportMenu]);
  useEffect(() => {
    if (zoom) zoomRef.current?.showModal();
  }, [zoom]);
  useEffect(() => {
    const paste = (event: ClipboardEvent) => {
      if (
        ["INPUT", "TEXTAREA"].includes((event.target as HTMLElement)?.tagName)
      )
        return;
      const image = Array.from(event.clipboardData?.files ?? []).find((f) =>
        f.type.startsWith("image/"),
      );
      if (image && !busy) {
        event.preventDefault();
        void start(image);
      }
    };
    document.addEventListener("paste", paste);
    return () => document.removeEventListener("paste", paste);
  });

  async function start(file: File, sample = "") {
    abort.current?.abort();
    const controller = new AbortController();
    abort.current = controller;
    const id = ++requestId.current;
    setError("");
    setNotice("");
    window.scrollTo({ top: 0, behavior: "smooth" });
    setAnalysis(null);
    setRows([]);
    setReviewed(false);
    setManual(false);
    setExportMenu(false);
    setContext("");
    setSampleId(sample);
    setFilename(file.name);
    setProgress({ stage: "geometry", detail: "Opening your image…" });
    if (sourceRef.current) URL.revokeObjectURL(sourceRef.current);
    sourceRef.current = "";
    setSource("");
    try {
      const { canvas, url } = await loadImage(file);
      if (controller.signal.aborted) {
        URL.revokeObjectURL(url);
        return;
      }
      sourceRef.current = url;
      setSource(url);
      const result = await analyze(
        canvas,
        (p) => {
          if (id === requestId.current) setProgress(p);
        },
        controller.signal,
      );
      if (id !== requestId.current) return;
      setAnalysis(result);
      setTitle(result.title);
      setUnit(result.unit);
      setRows(
        result.data.map((d) => ({
          id: d.id,
          label: d.label,
          value: String(d.value),
        })),
      );
    } catch (e) {
      if (!controller.signal.aborted && id === requestId.current)
        setError(
          e instanceof Error
            ? e.message
            : "Analysis could not be completed. Try a clearer image or enter values manually.",
        );
    } finally {
      if (id === requestId.current) setProgress(null);
    }
  }
  async function chooseSample(sample: Sample) {
    try {
      const file = await sampleFile(sample);
      await start(file, sample.id);
    } catch {
      setError("The sample could not be opened. Please try again.");
    }
  }
  function reset() {
    abort.current?.abort();
    requestId.current++;
    setProgress(null);
    setNotice("");
    setAnalysis(null);
    setError("");
    setRows([]);
    setReviewed(false);
    setManual(false);
    setSource("");
    setSampleId("");
    if (sourceRef.current) URL.revokeObjectURL(sourceRef.current);
    sourceRef.current = "";
  }
  function enterManually() {
    setManual(true);
    setError("");
    setAnalysis(null);
    setTitle("Manually reconstructed chart");
    setUnit("");
    setContext("");
    setReviewed(false);
    setRows([
      { id: "manual-0", label: "Category A", value: "" },
      { id: "manual-1", label: "Category B", value: "" },
    ]);
  }
  function update(index: number, field: "label" | "value", value: string) {
    setReviewed(false);
    setRows((previous) =>
      previous.map((r, i) => (i === index ? { ...r, [field]: value } : r)),
    );
  }
  async function doExport(format: "svg" | "png" | "json") {
    if (!reviewed || !validData) return;
    setExporting(true);
    setExportMenu(false);
    try {
      if (format === "json")
        download(
          new Blob(
            [
              JSON.stringify(
                {
                  schemaVersion: 1,
                  title,
                  unit,
                  context,
                  mode: manual ? "manual" : "automatic",
                  reviewedByUser: true,
                  independentlyVerified: false,
                  baseline: 0,
                  data: data.map((row) =>
                    row.source === "manual"
                      ? {
                          id: row.id,
                          label: row.label,
                          value: row.value,
                          source: "manual",
                        }
                      : row,
                  ),
                  evidence: analysis
                    ? {
                        originalData: analysis.data,
                        ocrWords: analysis.words,
                        ticks: analysis.calibration.ticks,
                        calibration: analysis.calibration,
                        findings: analysis.findings,
                        imageSize: {
                          width: analysis.width,
                          height: analysis.height,
                        },
                      }
                    : null,
                },
                null,
                2,
              ),
            ],
            { type: "application/json" },
          ),
          "charttruth-evidence.json",
        );
      else await exportChart(svg, format);
      setNotice(
        `${format.toUpperCase()} exported with user-review provenance.`,
      );
    } catch {
      setError("The export could not be created. Please retry, or choose SVG.");
    } finally {
      setExporting(false);
    }
  }
  const stageIndex =
    progress?.stage === "geometry" ? 0 : progress?.stage === "ocr" ? 1 : 2;

  return (
    <div className="app-shell">
      <a className="skip-link" href="#main">
        Skip to workspace
      </a>
      <header className="app-header">
        <button
          className="brand-button"
          aria-label="ChartTruth home"
          onClick={reset}
        >
          <Logo />
        </button>
        <span className="header-divider" />
        <span className="workspace-label">The chart clarity workspace</span>
        <div className="header-actions">
          <span className="privacy-badge">
            <span />
            Runs on your device
          </span>
          <button className="text-button" onClick={() => setMethodology(true)}>
            <CircleHelp size={16} />
            How it works
          </button>
          <span className="header-divider" />
          <span className="edition">
            BANANA HACKS <b>2026</b>
          </span>
        </div>
      </header>
      <div className="workspace-shell">
        <aside className="sidebar">
          <div>
            <span className="nav-label">WORKSPACE</span>
            <button
              className="nav-button active"
              onClick={() =>
                document
                  .getElementById("main")
                  ?.scrollIntoView({ behavior: "smooth" })
              }
            >
              <ScanLine size={19} />
              Analyze a chart
              <span className="active-dot" />
            </button>
            <button
              className="nav-button"
              onClick={() =>
                samplesRef.current?.scrollIntoView({
                  behavior: "smooth",
                  block: "center",
                })
              }
            >
              <Layers2 size={18} />
              Sample gallery<span className="nav-count">3</span>
            </button>
            <button className="nav-button" onClick={() => setMethodology(true)}>
              <Fingerprint size={18} />
              Our methodology
              <ArrowUpRight size={14} className="nav-arrow" />
            </button>
          </div>
          <div className="sidebar-bottom">
            <div className="sidebar-note">
              <div className="mini-mark">
                <ShieldCheck size={22} />
              </div>
              <h3>
                A little more
                <br />
                critical thinking.
              </h3>
              <p>
                For the charts you share.
                <br />
                And the ones you believe.
              </p>
            </div>
            <div className="local-foot">
              <LockKeyhole size={13} />
              <span>Private by design</span>
            </div>
            <span className="version">ChartTruth / v1.0 beta</span>
          </div>
        </aside>
        <main
          id="main"
          className={`main-content ${hasWorkspace ? "has-analysis" : ""}`}
        >
          <div className="breadcrumb">
            Workspace <ChevronRight size={12} /> <span>Chart analysis</span>
          </div>
          <div className="page-heading">
            <div>
              <div className="eyebrow">
                <span className="tiny-line" /> A FRESH PERSPECTIVE ON DATA
              </div>
              <h1>
                {hasWorkspace
                  ? "Look beyond the bars"
                  : "See the whole picture"}
                <span className="heading-dot">.</span>
              </h1>
              <p>
                {hasWorkspace
                  ? "Compare the picture with the numbers. The evidence is yours to inspect."
                  : "A chart can tell a story. Make sure it’s telling the right one."}
              </p>
            </div>
            {hasWorkspace && (
              <button
                className="button secondary change-button"
                onClick={() => input.current?.click()}
                disabled={busy}
              >
                <Upload size={15} />
                Change image
              </button>
            )}
          </div>
          <input
            ref={input}
            className="file-input"
            type="file"
            accept="image/png,image/jpeg,image/webp"
            aria-label="Upload chart image"
            onChange={(e) => {
              const file = e.target.files?.[0];
              if (file) void start(file);
              e.target.value = "";
            }}
          />

          {!hasWorkspace && !busy && (
            <section className="start-panel" aria-label="Upload a chart">
              <div
                className={`dropzone ${dragging ? "dragging" : ""}`}
                onDragOver={(e) => {
                  e.preventDefault();
                  setDragging(true);
                }}
                onDragLeave={() => setDragging(false)}
                onDrop={(e) => {
                  e.preventDefault();
                  setDragging(false);
                  const file = e.dataTransfer.files[0];
                  if (file) void start(file);
                }}
              >
                <div className="upload-art" aria-hidden="true">
                  <div className="art-page">
                    <div />
                    <div />
                    <span>
                      <i />
                      <i />
                      <i />
                    </span>
                  </div>
                  <span className="art-plus">
                    <Plus size={19} />
                  </span>
                  <span className="art-scan s1" />
                  <span className="art-scan s2" />
                </div>
                <h2>Your chart. A clearer perspective.</h2>
                <p>Drop a bar chart here, or choose an image to get started.</p>
                <button
                  className="button primary upload-button"
                  onClick={() => input.current?.click()}
                >
                  <Upload size={17} />
                  Upload a chart
                  <ArrowRight size={17} />
                </button>
                <span className="file-hint">
                  PNG, JPG or WebP · Up to 10 MB <span>·</span> Or paste an
                  image
                </span>
              </div>
              <div className="start-guide">
                <span className="eyebrow">FROM PICTURE TO PERSPECTIVE</span>
                <h2>
                  Same numbers.
                  <br />
                  More honest context.
                </h2>
                <ol>
                  <li>
                    <span>01</span>
                    <div>
                      <h3>Bring a chart</h3>
                      <p>
                        A screenshot, a report, a claim worth a closer look.
                      </p>
                    </div>
                  </li>
                  <li>
                    <span>02</span>
                    <div>
                      <h3>Follow the evidence</h3>
                      <p>
                        See the detected bars, axis ticks and potential
                        distortions.
                      </p>
                    </div>
                  </li>
                  <li>
                    <span>03</span>
                    <div>
                      <h3>Make it clearer</h3>
                      <p>
                        Review the values. Rebuild the chart. Share with
                        confidence.
                      </p>
                    </div>
                  </li>
                </ol>
                <div className="supported-note">
                  <ChartNoAxesColumnIncreasing size={17} />
                  <p>
                    Built for single-series vertical bar charts.
                    <br />
                    <button onClick={() => setMethodology(true)}>
                      See supported formats <ArrowUpRight size={12} />
                    </button>
                  </p>
                </div>
              </div>
            </section>
          )}

          {error && (
            <section className="error-panel" role="alert">
              <Info size={22} />
              <div>
                <h2>
                  {analysis
                    ? "Something needs attention"
                    : "Let’s take a closer look"}
                </h2>
                <p>{error}</p>
                <div className="error-actions">
                  <button
                    className="button secondary"
                    onClick={() => input.current?.click()}
                  >
                    Try another image
                  </button>
                  {!analysis && (
                    <button className="text-button" onClick={enterManually}>
                      Enter values manually <ArrowRight size={15} />
                    </button>
                  )}
                </div>
              </div>
            </section>
          )}

          {busy && (
            <section className="loading-panel" role="status" aria-live="polite">
              <div className="loading-icon">
                <ScanLine size={29} />
              </div>
              <div>
                <span className="eyebrow">LOOKING CLOSER</span>
                <h2>
                  {progress.stage === "geometry"
                    ? "Finding the structure."
                    : progress.stage === "ocr"
                      ? "Reading between the lines."
                      : "Connecting the evidence."}
                </h2>
                <p>{progress.detail}</p>
                <div className="progress-stages">
                  {["Image geometry", "Text recognition", "Evidence check"].map(
                    (label, i) => (
                      <span
                        key={label}
                        className={i <= stageIndex ? "current" : ""}
                      >
                        {i < stageIndex ? (
                          <Check size={13} />
                        ) : i === stageIndex ? (
                          <LoaderCircle className="spin" size={13} />
                        ) : (
                          <span className="stage-number">{i + 1}</span>
                        )}
                        {label}
                      </span>
                    ),
                  )}
                </div>
                {progress.fraction !== undefined && (
                  <progress
                    value={progress.fraction}
                    max="1"
                    aria-label="OCR progress"
                  />
                )}
              </div>
              <button
                className="text-button cancel-button"
                onClick={() => {
                  abort.current?.abort();
                  requestId.current++;
                  setProgress(null);
                  setError(
                    "Analysis cancelled. You can try another image or enter values manually.",
                  );
                }}
              >
                Cancel
              </button>
            </section>
          )}

          {hasWorkspace && !busy && (
            <>
              <div className="analysis-toolbar">
                <div className="file-meta">
                  <FileImage size={15} />
                  <span>{filename || "Manual entry"}</span>
                  {sampleId && (
                    <span className="tag neutral">Synthetic example</span>
                  )}
                </div>
                <div className="toolbar-right">
                  {analysis && (
                    <span className="analysis-time">
                      <Check size={13} />
                      {(analysis.elapsed / 1000).toFixed(1)}s · analyzed locally
                    </span>
                  )}
                  <button
                    className="icon-button"
                    aria-label="Start over"
                    title="Start over"
                    onClick={reset}
                  >
                    <RotateCcw size={16} />
                  </button>
                </div>
              </div>
              <section
                className="comparison"
                aria-label="Original versus corrected chart"
              >
                <article className="chart-panel original-panel">
                  <div className="panel-header">
                    <div>
                      <span className="panel-number">01</span>
                      <h2>Original chart</h2>
                      <span className="tag neutral">Source</span>
                    </div>
                    <div>
                      {analysis && (
                        <button
                          className={`evidence-toggle ${annotated ? "selected" : ""}`}
                          aria-pressed={annotated}
                          onClick={() => setAnnotated((v) => !v)}
                        >
                          <Focus size={14} />
                          <span>Evidence</span>
                        </button>
                      )}
                      {source && (
                        <button
                          className="icon-button"
                          aria-label="Enlarge original chart"
                          onClick={() => setZoom(true)}
                        >
                          <Maximize2 size={15} />
                        </button>
                      )}
                    </div>
                  </div>
                  <div className="chart-canvas">
                    {source ? (
                      <SourceChart
                        url={source}
                        analysis={analysis}
                        annotated={annotated}
                      />
                    ) : (
                      <div className="chart-placeholder">
                        <FileImage size={35} />
                        <p>Manual entry has no source image</p>
                      </div>
                    )}
                  </div>
                  <div className="chart-caption">
                    <span
                      className={`status-dot ${cautionCount ? "amber" : "gray"}`}
                    />
                    {analysis
                      ? cautionCount
                        ? `${cautionCount} visual decision${cautionCount > 1 ? "s" : ""} worth reviewing`
                        : "No issue found in the checks performed"
                      : "Image retained for your reference"}
                    {analysis && annotated && (
                      <span className="caption-legend">
                        Dashed = detected bars
                      </span>
                    )}
                  </div>
                </article>
                <div className="compare-arrow" aria-hidden="true">
                  <ArrowRight size={19} />
                </div>
                <article className="chart-panel corrected-panel">
                  <div className="panel-header">
                    <div>
                      <span className="panel-number purple">02</span>
                      <h2>Corrected chart</h2>
                      <span className={`tag ${reviewed ? "green" : "violet"}`}>
                        {reviewed ? "Reviewed" : "Draft"}
                      </span>
                    </div>
                    <button
                      className="icon-button"
                      aria-label="Edit extracted values"
                      title="Edit extracted values"
                      onClick={() =>
                        tableRef.current?.scrollIntoView({
                          behavior: "smooth",
                          block: "center",
                        })
                      }
                    >
                      <PencilLine size={16} />
                    </button>
                  </div>
                  <div className="chart-canvas">
                    {svg ? (
                      <div
                        className="reconstructed-svg"
                        data-testid="corrected-chart"
                        dangerouslySetInnerHTML={{ __html: svg }}
                      />
                    ) : (
                      <div className="chart-placeholder">
                        <ChartNoAxesColumnIncreasing size={39} />
                        <h3>
                          {manual
                            ? "Your values, visualized."
                            : "A clearer view starts with good data."}
                        </h3>
                        <p>
                          {manual
                            ? "Enter at least two valid values below."
                            : "We’ll reconstruct the chart when the image supports it."}
                        </p>
                      </div>
                    )}
                  </div>
                  <div className="chart-caption">
                    <span className="status-dot green-dot" />
                    {svg
                      ? "Zero baseline · consistent scale · equal bar widths"
                      : "Reviewable values required"}
                  </div>
                </article>
              </section>

              {analysis && (
                <div
                  className={`insight-strip ${cautionCount ? "" : "positive"}`}
                >
                  <div className="insight-symbol">
                    {cautionCount ? (
                      <Focus size={20} />
                    ) : (
                      <ShieldCheck size={20} />
                    )}
                  </div>
                  <div>
                    <h3>
                      {cautionCount
                        ? "A different scale can tell a different story."
                        : hasEstimates
                          ? "The baseline is supported. Some values need review."
                          : "The visible evidence supports this comparison."}
                    </h3>
                    <p>
                      {analysis.calibration.baseline >
                      analysis.calibration.uncertainty ? (
                        <>
                          The original starts at{" "}
                          <strong>
                            {formatValue(analysis.calibration.baseline)}
                          </strong>
                          . The reconstruction restores the missing context with
                          a zero baseline.
                        </>
                      ) : cautionCount ? (
                        "The reconstruction uses readable printed values. Check the height discrepancies and verify the labels below."
                      ) : hasEstimates ? (
                        "A zero baseline is supported. Some values come from bar heights, so their proportions have not been independently checked. Review the source and table."
                      ) : (
                        "A zero baseline and consistent proportions were supported. This does not verify the source data."
                      )}
                    </p>
                  </div>
                  <button
                    className="text-button"
                    onClick={() =>
                      document.getElementById("findings")?.scrollIntoView({
                        behavior: "smooth",
                        block: "center",
                      })
                    }
                  >
                    Inspect evidence <ArrowRight size={15} />
                  </button>
                </div>
              )}

              {(analysis || manual) && (
                <div className="details-grid">
                  <Findings analysis={analysis} />
                  <section
                    ref={tableRef}
                    className="data-section"
                    aria-label="Extracted data editor"
                  >
                    <div className="section-title">
                      <div>
                        <span className="eyebrow">YOU HAVE THE FINAL SAY</span>
                        <h2>
                          {manual
                            ? "Enter your data"
                            : "Verify the extracted data"}
                        </h2>
                      </div>
                      <PencilLine size={17} />
                    </div>
                    <p className="section-intro">
                      {manual
                        ? "Use values from your source. This is a manual reconstruction."
                        : "Compare each value with the source. Click a cell to make a correction."}
                    </p>
                    <div className="table-scroll">
                      <table>
                        <thead>
                          <tr>
                            <th scope="col">Category</th>
                            <th scope="col">Value</th>
                            <th scope="col">Source / certainty</th>
                          </tr>
                        </thead>
                        <tbody>
                          {rows.map((row, i) => (
                            <tr key={row.id}>
                              <td>
                                <input
                                  aria-label={`Category ${i + 1}`}
                                  value={row.label}
                                  maxLength={48}
                                  onChange={(e) =>
                                    update(i, "label", e.target.value)
                                  }
                                />
                              </td>
                              <td>
                                <input
                                  aria-label={`Value ${i + 1}`}
                                  type="number"
                                  min="0"
                                  max="1000000000000"
                                  step="any"
                                  value={row.value}
                                  onChange={(e) =>
                                    update(i, "value", e.target.value)
                                  }
                                />
                              </td>
                              <td>
                                {data[i].source === "manual" ? (
                                  <span className="certainty manual">
                                    <PencilLine size={11} />
                                    Manual
                                  </span>
                                ) : data[i].source === "printed" ? (
                                  <span
                                    className={`certainty ${data[i].valueConfidence! < 80 ? "low" : ""}`}
                                  >
                                    <span />
                                    {Math.round(data[i].valueConfidence!)} / 100
                                    OCR
                                  </span>
                                ) : (
                                  <span className="certainty estimate">
                                    ± {formatValue(data[i].uncertainty)}
                                  </span>
                                )}
                              </td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                    {manual && rows.length < 16 && (
                      <button
                        className="text-button add-row"
                        onClick={() => {
                          setReviewed(false);
                          setRows((r) => [
                            ...r,
                            {
                              id: `manual-${Date.now()}`,
                              label: `Category ${r.length + 1}`,
                              value: "",
                            },
                          ]);
                        }}
                      >
                        <Plus size={14} />
                        Add category
                      </button>
                    )}
                    <details className="chart-settings">
                      <summary>
                        Chart title, units & context <ChevronDown size={14} />
                      </summary>
                      <label>
                        Chart title
                        <input
                          value={title}
                          maxLength={62}
                          onChange={(e) => {
                            setTitle(e.target.value);
                            setReviewed(false);
                          }}
                        />
                      </label>
                      <label>
                        Unit symbol
                        <select
                          value={unit}
                          onChange={(e) => {
                            setUnit(e.target.value);
                            setReviewed(false);
                          }}
                        >
                          <option value="">Source units (not inferred)</option>
                          <option value="%">Percent (%)</option>
                          <option value="$">Dollar ($)</option>
                          <option value="€">Euro (€)</option>
                          <option value="£">Pound (£)</option>
                        </select>
                      </label>
                      <label>
                        Context or baseline exception
                        <textarea
                          value={context}
                          maxLength={95}
                          placeholder="Optional: explain the source or specialist context"
                          onChange={(e) => {
                            setContext(e.target.value);
                            setReviewed(false);
                          }}
                        />
                      </label>
                      <p>
                        Zero is retained for this bar reconstruction. Use
                        context to explain an intentional nonzero source
                        baseline, or choose a dot/line chart in your publishing
                        tool.
                      </p>
                    </details>
                    {validation && (
                      <p className="validation-error" role="alert">
                        {validation}
                      </p>
                    )}
                    <div
                      className={`review-action ${reviewed ? "is-reviewed" : ""}`}
                    >
                      <span>
                        {reviewed ? (
                          <CheckCheck size={18} />
                        ) : (
                          <Info size={17} />
                        )}
                      </span>
                      <p>
                        {reviewed
                          ? "Values reviewed by you."
                          : "An extraction is a starting point. Review before sharing."}
                      </p>
                      <button
                        className={`button ${reviewed ? "secondary" : "primary"}`}
                        disabled={!validData || reviewed}
                        onClick={() => {
                          setReviewed(true);
                          setNotice(
                            "Values marked as reviewed by you. Export is ready.",
                          );
                        }}
                      >
                        {reviewed ? "Reviewed" : "Confirm values"}
                        <Check size={14} />
                      </button>
                    </div>
                  </section>
                </div>
              )}
              {(analysis || manual) && (
                <div className="export-bar">
                  <div>
                    <div className="export-mark">
                      <ChartNoAxesColumnIncreasing size={20} />
                    </div>
                    <span>
                      <strong>
                        {reviewed
                          ? "Ready for a clearer conversation."
                          : "One last look before you share."}
                      </strong>
                      <small>
                        {reviewed
                          ? "Export a clean chart or the evidence behind it."
                          : "Confirm the extracted values to unlock export."}
                      </small>
                    </span>
                  </div>
                  <div className="export-controls" ref={menuRef}>
                    <button className="button secondary" onClick={reset}>
                      New analysis
                    </button>
                    <button
                      className="button primary export-button"
                      disabled={!reviewed || !validData || exporting}
                      aria-expanded={exportMenu}
                      onClick={() => setExportMenu((v) => !v)}
                    >
                      {exporting ? (
                        <LoaderCircle className="spin" size={16} />
                      ) : (
                        <ArrowDownToLine size={16} />
                      )}
                      Export chart
                      <ChevronDown size={14} />
                    </button>
                    {exportMenu && (
                      <div className="export-menu">
                        <button onClick={() => void doExport("png")}>
                          <FileImage size={16} />
                          <span>
                            PNG image<small>2000 × 1260 · ready to share</small>
                          </span>
                        </button>
                        <button onClick={() => void doExport("svg")}>
                          <Code2 size={16} />
                          <span>
                            SVG vector
                            <small>Editable · accessible description</small>
                          </span>
                        </button>
                        <button onClick={() => void doExport("json")}>
                          <Fingerprint size={16} />
                          <span>
                            Evidence report
                            <small>JSON · values, ticks & provenance</small>
                          </span>
                        </button>
                      </div>
                    )}
                  </div>
                </div>
              )}
            </>
          )}

          <section
            ref={samplesRef}
            className="samples-section"
            aria-label="Synthetic sample gallery"
          >
            <Samples
              active={sampleId}
              busy={busy}
              hasWorkspace={hasWorkspace}
              onSelect={(sample) => void chooseSample(sample)}
            />
          </section>
          {!hasWorkspace && (
            <div className="principles">
              <div>
                <LockKeyhole size={18} />
                <span>
                  <strong>Your image stays yours.</strong>
                  <small>Local processing. No uploads to a server.</small>
                </span>
              </div>
              <div>
                <Fingerprint size={19} />
                <span>
                  <strong>Evidence over assumptions.</strong>
                  <small>Every finding has a measurable reason.</small>
                </span>
              </div>
              <div>
                <PencilLine size={18} />
                <span>
                  <strong>You’re in control.</strong>
                  <small>Review, edit and export your values.</small>
                </span>
              </div>
            </div>
          )}
          <footer className="page-footer">
            <span>
              Built for curious minds. Designed for clearer conversations.
            </span>
            <button onClick={() => setMethodology(true)}>
              Evidence, not a verdict <ArrowUpRight size={12} />
            </button>
          </footer>
        </main>
      </div>
      {notice && (
        <div className="toast" role="status">
          <CircleCheck size={17} />
          {notice}
          <button
            aria-label="Dismiss notification"
            onClick={() => setNotice("")}
          >
            <X size={15} />
          </button>
        </div>
      )}
      {methodology && <Methodology close={() => setMethodology(false)} />}
      {zoom && (
        <dialog
          ref={zoomRef}
          aria-label="Enlarged source chart"
          className="zoom-dialog"
          onCancel={() => setZoom(false)}
          onClick={(e) => {
            if (e.target === e.currentTarget) setZoom(false);
          }}
        >
          <div className="zoom-heading">
            <h2>Original chart · image evidence</h2>
            <button
              className="icon-button"
              aria-label="Close enlarged image"
              onClick={() => setZoom(false)}
            >
              <X size={20} />
            </button>
          </div>
          <SourceChart url={source} analysis={analysis} annotated={annotated} />
        </dialog>
      )}
    </div>
  );
}
