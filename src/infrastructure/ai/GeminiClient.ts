import { LlmError } from "../../ports/ILlmClient.js";
import type { ILlmClient, LlmRequest } from "../../ports/ILlmClient.js";

const ENDPOINT = "https://generativelanguage.googleapis.com/v1beta/models";
const DEFAULT_TIMEOUT_MS = 15_000;

type GeminiResponse = {
  candidates?: Array<{ content?: { parts?: Array<{ text?: string }> }; finishReason?: string }>;
};

export class GeminiClient implements ILlmClient {
  public constructor(
    private readonly apiKey: string,
    private readonly model: string,
  ) {}

  public async complete(request: LlmRequest): Promise<string> {
    const generationConfig: Record<string, unknown> = {};
    if (request.json) {
      generationConfig.responseMimeType = "application/json";
    }
    if (request.temperature !== undefined) {
      generationConfig.temperature = request.temperature;
    }

    const body: Record<string, unknown> = {
      contents: [{ role: "user", parts: [{ text: request.user }] }],
      ...(request.system ? { system_instruction: { parts: [{ text: request.system }] } } : {}),
      ...(Object.keys(generationConfig).length > 0 ? { generationConfig } : {}),
    };

    const url = `${ENDPOINT}/${this.model}:generateContent?key=${this.apiKey}`;

    let response: Response;
    try {
      response = await fetch(url, {
        method: "POST",
        headers: { "content-type": "application/json" },
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
      throw new LlmError(`LLM HTTP ${response.status}`, "http");
    }

    const data = (await response.json()) as GeminiResponse;
    const text = data.candidates?.[0]?.content?.parts?.[0]?.text;
    if (!text) {
      throw new LlmError(
        `LLM returned empty response (finish: ${data.candidates?.[0]?.finishReason ?? "?"})`,
        "empty",
      );
    }
    return text;
  }
}
