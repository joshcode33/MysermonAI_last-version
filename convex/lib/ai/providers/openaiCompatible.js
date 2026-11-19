import { AiError } from "../errors.js";
import { postJson } from "./http.js";
import { validateProviderRequest, validateProviderResponse } from "./contract.js";

/** Fournisseur OpenAI-compatible (vLLM, LM Studio, OpenRouter, etc.). */
export function createOpenAiCompatibleProvider(config, { fetchImpl } = {}) {
  return {
    name: "openai-compatible",
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
        messages: [
          { role: "system", content: request.system },
          ...request.messages.map((message) => ({
            role: message.role,
            content: message.content,
            ...(message.toolCalls ? {
              tool_calls: message.toolCalls.map((call) => ({
                id: call.id,
                type: "function",
                function: { name: call.name, arguments: JSON.stringify(call.arguments) },
              })),
            } : {}),
            ...(message.toolCallId ? { tool_call_id: message.toolCallId, name: message.name } : {}),
          })),
        ],
        temperature: config.temperature,
        max_tokens: config.maxOutputTokens,
        ...(request.tools?.length
          ? {
              tools: request.tools.map((tool) => ({
                type: "function",
                function: { name: tool.name, description: tool.description, parameters: tool.parameters },
              })),
              tool_choice: "auto",
            }
          : { response_format: { type: "json_object" } }),
      };
      const headers = {};
      if (config.apiKey) headers.Authorization = ["Bearer", config.apiKey].join(" ");
      const data = await postJson(`${config.baseUrl}/chat/completions`, {
        headers, body, timeoutMs: config.timeoutMs, signal: rawRequest.signal, fetchImpl,
      });
      const choice = data?.choices?.[0];
      const content = choice?.message?.content;
      const toolCalls = choice?.message?.tool_calls ?? [];
      if (typeof content !== "string" && toolCalls.length === 0) throw new AiError("bad_response", "Réponse sans contenu.");
      return validateProviderResponse({
        text: content ?? "",
        toolCalls: toolCalls.map((call) => {
          let args;
          try {
            args = JSON.parse(call.function.arguments);
          } catch {
            throw new AiError("bad_response", "Arguments d'outil JSON invalides.");
          }
          return { id: call.id, name: call.function.name, arguments: args };
        }),
        truncated: choice.finish_reason === "length",
        usage: { promptTokens: data.usage?.prompt_tokens ?? null, completionTokens: data.usage?.completion_tokens ?? null },
      });
    },
  };
}
