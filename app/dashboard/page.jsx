"use client";

import Link from "next/link";
import { useEffect } from "react";
import { useMutation, useQuery } from "convex/react";
import { api } from "@/convex/_generated/api";
import AppShell from "@/components/AppShell";

const formatDate = (ts) => new Date(ts).toLocaleDateString("fr-FR", { day: "numeric", month: "long", year: "numeric" });

export default function DashboardPage() {
  const viewer = useQuery(api.users.viewer);
  const recent = useQuery(api.sermons.recent);
  const progress = useQuery(api.bible.getProgress);
  const ensureProfile = useMutation(api.users.ensureMyProfile);

  useEffect(() => {
    if (viewer && viewer.profile === null) ensureProfile();
  }, [viewer, ensureProfile]);

  const name = viewer?.profile?.displayName;
  const usage = viewer?.usage;

  return (
    <AppShell wide>
      <header className="flex flex-col justify-between gap-4 sm:flex-row sm:items-center">
        <div>
          <p className="text-sm text-slate-400">Tableau de bord</p>
          <h1 className="text-3xl font-bold text-slate-900">{name ? `Bonjour, ${name}` : "Bonjour"}</h1>
        </div>
        <Link href="/creation-sermon" className="rounded-xl bg-violet-600 px-5 py-3 text-center text-sm font-bold text-white hover:bg-violet-700">
          + Nouveau sermon
        </Link>
      </header>

      <div className="mt-8 grid gap-5 lg:grid-cols-3">
        <section className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm lg:col-span-2" aria-labelledby="recent-title">
          <h2 id="recent-title" className="font-bold text-slate-900">Reprendre mon travail</h2>
          {recent === undefined && <p className="mt-4 text-sm text-slate-500">Chargement…</p>}
          {recent && recent.length === 0 && (
            <p className="mt-4 text-sm text-slate-500">Aucun sermon pour le moment. <Link href="/creation-sermon" className="font-semibold text-violet-600">Préparer le premier</Link>.</p>
          )}
          <ul className="mt-4 divide-y divide-slate-100">
            {recent?.map((s) => (
              <li key={s.id}>
                <Link href={`/sermon/${s.id}`} className="block py-3 hover:text-violet-700">
                  <span className="font-semibold text-slate-900">{s.title}</span>
                  <span className="mt-0.5 block text-xs text-slate-400">
                    {s.mainPassage || "Passage non précisé"} · modifié le {formatDate(s.updatedAt)}
                  </span>
                </Link>
              </li>
            ))}
          </ul>
        </section>

        <div className="space-y-5">
          <section className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm" aria-labelledby="plan-title">
            <h2 id="plan-title" className="font-bold text-slate-900">Mon offre</h2>
            {usage ? (
              <>
                <p className="mt-3 text-sm text-slate-500">Offre {viewer.planLabel}</p>
                <p className="mt-2 text-2xl font-bold text-slate-900">{usage.generations}<span className="text-base font-medium text-slate-400"> / {usage.limit}</span></p>
                <p className="text-xs text-slate-400">générations ce mois-ci</p>
                <div className="mt-3 h-2 overflow-hidden rounded-full bg-slate-100" role="progressbar" aria-valuenow={usage.generations} aria-valuemin={0} aria-valuemax={usage.limit}>
                  <div className="h-full bg-violet-500" style={{ width: `${Math.min(100, (usage.generations / usage.limit) * 100)}%` }} />
                </div>
              </>
            ) : <p className="mt-3 text-sm text-slate-500">Chargement…</p>}
          </section>

          <section className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm" aria-labelledby="bible-title">
            <h2 id="bible-title" className="font-bold text-slate-900">Lecture biblique</h2>
            {progress ? (
              <Link href={`/bible?book=${progress.bookId}&chapter=${progress.chapter}`} className="mt-3 block text-sm font-semibold text-violet-600">
                Reprendre : {progress.bookName} {progress.chapter}
              </Link>
            ) : <Link href="/bible" className="mt-3 block text-sm font-semibold text-violet-600">Ouvrir la Bible</Link>}
          </section>
        </div>
      </div>
    </AppShell>
  );
}
