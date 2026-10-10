import { ArrowUpRight, Sparkles } from "lucide-react";
import { sampleImage, samples } from "../samples";
import type { Sample } from "../samples";
export default function Samples({
  active,
  busy,
  hasWorkspace,
  onSelect,
}: {
  active: string;
  busy: boolean;
  hasWorkspace: boolean;
  onSelect: (sample: Sample) => void;
}) {
  return (
    <>
      <div className="samples-heading">
        <div>
          <h2>
            {hasWorkspace
              ? "Take another look."
              : "A few charts worth a closer look."}
          </h2>
          <p>Three synthetic examples. The same real analysis pipeline.</p>
        </div>
        <span className="gallery-label">
          <Sparkles size={13} />
          TRY A SAMPLE
        </span>
      </div>
      <div className="sample-grid">
        {samples.map((sample, i) => (
          <button
            key={sample.id}
            className={`sample-card ${active === sample.id ? "is-selected" : ""}`}
            disabled={busy}
            onClick={() => onSelect(sample)}
            aria-label={`Analyze ${sample.name}`}
          >
            <div
              className="sample-thumbnail"
              style={{ background: sample.tint }}
            >
              <span className="sample-number">0{i + 1}</span>
              <img
                src={sampleImage(sample)}
                alt={`${sample.title} — synthetic ${sample.scenario.toLowerCase()} example`}
              />
              <span className="sample-open">
                <ArrowUpRight size={16} />
              </span>
            </div>
            <div className="sample-info">
              <div>
                <h3>{sample.name}</h3>
                <p>{sample.subtitle}</p>
              </div>
              <span className={`scenario scenario-${sample.id}`}>
                {sample.scenario}
              </span>
            </div>
          </button>
        ))}
      </div>
    </>
  );
}
