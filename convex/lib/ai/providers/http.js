import { AiError } from "../errors.js";

/** POST JSON avec délai d'expiration et signal d'annulation externe. Ne journalise jamais le contenu. */
export async function postJson(url, { headers, body, timeoutMs, signal, fetchImpl = fetch }) {
  const timeout = AbortSignal.timeout(timeoutMs);
  const combined = signal ? AbortSignal.any([timeout, signal]) : timeout;
  let response;
  try {
    response = await fetchImpl(url, {
      method: "POST",
      headers: { "Content-Type": "application/json", ...headers },
      body: JSON.stringify(body),
      signal: combined,
    });
  } catch (error) {
    if (timeout.aborted) throw new AiError("timeout", "Délai dépassé.", { cause: error });
    if (signal?.aborted) throw new AiError("aborted", "Génération interrompue.", { cause: error, retryable: false });
    throw new AiError("unavailable", "Service IA injoignable.", { cause: error });
  }
  if (!response.ok) {
    const detail = (await response.text().catch(() => "")).slice(0, 200);
    const code = response.status === 401 || response.status === 403 ? "config" : "unavailable";
    throw new AiError(code, `Le service IA a répondu ${response.status}. ${detail}`, { retryable: code !== "config" });
  }
  try {
    return await response.json();
  } catch (error) {
    throw new AiError("bad_response", "Réponse du service IA illisible.", { cause: error });
  }
}
