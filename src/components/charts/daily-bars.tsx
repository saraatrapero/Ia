"use client";

import { useState } from "react";
import { formatUsd } from "@/lib/ai/pricing";

/** Gráfico de barras diario (una serie) con tooltip al pasar el ratón o tocar. */
export function DailyBars({
  data: raw,
  label,
  metric = "usd",
}: {
  data: { day: string; value: number; calls: number }[];
  label: string;
  /** usd = coste diario · calls = número de peticiones */
  metric?: "usd" | "calls";
}) {
  const data = metric === "calls" ? raw.map((d) => ({ ...d, value: d.calls })) : raw;
  const format = metric === "calls" ? (v: number) => `${v} pet.` : formatUsd;
  const [hover, setHover] = useState<number | null>(null);
  const max = Math.max(...data.map((d) => d.value), 0);
  const top = max > 0 ? max : 1;
  const h = hover !== null ? data[hover] : null;

  return (
    <div>
      <div className="mb-2 flex h-5 items-baseline justify-between text-xs text-muted">
        <span>{label}</span>
        {h ? (
          <span className="text-ink">
            {new Date(h.day).toLocaleDateString("es-ES", { day: "numeric", month: "short" })} · <b className="tabular-nums">{format(h.value)}</b>
            {metric === "usd" && <> · {h.calls} peticiones</>}
          </span>
        ) : (
          <span>máx. {format(max)}</span>
        )}
      </div>
      <div className="relative flex h-36 items-end gap-[2px] border-b border-line" onMouseLeave={() => setHover(null)} role="img" aria-label={label}>
        {[0.5, 1].map((f) => (
          <div key={f} className="pointer-events-none absolute inset-x-0 border-t border-dashed border-line/70" style={{ bottom: `${f * 100}%` }} />
        ))}
        {data.map((d, i) => (
          <button
            key={d.day}
            type="button"
            className="group relative flex h-full flex-1 items-end"
            onMouseEnter={() => setHover(i)}
            onFocus={() => setHover(i)}
            onClick={() => setHover(i)}
            aria-label={`${d.day}: ${format(d.value)}`}
          >
            <span
              className={`w-full rounded-t-[4px] transition ${hover === i ? "bg-accent" : "bg-accent/70"} ${d.value === 0 ? "opacity-0" : ""}`}
              style={{ height: `${Math.max((d.value / top) * 100, d.value > 0 ? 2 : 0)}%` }}
            />
          </button>
        ))}
      </div>
      <div className="mt-1.5 flex justify-between text-[11px] text-muted">
        <span>{data[0] && new Date(data[0].day).toLocaleDateString("es-ES", { day: "numeric", month: "short" })}</span>
        <span>{data.at(-1) && new Date(data.at(-1)!.day).toLocaleDateString("es-ES", { day: "numeric", month: "short" })}</span>
      </div>
    </div>
  );
}
