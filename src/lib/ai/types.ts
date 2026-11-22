import type { ProviderId } from "./catalog";

export interface ChatTurn {
  role: "user" | "assistant";
  content: string;
}

export interface StreamRequest {
  apiModel: string;
  system: string;
  messages: ChatTurn[];
  signal?: AbortSignal;
}

export interface StreamResult {
  inputTokens: number;
  outputTokens: number;
  /** Modelo que respondió realmente (puede diferir si hubo respaldo automático) */
  servedModel?: string;
}

export interface ProviderAdapter {
  id: ProviderId;
  isConfigured(): boolean;
  /** Emite fragmentos de texto vía onText y devuelve el consumo al terminar. */
  stream(req: StreamRequest, onText: (text: string) => void): Promise<StreamResult>;
}

export class ProviderError extends Error {
  constructor(
    public provider: ProviderId,
    message: string,
    public retryable = false,
  ) {
    super(message);
  }
}
