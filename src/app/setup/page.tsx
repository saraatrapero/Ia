import { redirect } from "next/navigation";
import { db } from "@/lib/db";
import { SetupForm } from "./setup-form";

export const metadata = { title: "Instalación" };
export const dynamic = "force-dynamic";

export default async function SetupPage() {
  if ((await db.user.count()) > 0) redirect("/login");
  return (
    <main className="flex min-h-dvh items-center justify-center px-4 py-10">
      <div className="w-full max-w-md">
        <div className="mb-6 text-center">
          <h1 className="text-xl font-semibold tracking-tight">Instalación de TRAPERO AI</h1>
          <p className="mt-1 text-sm text-muted">Crea la cuenta del administrador principal. Este paso solo se hace una vez.</p>
        </div>
        <div className="card p-6">
          <SetupForm />
        </div>
      </div>
    </main>
  );
}
