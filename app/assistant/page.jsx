"use client";

import { useEffect, useRef, useState } from "react";
import { useAction, useMutation, useQuery } from "convex/react";
import { api } from "@/convex/_generated/api";
import AppShell from "@/components/AppShell";
import { errorMessage } from "@/lib/sermonForm";

const SUGGESTIONS = [
  "Recherche des passages bibliques sur la grâce.",
  "Explique le contexte immédiat de Jean 3:16.",
  "Aide-moi à préparer un plan de sermon sur le pardon.",
  "Vérifie les références bibliques de ma question.",
];

export default function AssistantPage() {
  const conversations = useQuery(api.assistant.conversations);
  const createConversation = useMutation(api.assistant.createConversation);
  const sendMessage = useAction(api.assistant.sendMessage);
  const [threadId, setThreadId] = useState(null);
  const [draft, setDraft] = useState("");
  const [pending, setPending] = useState(false);
  const [notice, setNotice] = useState(null);
  const [citations, setCitations] = useState([]);
  const [warnings, setWarnings] = useState([]);
  const activeThreadId = threadId ?? conversations?.[0]?.id ?? null;
  const messages = useQuery(api.assistant.messages, activeThreadId ? { threadId: activeThreadId } : "skip");
  const createdRef = useRef(false);
  const endRef = useRef(null);

  useEffect(() => {
    if (!conversations || conversations.length > 0) return;
    if (createdRef.current) return;
    createdRef.current = true;
    createConversation({}).then(setThreadId).catch((error) => {
      createdRef.current = false;
      setNotice(errorMessage(error));
    });
  }, [conversations, createConversation]);

  useEffect(() => {
    endRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages?.length, pending]);

  const startConversation = async () => {
    setNotice(null);
    setCitations([]);
    setWarnings([]);
    try {
      const id = await createConversation({});
      setThreadId(id);
    } catch (error) {
      setNotice(errorMessage(error));
    }
  };

  const submit = async (event) => {
    event.preventDefault();
    const prompt = draft.trim();
    if (!prompt || !activeThreadId || pending) return;
    setDraft("");
    setPending(true);
    setNotice(null);
    setCitations([]);
    setWarnings([]);
    try {
      const result = await sendMessage({ threadId: activeThreadId, prompt });
      setCitations(result.citations ?? []);
      setWarnings(result.warnings ?? []);
    } catch (error) {
      setNotice(errorMessage(error));
      setDraft(prompt);
    } finally {
      setPending(false);
    }
  };

  return (
    <AppShell wide>
      <div className="grid gap-6 lg:grid-cols-[260px_minmax(0,1fr)]">
        <aside className="rounded-2xl border border-slate-200 bg-white p-4">
          <div className="flex items-center justify-between gap-2">
            <h1 className="font-bold text-slate-900">Conversations</h1>
            <button type="button" onClick={startConversation} className="rounded-lg bg-violet-600 px-3 py-2 text-xs font-bold text-white">
              Nouvelle
            </button>
          </div>
          <ul className="mt-4 space-y-1">
            {conversations?.map((conversation) => (
              <li key={conversation.id}>
                <button type="button" onClick={() => { setThreadId(conversation.id); setCitations([]); setWarnings([]); }}
                  className={`w-full rounded-lg px-3 py-2 text-left text-sm ${conversation.id === activeThreadId ? "bg-violet-50 font-semibold text-violet-800" : "text-slate-600 hover:bg-slate-50"}`}>
                  <span className="block truncate">{conversation.title}</span>
                  <span className="mt-1 block text-xs text-slate-400">{new Date(conversation.updatedAt).toLocaleDateString("fr-FR")}</span>
                </button>
              </li>
            ))}
          </ul>
        </aside>

        <section className="flex min-h-[70vh] flex-col overflow-hidden rounded-2xl border border-slate-200 bg-white">
          <header className="border-b border-slate-100 px-5 py-4">
            <h2 className="font-bold text-slate-900">Assistant biblique et pastoral</h2>
            <p className="mt-1 text-xs text-slate-500">Les références et citations sont vérifiées dans les éditions disponibles. Les interprétations restent à discerner.</p>
          </header>

          <div className="flex-1 space-y-5 overflow-y-auto p-5">
            {messages?.length === 0 && (
              <div>
                <p className="text-sm text-slate-600">Comment puis-je vous aider dans votre étude ou préparation ?</p>
                <div className="mt-4 flex flex-wrap gap-2">
                  {SUGGESTIONS.map((suggestion) => (
                    <button key={suggestion} type="button" onClick={() => setDraft(suggestion)}
                      className="rounded-full border border-slate-200 px-3 py-2 text-left text-xs text-slate-600 hover:border-violet-300 hover:text-violet-700">
                      {suggestion}
                    </button>
                  ))}
                </div>
              </div>
            )}
            {messages === undefined && <p className="text-sm text-slate-400">Chargement…</p>}
            {messages?.map((message, index) => (
              <article key={`${message.createdAt}-${index}`} className={`max-w-3xl rounded-2xl px-4 py-3 text-sm leading-7 ${message.role === "user" ? "ml-auto bg-violet-600 text-white" : "bg-slate-50 text-slate-700"}`}>
                <p className="whitespace-pre-wrap">{message.content}</p>
              </article>
            ))}
            {pending && <p role="status" className="text-sm text-slate-400">Recherche et préparation de la réponse…</p>}
            {warnings.map((warning, index) => <p key={index} role="note" className="rounded-xl bg-amber-50 px-4 py-3 text-xs text-amber-800">{warning.message}</p>)}
            {citations.map((source, index) => (
              <article key={`${source.reference}-${index}`} className="rounded-xl border border-slate-200 bg-white p-4">
                <div className="flex flex-wrap items-center gap-2">
                  <strong className="text-sm text-slate-800">{source.reference}</strong>
                  {(source.translationName || source.translationCode) && (
                    <span className="text-xs text-slate-500">
                      {source.translationName || source.translationCode}
                      {source.translationName && source.translationCode ? ` (${source.translationCode})` : ""}
                    </span>
                  )}
                  <span className={`rounded-full px-2 py-0.5 text-xs ${source.status === "verified" ? "bg-emerald-50 text-emerald-700" : "bg-amber-50 text-amber-700"}`}>
                    {source.status === "verified" ? "Vérifiée dans l'édition disponible" : "À vérifier"}
                  </span>
                </div>
                {source.verses?.length > 0 && <p className="mt-2 text-sm leading-6 text-slate-600">{source.verses.map((verse) => `${verse.verse}. ${verse.text}`).join(" ")}</p>}
              </article>
            ))}
            <div ref={endRef} />
          </div>

          {notice && <p role="alert" className="mx-5 mb-3 rounded-xl bg-red-50 px-4 py-3 text-sm text-red-700">{notice}</p>}
          <form onSubmit={submit} className="border-t border-slate-100 p-4">
            <label htmlFor="assistant-prompt" className="sr-only">Votre question</label>
            <div className="flex items-end gap-3">
              <textarea id="assistant-prompt" value={draft} onChange={(event) => setDraft(event.target.value)} maxLength={4000} rows={3}
                placeholder="Posez une question biblique ou pastorale…" className="min-h-12 flex-1 resize-y rounded-xl border border-slate-200 p-3 text-sm outline-none focus:border-violet-500" />
              <button type="submit" disabled={!draft.trim() || !activeThreadId || pending}
                className="rounded-xl bg-violet-600 px-5 py-3 text-sm font-bold text-white disabled:opacity-50">
                Envoyer
              </button>
            </div>
          </form>
        </section>
      </div>
    </AppShell>
  );
}
