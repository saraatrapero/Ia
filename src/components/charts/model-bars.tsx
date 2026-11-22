import { ProviderDot } from "../provider-dot";

const FILL: Record<string, string> = { openai: "bg-openai", anthropic: "bg-anthropic", google: "bg-google" };

/** Barras horizontales por modelo, con etiqueta directa (el color identifica al proveedor). */
export function ModelBars({
  rows,
  format,
}: {
  rows: { label: string; provider: string; value: number; sub: string }[];
  format: (v: number) => string;
}) {
  const max = Math.max(...rows.map((r) => r.value), 0) || 1;
  if (rows.length === 0) return <p className="py-6 text-center text-sm text-muted">Sin datos en el periodo.</p>;
  return (
    <ul className="space-y-3">
      {rows.map((r) => (
        <li key={r.label} title={`${r.label}: ${format(r.value)} · ${r.sub}`}>
          <div className="mb-1 flex items-center justify-between gap-3 text-sm">
            <span className="flex min-w-0 items-center gap-2">
              <ProviderDot provider={r.provider} />
              <span className="truncate">{r.label}</span>
            </span>
            <span className="shrink-0 tabular-nums text-muted">
              <b className="font-medium text-ink">{format(r.value)}</b> · {r.sub}
            </span>
          </div>
          <div className="h-2 rounded-full bg-panel-2">
            <div className={`h-2 rounded-full ${FILL[r.provider] ?? "bg-muted"}`} style={{ width: `${(r.value / max) * 100}%` }} />
          </div>
        </li>
      ))}
    </ul>
  );
}
