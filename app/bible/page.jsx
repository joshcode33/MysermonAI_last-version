"use client";

import Link from "next/link";
import { Suspense, useEffect, useMemo, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { useMutation, useQuery } from "convex/react";
import { api } from "@/convex/_generated/api";
import AppShell from "@/components/AppShell";
import { BOOKS, BOOK_BY_ID } from "@/convex/lib/bible/books";

export default function BiblePage() {
  return (
    <AppShell wide>
      <Suspense fallback={<p className="text-slate-500">Chargement…</p>}><Reader /></Suspense>
    </AppShell>
  );
}

function Reader() {
  const router = useRouter();
  const params = useSearchParams();
  const translations = useQuery(api.bible.translations);
  const viewer = useQuery(api.users.viewer);
  const progress = useQuery(api.bible.getProgress);
  const favorites = useQuery(api.bible.listFavorites);
  const setProgress = useMutation(api.bible.setProgress);
  const toggleFavorite = useMutation(api.bible.toggleFavorite);
  const updateProfile = useMutation(api.users.updateProfile);

  const [chosenTranslation, setChosenTranslation] = useState(null);
  const [selected, setSelected] = useState([]); // numéros de versets sélectionnés
  const [query, setQuery] = useState("");
  const [submitted, setSubmitted] = useState("");
  const [pendingSize, setPendingSize] = useState(null);
  const [message, setMessage] = useState(null);

  const translation = useMemo(() => {
    if (!translations?.length) return null;
    return translations.find((t) => t.id === chosenTranslation) ?? translations.find((t) => t.isDefault) ?? translations[0];
  }, [translations, chosenTranslation]);

  const bookParam = params.get("book");
  const chapterParam = Number(params.get("chapter"));
  const resumeBook = progress && progress.translationId === translation?.id ? progress : null;
  const availableBooks = translation ? BOOKS.filter((b) => translation.books.some((x) => x.bookId === b.id)) : [];
  const bookId = BOOK_BY_ID[bookParam] && availableBooks.some((b) => b.id === bookParam) ? bookParam : (resumeBook?.bookId ?? availableBooks[0]?.id ?? null);
  const maxChapter = translation?.books.find((b) => b.bookId === bookId)?.chapters ?? 1;
  const chapter = chapterParam >= 1 && chapterParam <= maxChapter ? chapterParam : (bookId === resumeBook?.bookId ? resumeBook.chapter : 1);
  const highlight = Number(params.get("verse")) || null;

  const data = useQuery(api.bible.chapter, translation && bookId ? { translationId: translation.id, bookId, chapter } : "skip");
  const results = useQuery(api.bible.search, translation && submitted ? { translationId: translation.id, q: submitted } : "skip");
  const notes = useQuery(api.bible.notesForChapter, bookId ? { bookId, chapter } : "skip");
  const fontSize = pendingSize ?? viewer?.profile?.preferences?.readerFontSize ?? 18;

  useEffect(() => {
    if (translation && bookId && data?.verses?.length) setProgress({ translationId: translation.id, bookId, chapter }).catch(() => {});
  }, [translation, bookId, chapter, data?.verses?.length, setProgress]);

  const go = (book, ch, verse) => {
    setSelected([]);
    router.replace(`/bible?book=${book}&chapter=${ch}${verse ? `&verse=${verse}` : ""}`);
  };

  if (translations === undefined) return <p className="text-slate-500">Chargement…</p>;
  if (!translation) {
    return (
      <div className="rounded-2xl border border-dashed border-slate-300 bg-white p-10 text-center">
        <h1 className="text-2xl font-bold text-slate-900">Bible</h1>
        <p className="mt-3 text-slate-500">Aucune édition biblique n’est installée pour le moment.</p>
        <p className="mt-1 text-sm text-slate-400">L’administrateur doit importer une édition dont la licence est vérifiée.</p>
      </div>
    );
  }

  const range = selected.length ? [Math.min(...selected), Math.max(...selected)] : null;
  const label = range ? `${BOOK_BY_ID[bookId].name} ${chapter}:${range[0]}${range[1] !== range[0] ? `-${range[1]}` : ""}` : `${BOOK_BY_ID[bookId]?.name} ${chapter}`;
  const selectedText = () => data.verses.filter((v) => selected.includes(v.verse)).map((v) => v.text).join(" ");
  const flash = (text) => { setMessage(text); setTimeout(() => setMessage(null), 2500); };
  const copy = async () => { await navigator.clipboard.writeText(`« ${selectedText()} » — ${label} (${translation.code})`); flash("Passage copié."); };
  const share = async () => {
    const text = `« ${selectedText()} » — ${label} (${translation.code})`;
    if (navigator.share) { try { await navigator.share({ text }); } catch { /* annulé */ } } else { await navigator.clipboard.writeText(text); flash("Passage copié."); }
  };
  const fav = async () => { const r = await toggleFavorite({ translationId: translation.id, bookId, chapter, verseStart: range[0], verseEnd: range[1] }); flash(r.favorite ? "Ajouté aux favoris." : "Retiré des favoris."); };
  const resize = (delta) => { const next = Math.min(32, Math.max(14, fontSize + delta)); setPendingSize(next); updateProfile({ preferences: { ...(viewer?.profile?.preferences ?? {}), readerFontSize: next } }).catch(() => {}); };
  const toggle = (n) => setSelected((s) => (s.includes(n) ? s.filter((x) => x !== n) : [...s, n]));

  return (
    <div className="grid gap-6 lg:grid-cols-[1fr_320px]">
      <section aria-label="Lecteur biblique">
        <div className="flex flex-wrap items-end gap-3">
          <Select label="Édition" value={translation.id} onChange={(v) => { setChosenTranslation(v); setSelected([]); }} options={translations.map((t) => [t.id, `${t.name} (${t.code})`])} />
          <Select label="Livre" value={bookId} onChange={(v) => go(v, 1)} options={availableBooks.map((b) => [b.id, b.name])} />
          <Select label="Chapitre" value={chapter} onChange={(v) => go(bookId, Number(v))} options={Array.from({ length: maxChapter }, (_, i) => [i + 1, String(i + 1)])} />
          <div className="ml-auto flex gap-1" role="group" aria-label="Taille du texte">
            <button type="button" onClick={() => resize(-2)} className="h-10 rounded-lg border border-slate-200 bg-white px-3 text-sm font-semibold">A−</button>
            <button type="button" onClick={() => resize(2)} className="h-10 rounded-lg border border-slate-200 bg-white px-3 text-sm font-semibold">A+</button>
          </div>
        </div>

        <article className="mt-5 rounded-2xl border border-slate-200 bg-white p-6 shadow-sm sm:p-8">
          <h1 className="text-2xl font-bold text-slate-900">{BOOK_BY_ID[bookId]?.name} {chapter}</h1>
          {data === undefined && <p className="mt-4 text-slate-500">Chargement…</p>}
          {data && data.verses.length === 0 && <p className="mt-4 text-slate-500">Ce chapitre n’est pas disponible dans cette édition.</p>}
          <div className="mt-4 text-slate-800" style={{ fontSize: `${fontSize}px`, lineHeight: 1.85 }}>
            {data?.verses.map((v) => (
              <span key={v.verse} id={`v${v.verse}`}>
                <button type="button" onClick={() => toggle(v.verse)} aria-pressed={selected.includes(v.verse)}
                  className={`mr-1 rounded px-1 text-left align-baseline transition ${selected.includes(v.verse) ? "bg-violet-100" : highlight === v.verse ? "bg-amber-100" : "hover:bg-slate-50"}`}>
                  <sup className="mr-1 text-[0.6em] font-bold text-violet-600">{v.verse}</sup>{v.text}
                </button>{" "}
              </span>
            ))}
          </div>
          <p className="mt-6 text-xs text-slate-400">
            {translation.name} — {translation.license.status === "public_domain" ? "domaine public" : translation.license.status === "licensed" ? "sous licence" : "corpus de démonstration"} · {translation.license.holder} · source : {translation.license.source}
          </p>
          <div className="mt-4 flex justify-between text-sm font-semibold text-violet-600">
            <button type="button" disabled={chapter <= 1} onClick={() => go(bookId, chapter - 1)} className="disabled:opacity-30">← Chapitre précédent</button>
            <button type="button" disabled={chapter >= maxChapter} onClick={() => go(bookId, chapter + 1)} className="disabled:opacity-30">Chapitre suivant →</button>
          </div>
        </article>

        {range && (
          <div role="toolbar" aria-label="Actions sur le passage sélectionné" className="sticky bottom-4 mt-4 flex flex-wrap items-center gap-2 rounded-2xl border border-violet-200 bg-white p-3 shadow-lg">
            <span className="mr-2 text-sm font-bold text-slate-800">{label}</span>
            <Btn onClick={copy}>Copier</Btn><Btn onClick={share}>Partager</Btn><Btn onClick={fav}>Favori</Btn>
            <Link href={`/creation-sermon?passage=${encodeURIComponent(label)}`} className="rounded-lg bg-violet-600 px-3 py-2 text-sm font-bold text-white">Préparer un sermon</Link>
            <Btn onClick={() => setSelected([])}>Désélectionner</Btn>
          </div>
        )}
        {message && <p role="status" className="mt-2 text-sm text-emerald-700">{message}</p>}
        {range && <NoteBox key={label} translationId={translation.id} bookId={bookId} chapter={chapter} range={range} notes={notes} />}
      </section>

      <aside className="space-y-5" aria-label="Recherche et favoris">
        <form onSubmit={(e) => { e.preventDefault(); setSubmitted(query.trim()); }} className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
          <label className="block text-sm font-bold text-slate-900">Rechercher
            <input value={query} onChange={(e) => setQuery(e.target.value)} placeholder="Jean 3:16 ou un mot…" maxLength={200} className="mt-2 h-11 w-full rounded-xl border border-slate-200 px-3 text-sm font-normal" />
          </label>
          <button type="submit" className="mt-2 h-10 w-full rounded-xl bg-violet-600 text-sm font-bold text-white">Rechercher</button>
          {submitted && results === undefined && <p className="mt-3 text-sm text-slate-500">Recherche…</p>}
          {results?.kind === "reference" && (
            <div className="mt-3 text-sm">
              {results.verses.length ? <button type="button" onClick={() => go(results.ref.bookId, results.ref.chapter, results.ref.verseStart)} className="font-semibold text-violet-600">Ouvrir {results.label}</button> : <p className="text-slate-500">« {results.label} » n’existe pas dans cette édition.</p>}
            </div>
          )}
          {results?.kind === "text" && (
            <ul className="mt-3 max-h-96 space-y-3 overflow-y-auto text-sm">
              {results.results.length === 0 && <li className="text-slate-500">Aucun résultat.</li>}
              {results.results.map((r) => (
                <li key={`${r.bookId}-${r.chapter}-${r.verse}`}>
                  <button type="button" onClick={() => go(r.bookId, r.chapter, r.verse)} className="text-left"><span className="font-semibold text-violet-600">{r.bookName} {r.chapter}:{r.verse}</span><span className="block text-slate-600">{r.text}</span></button>
                </li>
              ))}
            </ul>
          )}
        </form>

        <section className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
          <h2 className="text-sm font-bold text-slate-900">Favoris</h2>
          {favorites?.length === 0 && <p className="mt-2 text-sm text-slate-500">Sélectionnez des versets puis « Favori ».</p>}
          <ul className="mt-2 space-y-1 text-sm">
            {favorites?.map((f) => (
              <li key={f._id}><button type="button" onClick={() => go(f.bookId, f.chapter, f.verseStart)} className="font-semibold text-violet-600">{f.bookName} {f.chapter}:{f.verseStart}{f.verseEnd !== f.verseStart ? `-${f.verseEnd}` : ""}</button></li>
            ))}
          </ul>
        </section>
      </aside>
    </div>
  );
}

function Select({ label, value, onChange, options }) {
  return (
    <label className="text-xs font-semibold text-slate-500">{label}
      <select value={value ?? ""} onChange={(e) => onChange(e.target.value)} className="mt-1 block h-10 rounded-lg border border-slate-200 bg-white px-2 text-sm font-normal text-slate-900">
        {options.map(([v, l]) => <option key={v} value={v}>{l}</option>)}
      </select>
    </label>
  );
}
const Btn = ({ onClick, children }) => <button type="button" onClick={onClick} className="rounded-lg border border-slate-200 px-3 py-2 text-sm font-semibold text-slate-700 hover:bg-slate-50">{children}</button>;

function NoteBox({ translationId, bookId, chapter, range, notes }) {
  const save = useMutation(api.bible.saveNote);
  const del = useMutation(api.bible.deleteNote);
  const [body, setBody] = useState("");
  const [error, setError] = useState(null);
  const here = (notes ?? []).filter((n) => n.verseStart <= range[1] && n.verseEnd >= range[0]);
  return (
    <section className="mt-4 rounded-2xl border border-slate-200 bg-white p-4" aria-label="Notes personnelles">
      <h2 className="text-sm font-bold text-slate-900">Mes notes sur ce passage</h2>
      <ul className="mt-2 space-y-2 text-sm text-slate-700">
        {here.map((n) => <li key={n._id} className="flex justify-between gap-3 rounded-lg bg-slate-50 p-2"><span>{n.body}</span><button type="button" onClick={() => del({ noteId: n._id })} className="shrink-0 text-xs font-semibold text-red-500">Supprimer</button></li>)}
      </ul>
      <textarea value={body} onChange={(e) => setBody(e.target.value)} rows={3} maxLength={5000} placeholder="Ajouter une note…" className="mt-2 w-full rounded-lg border border-slate-200 p-2 text-sm" />
      {error && <p role="alert" className="text-sm text-red-600">{error}</p>}
      <button type="button" disabled={!body.trim()} onClick={async () => { try { await save({ translationId, bookId, chapter, verseStart: range[0], verseEnd: range[1], body }); setBody(""); setError(null); } catch { setError("Impossible d’enregistrer la note."); } }} className="mt-2 rounded-lg bg-violet-600 px-4 py-2 text-sm font-bold text-white disabled:opacity-50">Enregistrer la note</button>
    </section>
  );
}
