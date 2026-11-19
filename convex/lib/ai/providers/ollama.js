import { AiError } from "../errors.js";
import { postJson } from "./http.js";
import { validateProviderRequest, validateProviderResponse } from "./contract.js";

/** Fournisseur Ollama, avec sortie contrainte et appels d'outils natifs. */
export function createOllamaProvider(config, { fetchImpl } = {}) {
  return {
    name: "ollama",
    model: config.model,
    async generate(rawRequest) {
      let request;
      try {
        request = validateProviderRequest(rawRequest);
      } catch (error) {
        throw new AiError("validation", error.message, { retryable: false });
      }

      const body = {
        model: config.model,
        stream: false,
        ...(request.tools?.length ? {} : { format: request.jsonSchema ?? "json" }),
        messages: [
          { role: "system", content: request.system },
          ...request.messages.map((message) => ({
            role: message.role,
            content: message.content,
            ...(message.toolCalls ? {
              tool_calls: message.toolCalls.map((call) => ({
                function: { name: call.name, arguments: call.arguments },
              })),
            } : {}),
            ...(message.toolCallId ? { tool_name: message.name } : {}),
          })),
        ],
        ...(request.tools?.length
          ? {
              tools: request.tools.map((tool) => ({
                type: "function",
                function: { name: tool.name, description: tool.description, parameters: tool.parameters },
              })),
            }
          : {}),
        options: { temperature: config.temperature, num_predict: config.maxOutputTokens, num_ctx: config.contextTokens },
      };
      const headers = {};
      if (config.apiKey) headers.Authorization = ["Bearer", config.apiKey].join(" ");
      const data = await postJson(`${config.baseUrl}/api/chat`, {
        headers, body, timeoutMs: config.timeoutMs, signal: rawRequest.signal, fetchImpl,
      });
      const content = data?.message?.content;
      const calls = data?.message?.tool_calls ?? [];
      if (typeof content !== "string" && calls.length === 0) throw new AiError("bad_response", "Réponse Ollama sans contenu.");
      return validateProviderResponse({
        text: content ?? "",
        toolCalls: calls.map((call, index) => ({
          id: `${call.function?.name ?? "tool"}-${index}`,
          name: call.function?.name,
          arguments: call.function?.arguments ?? {},
        })),
        truncated: data.done_reason === "length",
        usage: { promptTokens: data.prompt_eval_count ?? null, completionTokens: data.eval_count ?? null },
      });
    },
  };
}
