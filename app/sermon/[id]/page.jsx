"use client";

import Link from "next/link";
import { useParams, useRouter } from "next/navigation";
import { useState } from "react";
import { useMutation, useQuery } from "convex/react";
import { api } from "@/convex/_generated/api";
import AppShell from "@/components/AppShell";
import SectionEditor from "@/components/SectionEditor";
import { errorMessage } from "@/lib/sermonForm";

const STATUS = {
  verified: { label: "Vérifiée dans la Bible intégrée", cls: "bg-emerald-50 text-emerald-700" },
  no_text: { label: "Texte indisponible — à vérifier", cls: "bg-amber-50 text-amber-700" },
  invalid: { label: "Référence non reconnue", cls: "bg-red-50 text-red-700" },
};
const EDIT_ROLES = ["owner", "admin", "editor"];
const swap = (arr, i, j) => { const a = [...arr]; [a[i], a[j]] = [a[j], a[i]]; return a; };

export default function SermonPage() {
  const { id } = useParams();
  const router = useRouter();
  const sermon = useQuery(api.sermons.get, id ? { id } : "skip");
  const versions = useQuery(api.sermons.listVersions, id ? { id } : "skip");
  const updateSection = useMutation(api.sermons.updateSection);
  const restoreVersion = useMutation(api.sermons.restoreVersion);
  const setStatus = useMutation(api.sermons.setStatus);
  const remove = useMutation(api.sermons.remove);
  const [editing, setEditing] = useState(null); // chemin en cours d'édition, ou "points.new"
  const [notice, setNotice] = useState(null);
  const [showVersions, setShowVersions] = useState(false);

  if (sermon === undefined) return <AppShell><p className="text-slate-500">Chargement…</p></AppShell>;
  if (sermon === null) {
    return (
      <AppShell>
        <div className="text-center">
          <h1 className="text-2xl font-bold">Sermon introuvable</h1>
          <p className="mt-2 text-slate-500">Il n’existe pas ou vous n’y avez pas accès.</p>
          <Link href="/sermons" className="mt-6 inline-block rounded-xl bg-violet-600 px-5 py-3 font-bold text-white">Mes sermons</Link>
        </div>
      </AppShell>
    );
  }

  const c = sermon.content;
  const canEdit = EDIT_ROLES.includes(sermon.role);
  const run = async (fn) => { setNotice(null); try { await fn(); } catch (e) { setNotice(errorMessage(e)); } };
  const save = (path) => async (value) => { await updateSection({ id, expectedVersion: sermon.version, path, value }); setEditing(null); };
  // edit() -> { panel, button } : le panneau d'édition (si cette partie est en cours d'édition) et le bouton « Modifier ».
  const edit = (path, value, label, isNew = false) => ({
    panel: editing === path ? (
      <SectionEditor key={path} sermonId={id} path={path.replace(".new", "")} value={value} isNew={isNew}
        onSave={isNew ? async (v) => { await updateSection({ id, expectedVersion: sermon.version, path: "points", value: [...c.points, v] }); setEditing(null); } : save(path)}
        onCancel={() => setEditing(null)} />
    ) : null,
    button: canEdit && editing === null ? (
      <button type="button" onClick={() => setEditing(path)} className="text-xs font-semibold text-violet-600 print:hidden" aria-label={`Modifier ${label}`}>Modifier</button>
    ) : null,
  });

  return (
    <AppShell>
      <div className="mb-6 flex flex-wrap items-center justify-between gap-3 print:hidden">
        <Link href="/sermons" className="font-semibold text-violet-600">← Mes sermons</Link>
        <div className="flex flex-wrap gap-2">
          <Link href={`/sermon/${id}/precher`} className="rounded-xl bg-violet-600 px-4 py-2 text-sm font-bold text-white hover:bg-violet-700">Mode prédication</Link>
          <button type="button" onClick={() => window.print()} className="rounded-xl border border-slate-200 bg-white px-4 py-2 text-sm font-semibold text-slate-700 hover:bg-slate-50">Imprimer / PDF</button>
          {canEdit && <button type="button" onClick={() => run(() => setStatus({ id, status: sermon.status === "ready" ? "draft" : "ready" }))} className="rounded-xl border border-slate-200 bg-white px-4 py-2 text-sm font-semibold text-slate-700 hover:bg-slate-50">{sermon.status === "ready" ? "Repasser en brouillon" : "Marquer comme prêt"}</button>}
          <button type="button" onClick={() => setShowVersions((v) => !v)} className="rounded-xl border border-slate-200 bg-white px-4 py-2 text-sm font-semibold text-slate-700 hover:bg-slate-50">Versions</button>
        </div>
      </div>

      {notice && <p role="alert" className="mb-4 rounded-xl bg-red-50 px-4 py-3 text-sm text-red-700">{notice}</p>}

      {showVersions && (
        <section className="mb-6 rounded-2xl border border-slate-200 bg-white p-5 print:hidden" aria-label="Versions antérieures">
          <h2 className="font-bold text-slate-900">Versions antérieures</h2>
          {versions?.length === 0 && <p className="mt-2 text-sm text-slate-500">Aucune version antérieure : elles sont créées à chaque modification.</p>}
          <ul className="mt-3 divide-y divide-slate-100 text-sm">
            {versions?.map((v) => (
              <li key={v.version} className="flex items-center justify-between gap-3 py-2">
                <span className="text-slate-600">v{v.version} — {v.reason} · {new Date(v.createdAt).toLocaleString("fr-FR")}</span>
                {canEdit && <button type="button" onClick={() => run(() => restoreVersion({ id, version: v.version, expectedVersion: sermon.version }))} className="font-semibold text-violet-600">Restaurer</button>}
              </li>
            ))}
          </ul>
        </section>
      )}

      <section className="rounded-3xl bg-gradient-to-br from-violet-700 to-indigo-600 p-7 text-white print:bg-none print:p-0 print:text-black">
        <div className="flex items-start justify-between gap-3">
          <h1 className="text-3xl font-bold">{c.title}</h1>
          {sermon.status === "ready" && <span className="rounded-full bg-white/20 px-3 py-1 text-xs font-semibold print:hidden">Prêt</span>}
        </div>
        <p className="mt-2 text-violet-100 print:text-slate-600">{c.theme}</p>
        {c.mainPassage && <p className="mt-5 text-sm font-semibold">{c.mainPassage}</p>}
        {canEdit && editing === null && (
          <div className="mt-4 flex gap-4 text-xs font-semibold text-violet-100 print:hidden">
            <button type="button" onClick={() => setEditing("title")}>Modifier le titre</button>
            <button type="button" onClick={() => setEditing("theme")}>Modifier le thème</button>
          </div>
        )}
      </section>
      {(editing === "title" || editing === "theme") && <div className="mt-4">{edit(editing, c[editing], editing).panel}</div>}

      {sermon.warnings?.length > 0 && (
        <aside role="note" className="mt-6 rounded-2xl border border-amber-200 bg-amber-50 p-5 text-sm text-amber-900 print:hidden">
          <p className="font-bold">À vérifier avant de prêcher</p>
          <ul className="mt-2 list-disc space-y-1 pl-5">{sermon.warnings.map((w, i) => <li key={i}>{w.message}</li>)}</ul>
        </aside>
      )}

      <article className="mt-8 rounded-2xl border border-slate-200 bg-white p-6 shadow-sm sm:p-10 print:border-0 print:p-0 print:shadow-none">
        <Block title="Objectif" action={edit("objective", c.objective, "l'objectif")}>{editing !== "objective" && <p>{c.objective}</p>}</Block>
        <Block title="Idée centrale" action={edit("centralIdea", c.centralIdea, "l'idée centrale")}>{editing !== "centralIdea" && <p>{c.centralIdea}</p>}</Block>
        <Block title="Introduction" action={edit("introduction", c.introduction, "l'introduction")}>{editing !== "introduction" && c.introduction.paragraphs.map((p, i) => <p key={i}>{p}</p>)}</Block>
        <Block title="Contexte du passage" action={edit("context", c.context, "le contexte")}>{editing !== "context" && c.context.paragraphs.map((p, i) => <p key={i}>{p}</p>)}</Block>

        {c.points.map((pt, i) => (
          <Block key={i} title={`${String(i + 1).padStart(2, "0")} — ${pt.title}`} action={edit(`points.${i}`, pt, `le point ${i + 1}`)}
            extra={canEdit && editing === null && (
              <span className="flex gap-2 text-xs font-semibold text-slate-400 print:hidden">
                <button type="button" disabled={i === 0} onClick={() => run(() => updateSection({ id, expectedVersion: sermon.version, path: "points", value: swap(c.points, i, i - 1) }))} aria-label="Monter ce point">↑</button>
                <button type="button" disabled={i === c.points.length - 1} onClick={() => run(() => updateSection({ id, expectedVersion: sermon.version, path: "points", value: swap(c.points, i, i + 1) }))} aria-label="Descendre ce point">↓</button>
                <button type="button" disabled={c.points.length <= 1} onClick={() => window.confirm("Supprimer ce point ?") && run(() => updateSection({ id, expectedVersion: sermon.version, path: "points", value: c.points.filter((_, j) => j !== i) }))} className="text-red-500">Supprimer</button>
              </span>)}>
            {editing !== `points.${i}` && (<>
              {pt.scriptureRef && <p className="text-sm font-semibold text-violet-700">{pt.scriptureRef}</p>}
              {pt.paragraphs.map((p, j) => <p key={j}>{p}</p>)}
              <Callout>{pt.keyPoint}</Callout>
              {pt.illustration && <p><em>Illustration : </em>{pt.illustration}</p>}
              {pt.application && <p><strong>Application : </strong>{pt.application}</p>}
              {pt.transition && <p className="text-slate-400">{pt.transition}</p>}
            </>)}
          </Block>
        ))}
        {canEdit && c.points.length < 8 && (editing === "points.new"
          ? edit("points.new", null, "un nouveau point", true).panel
          : <button type="button" onClick={() => setEditing("points.new")} className="mb-10 text-sm font-semibold text-violet-600 print:hidden">+ Ajouter un point</button>)}

        <Block title="Applications" action={edit("applications", c.applications, "les applications")}>{editing !== "applications" && c.applications.map((a, i) => <p key={i}><strong>{i + 1}. {a.title}</strong> — {a.text}</p>)}</Block>
        <Block title="Conclusion" action={edit("conclusion", c.conclusion, "la conclusion")}>{editing !== "conclusion" && (<>{c.conclusion.paragraphs.map((p, i) => <p key={i}>{p}</p>)}{c.conclusion.call && <Callout>{c.conclusion.call}</Callout>}</>)}</Block>
        <Block title="Questions de réflexion" action={edit("reflectionQuestions", c.reflectionQuestions, "les questions")}>{editing !== "reflectionQuestions" && (c.reflectionQuestions?.length ? <ul className="list-disc space-y-1 pl-5">{c.reflectionQuestions.map((q, i) => <li key={i}>{q}</li>)}</ul> : <p className="text-sm text-slate-400">Aucune question.</p>)}</Block>
        <Block title="Références complémentaires" action={edit("relatedReferences", c.relatedReferences, "les références")}>{editing !== "relatedReferences" && (c.relatedReferences?.length ? <p>{c.relatedReferences.join(" · ")}</p> : <p className="text-sm text-slate-400">Aucune.</p>)}</Block>

        <Block title="Sources bibliques">
          <p className="text-sm text-slate-500">Les textes ci-dessous proviennent de la Bible intégrée, pas du modèle IA. Les interprétations et applications restent à discerner par le prédicateur.</p>
          <ul className="space-y-4">
            {sermon.sources.map((s, i) => (
              <li key={i} className="rounded-xl border border-slate-100 p-4">
                <div className="flex flex-wrap items-center gap-2">
                  {s.key ? <Link href={bibleLink(s)} className="font-semibold text-slate-900 underline-offset-2 hover:underline print:no-underline">{s.reference}</Link> : <span className="font-semibold text-slate-900">{s.reference}</span>}
                  <span className={`rounded-full px-2.5 py-0.5 text-xs font-semibold ${STATUS[s.status]?.cls}`}>{STATUS[s.status]?.label}</span>
                </div>
                {s.verses?.length > 0 && <p className="mt-2 text-sm leading-7 text-slate-600">{s.verses.map((v) => <span key={`${v.chapter ?? ""}-${v.verse}`}><sup className="mr-1 text-violet-500">{v.verse}</sup>{v.text} </span>)}</p>}
              </li>
            ))}
          </ul>
        </Block>
      </article>

      <footer className="mt-4 flex flex-wrap items-center justify-between gap-3 text-xs text-slate-400 print:hidden">
        <span>Généré avec le modèle {sermon.generation.model} en {Math.round(sermon.generation.durationMs / 1000)} s · version {sermon.version}</span>
        {sermon.role !== "viewer" && sermon.role !== "editor" && (
          <button type="button" onClick={() => window.confirm("Supprimer ce sermon ?") && run(async () => { await remove({ id }); router.replace("/sermons"); })} className="font-semibold text-red-500">Supprimer ce sermon</button>
        )}
      </footer>
    </AppShell>
  );
}

// "JHN|3|16||" -> /bible?book=JHN&chapter=3&verse=16
function bibleLink(s) {
  const [book, chapter, verse] = String(s.key).split("|");
  return `/bible?book=${book}&chapter=${chapter}${verse ? `&verse=${verse}` : ""}`;
}

function Block({ title, children, action, extra }) {
  return (
    <section className="mb-10 break-inside-avoid-page">
      <div className="flex items-center justify-between gap-3">
        <h2 className="text-2xl font-bold text-slate-900">{title}</h2>
        <div className="flex items-center gap-3">{extra}{action?.button}</div>
      </div>
      {action?.panel && <div className="mt-4">{action.panel}</div>}
      <div className="mt-4 space-y-4 leading-8 text-slate-600">{children}</div>
    </section>
  );
}
const Callout = ({ children }) => <p className="rounded-xl bg-violet-50 p-5 font-medium text-violet-900">{children}</p>;
