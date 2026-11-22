import { availableModels, costMode } from "./ai/models";
import { db } from "./db";

export type ModelOption = { id: string; label: string; provider: string; tier: string; description: string; free: boolean };

export type UiMessage = {
  id: string;
  role: "user" | "assistant";
  content: string;
  kind: "answer" | "compare" | "review";
  variantGroup?: string | null;
  selected?: boolean;
  modelId?: string;
  modelLabel?: string;
  provider?: string;
  reason?: string;
  costUsd?: number;
  tokens?: number;
  free?: boolean;
  status?: string;
  attachments?: { id: string; filename: string }[];
};

export async function modelOptions(role: string): Promise<{ models: ModelOption[]; mode: string }> {
  const [models, mode] = await Promise.all([availableModels(role), costMode()]);
  return {
    mode,
    models: models.map((m) => ({ id: m.id, label: m.label, provider: m.provider, tier: m.tier, description: m.description, free: m.free })),
  };
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
  const all = await db.aiModel.findMany({ select: { id: true, label: true, free: true } });
  const info = new Map(all.map((m) => [m.id, m]));
  const messages: UiMessage[] = conv.messages.map((m) => ({
    id: m.id,
    role: m.role as UiMessage["role"],
    content: m.content,
    kind: (m.kind as UiMessage["kind"]) ?? "answer",
    variantGroup: m.variantGroup,
    selected: m.selected,
    modelId: m.modelId ?? undefined,
    modelLabel: m.modelId ? info.get(m.modelId)?.label ?? m.modelId : undefined,
    provider: m.provider ?? undefined,
    reason: m.routingReason ?? undefined,
    costUsd: m.costUsd,
    tokens: m.inputTokens + m.outputTokens,
    free: m.modelId ? info.get(m.modelId)?.free : undefined,
    status: m.status,
    attachments: m.attachments,
  }));
  return { id: conv.id, title: conv.title, modelMode: conv.modelMode, messages };
}
