import { ChevronDown, CircleCheck, Focus, Info } from "lucide-react";
import type { Analysis } from "../analysis/types";
import { formatValue } from "../analysis/types";
export default function Findings({ analysis }: { analysis: Analysis | null }) {
  return (
    <section id="findings" className="findings-section">
      <div className="section-title">
        <div>
          <span className="eyebrow">READ THE REASONING</span>
          <h2>What the image tells us</h2>
        </div>
        {analysis && (
          <span className="tag neutral">
            {analysis.calibration.ticks.length} axis ticks ·{" "}
            {analysis.bars.length} bars
          </span>
        )}
      </div>
      {!analysis ? (
        <div className="manual-note">
          <Info size={20} />
          <h3>Reconstruction from your values</h3>
          <p>
            These values were entered manually. No automated finding, extraction
            confidence or source-data verification is available.
          </p>
        </div>
      ) : (
        analysis.findings.map((finding) => (
          <article key={finding.id} className={`finding ${finding.level}`}>
            <span className="finding-icon">
              {finding.level === "good" ? (
                <CircleCheck size={18} />
              ) : finding.level === "caution" ? (
                <Focus size={18} />
              ) : (
                <Info size={18} />
              )}
            </span>
            <div>
              <div className="finding-heading">
                <h3>{finding.title}</h3>
                <span>
                  {finding.level === "caution"
                    ? "REVIEW"
                    : finding.level === "good"
                      ? "SUPPORTED"
                      : "NOTE"}
                </span>
              </div>
              <p>{finding.detail}</p>
            </div>
          </article>
        ))
      )}
      {analysis && (
        <details className="technical-evidence">
          <summary>
            View extraction diagnostics <ChevronDown size={14} />
          </summary>
          <dl>
            <div>
              <dt>OCR tick labels</dt>
              <dd>
                {analysis.calibration.ticks.map((t) => t.text).join(" · ")}
              </dd>
            </div>
            <div>
              <dt>Linear scale fit</dt>
              <dd>R² = {analysis.calibration.r2.toFixed(5)}</dd>
            </div>
            <div>
              <dt>Geometry uncertainty</dt>
              <dd>± {formatValue(analysis.calibration.uncertainty)} units</dd>
            </div>
            <div>
              <dt>OCR tick certainty (engine)</dt>
              <dd>
                {Math.round(
                  Math.min(
                    ...analysis.calibration.ticks.map((t) => t.confidence),
                  ),
                )}
                –
                {Math.round(
                  Math.max(
                    ...analysis.calibration.ticks.map((t) => t.confidence),
                  ),
                )}{" "}
                / 100
              </dd>
            </div>
          </dl>
          <p>
            Uncertainty = max(2 pixels × scale, 2 × RMS tick residual). It does
            not cover every OCR or model error. Findings stay tied to the
            original image when you edit values.
          </p>
        </details>
      )}
    </section>
  );
}
