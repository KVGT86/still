import { useEffect, useState } from "react";
// Real progress is unknown while peers are found, so ease toward `ceil`; `floor` marks confirmed steps.
function useProgress(floor: number, ceil: number, done: boolean) {
  const [p, setP] = useState(floor);
  useEffect(() => {
    if (done) return setP(1);
    setP((c) => Math.max(c, floor));
    const timer = setInterval(() => setP((c) => c + (ceil - c) * 0.04), 250);
    return () => clearInterval(timer);
  }, [floor, ceil, done]);
  return p;
}
export function LoadScreen({
  art,
  title,
  label,
  floor,
  ceil,
  done = false,
  inPlayer = false,
  onCancel,
  onDone,
}: {
  art?: string;
  title: string;
  label: string;
  floor: number;
  ceil: number;
  done?: boolean;
  inPlayer?: boolean;
  onCancel?: () => void;
  onDone?: () => void;
}) {
  const p = useProgress(floor, ceil, done);
  useEffect(() => {
    if (!done) return;
    const timer = setTimeout(() => onDone?.(), 900);
    return () => clearTimeout(timer);
  }, [done]);
  return (
    <div
      className={`load-screen${inPlayer ? " in-player" : ""}${done ? " done" : ""}`}
      role="dialog"
      aria-label="Preparing playback"
    >
      {art && (
        <>
          <img className="load-art" src={art} alt="" />
          <img
            className="load-art frost"
            src={art}
            alt=""
            style={{ opacity: 1 - p }}
          />
        </>
      )}
      <div className="load-glass" style={{ opacity: (1 - p) * 0.6 }} />
      <div className="load-card" role="status">
        <div className="load-dial" style={{ ["--p" as string]: p * 100 }}>
          <b>{Math.round(p * 100)}</b>
        </div>
        <h2>{title}</h2>
        <p>{label}</p>
        {onCancel && (
          <button autoFocus onClick={onCancel}>
            Cancel
          </button>
        )}
      </div>
    </div>
  );
}
