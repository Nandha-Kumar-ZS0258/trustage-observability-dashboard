import { clsx } from 'clsx';

interface DurationBarProps {
  download: number | null;
  process: number | null;
  persist: number | null;
  total?: number | null;
}

export function DurationBar({ download, process, persist, total }: DurationBarProps) {
  const d = download ?? 0;
  const p = process ?? 0;
  const pe = persist ?? 0;
  const t = (total ?? (d + p + pe)) || 1;

  const pct = (v: number) => `${((v / t) * 100).toFixed(1)}%`;

  return (
    <div className="space-y-2">
      <div className="flex h-4 rounded-full overflow-hidden gap-0.5">
        <div
          className="bg-blue-500 transition-all"
          style={{ width: pct(d) }}
          title={`Download: ${d}ms`}
        />
        <div
          className="bg-purple-500 transition-all"
          style={{ width: pct(p) }}
          title={`Process: ${p}ms`}
        />
        <div
          className="bg-amber-500 transition-all flex-1"
          title={`Persist: ${pe}ms`}
        />
      </div>
      <div className="flex gap-4 text-xs text-gray-400">
        <LegendItem color="bg-blue-500"   label="Download" value={d} pct={pct(d)} />
        <LegendItem color="bg-purple-500" label="Process"  value={p} pct={pct(p)} />
        <LegendItem color="bg-amber-500"  label="Persist"  value={pe} pct={pct(pe)} />
      </div>
    </div>
  );
}

function LegendItem({ color, label, value, pct }: {
  color: string; label: string; value: number; pct: string;
}) {
  return (
    <div className="flex items-center gap-1">
      <span className={clsx('w-2 h-2 rounded-sm', color)} />
      <span>{label}: {value.toLocaleString()}ms ({pct})</span>
    </div>
  );
}
