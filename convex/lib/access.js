// Règles d'accès pures (testées) : l'identifiant d'un document n'est jamais une autorisation.
export const ROLES = ["owner", "admin", "editor", "viewer"];
const RANK = { viewer: 1, editor: 2, admin: 3, owner: 4 };

/** Rôle effectif de `userId` sur un sermon : "owner" (auteur), rôle d'espace de travail, ou null. */
export function effectiveSermonRole({ userId, sermon, membership }) {
  if (!userId || !sermon) return null;
  if (sermon.deletedAt) return null;
  if (sermon.ownerId === userId) return "owner";
  if (sermon.workspaceId && membership && membership.userId === userId && membership.workspaceId === sermon.workspaceId) {
    return membership.role;
  }
  return null;
}

export const canRead = (role) => role !== null && RANK[role] >= RANK.viewer;
export const canEdit = (role) => role !== null && RANK[role] >= RANK.editor;
export const canDelete = (role) => role !== null && RANK[role] >= RANK.admin;
