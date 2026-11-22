import Link from "next/link";

export default function NotFound() {
  return (
    <main className="grid min-h-dvh place-items-center px-4 text-center">
      <div>
        <p className="text-5xl font-semibold text-muted">404</p>
        <p className="mt-2">No se ha encontrado esta página.</p>
        <Link href="/" className="btn-ghost mt-6">Volver al panel</Link>
      </div>
    </main>
  );
}
