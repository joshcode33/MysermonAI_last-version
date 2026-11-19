/** Codes : config | unavailable | timeout | aborted | bad_response | validation | quota */
export class AiError extends Error {
  constructor(code, message, options = {}) {
    super(message);
    this.name = "AiError";
    this.code = code;
    this.retryable = options.retryable ?? ["unavailable", "timeout", "bad_response"].includes(code);
    if (options.cause) this.cause = options.cause;
  }
}

/** Message affichable à l'utilisateur, sans détail interne. */
export function publicMessage(error) {
  if (!(error instanceof AiError)) return "Une erreur inattendue est survenue. Réessayez dans un instant.";
  switch (error.code) {
    case "unavailable": return "Le moteur IA est momentanément indisponible. Votre quota n'a pas été consommé, réessayez dans quelques minutes.";
    case "timeout": return "La génération a pris trop de temps. Essayez avec une durée plus courte ou un niveau de détail réduit.";
    case "bad_response": return "Le moteur IA a renvoyé une réponse inexploitable. Réessayez ; si le problème persiste, simplifiez votre demande.";
    case "config": return "Le service IA n'est pas configuré correctement. Contactez l'administrateur.";
    case "aborted": return "Génération interrompue.";
    case "validation": return error.message;
    case "quota": return error.message;
    default: return "Une erreur inattendue est survenue.";
  }
}
