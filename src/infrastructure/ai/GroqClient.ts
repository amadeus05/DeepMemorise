import { LlmError } from "../../ports/ILlmClient.js";
import type { ILlmClient, LlmRequest } from "../../ports/ILlmClient.js";

const ENDPOINT = "https://api.groq.com/openai/v1/chat/completions";
const DEFAULT_TIMEOUT_MS = 15_000;

type GroqResponse = {
  choices?: Array<{ message?: { content?: string }; finish_reason?: string }>;
};

export class GroqClient implements ILlmClient {
  public constructor(
    private readonly apiKey: string,
    private readonly model: string,
  ) {}

  public async complete(request: LlmRequest): Promise<string> {
    const messages: Array<{ role: string; content: string }> = [];
    if (request.system) {
      messages.push({ role: "system", content: request.system });
    }
    messages.push({ role: "user", content: request.user });

    const body: Record<string, unknown> = {
      model: this.model,
      messages,
      temperature: request.temperature ?? 0.7,
    };
    if (request.json) {
      body.response_format = { type: "json_object" };
    }

    let response: Response;
    try {
      response = await fetch(ENDPOINT, {
        method: "POST",
        headers: {
          "content-type": "application/json",
          authorization: `Bearer ${this.apiKey}`,
        },
        body: JSON.stringify(body),
        signal: AbortSignal.timeout(request.timeoutMs ?? DEFAULT_TIMEOUT_MS),
      });
    } catch (error) {
      const name = error instanceof Error ? error.name : "";
      if (name === "TimeoutError" || name === "AbortError") {
        throw new LlmError("LLM request timed out", "timeout");
      }
      throw new LlmError("LLM request failed to reach the server", "network");
    }

    if (response.status === 429) {
      throw new LlmError("LLM rate limited", "rate_limit");
    }
    if (!response.ok) {
      const errBody = await response.text().catch(() => "");
      throw new LlmError(`LLM HTTP ${response.status}: ${errBody.slice(0, 200)}`, "http");
    }

    const data = (await response.json()) as GroqResponse;
    const text = data.choices?.[0]?.message?.content;
    if (!text) {
      throw new LlmError(
        `LLM returned empty response (finish: ${data.choices?.[0]?.finish_reason ?? "?"})`,
        "empty",
      );
    }
    return text;
  }
}
