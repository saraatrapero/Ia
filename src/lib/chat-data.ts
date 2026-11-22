import { availableModels } from "./ai/models";
import { db } from "./db";

export type ModelOption = { id: string; label: string; provider: string; tier: string; description: string };

export type UiMessage = {
  id: string;
  role: "user" | "assistant";
  content: string;
  modelLabel?: string;
  provider?: string;
  reason?: string;
  costUsd?: number;
  tokens?: number;
  status?: string;
  attachments?: { id: string; filename: string }[];
};

export async function modelOptions(role: string): Promise<ModelOption[]> {
  const models = await availableModels(role);
  return models.map((m) => ({ id: m.id, label: m.label, provider: m.provider, tier: m.tier, description: m.description }));
}

export async function loadConversation(id: string, userId: string) {
  const conv = await db.conversation.findFirst({
    where: { id, userId },
    include: {
      messages: {
        orderBy: { createdAt: "asc" },
        include: { attachments: { select: { id: true, filename: true } } },
      },
    },
  });
  if (!conv) return null;
  const labels = new Map((await db.aiModel.findMany({ select: { id: true, label: true } })).map((m) => [m.id, m.label]));
  const messages: UiMessage[] = conv.messages.map((m) => ({
    id: m.id,
    role: m.role as UiMessage["role"],
    content: m.content,
    modelLabel: m.modelId ? labels.get(m.modelId) ?? m.modelId : undefined,
    provider: m.provider ?? undefined,
    reason: m.routingReason ?? undefined,
    costUsd: m.costUsd,
    tokens: m.inputTokens + m.outputTokens,
    status: m.status,
    attachments: m.attachments,
  }));
  return { id: conv.id, title: conv.title, modelMode: conv.modelMode, messages };
}
