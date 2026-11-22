export function costUsd(inputTokens: number, outputTokens: number, inputPrice: number, outputPrice: number) {
  return (inputTokens * inputPrice + outputTokens * outputPrice) / 1_000_000;
}

export function formatUsd(v: number) {
  if (v === 0) return "0,00 $";
  if (v < 0.01) return `${v.toLocaleString("es-ES", { maximumFractionDigits: 4 })} $`;
  return `${v.toLocaleString("es-ES", { minimumFractionDigits: 2, maximumFractionDigits: 2 })} $`;
}

export function formatTokens(n: number) {
  if (n >= 1_000_000) return `${(n / 1_000_000).toLocaleString("es-ES", { maximumFractionDigits: 2 })} M`;
  if (n >= 1_000) return `${(n / 1_000).toLocaleString("es-ES", { maximumFractionDigits: 1 })} k`;
  return n.toLocaleString("es-ES");
}
