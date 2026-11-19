// Offres et limites : valeurs configurables, à valider par des tests auprès de vrais utilisateurs.
// Aucun prix ici : la facturation n'est pas implémentée (aucun fournisseur de paiement configuré).
export const PLANS = {
  free:   { label: "Gratuit", monthlyGenerations: 5,   maxSermons: 20,   workspaces: false },
  pro:    { label: "Pro",     monthlyGenerations: 100, maxSermons: 1000, workspaces: false },
  church: { label: "Église",  monthlyGenerations: 500, maxSermons: 5000, workspaces: true },
};
export const DEFAULT_PLAN = "free";

export const MIN_SECONDS_BETWEEN_GENERATIONS = 8;
export const STALE_JOB_MS = 6 * 60 * 1000;

export const periodKey = (timestamp) => new Date(timestamp).toISOString().slice(0, 7); // "2026-10"

/** Décision pure : peut-on démarrer une génération ? */
export function checkGenerationAllowed({ plan, used, sermonCount, runningJob, lastStartedAt, now }) {
  const limits = PLANS[plan] ?? PLANS[DEFAULT_PLAN];
  if (runningJob) return { ok: false, code: "busy", message: "Une génération est déjà en cours. Patientez qu'elle se termine." };
  if (lastStartedAt && now - lastStartedAt < MIN_SECONDS_BETWEEN_GENERATIONS * 1000) {
    return { ok: false, code: "too_fast", message: "Trop de demandes rapprochées. Réessayez dans quelques secondes." };
  }
  if (used >= limits.monthlyGenerations) {
    return { ok: false, code: "quota", message: `Limite mensuelle atteinte (${limits.monthlyGenerations} générations avec l'offre ${limits.label}).` };
  }
  if (sermonCount >= limits.maxSermons) {
    return { ok: false, code: "storage", message: `Limite de ${limits.maxSermons} sermons atteinte avec l'offre ${limits.label}.` };
  }
  return { ok: true };
}
