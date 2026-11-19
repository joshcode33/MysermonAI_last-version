import Link from "next/link";
export default function HomePage() {
  return (
    <main className="flex min-h-screen items-center justify-center bg-slate-950 px-6">

      <div className="text-center">

        <div className="mb-6 text-5xl">
          ✨
        </div>

        <h1 className="text-5xl font-bold text-white">
          MySermon
          <span className="text-violet-400">
            {" "}AI
          </span>
        </h1>

        <p className="mx-auto mt-4 max-w-md text-slate-400">
          Votre assistant intelligent pour préparer
          vos prédications.
        </p>

        <div className="mt-8 flex justify-center gap-3">

          <Link
            href="/Connexion"
            className="
              rounded-xl
              bg-violet-600
              px-6 py-3
              text-sm font-bold
              text-white
              transition
              hover:bg-violet-700
            "
          >
            Se connecter
          </Link>

          <Link
            href="/inscription"
            className="
              rounded-xl
              border border-white/10
              px-6 py-3
              text-sm font-bold
              text-white
              transition
              hover:bg-white/5
            "
          >
            Créer un compte
          </Link>

        </div>

      </div>

    </main>
  );
}
