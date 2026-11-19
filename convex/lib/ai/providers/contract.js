import { z } from "zod";

export const ProviderMessageSchema = z.object({
  role: z.enum(["user", "assistant", "tool"]),
  content: z.string().default(""),
  toolCalls: z.array(z.object({
    id: z.string(),
    name: z.string(),
    arguments: z.record(z.string(), z.unknown()),
  })).optional(),
  toolCallId: z.string().optional(),
  name: z.string().optional(),
});

export const ProviderToolSchema = z.object({
  name: z.string().regex(/^[A-Za-z][A-Za-z0-9_]{0,63}$/),
  description: z.string().min(1).max(1000),
  parameters: z.record(z.string(), z.unknown()),
});

export const ProviderRequestSchema = z.object({
  system: z.string().min(1),
  messages: z.array(ProviderMessageSchema).max(50),
  jsonSchema: z.record(z.string(), z.unknown()).optional(),
  tools: z.array(ProviderToolSchema).max(16).optional(),
});

export const ProviderResponseSchema = z.object({
  text: z.string(),
  toolCalls: z.array(z.object({
    id: z.string(),
    name: z.string(),
    arguments: z.record(z.string(), z.unknown()),
  })).default([]),
  truncated: z.boolean().default(false),
  usage: z.object({
    promptTokens: z.number().nullable(),
    completionTokens: z.number().nullable(),
  }),
});

export function validateProviderRequest(request) {
  const result = ProviderRequestSchema.safeParse(request);
  if (!result.success) throw new TypeError(`Requête fournisseur invalide : ${result.error.issues[0]?.message ?? "format incorrect"}.`);
  return result.data;
}

export function validateProviderResponse(response) {
  const result = ProviderResponseSchema.safeParse(response);
  if (!result.success) throw new TypeError(`Réponse fournisseur invalide : ${result.error.issues[0]?.message ?? "format incorrect"}.`);
  return result.data;
}
