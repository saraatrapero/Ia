const COLORS: Record<string, string> = {
  openai: "bg-openai",
  anthropic: "bg-anthropic",
  google: "bg-google",
};

export function ProviderDot({ provider, className = "" }: { provider: string; className?: string }) {
  return <span className={`inline-block size-2 shrink-0 rounded-full ${COLORS[provider] ?? "bg-muted"} ${className}`} />;
}

export const PROVIDER_SHORT: Record<string, string> = { openai: "GPT", anthropic: "Claude", google: "Gemini" };
