import { Shell } from "@/components/shell";
import { requireUser } from "@/lib/auth/session";
import { db } from "@/lib/db";
import { can } from "@/lib/permissions";
import { ROLE_LABELS, type Role } from "@/lib/permissions";

export default async function AppLayout({ children }: { children: React.ReactNode }) {
  const user = await requireUser();
  const conversations = await db.conversation.findMany({
    where: { userId: user.id },
    orderBy: [{ pinned: "desc" }, { updatedAt: "desc" }],
    take: 40,
    select: { id: true, title: true, pinned: true },
  });
  return (
    <Shell
      user={{ name: user.name, email: user.email, role: ROLE_LABELS[user.role as Role] ?? user.role }}
      isAdmin={can(user.role, "users.manage")}
      conversations={conversations}
    >
      {children}
    </Shell>
  );
}
