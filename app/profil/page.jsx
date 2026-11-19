"use client";

import { useState } from "react";
import { useMutation, useQuery } from "convex/react";
import { api } from "@/convex/_generated/api";
import AppShell from "@/components/AppShell";
import { errorMessage } from "@/lib/sermonForm";

export default function ProfilPage() {
  const viewer = useQuery(api.users.viewer);
  if (viewer === undefined) return <AppShell><p className="text-slate-500">Chargement…</p></AppShell>;
  return (
    <AppShell>
      <h1 className="text-3xl font-bold text-slate-900">Profil et paramètres</h1>
      <p className="mt-1 text-sm text-slate-500">{viewer?.email} · Offre {viewer?.planLabel}</p>
      <ProfileForm key={viewer?.profile?._id ?? "none"} profile={viewer?.profile} />
    </AppShell>
  );
}

function ProfileForm({ profile }) {
  const update = useMutation(api.users.updateProfile);
  const purge = useMutation(api.users.purgeMyData);
  const [form, setForm] = useState({
    displayName: profile?.displayName ?? "",
    ministryName: profile?.ministryName ?? "",
    country: profile?.country ?? "",
  });
  const [status, setStatus] = useState(null);

  const save = async (event) => {
    event.preventDefault();
    try {
      await update(form);
      setStatus({ ok: true, text: "Profil enregistré." });
    } catch (error) {
      setStatus({ ok: false, text: errorMessage(error) });
    }
  };

  const field = (name, label) => (
    <label className="block text-sm font-semibold text-slate-700">
      {label}
      <input
        name={name}
        value={form[name]}
        onChange={(e) => setForm({ ...form, [name]: e.target.value })}
        className="mt-2 h-12 w-full rounded-xl border border-slate-200 bg-white px-4 text-sm font-normal text-slate-900 outline-none focus:border-violet-500"
      />
    </label>
  );

  return (
    <>
      <form onSubmit={save} className="mt-8 space-y-5 rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
        {field("displayName", "Nom affiché")}
        {field("ministryName", "Église ou ministère")}
        {field("country", "Pays")}
        {status && (
          <p role="status" className={`rounded-xl px-4 py-3 text-sm ${status.ok ? "bg-emerald-50 text-emerald-700" : "bg-red-50 text-red-700"}`}>
            {status.text}
          </p>
        )}
        <button type="submit" className="h-12 rounded-xl bg-violet-600 px-6 text-sm font-bold text-white hover:bg-violet-700">
          Enregistrer
        </button>
      </form>
      <section className="mt-8 rounded-2xl border border-red-100 bg-white p-6">
        <h2 className="font-bold text-slate-900">Supprimer mes données</h2>
        <p className="mt-2 text-sm text-slate-500">
          Supprime définitivement vos sermons, versions, notes, favoris et historique d’usage. Cette action est irréversible.
        </p>
        <button
          type="button"
          onClick={async () => {
            if (window.confirm("Supprimer définitivement toutes vos données ?")) {
              await purge();
              setStatus({ ok: true, text: "Suppression lancée." });
            }
          }}
          className="mt-4 rounded-xl border border-red-200 px-5 py-2.5 text-sm font-semibold text-red-600 hover:bg-red-50"
        >
          Supprimer mes données
        </button>
      </section>
    </>
  );
}
