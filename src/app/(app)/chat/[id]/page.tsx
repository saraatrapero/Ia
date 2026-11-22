import { notFound } from "next/navigation";
import { ChatView } from "@/components/chat/chat-view";
import { requirePermission } from "@/lib/auth/session";
import { loadConversation, modelOptions } from "@/lib/chat-data";
import { getSettings } from "@/lib/settings";

export const metadata = { title: "Conversación" };

export default async function ChatPage({ params }: { params: Promise<{ id: string }> }) {
  const user = await requirePermission("chat.use");
  const { id } = await params;
  const conv = await loadConversation(id, user.id);
  if (!conv) notFound();
  const settings = await getSettings();
  return (
    <ChatView
      key={conv.id}
      models={await modelOptions(user.role)}
      initial={conv}
      userName={user.name.split(" ")[0]}
      allowedExtensions={settings.allowed_extensions}
    />
  );
}
