import { redirect } from "next/navigation";
import { getCurrentUser } from "@/lib/auth/session";
import { ConfigProblems } from "@/components/config-problems";
import { db } from "@/lib/db";
import { configProblems } from "@/lib/env";
import { LoginForm } from "./login-form";

export const metadata = { title: "Acceso" };
export const dynamic = "force-dynamic";

export default async function LoginPage() {
  const problems = configProblems();
  if (problems.length) return <ConfigProblems problems={problems} />;
  if ((await db.user.count()) === 0) redirect("/setup");
  if (await getCurrentUser()) redirect("/");
  return (
    <main className="relative flex min-h-dvh items-center justify-center overflow-hidden px-4">
      <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(ellipse_at_top,rgba(79,140,255,0.16),transparent_60%)]" />
      <div className="relative w-full max-w-sm">
        <div className="mb-8 flex flex-col items-center gap-3 text-center">
          <div className="grid size-12 place-items-center rounded-2xl bg-gradient-to-br from-accent to-accent-2 text-xl font-bold text-white shadow-lg shadow-accent/20">
            T
          </div>
          <div>
            <h1 className="text-xl font-semibold tracking-tight">TRAPERO AI</h1>
            <p className="text-sm text-muted">Centro de operaciones de inteligencia artificial</p>
          </div>
        </div>
        <div className="card p-6">
          <LoginForm />
        </div>
        <p className="mt-6 text-center text-xs text-muted">Acceso privado. Las cuentas las crea el administrador.</p>
      </div>
    </main>
  );
}
