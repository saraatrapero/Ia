import Link from "next/link";
import { IconDownload } from "@/components/icons";
import { Page, PageHeader } from "@/components/page-header";
import { requireUser } from "@/lib/auth/session";
import { db } from "@/lib/db";

export const metadata = { title: "Archivos" };

function size(n: number) {
  if (n > 1024 * 1024) return `${(n / 1024 / 1024).toFixed(1)} MB`;
  return `${Math.max(1, Math.round(n / 1024))} KB`;
}

export default async function FilesPage() {
  const user = await requireUser();
  const [generated, uploaded] = await Promise.all([
    db.generatedFile.findMany({
      where: { userId: user.id },
      orderBy: { createdAt: "desc" },
      take: 100,
      include: { message: { select: { conversationId: true } } },
    }),
    db.attachment.findMany({
      where: { userId: user.id },
      orderBy: { createdAt: "desc" },
      take: 100,
      select: { id: true, filename: true, size: true, charCount: true, createdAt: true, conversationId: true },
    }),
  ]);

  const Table = ({ rows, kind }: { rows: { id: string; filename: string; size: number; createdAt: Date; conv?: string | null; extra?: string }[]; kind: "gen" | "up" }) => (
    <div className="card overflow-x-auto">
      <table className="table">
        <thead><tr><th>Archivo</th><th>Fecha</th><th className="text-right">Tamaño</th><th></th></tr></thead>
        <tbody>
          {rows.length === 0 && <tr><td colSpan={4} className="py-8 text-center text-muted">{kind === "gen" ? "Aún no has generado archivos. Usa «Descargar» en cualquier respuesta." : "Aún no has subido documentos."}</td></tr>}
          {rows.map((r) => (
            <tr key={r.id}>
              <td>
                <span className="font-medium">{r.filename}</span>
                {r.extra && <div className="text-xs text-muted">{r.extra}</div>}
              </td>
              <td className="whitespace-nowrap text-muted">{r.createdAt.toLocaleString("es-ES", { dateStyle: "short", timeStyle: "short" })}</td>
              <td className="text-right tabular-nums text-muted">{size(r.size)}</td>
              <td className="text-right whitespace-nowrap">
                {r.conv && <Link href={`/chat/${r.conv}`} className="mr-3 text-xs text-accent hover:underline">Conversación</Link>}
                <a href={`/api/files/${r.id}${kind === "up" ? "?tipo=subido" : ""}`} className="btn-ghost px-2.5 py-1 text-xs"><IconDownload width={14} /> Descargar</a>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );

  return (
    <Page>
      <PageHeader title="Archivos" subtitle="Documentos que has generado y documentos que has subido para analizar." />
      <h2 className="mb-3 text-sm font-medium text-muted">Generados ({generated.length})</h2>
      <Table kind="gen" rows={generated.map((g) => ({ id: g.id, filename: g.filename, size: g.size, createdAt: g.createdAt, conv: g.message?.conversationId }))} />
      <h2 className="mb-3 mt-8 text-sm font-medium text-muted">Subidos ({uploaded.length})</h2>
      <Table kind="up" rows={uploaded.map((u) => ({ id: u.id, filename: u.filename, size: u.size, createdAt: u.createdAt, conv: u.conversationId, extra: `${u.charCount.toLocaleString("es-ES")} caracteres extraídos` }))} />
    </Page>
  );
}
