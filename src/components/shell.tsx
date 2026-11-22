"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useState } from "react";
import { logoutAction } from "@/app/actions/auth";
import {
  IconBot, IconChart, IconChat, IconChip, IconClose, IconFile, IconLogout, IconMenu,
  IconPanel, IconPlus, IconSearch, IconSettings, IconShield, IconUsers,
} from "./icons";

type Conv = { id: string; title: string; pinned: boolean };

const MAIN = [
  { href: "/", label: "Panel de operaciones", icon: IconPanel },
  { href: "/search", label: "Búsqueda y análisis", icon: IconSearch },
  { href: "/usage", label: "Consumo y costes", icon: IconChart },
  { href: "/files", label: "Archivos", icon: IconFile },
  { href: "/agents", label: "Agentes y programación", icon: IconBot },
];
const ADMIN = [
  { href: "/admin/users", label: "Usuarios y roles", icon: IconUsers },
  { href: "/admin/models", label: "Modelos y proveedores", icon: IconChip },
  { href: "/admin/security", label: "Seguridad y auditoría", icon: IconShield },
];

export function Shell({
  user,
  isAdmin,
  conversations,
  children,
}: {
  user: { name: string; email: string; role: string };
  isAdmin: boolean;
  conversations: Conv[];
  children: React.ReactNode;
}) {
  const pathname = usePathname();
  const [open, setOpen] = useState(false);
  useEffect(() => setOpen(false), [pathname]);

  const active = (href: string) => (href === "/" ? pathname === "/" : pathname.startsWith(href));
  const link = (href: string, label: string, Icon: typeof IconPanel) => (
    <Link
      key={href}
      href={href}
      className={`flex items-center gap-2.5 rounded-lg px-2.5 py-2 text-sm transition ${
        active(href) ? "bg-panel-2 text-ink" : "text-muted hover:bg-panel-2/60 hover:text-ink"
      }`}
    >
      <Icon className="shrink-0" />
      <span className="truncate">{label}</span>
    </Link>
  );

  return (
    <div className="flex h-dvh overflow-hidden">
      {/* Barra lateral */}
      <aside
        className={`fixed inset-y-0 left-0 z-40 flex w-72 flex-col border-r border-line bg-panel transition-transform lg:static lg:translate-x-0 ${
          open ? "translate-x-0" : "-translate-x-full"
        }`}
      >
        <div className="flex items-center justify-between px-4 pb-3 pt-4">
          <Link href="/" className="flex items-center gap-2.5">
            <span className="grid size-8 place-items-center rounded-lg bg-gradient-to-br from-accent to-accent-2 text-sm font-bold text-white">T</span>
            <span className="font-semibold tracking-tight">TRAPERO AI</span>
          </Link>
          <button className="rounded-md p-1 text-muted hover:text-ink lg:hidden" onClick={() => setOpen(false)} aria-label="Cerrar menú">
            <IconClose />
          </button>
        </div>

        <div className="px-3">
          <Link href="/chat" className="btn-primary w-full">
            <IconPlus /> Nueva conversación
          </Link>
        </div>

        <nav className="mt-4 flex-1 space-y-5 overflow-y-auto px-3 pb-4">
          <div className="space-y-0.5">{MAIN.map((i) => link(i.href, i.label, i.icon))}</div>

          {isAdmin && (
            <div>
              <p className="px-2.5 pb-1.5 text-[11px] font-medium uppercase tracking-wider text-muted/70">Administración</p>
              <div className="space-y-0.5">{ADMIN.map((i) => link(i.href, i.label, i.icon))}</div>
            </div>
          )}

          <div>
            <p className="px-2.5 pb-1.5 text-[11px] font-medium uppercase tracking-wider text-muted/70">Conversaciones</p>
            {conversations.length === 0 && <p className="px-2.5 text-xs text-muted">Aún no hay conversaciones.</p>}
            <div className="space-y-0.5">
              {conversations.map((c) => (
                <Link
                  key={c.id}
                  href={`/chat/${c.id}`}
                  className={`flex items-center gap-2 rounded-lg px-2.5 py-1.5 text-[13px] transition ${
                    pathname === `/chat/${c.id}` ? "bg-panel-2 text-ink" : "text-muted hover:bg-panel-2/60 hover:text-ink"
                  }`}
                >
                  <IconChat width={14} height={14} className="shrink-0 opacity-60" />
                  <span className="truncate">{c.pinned ? "📌 " : ""}{c.title}</span>
                </Link>
              ))}
            </div>
          </div>
        </nav>

        <div className="border-t border-line p-3">
          <div className="flex items-center gap-2.5 rounded-lg px-2 py-1.5">
            <span className="grid size-8 shrink-0 place-items-center rounded-full bg-panel-2 text-xs font-semibold">
              {user.name.split(" ").map((p) => p[0]).slice(0, 2).join("").toUpperCase()}
            </span>
            <div className="min-w-0 flex-1">
              <p className="truncate text-sm font-medium">{user.name}</p>
              <p className="truncate text-xs text-muted">{user.role}</p>
            </div>
            <Link href="/settings" className="rounded-md p-1.5 text-muted hover:bg-panel-2 hover:text-ink" title="Ajustes de cuenta">
              <IconSettings width={16} height={16} />
            </Link>
            <form action={logoutAction}>
              <button className="rounded-md p-1.5 text-muted hover:bg-panel-2 hover:text-ink" title="Cerrar sesión">
                <IconLogout width={16} height={16} />
              </button>
            </form>
          </div>
        </div>
      </aside>

      {open && <div className="fixed inset-0 z-30 bg-black/50 lg:hidden" onClick={() => setOpen(false)} />}

      {/* Contenido */}
      <div className="flex min-w-0 flex-1 flex-col">
        <header className="flex items-center gap-3 border-b border-line px-4 py-3 lg:hidden">
          <button className="rounded-md p-1 text-muted hover:text-ink" onClick={() => setOpen(true)} aria-label="Abrir menú">
            <IconMenu />
          </button>
          <span className="font-semibold tracking-tight">TRAPERO AI</span>
        </header>
        <main className="min-h-0 flex-1 overflow-y-auto">{children}</main>
      </div>
    </div>
  );
}
