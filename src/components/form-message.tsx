export function FormMessage({ state }: { state?: { error?: string; ok?: string } }) {
  if (state?.error) return <p className="rounded-lg border border-bad/30 bg-bad/10 px-3 py-2 text-sm text-bad">{state.error}</p>;
  if (state?.ok) return <p className="rounded-lg border border-ok/30 bg-ok/10 px-3 py-2 text-sm text-ok">{state.ok}</p>;
  return null;
}
