// @vitest-environment edge-runtime
import { convexTest } from "convex-test";
import { describe, expect, it } from "vitest";
import schema from "../convex/schema.js";
import { api, internal } from "../convex/_generated/api.js";

const modules = import.meta.glob("../convex/**/*.js");

const sermonContent = {
  title: "Test sermon",
  theme: "Grace",
  mainPassage: "",
  objective: "Teach about grace",
  centralIdea: "Grace is a gift",
  introduction: { paragraphs: ["Introduction"] },
  context: { paragraphs: ["Context"] },
  points: [{
    title: "Grace received",
    scriptureRef: "",
    paragraphs: ["Development"],
    keyPoint: "Grace is received",
    illustration: "",
    application: "",
    transition: "",
  }],
  applications: [{ title: "Practice", text: "Show grace" }],
  conclusion: { paragraphs: ["Conclusion"], call: "" },
  reflectionQuestions: [],
  relatedReferences: [],
};

async function createUser(t, name) {
  return await t.run((ctx) => ctx.db.insert("users", { name }));
}

function asUser(t, userId) {
  return t.withIdentity({
    subject: String(userId),
    tokenIdentifier: String(userId),
    issuer: "https://test.example",
  });
}

describe("assistant Convex ownership", () => {
  it("searches and returns exact fixture verses and flags absent references", async () => {
    const t = convexTest(schema, modules);
    const userId = await createUser(t, "Reader");
    const translationId = await t.run(async (ctx) => {
      const id = await ctx.db.insert("bibleTranslations", {
        code: "FIX",
        name: "Synthetic fixture",
        language: "fr",
        license: {
          status: "demo",
          holder: "Test fixture",
          source: "Synthetic test data",
          verifiedBy: "Tests",
          verifiedAt: 1_700_000_000_000,
          commercialUseVerified: true,
        },
        books: [],
        verseCount: 11,
        isActive: true,
        isDefault: true,
        importedAt: 1_700_000_000_000,
      });
      for (const [verse, text] of [
        [15, "Synthetic context before."],
        [16, "Synthetic grace-token verse."],
        [17, "Synthetic context after."],
        ...Array.from({ length: 8 }, (_, index) => [18 + index, "x".repeat(900)]),
      ]) {
        await ctx.db.insert("bibleVerses", { translationId: id, bookId: "JHN", chapter: 3, verse, text });
      }
      return id;
    });

    const passage = await t.query(internal.assistant.getPassageForAgent, {
      userId,
      reference: "Jean 3:16",
    });
    expect(passage.verses.map(({ verse, text }) => [verse, text]))
      .toEqual([[16, "Synthetic grace-token verse."]]);
    expect(passage.translation.code).toBe("FIX");
    expect(passage.sources[0].translationName).toBe("Synthetic fixture");

    const longPassage = await t.query(internal.assistant.getPassageForAgent, {
      userId,
      reference: "Jean 3",
      translationId,
    });
    expect(longPassage.warnings.some(({ code }) => code === "passage_truncated")).toBe(true);
    expect(JSON.stringify(longPassage).length).toBeLessThan(12_000);

    const search = await t.query(internal.assistant.searchBibleForAgent, {
      userId,
      query: "grace-token",
      translationId,
    });
    expect(search.results.map(({ reference }) => reference)).toEqual(["Jean 3:16"]);

    const verified = await t.query(internal.assistant.verifyReferencesForAgent, {
      userId,
      references: ["Jean 3:16", "Jean 3:40"],
      translationId,
    });
    expect(verified.sources.map(({ status }) => status)).toEqual(["verified", "no_text"]);
  });

  it("limits conversation listings and thread loading to the owning account", async () => {
    const t = convexTest(schema, modules);
    const ownerId = await createUser(t, "Owner");
    const otherId = await createUser(t, "Other");
    const now = 1_700_000_000_000;
    const ownerThread = await t.run((ctx) => ctx.db.insert("assistantThreads", {
      userId: ownerId,
      componentThreadId: "owner-thread",
      title: "Owner thread",
      createdAt: now,
      updatedAt: now,
    }));
    await t.run((ctx) => ctx.db.insert("assistantThreads", {
      userId: otherId,
      componentThreadId: "other-thread",
      title: "Other thread",
      createdAt: now,
      updatedAt: now,
    }));

    expect(await t.query(api.assistant.conversations, {})).toEqual([]);
    expect((await asUser(t, ownerId).query(api.assistant.conversations, {})).map(({ title }) => title))
      .toEqual(["Owner thread"]);
    await expect(asUser(t, otherId).query(internal.assistant.loadThread, {
      threadId: ownerThread,
      userId: otherId,
    })).rejects.toThrow("Conversation introuvable.");
  });

  it("saves a validated sermon to its owner and hides it from other accounts", async () => {
    const t = convexTest(schema, modules);
    const ownerId = await createUser(t, "Owner");
    const otherId = await createUser(t, "Other");
    const sermonId = await t.mutation(internal.assistant.saveSermonInternal, {
      userId: ownerId,
      title: sermonContent.title,
      content: sermonContent,
      sources: [],
      warnings: [],
      provider: "test",
      model: "fixture",
    });

    expect(await asUser(t, ownerId).query(api.sermons.get, { id: sermonId })).not.toBeNull();
    expect(await asUser(t, otherId).query(api.sermons.get, { id: sermonId })).toBeNull();
    expect((await asUser(t, otherId).query(api.sermons.list, {})).map(({ id }) => id))
      .not.toContain(sermonId);
  });
});
