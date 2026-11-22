export function ConfigProblems({ problems }: { problems: string[] }) {
  return (
    <main className="flex min-h-dvh items-center justify-center px-4 py-10">
      <div className="card w-full max-w-lg p-6">
        <h1 className="text-lg font-semibold">Configuración pendiente</h1>
        <p className="mt-1 text-sm text-muted">TRAPERO AI está publicado, pero le falta lo siguiente para funcionar:</p>
        <ol className="mt-4 list-decimal space-y-2 pl-5 text-sm">
          {problems.map((p) => (
            <li key={p}>{p}</li>
          ))}
        </ol>
        <p className="mt-4 text-xs text-muted">Tras cambiar la configuración en Vercel, ve a Deployments → ⋯ → Redeploy y recarga esta página.</p>
      </div>
    </main>
  );
}
