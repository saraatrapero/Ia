import { ChatView } from "@/components/chat/chat-view";
import { requirePermission } from "@/lib/auth/session";
import { modelOptions } from "@/lib/chat-data";
import { getSettings } from "@/lib/settings";

export const metadata = { title: "Nueva conversación" };

export default async function NewChatPage() {
  const user = await requirePermission("chat.use");
  const settings = await getSettings();
  return (
    <ChatView
      key="new"
      {...await modelOptions(user.role)}
      initial={{ id: null, title: "Nueva conversación", modelMode: "auto", messages: [] }}
      userName={user.name.split(" ")[0]}
      allowedExtensions={settings.allowed_extensions}
    />
  );
}
