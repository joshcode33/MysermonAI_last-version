"use client";

import Link from "next/link";
import { useParams } from "next/navigation";
import { useEffect, useMemo, useRef, useState } from "react";
import { useMutation, useQuery } from "convex/react";
import { api } from "@/convex/_generated/api";

// Découpe le sermon en écrans de lecture successifs.
function buildScreens(c) {
  const screens = [
    { key: "intro", label: "Introduction", blocks: [{ t: "h", v: c.title }, { t: "m", v: c.mainPassage }, { t: "k", v: c.centralIdea }, ...c.introduction.paragraphs.map((v) => ({ t: "p", v })) ] },
    { key: "context", label: "Contexte", blocks: c.context.paragraphs.map((v) => ({ t: "p", v })) },
    ...c.points.map((pt, i) => ({
      key: `p${i}`, label: `Point ${i + 1}`,
      blocks: [{ t: "h", v: `${i + 1}. ${pt.title}` }, ...(pt.scriptureRef ? [{ t: "m", v: pt.scriptureRef }] : []), { t: "k", v: pt.keyPoint }, ...pt.paragraphs.map((v) => ({ t: "p", v })), ...(pt.illustration ? [{ t: "i", v: pt.illustration }] : []), ...(pt.application ? [{ t: "a", v: pt.application }] : []), ...(pt.transition ? [{ t: "tr", v: pt.transition }] : [])],
    })),
    { key: "apps", label: "Applications", blocks: c.applications.map((a, i) => ({ t: "p", v: `${i + 1}. ${a.title} — ${a.text}` })) },
    { key: "end", label: "Conclusion", blocks: [...c.conclusion.paragraphs.map((v) => ({ t: "p", v })), ...(c.conclusion.call ? [{ t: "k", v: c.conclusion.call }] : [])] },
  ];
  return screens;
}

export default function PreachingPage() {
  const { id } = useParams();
  const sermon = useQuery(api.sermons.get, id ? { id } : "skip");
  const savedNotes = useQuery(api.sermons.getNotes, id ? { id } : "skip");
  const saveNotes = useMutation(api.sermons.saveNotes);
  const [index, setIndex] = useState(0);
  const [size, setSize] = useState(28);
  const [dark, setDark] = useState(true);
  const [showNotes, setShowNotes] = useState(false);
  const [draft, setDraft] = useState(null); // null = pas encore modifié localement
  const [saved, setSaved] = useState(null);
  const rootRef = useRef(null);
  const screens = useMemo(() => (sermon ? buildScreens(sermon.content) : []), [sermon]);

  useEffect(() => {
    const onKey = (e) => {
      if (["TEXTAREA", "INPUT"].includes(e.target.tagName)) return;
      if (e.key === "ArrowRight" || e.key === " ") setIndex((i) => Math.min(screens.length - 1, i + 1));
      if (e.key === "ArrowLeft") setIndex((i) => Math.max(0, i - 1));
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [screens.length]);

  if (sermon === undefined) return <div className="p-8 text-slate-500">Chargement…</div>;
  if (sermon === null) return <div className="p-8"><p>Sermon introuvable.</p><Link href="/sermons" className="text-violet-600">Mes sermons</Link></div>;

  const screen = screens[Math.min(index, screens.length - 1)];
  const notesValue = draft ?? savedNotes ?? "";
  const palette = dark ? "bg-slate-950 text-slate-100" : "bg-white text-slate-900";

  const fullscreen = () => (document.fullscreenElement ? document.exitFullscreen() : rootRef.current?.requestFullscreen?.());
  const persistNotes = async () => { try { await saveNotes({ id, body: notesValue }); setSaved("Notes enregistrées."); } catch { setSaved("Échec de l’enregistrement."); } };

  return (
    <div ref={rootRef} className={`flex min-h-screen flex-col ${palette}`}>
      <header className="flex flex-wrap items-center justify-between gap-2 border-b border-white/10 px-4 py-3 text-sm">
        <Link href={`/sermon/${id}`} className="font-semibold opacity-80">← Quitter</Link>
        <span className="opacity-70">{screen.label} · {index + 1}/{screens.length}</span>
        <div className="flex items-center gap-2">
          <button type="button" aria-label="Réduire le texte" onClick={() => setSize((s) => Math.max(16, s - 2))} className="rounded-lg border border-white/20 px-3 py-1">A−</button>
          <button type="button" aria-label="Agrandir le texte" onClick={() => setSize((s) => Math.min(64, s + 2))} className="rounded-lg border border-white/20 px-3 py-1">A+</button>
          <button type="button" onClick={() => setDark((d) => !d)} className="rounded-lg border border-white/20 px-3 py-1">{dark ? "Clair" : "Sombre"}</button>
          <button type="button" onClick={() => setShowNotes((n) => !n)} className="rounded-lg border border-white/20 px-3 py-1">Notes</button>
          <button type="button" onClick={fullscreen} className="rounded-lg border border-white/20 px-3 py-1">Plein écran</button>
        </div>
      </header>

      <main className="mx-auto w-full max-w-4xl flex-1 space-y-6 px-5 py-8 leading-relaxed" style={{ fontSize: `${size}px` }}>
        {screen.blocks.map((b, i) => {
          if (b.t === "h") return <h1 key={i} className="font-bold leading-tight">{b.v}</h1>;
          if (b.t === "m") return b.v ? <p key={i} className="text-[0.7em] font-semibold text-violet-400">{b.v}</p> : null;
          if (b.t === "k") return <p key={i} className="rounded-2xl border-l-8 border-violet-500 bg-violet-500/15 p-5 font-semibold">{b.v}</p>;
          if (b.t === "i") return <p key={i} className="italic opacity-90">Illustration : {b.v}</p>;
          if (b.t === "a") return <p key={i}><strong>Application : </strong>{b.v}</p>;
          if (b.t === "tr") return <p key={i} className="text-[0.8em] opacity-60">{b.v}</p>;
          return <p key={i}>{b.v}</p>;
        })}
      </main>

      {showNotes && (
        <section className="border-t border-white/10 p-4" aria-label="Notes personnelles">
          <textarea value={notesValue} onChange={(e) => { setDraft(e.target.value); setSaved(null); }} rows={5} placeholder="Vos notes personnelles (visibles par vous seul)…"
            className="w-full rounded-xl border border-white/20 bg-transparent p-3 text-base" />
          <div className="mt-2 flex items-center gap-3 text-sm">
            <button type="button" onClick={persistNotes} className="rounded-lg bg-violet-600 px-4 py-2 font-semibold text-white">Enregistrer les notes</button>
            {saved && <span role="status" className="opacity-70">{saved}</span>}
          </div>
        </section>
      )}

      <nav className="sticky bottom-0 flex items-center justify-between gap-3 border-t border-white/10 bg-inherit px-4 py-3" aria-label="Navigation entre les sections">
        <button type="button" disabled={index === 0} onClick={() => setIndex(index - 1)} className="h-14 flex-1 rounded-2xl border border-white/20 text-lg font-semibold disabled:opacity-30">← Précédent</button>
        <button type="button" disabled={index === screens.length - 1} onClick={() => setIndex(index + 1)} className="h-14 flex-1 rounded-2xl bg-violet-600 text-lg font-semibold text-white disabled:opacity-30">Suivant →</button>
      </nav>
    </div>
  );
}
