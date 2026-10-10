import type { Analysis } from "../analysis/types";
export default function SourceChart({
  url,
  analysis,
  annotated,
}: {
  url: string;
  analysis: Analysis | null;
  annotated: boolean;
}) {
  return (
    <div className="source-image">
      <img
        src={url}
        alt="Uploaded source chart. Compare its axis, labels and bar heights with the reconstruction."
      />
      {analysis && annotated && (
        <svg
          className="annotations"
          viewBox={`0 0 ${analysis.width} ${analysis.height}`}
          aria-label="Detected bar boundaries and y-axis tick evidence"
        >
          {analysis.bars.map((bar, i) => (
            <rect
              key={i}
              x={bar.x - 3}
              y={bar.y - 3}
              width={bar.width + 6}
              height={bar.height + 6}
              rx="4"
              fill="none"
              stroke="#7862d0"
              strokeWidth="2.5"
              strokeDasharray="7 5"
            />
          ))}
          {analysis.calibration.ticks.map((tick, i) => (
            <rect
              key={`t${i}`}
              x={tick.box.x - 7}
              y={tick.box.y - 5}
              width={tick.box.width + 14}
              height={tick.box.height + 10}
              rx="4"
              fill="#ffb950"
              fillOpacity=".13"
              stroke="#cc8c32"
              strokeWidth="2"
            />
          ))}
          <line
            x1={Math.min(...analysis.bars.map((b) => b.x)) - 65}
            x2={Math.max(...analysis.bars.map((b) => b.x + b.width)) + 20}
            y1={Math.max(...analysis.bars.map((b) => b.y + b.height))}
            y2={Math.max(...analysis.bars.map((b) => b.y + b.height))}
            stroke="#c58a2d"
            strokeWidth="3"
            strokeDasharray="8 5"
          />
        </svg>
      )}
    </div>
  );
}
