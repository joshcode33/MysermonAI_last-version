import { AiError } from "../errors.js";
import { postJson } from "./http.js";
import { validateProviderRequest, validateProviderResponse } from "./contract.js";

const GEMINI_TYPE = {
  object: "OBJECT",
  array: "ARRAY",
  string: "STRING",
  number: "NUMBER",
  integer: "INTEGER",
  boolean: "BOOLEAN",
};

function toGeminiSchema(schema) {
  if (!schema || typeof schema !== "object") return undefined;
  const type = GEMINI_TYPE[schema.type];
  if (!type) return undefined;
  const result = { type };
  if (typeof schema.description === "string") result.description = schema.description;
  if (Array.isArray(schema.enum)) result.enum = schema.enum.filter((item) => typeof item === "string");
  if (type === "OBJECT") {
    result.properties = Object.fromEntries(
      Object.entries(schema.properties ?? {})
        .map(([key, value]) => [key, toGeminiSchema(value)])
        .filter(([, value]) => value !== undefined)
    );
    if (Array.isArray(schema.required)) result.required = schema.required;
  }
  if (type === "ARRAY") {
    const items = toGeminiSchema(schema.items);
    if (items) result.items = items;
  }
  return result;
}

function toGeminiContents(messages) {
  const contents = [];
  for (const message of messages) {
    if (message.role === "tool") {
      const previous = contents.at(-1);
      if (previous?.role === "user" && previous.parts.some((part) => part.functionResponse)) {
        previous.parts.push({
          functionResponse: {
            name: message.name,
            response: { content: message.content },
          },
        });
      } else {
        contents.push({
          role: "user",
          parts: [{
            functionResponse: {
              name: message.name,
              response: { content: message.content },
            },
          }],
        });
      }
      continue;
    }

    const parts = [];
    if (message.content) parts.push({ text: message.content });
    for (const call of message.toolCalls ?? []) {
      parts.push({ functionCall: { name: call.name, args: call.arguments } });
    }
    if (parts.length) contents.push({ role: message.role === "assistant" ? "model" : "user", parts });
  }
  return contents;
}

function parseToolCalls(parts) {
  return parts.flatMap((part, index) => {
    const call = part.functionCall;
    if (!call || typeof call.name !== "string" || !call.args || typeof call.args !== "object") return [];
    return [{ id: `${call.name}-${index}`, name: call.name, arguments: call.args }];
  });
}

export async function embedTexts(texts, config, { fetchImpl } = {}) {
  if (!Array.isArray(texts) || texts.length === 0 || texts.length > 100 || texts.some((text) => typeof text !== "string" || !text.trim() || text.length > 6000)) {
    throw new AiError("validation", "Les textes à vectoriser doivent contenir entre 1 et 100 éléments valides.", { retryable: false });
  }
  if (!config.apiKey) throw new AiError("config", "GEMINI_API_KEY ou AI_EMBEDDING_API_KEY est requis pour la recherche sémantique.", { retryable: false });

  const data = await postJson(
    `${config.baseUrl}/models/${encodeURIComponent(config.model)}:batchEmbedContents`,
    {
      headers: { "x-goog-api-key": config.apiKey },
      body: {
        requests: texts.map((text) => ({
          model: `models/${config.model}`,
          content: { parts: [{ text }] },
          taskType: config.taskType ?? "RETRIEVAL_QUERY",
          outputDimensionality: 768,
        })),
      },
      timeoutMs: config.timeoutMs,
      fetchImpl,
    }
  );
  const embeddings = data?.embeddings;
  if (!Array.isArray(embeddings) || embeddings.length !== texts.length) {
    throw new AiError("bad_response", "Réponse d'embeddings Gemini incomplète.");
  }
  const vectors = embeddings.map((entry) => entry?.values);
  if (vectors.some((vector) => !Array.isArray(vector) || vector.length !== 768 || vector.some((value) => !Number.isFinite(value)))) {
    throw new AiError("bad_response", "Dimension ou valeurs d'embedding Gemini invalides.");
  }
  return vectors;
}

export function createGeminiProvider(config, { fetchImpl } = {}) {
  return {
    name: "gemini",
    model: config.model,
    async generate(rawRequest) {
      let request;
      try {
        request = validateProviderRequest(rawRequest);
      } catch (error) {
        throw new AiError("validation", error.message, { retryable: false });
      }

      const body = {
        systemInstruction: { parts: [{ text: request.system }] },
        contents: toGeminiContents(request.messages),
        generationConfig: {
          temperature: config.temperature,
          maxOutputTokens: config.maxOutputTokens,
          ...(request.tools?.length
            ? {}
            : request.jsonSchema
              ? { responseMimeType: "application/json", responseSchema: toGeminiSchema(request.jsonSchema) }
              : {}),
        },
        ...(request.tools?.length
          ? {
              tools: [{
                functionDeclarations: request.tools.map((tool) => ({
                  name: tool.name,
                  description: tool.description,
                  parameters: toGeminiSchema(tool.parameters),
                })),
              }],
              toolConfig: { functionCallingConfig: { mode: "AUTO" } },
            }
          : {}),
      };

      const data = await postJson(
        `${config.baseUrl}/models/${encodeURIComponent(config.model)}:generateContent`,
        {
          headers: { "x-goog-api-key": config.apiKey },
          body,
          timeoutMs: config.timeoutMs,
          signal: rawRequest.signal,
          fetchImpl,
        }
      );
      const candidate = data?.candidates?.[0];
      const parts = candidate?.content?.parts;
      if (!Array.isArray(parts)) throw new AiError("bad_response", "Réponse Gemini sans contenu.");
      const text = parts.filter((part) => typeof part.text === "string").map((part) => part.text).join("");
      const toolCalls = parseToolCalls(parts);
      if (!text && toolCalls.length === 0) throw new AiError("bad_response", "Réponse Gemini vide.");
      return validateProviderResponse({
        text,
        toolCalls,
        truncated: candidate.finishReason === "MAX_TOKENS",
        usage: {
          promptTokens: data.usageMetadata?.promptTokenCount ?? null,
          completionTokens: data.usageMetadata?.candidatesTokenCount ?? null,
        },
      });
    },
  };
}
