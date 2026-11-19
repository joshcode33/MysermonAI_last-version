import { getAuthUserId } from "@convex-dev/auth/server";
import { ConvexError } from "convex/values";
import { effectiveSermonRole } from "./access.js";

export const fail = (code, message, extra = {}) => new ConvexError({ code, message, ...extra });

export async function requireUserId(ctx) {
  const userId = await getAuthUserId(ctx);
  if (!userId) throw fail("unauthenticated", "Connexion requise.");
  return userId;
}

export async function ensureProfile(ctx, userId) {
  const existing = await ctx.db.query("profiles").withIndex("by_user", (q) => q.eq("userId", userId)).unique();
  if (existing) return existing;
  const user = await ctx.db.get(userId);
  const id = await ctx.db.insert("profiles", {
    userId,
    displayName: user?.name || (user?.email ? user.email.split("@")[0] : "Utilisateur"),
    language: "fr",
    plan: "free",
    sermonCount: 0,
    preferences: {},
    createdAt: Date.now(),
  });
  return await ctx.db.get(id);
}

/**
 * Charge un sermon ET vérifie le droit d'accès côté serveur.
 * Un sermon inexistant, supprimé ou non autorisé renvoie la même erreur (pas de fuite d'existence).
 */
export async function loadSermonWithRole(ctx, sermonId, userId) {
  const sermon = sermonId ? await ctx.db.get(sermonId) : null;
  let membership = null;
  if (sermon?.workspaceId) {
    membership = await ctx.db
      .query("workspaceMembers")
      .withIndex("by_workspace_user", (q) => q.eq("workspaceId", sermon.workspaceId).eq("userId", userId))
      .unique();
  }
  const role = effectiveSermonRole({ userId, sermon, membership });
  if (!role) throw fail("not_found", "Sermon introuvable.");
  return { sermon, role };
}
