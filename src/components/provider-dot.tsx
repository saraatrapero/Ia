const COLORS: Record<string, string> = {
  openai: "bg-openai",
  anthropic: "bg-anthropic",
  google: "bg-google",
  groq: "bg-groq",
  openrouter: "bg-openrouter",
};

export function ProviderDot({ provider, className = "" }: { provider: string; className?: string }) {
  return <span className={`inline-block size-2 shrink-0 rounded-full ${COLORS[provider] ?? "bg-muted"} ${className}`} />;
}

export const PROVIDER_FILL = COLORS;
