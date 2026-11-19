"use client";

import { useState } from "react";
import { useAction } from "convex/react";
import { api } from "@/convex/_generated/api";
import { errorMessage } from "@/lib/sermonForm";

const toParagraphs = (t) => t.split(/\n{2,}/).map((p) => p.trim()).filter(Boolean);
const toLines = (t) => t.split("\n").map((p) => p.trim()).filter(Boolean);
const EMPTY_POINT = { title: "", scriptureRef: "", paragraphs: [], keyPoint: "", illustration: "", application: "", transition: "" };

const AI_ACTIONS = [
  ["regenerate", "Réécrire"], ["expand", "Développer"], ["shorten", "Résumer"],
  ["simplify", "Simplifier"], ["illustrate", "Ajouter une illustration"], ["tone", "Changer le ton"],
];
const AI_PATHS = new Set(["introduction", "context", "conclusion", "applications", "reflectionQuestions"]);

/**
 * Éditeur d'une partie. `value` est la valeur actuelle ; `onSave(nouvelleValeur)` persiste (ou lève une erreur).
 * Rien n'est enregistré avant « Enregistrer » : une proposition IA remplit seulement le brouillon.
 */
export default function SectionEditor({ sermonId, path, value, isNew = false, onSave, onCancel }) {
  const suggest = useAction(api.generation.suggestSection);
  const canAi = !isNew && (AI_PATHS.has(path) || /^points\.\d+$/.test(path));
  const [draft, setDraft] = useState(() => init(path, value));
  const [instruction, setInstruction] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState(null);

  const set = (patch) => setDraft((d) => ({ ...d, ...patch }));

  const save = async () => {
    setBusy(true); setError(null);
    try { await onSave(build(path, draft)); }
    catch (e) { setError(errorMessage(e)); setBusy(false); }
  };

  const ask = async (action) => {
    setBusy(true); setError(null);
    try {
      const { value: proposal } = await suggest({ id: sermonId, path, action, instruction });
      setDraft(init(path, proposal));
    } catch (e) { setError(errorMessage(e)); }
    setBusy(false);
  };

  return (
    <div className="space-y-4 rounded-2xl border border-violet-200 bg-violet-50/40 p-4 print:hidden">
      {renderFields(path, draft, set)}
      {canAi && (
        <div className="rounded-xl border border-slate-200 bg-white p-3">
          <p className="text-xs font-semibold text-slate-500">Assistant IA — la proposition remplit le brouillon, rien n’est enregistré tant que vous ne cliquez pas sur « Enregistrer ».</p>
          <input value={instruction} onChange={(e) => setInstruction(e.target.value)} placeholder="Consigne (facultatif) : plus court, ton plus doux…" maxLength={800}
            className="mt-2 h-10 w-full rounded-lg border border-slate-200 px-3 text-sm" aria-label="Consigne pour l'assistant" />
          <div className="mt-2 flex flex-wrap gap-2">
            {AI_ACTIONS.map(([a, label]) => (
              <button key={a} type="button" disabled={busy} onClick={() => ask(a)} className="rounded-lg border border-slate-200 px-3 py-1.5 text-xs font-semibold text-slate-600 hover:bg-slate-50 disabled:opacity-50">{label}</button>
            ))}
          </div>
        </div>
      )}
      {error && <p role="alert" className="rounded-lg bg-red-50 px-3 py-2 text-sm text-red-700">{error}</p>}
      <div className="flex gap-2">
        <button type="button" disabled={busy} onClick={save} className="rounded-xl bg-violet-600 px-4 py-2 text-sm font-bold text-white disabled:opacity-60">{busy ? "…" : "Enregistrer"}</button>
        <button type="button" disabled={busy} onClick={onCancel} className="rounded-xl border border-slate-200 px-4 py-2 text-sm font-semibold text-slate-600">Annuler</button>
      </div>
    </div>
  );
}

function init(path, v) {
  if (["title", "theme", "objective", "centralIdea"].includes(path)) return { text: v ?? "" };
  if (path === "introduction" || path === "context") return { text: (v?.paragraphs ?? []).join("\n\n") };
  if (path === "conclusion") return { text: (v?.paragraphs ?? []).join("\n\n"), call: v?.call ?? "" };
  if (path === "applications") return { items: (v ?? []).map((a) => ({ ...a })) };
  if (path === "reflectionQuestions" || path === "relatedReferences") return { text: (v ?? []).join("\n") };
  const p = { ...EMPTY_POINT, ...(v ?? {}) };
  return { ...p, text: (p.paragraphs ?? []).join("\n\n") };
}

function build(path, d) {
  if (["title", "theme", "objective", "centralIdea"].includes(path)) return d.text.trim();
  if (path === "introduction" || path === "context") return { paragraphs: toParagraphs(d.text) };
  if (path === "conclusion") return { paragraphs: toParagraphs(d.text), call: d.call.trim() };
  if (path === "applications") return d.items.filter((a) => a.title.trim() || a.text.trim()).map((a) => ({ title: a.title.trim(), text: a.text.trim() }));
  if (path === "reflectionQuestions" || path === "relatedReferences") return toLines(d.text);
  const { text, ...rest } = d;
  return { ...rest, paragraphs: toParagraphs(text) };
}

const inputCls = "w-full rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm text-slate-900 outline-none focus:border-violet-500";
function Field({ label, children }) { return <label className="block text-xs font-semibold text-slate-500">{label}<div className="mt-1 font-normal">{children}</div></label>; }
function Area({ label, value, onChange, rows = 6 }) { return <Field label={label}><textarea rows={rows} value={value} onChange={(e) => onChange(e.target.value)} className={`${inputCls} leading-6`} /></Field>; }

function renderFields(path, d, set) {
  if (["title", "theme", "objective", "centralIdea"].includes(path)) return <Area label="Texte" rows={path === "title" ? 2 : 3} value={d.text} onChange={(text) => set({ text })} />;
  if (path === "introduction" || path === "context") return <Area label="Paragraphes (séparés par une ligne vide)" value={d.text} onChange={(text) => set({ text })} />;
  if (path === "conclusion") return (<><Area label="Paragraphes (séparés par une ligne vide)" value={d.text} onChange={(text) => set({ text })} /><Area label="Appel ou invitation (facultatif)" rows={3} value={d.call} onChange={(call) => set({ call })} /></>);
  if (path === "reflectionQuestions") return <Area label="Une question par ligne" value={d.text} onChange={(text) => set({ text })} />;
  if (path === "relatedReferences") return <Area label="Une référence par ligne (ex. Romains 8:28)" rows={4} value={d.text} onChange={(text) => set({ text })} />;
  if (path === "applications") {
    return (
      <div className="space-y-3">
        {d.items.map((a, i) => (
          <div key={i} className="rounded-xl border border-slate-200 bg-white p-3">
            <Field label={`Application ${i + 1} — titre`}><input value={a.title} onChange={(e) => set({ items: d.items.map((x, j) => (j === i ? { ...x, title: e.target.value } : x)) })} className={inputCls} /></Field>
            <Area label="Texte" rows={3} value={a.text} onChange={(text) => set({ items: d.items.map((x, j) => (j === i ? { ...x, text } : x)) })} />
            <button type="button" onClick={() => set({ items: d.items.filter((_, j) => j !== i) })} className="mt-2 text-xs font-semibold text-red-600">Retirer</button>
          </div>
        ))}
        <button type="button" onClick={() => set({ items: [...d.items, { title: "", text: "" }] })} className="text-sm font-semibold text-violet-600">+ Ajouter une application</button>
      </div>
    );
  }
  return (
    <div className="space-y-3">
      <Field label="Titre du point"><input value={d.title} onChange={(e) => set({ title: e.target.value })} className={inputCls} /></Field>
      <Field label="Passage qui fonde ce point (ex. Jean 3:16)"><input value={d.scriptureRef} onChange={(e) => set({ scriptureRef: e.target.value })} className={inputCls} /></Field>
      <Area label="Développement (paragraphes séparés par une ligne vide)" value={d.text} onChange={(text) => set({ text })} />
      <Area label="Idée clé" rows={2} value={d.keyPoint} onChange={(keyPoint) => set({ keyPoint })} />
      <Area label="Illustration (facultatif)" rows={3} value={d.illustration} onChange={(illustration) => set({ illustration })} />
      <Area label="Application (facultatif)" rows={3} value={d.application} onChange={(application) => set({ application })} />
      <Area label="Transition (facultatif)" rows={2} value={d.transition} onChange={(transition) => set({ transition })} />
    </div>
  );
}
