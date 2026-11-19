import test from "node:test";
import assert from "node:assert/strict";
import { checkGenerationAllowed, periodKey, PLANS } from "../convex/lib/plans.js";
import { effectiveSermonRole, canRead, canEdit, canDelete } from "../convex/lib/access.js";

const base = { plan: "free", used: 0, sermonCount: 0, runningJob: false, lastStartedAt: null, now: 1_000_000 };

test("limites d'usage : quota mensuel, génération concurrente, rafales, stockage", () => {
  assert.equal(checkGenerationAllowed(base).ok, true);
  assert.equal(checkGenerationAllowed({ ...base, used: PLANS.free.monthlyGenerations }).code, "quota");
  assert.equal(checkGenerationAllowed({ ...base, runningJob: true }).code, "busy");
  assert.equal(checkGenerationAllowed({ ...base, lastStartedAt: base.now - 1000 }).code, "too_fast");
  assert.equal(checkGenerationAllowed({ ...base, sermonCount: PLANS.free.maxSermons }).code, "storage");
  assert.equal(checkGenerationAllowed({ ...base, plan: "pro", used: 50 }).ok, true);
  assert.equal(checkGenerationAllowed({ ...base, plan: "inconnu" }).ok, true); // retombe sur free
});

test("clé de période mensuelle", () => assert.equal(periodKey(Date.UTC(2026, 9, 15)), "2026-10"));

test("accès : un autre utilisateur ne voit jamais un sermon privé", () => {
  const sermon = { ownerId: "u1" };
  assert.equal(effectiveSermonRole({ userId: "u1", sermon }), "owner");
  assert.equal(effectiveSermonRole({ userId: "u2", sermon }), null);
  assert.equal(effectiveSermonRole({ userId: null, sermon }), null);
  assert.equal(effectiveSermonRole({ userId: "u1", sermon: { ownerId: "u1", deletedAt: 5 } }), null);
});

test("accès : rôles d'espace de travail et appartenance vérifiée", () => {
  const sermon = { ownerId: "u1", workspaceId: "w1" };
  const m = (role, workspaceId = "w1", userId = "u2") => ({ userId, workspaceId, role });
  assert.equal(effectiveSermonRole({ userId: "u2", sermon, membership: m("viewer") }), "viewer");
  assert.equal(effectiveSermonRole({ userId: "u2", sermon, membership: m("editor", "autre") }), null);
  assert.equal(effectiveSermonRole({ userId: "u2", sermon, membership: m("editor", "w1", "u3") }), null);
  assert.deepEqual([canRead("viewer"), canEdit("viewer"), canDelete("viewer")], [true, false, false]);
  assert.deepEqual([canRead("editor"), canEdit("editor"), canDelete("editor")], [true, true, false]);
  assert.deepEqual([canRead("admin"), canEdit("admin"), canDelete("admin")], [true, true, true]);
  assert.deepEqual([canRead(null), canEdit(null), canDelete(null)], [false, false, false]);
});
