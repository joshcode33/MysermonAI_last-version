import { AiError } from "./errors.js";

/** Lit la configuration IA depuis un objet d'environnement (process.env côté Convex). */
export function readAiConfig(env) {
  const provider = (env.AI_PROVIDER || (env.OLLAMA_BASE_URL ? "ollama" : "gemini")).toLowerCase();
  const num = (v, d) => (v === undefined || v === "" ? d : Number(v));
  const defaults = {
    gemini: { baseUrl: "https://generativelanguage.googleapis.com/v1beta", model: "gemini-2.5-flash" },
    ollama: { baseUrl: env.OLLAMA_BASE_URL || "", model: env.OLLAMA_MODEL || "" },
    "openai-compatible": {
      baseUrl: env.OPENAI_COMPATIBLE_BASE_URL || "",
      model: env.OPENAI_COMPATIBLE_MODEL || "",
    },
  };
  const providerDefaults = defaults[provider] ?? {};
  const config = {
    provider,
    baseUrl: (env.AI_BASE_URL || providerDefaults.baseUrl || "").replace(/\/+$/, ""),
    model: env.AI_MODEL || providerDefaults.model || "",
    apiKey: env.AI_API_KEY || (
      provider === "gemini"
        ? env.GEMINI_API_KEY
        : provider === "ollama"
          ? env.OLLAMA_API_KEY
          : env.OPENAI_COMPATIBLE_API_KEY
    ) || "",
    timeoutMs: num(env.AI_TIMEOUT_MS, 240_000),
    maxOutputTokens: num(env.AI_MAX_OUTPUT_TOKENS, 6000),
    temperature: num(env.AI_TEMPERATURE, 0.6),
    contextTokens: num(env.AI_CONTEXT_TOKENS, 8192),
    maxAttempts: num(env.AI_MAX_ATTEMPTS, 2),
    embeddingModel: env.AI_EMBEDDING_MODEL || "gemini-embedding-001",
    embeddingApiKey: env.AI_EMBEDDING_API_KEY || env.GEMINI_API_KEY || (provider === "gemini" ? env.AI_API_KEY : ""),
  };
  if (!config.baseUrl) throw new AiError("config", "AI_BASE_URL (ou l'URL du fournisseur) n'est pas défini.", { retryable: false });
  if (!/^https?:\/\//.test(config.baseUrl)) throw new AiError("config", "AI_BASE_URL doit commencer par http(s)://.", { retryable: false });
  if (!config.model) throw new AiError("config", "AI_MODEL (ou le modèle du fournisseur) n'est pas défini.", { retryable: false });
  if (provider === "gemini" && !config.apiKey) throw new AiError("config", "GEMINI_API_KEY (ou AI_API_KEY) n'est pas défini.", { retryable: false });
  for (const k of ["timeoutMs", "maxOutputTokens", "temperature", "contextTokens", "maxAttempts"]) {
    if (!Number.isFinite(config[k]) || config[k] <= 0) throw new AiError("config", `Valeur invalide pour ${k}.`, { retryable: false });
  }
  return config;
}
