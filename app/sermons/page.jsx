"use client";

import Link from "next/link";
import { useQuery } from "convex/react";
import { api } from "@/convex/_generated/api";
import AppShell from "@/components/AppShell";

const formatDate = (ts) => new Date(ts).toLocaleDateString("fr-FR", { day: "numeric", month: "long", year: "numeric" });

export default function SermonsPage() {
  const sermons = useQuery(api.sermons.list);
  return (
    <AppShell>
      <div className="flex items-center justify-between gap-4">
        <div>
          <p className="text-sm text-slate-400">Historique</p>
          <h1 className="text-3xl font-bold text-slate-900">Mes sermons</h1>
        </div>
        <Link href="/creation-sermon" className="rounded-xl bg-violet-600 px-5 py-3 text-sm font-bold text-white hover:bg-violet-700">+ Nouveau</Link>
      </div>
      {sermons === undefined && <p className="mt-8 text-slate-500">Chargement…</p>}
      {sermons?.length === 0 && (
        <div className="mt-8 rounded-2xl border border-dashed border-slate-300 bg-white p-10 text-center text-slate-500">Aucun sermon pour le moment.</div>
      )}
      <ul className="mt-8 space-y-4">
        {sermons?.map((s) => (
          <li key={s.id}>
            <Link href={`/sermon/${s.id}`} className="block rounded-2xl border border-slate-200 bg-white p-5 shadow-sm hover:border-violet-300">
              <div className="flex items-start justify-between gap-3">
                <h2 className="font-bold text-slate-900">{s.title}</h2>
                <span className={`shrink-0 rounded-full px-2.5 py-0.5 text-xs font-semibold ${s.status === "ready" ? "bg-emerald-50 text-emerald-700" : "bg-slate-100 text-slate-500"}`}>
                  {s.status === "ready" ? "Prêt" : "Brouillon"}
                </span>
              </div>
              <p className="mt-1 text-sm text-slate-500">{s.theme}</p>
              <p className="mt-3 text-xs text-slate-400">{s.mainPassage || "Passage non précisé"} · {formatDate(s.updatedAt)}</p>
            </Link>
          </li>
        ))}
      </ul>
    </AppShell>
  );
}
