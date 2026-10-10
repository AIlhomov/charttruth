import { useEffect, useRef } from "react";
import { ArrowRight, Info, X } from "lucide-react";
export default function Methodology({ close }: { close: () => void }) {
  const ref = useRef<HTMLDialogElement>(null);
  useEffect(() => {
    ref.current?.showModal();
  }, []);
  return (
    <dialog
      ref={ref}
      aria-labelledby="method-title"
      className="method-dialog"
      onCancel={close}
      onClick={(e) => {
        if (e.target === e.currentTarget) close();
      }}
    >
      <button
        className="icon-button dialog-close"
        aria-label="Close methodology"
        onClick={close}
      >
        <X size={20} />
      </button>
      <span className="eyebrow">BEHIND THE PICTURE</span>
      <h2 id="method-title">
        Inspect. Understand.
        <br />
        Make your own call.
      </h2>
      <p>
        ChartTruth checks visible design choices. It cannot establish whether
        the underlying data is true or whether the author intended to mislead.
      </p>
      <ol className="method-steps">
        <li>
          <span>01</span>
          <div>
            <h3>Measure the image</h3>
            <p>
              A browser worker finds solid rectangular bars and a common
              baseline using connected components and fill geometry.
            </p>
          </div>
        </li>
        <li>
          <span>02</span>
          <div>
            <h3>Read, then cross-check</h3>
            <p>
              Tesseract.js reads English labels and numbers locally. At least
              three y-axis ticks must fit a linear scale (R² ≥ 0.995). Printed
              values are compared with measured heights.
            </p>
          </div>
        </li>
        <li>
          <span>03</span>
          <div>
            <h3>Put the evidence in your hands</h3>
            <p>
              Inspect detected regions, correct values and confirm your review.
              Zero is the default baseline for quantitative bars; a specialist
              context may justify a different presentation.
            </p>
          </div>
        </li>
      </ol>
      <div className="scope-note">
        <Info size={18} />
        <p>
          Automatic scope: 2–16 nonnegative, solid vertical bars, one series, a
          light background, readable English text and a linear y-axis. Stacked,
          grouped, 3D, logarithmic and pie/line charts are unsupported. OCR
          scores and geometric error are diagnostics, not calibrated
          probabilities.
        </p>
      </div>
      <button className="button primary" onClick={close}>
        Back to the workspace <ArrowRight size={16} />
      </button>
    </dialog>
  );
}
