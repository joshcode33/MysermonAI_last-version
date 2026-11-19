import { defineSchema, defineTable } from "convex/server";
import { v } from "convex/values";
import { authTables } from "@convex-dev/auth/server";

const licenseStatus = v.union(v.literal("public_domain"), v.literal("licensed"), v.literal("demo"));
const role = v.union(v.literal("owner"), v.literal("admin"), v.literal("editor"), v.literal("viewer"));
const plan = v.union(v.literal("free"), v.literal("pro"), v.literal("church"));

export default defineSchema({
  ...authTables,

  profiles: defineTable({
    userId: v.id("users"),
    displayName: v.string(),
    ministryName: v.optional(v.string()),
    country: v.optional(v.string()),
    language: v.string(),
    plan, // modifiable uniquement côté serveur (jamais par updateProfile)
    sermonCount: v.number(),
    preferences: v.object({
      defaultTone: v.optional(v.string()),
      defaultAudience: v.optional(v.string()),
      defaultDurationMinutes: v.optional(v.number()),
      translationId: v.optional(v.id("bibleTranslations")),
      readerFontSize: v.optional(v.number()),
    }),
    createdAt: v.number(),
  }).index("by_user", ["userId"]),

  // ---- Bible -------------------------------------------------------------
  bibleTranslations: defineTable({
    code: v.string(),
    name: v.string(),
    language: v.string(),
    license: v.object({
      status: licenseStatus,
      holder: v.string(),
      source: v.string(),
      url: v.optional(v.string()),
      notes: v.optional(v.string()),
      verifiedBy: v.string(),
      verifiedAt: v.number(),
      commercialUseVerified: v.optional(v.boolean()),
    }),
    books: v.array(v.object({ bookId: v.string(), chapters: v.number() })), // dérivé des versets importés
    verseCount: v.number(),
    isActive: v.boolean(),
    isDefault: v.boolean(),
    importedAt: v.number(),
  })
    .index("by_code", ["code"])
    .index("by_default", ["isDefault"]),

  bibleVerses: defineTable({
    translationId: v.id("bibleTranslations"),
    bookId: v.string(),
    chapter: v.number(),
    verse: v.number(),
    text: v.string(),
  })
    .index("by_passage", ["translationId", "bookId", "chapter", "verse"])
    .searchIndex("search_text", { searchField: "text", filterFields: ["translationId"] }),

  bibleChunks: defineTable({
    translationId: v.id("bibleTranslations"),
    bookId: v.string(),
    chapter: v.number(),
    verseStart: v.number(),
    verseEnd: v.number(),
    text: v.string(),
    embedding: v.array(v.float64()),
    embeddingModel: v.string(),
  })
    .index("by_translation_reference", ["translationId", "bookId", "chapter", "verseStart"])
    .searchIndex("search_text", { searchField: "text", filterFields: ["translationId"] })
    .vectorIndex("by_embedding", {
      vectorField: "embedding",
      dimensions: 768,
      filterFields: ["translationId", "bookId"],
    }),

  bibleFavorites: defineTable({
    userId: v.id("users"),
    translationId: v.id("bibleTranslations"),
    bookId: v.string(),
    chapter: v.number(),
    verseStart: v.number(),
    verseEnd: v.number(),
    label: v.optional(v.string()),
    createdAt: v.number(),
  }).index("by_user", ["userId", "createdAt"]),

  bibleNotes: defineTable({
    userId: v.id("users"),
    translationId: v.id("bibleTranslations"),
    bookId: v.string(),
    chapter: v.number(),
    verseStart: v.number(),
    verseEnd: v.number(),
    body: v.string(),
    updatedAt: v.number(),
  }).index("by_user_chapter", ["userId", "bookId", "chapter"]),

  readingProgress: defineTable({
    userId: v.id("users"),
    translationId: v.id("bibleTranslations"),
    bookId: v.string(),
    chapter: v.number(),
    updatedAt: v.number(),
  }).index("by_user", ["userId"]),

  // ---- Sermons -----------------------------------------------------------
  sermons: defineTable({
    ownerId: v.id("users"),
    workspaceId: v.optional(v.id("workspaces")),
    title: v.string(),
    status: v.union(v.literal("draft"), v.literal("ready")),
    params: v.any(), // paramètres validés (zod) au moment de la génération
    content: v.any(), // GeneratedSermon (zod) ; modifié uniquement via sermons.updateSection
    sources: v.array(v.any()), // traçabilité : références vérifiées contre la Bible intégrée
    warnings: v.array(v.any()),
    version: v.number(),
    generation: v.object({ provider: v.string(), model: v.string(), durationMs: v.number(), attempts: v.number() }),
    createdAt: v.number(),
    updatedAt: v.number(),
    deletedAt: v.optional(v.number()),
  })
    .index("by_owner_updated", ["ownerId", "updatedAt"])
    .index("by_workspace_updated", ["workspaceId", "updatedAt"]),

  sermonVersions: defineTable({
    sermonId: v.id("sermons"),
    version: v.number(),
    title: v.string(),
    content: v.any(),
    reason: v.string(),
    authorId: v.id("users"),
    createdAt: v.number(),
  }).index("by_sermon", ["sermonId", "version"]),

  sermonNotes: defineTable({
    sermonId: v.id("sermons"),
    userId: v.id("users"),
    body: v.string(),
    updatedAt: v.number(),
  }).index("by_sermon_user", ["sermonId", "userId"]),

  assistantThreads: defineTable({
    userId: v.id("users"),
    componentThreadId: v.string(),
    title: v.string(),
    createdAt: v.number(),
    updatedAt: v.number(),
  })
    .index("by_user_updated", ["userId", "updatedAt"])
    .index("by_component_thread", ["componentThreadId"]),

  // ---- Usage et observabilité (aucun contenu privé) ----------------------
  generationJobs: defineTable({
    ownerId: v.id("users"),
    status: v.union(v.literal("running"), v.literal("succeeded"), v.literal("failed")),
    startedAt: v.number(),
    finishedAt: v.optional(v.number()),
    durationMs: v.optional(v.number()),
    model: v.optional(v.string()),
    errorCode: v.optional(v.string()),
    promptTokens: v.optional(v.number()),
    completionTokens: v.optional(v.number()),
    sermonId: v.optional(v.id("sermons")),
  }).index("by_owner_started", ["ownerId", "startedAt"]),

  usageCounters: defineTable({
    ownerId: v.id("users"),
    period: v.string(),
    generations: v.number(),
  }).index("by_owner_period", ["ownerId", "period"]),

  // ---- Équipes (base ; interface à venir) -------------------------------
  workspaces: defineTable({ name: v.string(), ownerId: v.id("users"), createdAt: v.number() }),
  workspaceMembers: defineTable({
    workspaceId: v.id("workspaces"),
    userId: v.id("users"),
    role,
    createdAt: v.number(),
  })
    .index("by_workspace_user", ["workspaceId", "userId"])
    .index("by_user", ["userId"]),
});
