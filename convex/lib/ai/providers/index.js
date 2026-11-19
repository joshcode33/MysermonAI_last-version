import { AiError } from "../errors.js";
import { createOllamaProvider } from "./ollama.js";
import { createOpenAiCompatibleProvider } from "./openaiCompatible.js";
import { createGeminiProvider } from "./gemini.js";

const REGISTRY = {
  gemini: createGeminiProvider,
  ollama: createOllamaProvider,
  "openai-compatible": createOpenAiCompatibleProvider,
};

export function createProvider(config, options) {
  const factory = REGISTRY[config.provider];
  if (!factory) throw new AiError("config", `Fournisseur IA inconnu : ${config.provider}.`, { retryable: false });
  return factory(config, options);
}
