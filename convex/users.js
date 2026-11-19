import { query, mutation, internalMutation } from "./_generated/server";
import { internal } from "./_generated/api";
import { v } from "convex/values";
import { getAuthUserId } from "@convex-dev/auth/server";
import { ensureProfile, requireUserId } from "./lib/session.js";
import { PLANS, DEFAULT_PLAN, periodKey } from "./lib/plans.js";

export const viewer = query({
  args: {},
  handler: async (ctx) => {
    const userId = await getAuthUserId(ctx);
    if (!userId) return null;
    const user = await ctx.db.get(userId);
    const profile = await ctx.db.query("profiles").withIndex("by_user", (q) => q.eq("userId", userId)).unique();
    const plan = profile?.plan ?? DEFAULT_PLAN;
    const counter = await ctx.db
      .query("usageCounters")
      .withIndex("by_owner_period", (q) => q.eq("ownerId", userId).eq("period", periodKey(Date.now())))
      .unique();
    return {
      id: userId,
      email: user?.email ?? null,
      profile, // null tant que ensureProfile n'a pas tourné
      plan,
      planLabel: PLANS[plan].label,
      usage: { generations: counter?.generations ?? 0, limit: PLANS[plan].monthlyGenerations, sermonCount: profile?.sermonCount ?? 0, maxSermons: PLANS[plan].maxSermons },
    };
  },
});

export const ensureMyProfile = mutation({
  args: {},
  handler: async (ctx) => {
    const userId = await requireUserId(ctx);
    await ensureProfile(ctx, userId);
    return null;
  },
});

// Le plan n'est volontairement PAS modifiable ici.
export const updateProfile = mutation({
  args: {
    displayName: v.optional(v.string()),
    ministryName: v.optional(v.string()),
    country: v.optional(v.string()),
    preferences: v.optional(
      v.object({
        defaultTone: v.optional(v.string()),
        defaultAudience: v.optional(v.string()),
        defaultDurationMinutes: v.optional(v.number()),
        translationId: v.optional(v.id("bibleTranslations")),
        readerFontSize: v.optional(v.number()),
      })
    ),
  },
  handler: async (ctx, args) => {
    const userId = await requireUserId(ctx);
    const profile = await ensureProfile(ctx, userId);
    const patch = {};
    if (args.displayName !== undefined) patch.displayName = args.displayName.trim().slice(0, 100) || profile.displayName;
    if (args.ministryName !== undefined) patch.ministryName = args.ministryName.trim().slice(0, 150);
    if (args.country !== undefined) patch.country = args.country.trim().slice(0, 80);
    if (args.preferences !== undefined) {
      const p = { ...args.preferences };
      if (p.readerFontSize !== undefined) p.readerFontSize = Math.min(32, Math.max(12, p.readerFontSize));
      if (p.defaultDurationMinutes !== undefined) p.defaultDurationMinutes = Math.min(120, Math.max(5, Math.round(p.defaultDurationMinutes)));
      patch.preferences = p;
    }
    await ctx.db.patch(profile._id, patch);
    return null;
  },
});

// Suppression des données applicatives de l'utilisateur, par lots (reprogrammés jusqu'à épuisement).
// La suppression des enregistrements d'authentification (comptes/sessions) reste à vérifier : voir docs/STATUS.md.
export const purgeMyData = mutation({
  args: {},
  handler: async (ctx) => {
    const userId = await requireUserId(ctx);
    await ctx.scheduler.runAfter(0, internal.users.purgeBatch, { userId });
    return null;
  },
});

export const purgeBatch = internalMutation({
  args: { userId: v.id("users") },
  handler: async (ctx, { userId }) => {
    let more = false;
    const sermons = await ctx.db.query("sermons").withIndex("by_owner_updated", (q) => q.eq("ownerId", userId)).take(25);
    for (const s of sermons) {
      for (const row of await ctx.db.query("sermonVersions").withIndex("by_sermon", (q) => q.eq("sermonId", s._id)).collect()) await ctx.db.delete(row._id);
      for (const row of await ctx.db.query("sermonNotes").withIndex("by_sermon_user", (q) => q.eq("sermonId", s._id)).collect()) await ctx.db.delete(row._id);
      await ctx.db.delete(s._id);
    }
    if (sermons.length === 25) more = true;
    for (const [table, index, field] of [
      ["bibleFavorites", "by_user", "userId"],
      ["readingProgress", "by_user", "userId"],
      ["generationJobs", "by_owner_started", "ownerId"],
      ["usageCounters", "by_owner_period", "ownerId"],
    ]) {
      const rows = await ctx.db.query(table).withIndex(index, (q) => q.eq(field, userId)).take(100);
      for (const r of rows) await ctx.db.delete(r._id);
      if (rows.length === 100) more = true;
    }
    const notes = await ctx.db.query("bibleNotes").withIndex("by_user_chapter", (q) => q.eq("userId", userId)).take(100);
    for (const n of notes) await ctx.db.delete(n._id);
    if (notes.length === 100) more = true;
    if (more) {
      await ctx.scheduler.runAfter(0, internal.users.purgeBatch, { userId });
    } else {
      const profile = await ctx.db.query("profiles").withIndex("by_user", (q) => q.eq("userId", userId)).unique();
      if (profile) await ctx.db.patch(profile._id, { sermonCount: 0, displayName: "Compte vidé", ministryName: undefined, country: undefined, preferences: {} });
    }
  },
});
