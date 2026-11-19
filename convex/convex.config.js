import { defineApp } from "convex/server";
import { v } from "convex/values";
import agent from "@convex-dev/agent/convex.config.js";

const app = defineApp({
  env: {
    AI_PROVIDER: v.optional(v.string()),
    AI_MODEL: v.optional(v.string()),
    AI_API_KEY: v.optional(v.string()),
    AI_BASE_URL: v.optional(v.string()),
    AI_TIMEOUT_MS: v.optional(v.string()),
    AI_MAX_OUTPUT_TOKENS: v.optional(v.string()),
    AI_TEMPERATURE: v.optional(v.string()),
    AI_CONTEXT_TOKENS: v.optional(v.string()),
    AI_MAX_ATTEMPTS: v.optional(v.string()),
    GEMINI_API_KEY: v.optional(v.string()),
    OLLAMA_BASE_URL: v.optional(v.string()),
    OLLAMA_MODEL: v.optional(v.string()),
    OLLAMA_API_KEY: v.optional(v.string()),
    OPENAI_COMPATIBLE_BASE_URL: v.optional(v.string()),
    OPENAI_COMPATIBLE_MODEL: v.optional(v.string()),
    OPENAI_COMPATIBLE_API_KEY: v.optional(v.string()),
    AI_EMBEDDING_API_KEY: v.optional(v.string()),
    AI_EMBEDDING_BASE_URL: v.optional(v.string()),
    AI_EMBEDDING_MODEL: v.optional(v.string()),
    BIBLE_IMPORT_TOKEN: v.optional(v.string()),
  },
});
app.use(agent);

export default app;
